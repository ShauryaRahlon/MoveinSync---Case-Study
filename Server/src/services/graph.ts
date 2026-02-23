import prisma from '../db';
import redis from './redis';

// ─── TYPES ──────────────────────────────────────────────────────

// An edge in our graph: "from stop X, you can go to stop Y on this route"
interface Edge {
    toStopId: string;
    routeId: string;
    weight: number; // cost to travel this edge (default: 1)
}

// What we track for each step in Dijkstra's algorithm
interface DijkstraState {
    stopId: string;
    routeId: string;     // which metro line we're currently on
    cost: number;
    path: PathStep[];    // full journey so far
}

// One step in the journey
interface PathStep {
    stopId: string;
    stopName: string;
    routeId: string;
    routeName: string;
    routeColor: string;
}

// A segment of the journey on one metro line
interface RouteSegment {
    line: { id: string; name: string; color: string };
    from: string;
    to: string;
    stops: string[];
    stopCount: number;
}

// Interchange point between two lines
interface InterchangePoint {
    interchange: string;
    fromLine: string;
    toLine: string;
}

// The final result returned to the user
export interface RouteResult {
    source: string;
    destination: string;
    totalStops: number;
    totalTransfers: number;
    segments: (RouteSegment | InterchangePoint)[];
}

// Optimization strategies
export enum OptimizationStrategy {
    MINIMUM_STOPS = 'minimum_stops',
    MINIMUM_TRANSFERS = 'minimum_transfers',
    BALANCED = 'balanced',
}

// ─── GRAPH STORAGE (in-memory) ──────────────────────────────────

// The adjacency list: stopId → list of edges going out from that stop
let graph: Map<string, Edge[]> = new Map();

// Lookup tables so we don't need to query DB during pathfinding
let stopNames: Map<string, string> = new Map();   // stopId → name
let stopIds: Map<string, string> = new Map();      // name → stopId
let routeNames: Map<string, string> = new Map();   // routeId → name
let routeColors: Map<string, string> = new Map();  // routeId → color

// ─── BUILD THE GRAPH ────────────────────────────────────────────

/**
 * Loads all routes and stops from the database and builds 
 * an in-memory graph. Call this on server startup and
 * whenever an admin updates metro data.
 */
export async function buildGraph(): Promise<void> {
    // Reset everything
    graph = new Map();
    stopNames = new Map();
    stopIds = new Map();
    routeNames = new Map();
    routeColors = new Map();

    // Load all routes with their stops in order
    const routes = await prisma.route.findMany({
        include: {
            stops: {
                include: { stop: true },
                orderBy: { sequenceOrder: 'asc' },
            },
        },
    });

    // Build lookup tables
    for (const route of routes) {
        routeNames.set(route.id, route.name);
        routeColors.set(route.id, route.color);

        for (const rs of route.stops) {
            stopNames.set(rs.stop.id, rs.stop.name);
            stopIds.set(rs.stop.name, rs.stop.id);
        }
    }

    // Build edges: connect consecutive stops on each route
    for (const route of routes) {
        const orderedStops = route.stops;

        for (let i = 0; i < orderedStops.length - 1; i++) {
            const currentStop = orderedStops[i]!;
            const nextStop = orderedStops[i + 1]!;

            // Add edge: current → next
            addEdge(currentStop.stopId, nextStop.stopId, route.id);

            // Add edge: next → current (metro goes both directions)
            addEdge(nextStop.stopId, currentStop.stopId, route.id);
        }
    }

    const stopCount = stopNames.size;
    const edgeCount = Array.from(graph.values()).reduce((sum, edges) => sum + edges.length, 0);
    console.log(`[Graph] Built with ${stopCount} stops and ${edgeCount} edges`);

    const keys = await redis.keys('route:*')

    if (keys.length > 0) {
        await redis.del(...keys)
        console.log(`graph cleared ${keys.length} cached routes`)
    }
}

/**
 * Helper: add one edge to the adjacency list
 */
function addEdge(fromStopId: string, toStopId: string, routeId: string): void {
    if (!graph.has(fromStopId)) {
        graph.set(fromStopId, []);
    }
    graph.get(fromStopId)!.push({
        toStopId,
        routeId,
        weight: 1,
    });
}

// ─── DIJKSTRA'S ALGORITHM ───────────────────────────────────────

/**
 * Find the optimal route between two stops.
 * 
 * How it works:
 * 1. Start at the source stop (on any route that passes through it)
 * 2. Explore neighbors, tracking which metro line we're on
 * 3. When we switch lines at an interchange, add a transfer penalty
 * 4. Return the cheapest path to the destination
 */
export function findOptimalRoute(
    sourceStopId: string,
    destStopId: string,
    strategy: OptimizationStrategy = OptimizationStrategy.BALANCED
): RouteResult | null {

    // Pick costs based on strategy
    const { stopCost, transferPenalty } = getStrategyCosts(strategy);

    // Priority queue (simple sorted array — good enough for metro-sized graphs)
    const queue: DijkstraState[] = [];

    // Track the best cost to reach each (stopId + routeId) combination
    // Key format: "stopId:routeId"
    const visited = new Map<string, number>();

    // Start: add the source stop on every route that passes through it
    const sourceEdges = graph.get(sourceStopId);
    if (!sourceEdges) return null;

    // Find all routes that pass through the source stop
    const startRoutes = new Set<string>();
    for (const edge of sourceEdges) {
        startRoutes.add(edge.routeId);
    }

    // Add a starting state for each route at the source
    for (const routeId of startRoutes) {
        queue.push({
            stopId: sourceStopId,
            routeId: routeId,
            cost: 0,
            path: [{
                stopId: sourceStopId,
                stopName: stopNames.get(sourceStopId) || 'Unknown',
                routeId: routeId,
                routeName: routeNames.get(routeId) || 'Unknown',
                routeColor: routeColors.get(routeId) || '#000',
            }],
        });
    }

    // Process the queue
    while (queue.length > 0) {
        // Sort by cost and pick the cheapest (simple priority queue)
        queue.sort((a, b) => a.cost - b.cost);
        const current = queue.shift()!;

        // Have we reached the destination?
        if (current.stopId === destStopId) {
            return formatResult(current.path);
        }

        // Skip if we've already found a cheaper way to this (stop, route) pair
        const stateKey = `${current.stopId}:${current.routeId}`;
        const previousCost = visited.get(stateKey);
        if (previousCost !== undefined && previousCost <= current.cost) {
            continue;
        }
        visited.set(stateKey, current.cost);

        // Explore all neighbors
        const edges = graph.get(current.stopId) || [];
        for (const edge of edges) {
            // Calculate the cost to travel this edge
            let edgeCost = stopCost;

            // If we're switching metro lines, add the transfer penalty
            const isTransfer = edge.routeId !== current.routeId;
            if (isTransfer) {
                edgeCost += transferPenalty;
            }

            const newCost = current.cost + edgeCost;

            // Skip if we already found a cheaper way
            const nextKey = `${edge.toStopId}:${edge.routeId}`;
            const nextPrevCost = visited.get(nextKey);
            if (nextPrevCost !== undefined && nextPrevCost <= newCost) {
                continue;
            }

            // Add to queue with updated path
            queue.push({
                stopId: edge.toStopId,
                routeId: edge.routeId,
                cost: newCost,
                path: [...current.path, {
                    stopId: edge.toStopId,
                    stopName: stopNames.get(edge.toStopId) || 'Unknown',
                    routeId: edge.routeId,
                    routeName: routeNames.get(edge.routeId) || 'Unknown',
                    routeColor: routeColors.get(edge.routeId) || '#000',
                }],
            });
        }
    }

    // No path found
    return null;
}

// ─── STRATEGY COSTS ─────────────────────────────────────────────

/**
 * Returns the per-stop cost and transfer penalty for each strategy.
 * 
 * MINIMUM_STOPS:     Just count stops, ignore transfers
 * MINIMUM_TRANSFERS: Heavily penalize transfers, stops are free
 * BALANCED:          Count stops + add penalty for transfers
 */
function getStrategyCosts(strategy: OptimizationStrategy) {
    switch (strategy) {
        case OptimizationStrategy.MINIMUM_STOPS:
            return { stopCost: 1, transferPenalty: 0 };

        case OptimizationStrategy.MINIMUM_TRANSFERS:
            return { stopCost: 0, transferPenalty: 100 };

        case OptimizationStrategy.BALANCED:
            return { stopCost: 1, transferPenalty: 5 };

        default:
            return { stopCost: 1, transferPenalty: 5 };
    }
}

// ─── FORMAT THE RESULT ──────────────────────────────────────────

/**
 * Takes the raw path (list of stops with their routes) and formats
 * it into clear segments showing which line you're on and where
 * you transfer.
 */
function formatResult(path: PathStep[]): RouteResult {
    if (path.length === 0) {
        return { source: '', destination: '', totalStops: 0, totalTransfers: 0, segments: [] };
    }

    const segments: (RouteSegment | InterchangePoint)[] = [];
    let transfers = 0;

    // Group consecutive stops on the same route into segments
    let segmentStops: string[] = [path[0]!.stopName];
    let currentRoute = path[0]!;

    for (let i = 1; i < path.length; i++) {
        const step = path[i]!;

        if (step.routeId === currentRoute.routeId) {
            // Same line — keep adding stops to current segment
            segmentStops.push(step.stopName);
        } else {
            // Line change! Save the current segment
            segments.push({
                line: {
                    id: currentRoute.routeId,
                    name: currentRoute.routeName,
                    color: currentRoute.routeColor,
                },
                from: segmentStops[0]!,
                to: segmentStops[segmentStops.length - 1]!,
                stops: [...segmentStops],
                stopCount: segmentStops.length,
            });

            // Add the interchange marker
            segments.push({
                interchange: step.stopName,
                fromLine: currentRoute.routeName,
                toLine: step.routeName,
            });
            transfers++;

            // Start a new segment (interchange stop is on both lines)
            segmentStops = [step.stopName];
            currentRoute = step;
        }
    }

    // Don't forget the last segment
    if (segmentStops.length > 0) {
        segments.push({
            line: {
                id: currentRoute.routeId,
                name: currentRoute.routeName,
                color: currentRoute.routeColor,
            },
            from: segmentStops[0]!,
            to: segmentStops[segmentStops.length - 1]!,
            stops: [...segmentStops],
            stopCount: segmentStops.length,
        });
    }

    return {
        source: path[0]!.stopName,
        destination: path[path.length - 1]!.stopName,
        totalStops: path.length,
        totalTransfers: transfers,
        segments,
    };
}

// ─── HELPER: check if graph is loaded ───────────────────────────

export function isGraphReady(): boolean {
    return graph.size > 0;
}

// ─── HELPER: get stop ID from name ──────────────────────────────

export function getStopIdByName(name: string): string | undefined {
    return stopIds.get(name);
}

// ─── HELPER: check if a stop ID exists in the graph ─────────────

export function stopExistsInGraph(stopId: string): boolean {
    return stopNames.has(stopId);
}

export function getStopName(stopId: string): string | undefined {
    return stopNames.get(stopId);
}

// ─── CACHED ROUTE FINDING ───────────────────────────────────────

/**
 * Wrapper around findOptimalRoute that checks Redis cache first.
 * First request: runs Dijkstra's, stores result in Redis (1 hour TTL)
 * Repeat requests: returns cached result instantly
 */
export async function findOptimalRouteCached(
    sourceStopId: string,
    destStopId: string,
    strategy: OptimizationStrategy = OptimizationStrategy.BALANCED
): Promise<{ result: RouteResult | null; cacheHit: boolean }> {

    // 1. Check Redis cache
    const cacheKey = `route:${sourceStopId}:${destStopId}:${strategy}`;
    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            return { result: JSON.parse(cached), cacheHit: true };
        }
    } catch (err) {
        console.error('[Redis] Cache read error:', err);
    }

    // 2. Cache miss — run Dijkstra's
    const result = findOptimalRoute(sourceStopId, destStopId, strategy);

    // 3. Store in Redis for 1 hour
    if (result) {
        try {
            await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);
        } catch (err) {
            console.error('[Redis] Cache write error:', err);
        }
    }

    return { result, cacheHit: false };
}