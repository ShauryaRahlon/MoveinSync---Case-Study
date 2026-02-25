import prisma from '../db';
import redis from './redis';
import { MinPriorityQueue } from '@datastructures-js/priority-queue';

// ─── TYPES ──────────────────────────────────────────────────────

interface Edge {
    toStopId: string;
    routeId: string;
    weight: number;
}

interface DijkstraState {
    stopId: string;
    routeId: string;
    cost: number;
    path: PathStep[];
}

interface PathStep {
    stopId: string;
    stopName: string;
    routeId: string;
    routeName: string;
    routeColor: string;
}

export interface RouteResult {
    source: string;
    destination: string;
    totalStops: number;
    totalTransfers: number;
    segments: (RouteSegment | InterchangePoint)[];
}

interface RouteSegment {
    line: { id: string; name: string; color: string };
    from: string;
    to: string;
    stops: string[];
    stopCount: number;
}

interface InterchangePoint {
    interchange: string;
    fromLine: string;
    toLine: string;
}

export enum OptimizationStrategy {
    MINIMUM_STOPS = 'minimum_stops',
    MINIMUM_TRANSFERS = 'minimum_transfers',
    BALANCED = 'balanced',
}

// ─── GRAPH STORAGE (in-memory) ──────────────────────────────────

let graph = new Map<string, Edge[]>();
let stopNames = new Map<string, string>();  // stopId  → name
let stopIds = new Map<string, string>();  // name    → stopId
let routeNames = new Map<string, string>();  // routeId → name
let routeColors = new Map<string, string>();  // routeId → color

// ─── BUILD GRAPH ────────────────────────────────────────────────

export async function buildGraph(): Promise<void> {
    graph = new Map(); stopNames = new Map();
    stopIds = new Map(); routeNames = new Map(); routeColors = new Map();

    const routes = await prisma.route.findMany({
        include: {
            stops: {
                include: { stop: true },
                orderBy: { sequenceOrder: 'asc' },
            },
        },
    });

    // Populate lookup maps
    for (const route of routes) {
        routeNames.set(route.id, route.name);
        routeColors.set(route.id, route.color);
        for (const rs of route.stops) {
            stopNames.set(rs.stop.id, rs.stop.name);
            stopIds.set(rs.stop.name, rs.stop.id);
        }
    }

    // Connect consecutive stops in both directions
    for (const route of routes) {
        for (let i = 0; i < route.stops.length - 1; i++) {
            const a = route.stops[i]!.stopId;
            const b = route.stops[i + 1]!.stopId;
            addEdge(a, b, route.id);
            addEdge(b, a, route.id);
        }
    }

    const totalEdges = Array.from(graph.values()).reduce((sum, e) => sum + e.length, 0);
    console.log(`[Graph] Built: ${stopNames.size} stops, ${totalEdges} edges`);

    // Clear Redis route cache since graph changed
    const keys = await redis.keys('route:*');
    if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`[Graph] Cleared ${keys.length} cached routes`);
    }
}

function addEdge(from: string, to: string, routeId: string) {
    if (!graph.has(from)) graph.set(from, []);
    graph.get(from)!.push({ toStopId: to, routeId, weight: 1 });
}

// ─── STRATEGY COSTS ─────────────────────────────────────────────

const STRATEGY_COSTS = {
    [OptimizationStrategy.MINIMUM_STOPS]: { stopCost: 1, transferPenalty: 0 },
    [OptimizationStrategy.MINIMUM_TRANSFERS]: { stopCost: 0, transferPenalty: 100 },
    [OptimizationStrategy.BALANCED]: { stopCost: 1, transferPenalty: 5 },
};

// ─── DIJKSTRA'S ALGORITHM ───────────────────────────────────────

export function findOptimalRoute(
    sourceId: string,
    destId: string,
    strategy: OptimizationStrategy = OptimizationStrategy.BALANCED
): RouteResult | null {

    const { stopCost, transferPenalty } = STRATEGY_COSTS[strategy];

    // MinPriorityQueue from @datastructures-js/priority-queue
    // No custom heap class needed — just pass a comparator function
    const heap = new MinPriorityQueue<DijkstraState>((state) => state.cost);
    const visited = new Map<string, number>();

    const sourceEdges = graph.get(sourceId);
    if (!sourceEdges) return null;

    // Helper: build a PathStep for a given stop + route
    const makeStep = (stopId: string, routeId: string): PathStep => ({
        stopId,
        stopName: stopNames.get(stopId) || 'Unknown',
        routeId,
        routeName: routeNames.get(routeId) || 'Unknown',
        routeColor: routeColors.get(routeId) || '#000000',
    });

    // Push an initial state for every route passing through the source stop
    const startRoutes = new Set(sourceEdges.map(e => e.routeId));
    for (const routeId of startRoutes) {
        heap.push({ stopId: sourceId, routeId, cost: 0, path: [makeStep(sourceId, routeId)] });
    }

    while (!heap.isEmpty()) {
        const curr = heap.pop();

        if (!curr)
            break

        // Reached destination — format and return
        if (curr.stopId === destId) return formatResult(curr.path);

        // Skip if we've already visited this stop+route with a lower cost
        const key = `${curr.stopId}:${curr.routeId}`;
        if ((visited.get(key) ?? Infinity) <= curr.cost) continue;
        visited.set(key, curr.cost);

        for (const edge of graph.get(curr.stopId) || []) {
            const isTransfer = edge.routeId !== curr.routeId;
            const newCost = curr.cost + stopCost + (isTransfer ? transferPenalty : 0);

            const neighborKey = `${edge.toStopId}:${edge.routeId}`;
            if ((visited.get(neighborKey) ?? Infinity) <= newCost) continue;

            heap.push({
                stopId: edge.toStopId,
                routeId: edge.routeId,
                cost: newCost,
                path: [...curr.path, makeStep(edge.toStopId, edge.routeId)],
            });
        }
    }

    return null; // No path found
}

// ─── FORMAT RESULT ──────────────────────────────────────────────

function formatResult(path: PathStep[]): RouteResult {
    if (!path.length) {
        return { source: '', destination: '', totalStops: 0, totalTransfers: 0, segments: [] };
    }

    const segments: (RouteSegment | InterchangePoint)[] = [];
    let transfers = 0;
    let segStops = [path[0]!.stopName];
    let currRoute = path[0]!;

    const pushSegment = () => {
        segments.push({
            line: { id: currRoute.routeId, name: currRoute.routeName, color: currRoute.routeColor },
            from: segStops[0]!,
            to: segStops[segStops.length - 1]!,
            stops: [...segStops],
            stopCount: segStops.length,
        });
    };

    for (let i = 1; i < path.length; i++) {
        const step = path[i]!;

        if (step.routeId === currRoute.routeId) {
            // Same line — just add the stop
            segStops.push(step.stopName);
        } else {
            // Line change — close currrent segment, add interchange, start new segment
            pushSegment();
            segments.push({
                interchange: step.stopName,
                fromLine: currRoute.routeName,
                toLine: step.routeName
            });
            transfers++;
            segStops = [step.stopName];
            currRoute = step;
        }
    }

    pushSegment(); // push final segment

    return {
        source: path[0]!.stopName,
        destination: path[path.length - 1]!.stopName,
        totalStops: path.length,
        totalTransfers: transfers,
        segments,
    };
}

// ─── HELPERS ────────────────────────────────────────────────────

export const isGraphReady = () => graph.size > 0;
export const getStopIdByName = (name: string) => stopIds.get(name);
export const stopExistsInGraph = (id: string) => stopNames.has(id);
export const getStopName = (id: string) => stopNames.get(id);

// ─── CACHED ROUTE FINDING ───────────────────────────────────────

export async function findOptimalRouteCached(
    sourceId: string,
    destId: string,
    strategy: OptimizationStrategy = OptimizationStrategy.BALANCED
): Promise<{ result: RouteResult | null; cacheHit: boolean }> {

    const cacheKey = `route:${sourceId}:${destId}:${strategy}`;

    // Try cache first
    try {
        const cached = await redis.get(cacheKey);
        if (cached) return { result: JSON.parse(cached), cacheHit: true };
    } catch (err) {
        console.error('[Redis] Cache read error:', err);
    }

    // Cache miss — compute route
    const result = findOptimalRoute(sourceId, destId, strategy);

    // Store in cache for 1 hour
    if (result) {
        try {
            await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);
        } catch (err) {
            console.error('[Redis] Cache write error:', err);
        }
    }

    return { result, cacheHit: false };
}

// ─── TIME COMPLEXITY ────────────────────────────────────────────
//
// V = number of stops, E = number of edges, R = number of routes
//
// buildGraph()        → O(V + E)       Load from DB, build adjacency list
// addEdge()           → O(1)           Map insert
// MinHeap.push()      → O(log n)       Bubble up
// MinHeap.pop()       → O(log n)       Sink down
// findOptimalRoute()  → O((V*R) * log(V*R))  Dijkstra's with min-heap
//                       State space is V*R (stop × route combinations)
//                       Each state pushed/popped from heap in O(log(V*R))
// formatResult()      → O(P)           P = path length (linear scan)
// findOptimalRouteCached() → O(1) on cache hit, same as findOptimalRoute on miss
//
// Space: O(V + E) for graph, O(V*R) for Dijkstra's visited set
//