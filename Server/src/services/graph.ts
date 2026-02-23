import prisma from '../db';
import redis from './redis';

// ─── TYPES ──────────────────────────────────────────────────────

interface Edge { toStopId: string; routeId: string; weight: number; }

interface DijkstraState {
    stopId: string;
    routeId: string;
    cost: number;
    path: PathStep[];
}

interface PathStep {
    stopId: string; stopName: string;
    routeId: string; routeName: string; routeColor: string;
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
    from: string; to: string; stops: string[]; stopCount: number;
}

interface InterchangePoint { interchange: string; fromLine: string; toLine: string; }

export enum OptimizationStrategy {
    MINIMUM_STOPS = 'minimum_stops',
    MINIMUM_TRANSFERS = 'minimum_transfers',
    BALANCED = 'balanced',
}

// ─── GRAPH STORAGE (in-memory) ──────────────────────────────────

let graph = new Map<string, Edge[]>();
let stopNames = new Map<string, string>();   // stopId → name
let stopIds = new Map<string, string>();      // name → stopId
let routeNames = new Map<string, string>();   // routeId → name
let routeColors = new Map<string, string>();  // routeId → color

// ─── BUILD GRAPH ────────────────────────────────────────────────

export async function buildGraph(): Promise<void> {
    graph = new Map(); stopNames = new Map(); stopIds = new Map();
    routeNames = new Map(); routeColors = new Map();

    const routes = await prisma.route.findMany({
        include: { stops: { include: { stop: true }, orderBy: { sequenceOrder: 'asc' } } },
    });

    for (const route of routes) {
        routeNames.set(route.id, route.name);
        routeColors.set(route.id, route.color);
        for (const rs of route.stops) {
            stopNames.set(rs.stop.id, rs.stop.name);
            stopIds.set(rs.stop.name, rs.stop.id);
        }
    }

    // Connect consecutive stops (both directions)
    for (const route of routes) {
        for (let i = 0; i < route.stops.length - 1; i++) {
            const a = route.stops[i]!.stopId, b = route.stops[i + 1]!.stopId;
            addEdge(a, b, route.id);
            addEdge(b, a, route.id);
        }
    }

    const edges = Array.from(graph.values()).reduce((s, e) => s + e.length, 0);
    console.log(`[Graph] Built: ${stopNames.size} stops, ${edges} edges`);

    // Flush Redis route cache
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

// ─── MIN-HEAP ───────────────────────────────────────────────────

class MinHeap {
    private h: DijkstraState[] = [];
    get size() { return this.h.length; }

    push(item: DijkstraState) { this.h.push(item); this.up(this.h.length - 1); }

    pop(): DijkstraState | undefined {
        if (!this.h.length) return undefined;
        const min = this.h[0]!;
        const last = this.h.pop()!;
        if (this.h.length) { this.h[0] = last; this.down(0); }
        return min;
    }

    private up(i: number) {
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.h[p]!.cost <= this.h[i]!.cost) break;
            [this.h[p], this.h[i]] = [this.h[i]!, this.h[p]!];
            i = p;
        }
    }

    private down(i: number) {
        while (true) {
            let s = i, l = 2 * i + 1, r = 2 * i + 2;
            if (l < this.h.length && this.h[l]!.cost < this.h[s]!.cost) s = l;
            if (r < this.h.length && this.h[r]!.cost < this.h[s]!.cost) s = r;
            if (s === i) break;
            [this.h[s], this.h[i]] = [this.h[i]!, this.h[s]!];
            i = s;
        }
    }
}

// ─── DIJKSTRA'S ALGORITHM ───────────────────────────────────────

const STRATEGY_COSTS = {
    [OptimizationStrategy.MINIMUM_STOPS]: { stopCost: 1, transferPenalty: 0 },
    [OptimizationStrategy.MINIMUM_TRANSFERS]: { stopCost: 0, transferPenalty: 100 },
    [OptimizationStrategy.BALANCED]: { stopCost: 1, transferPenalty: 5 },
};

export function findOptimalRoute(
    sourceId: string, destId: string,
    strategy: OptimizationStrategy = OptimizationStrategy.BALANCED
): RouteResult | null {
    const { stopCost, transferPenalty } = STRATEGY_COSTS[strategy] || STRATEGY_COSTS.balanced;
    const heap = new MinHeap();
    const visited = new Map<string, number>();

    const sourceEdges = graph.get(sourceId);
    if (!sourceEdges) return null;

    // Helper to build a PathStep
    const step = (sId: string, rId: string): PathStep => ({
        stopId: sId, stopName: stopNames.get(sId) || 'Unknown',
        routeId: rId, routeName: routeNames.get(rId) || 'Unknown',
        routeColor: routeColors.get(rId) || '#000',
    });

    // Start on every route passing through source
    const startRoutes = new Set(sourceEdges.map(e => e.routeId));
    for (const rId of startRoutes) {
        heap.push({ stopId: sourceId, routeId: rId, cost: 0, path: [step(sourceId, rId)] });
    }

    while (heap.size > 0) {
        const cur = heap.pop()!;
        if (cur.stopId === destId) return formatResult(cur.path);

        const key = `${cur.stopId}:${cur.routeId}`;
        if ((visited.get(key) ?? Infinity) <= cur.cost) continue;
        visited.set(key, cur.cost);

        for (const edge of graph.get(cur.stopId) || []) {
            const cost = cur.cost + stopCost + (edge.routeId !== cur.routeId ? transferPenalty : 0);
            const nk = `${edge.toStopId}:${edge.routeId}`;
            if ((visited.get(nk) ?? Infinity) <= cost) continue;
            heap.push({
                stopId: edge.toStopId, routeId: edge.routeId, cost,
                path: [...cur.path, step(edge.toStopId, edge.routeId)],
            });
        }
    }
    return null;
}

// ─── FORMAT RESULT ──────────────────────────────────────────────

function formatResult(path: PathStep[]): RouteResult {
    if (!path.length) return { source: '', destination: '', totalStops: 0, totalTransfers: 0, segments: [] };

    const segments: (RouteSegment | InterchangePoint)[] = [];
    let transfers = 0, segStops = [path[0]!.stopName], curRoute = path[0]!;

    const pushSegment = () => {
        segments.push({
            line: { id: curRoute.routeId, name: curRoute.routeName, color: curRoute.routeColor },
            from: segStops[0]!, to: segStops[segStops.length - 1]!,
            stops: [...segStops], stopCount: segStops.length,
        });
    };

    for (let i = 1; i < path.length; i++) {
        const s = path[i]!;
        if (s.routeId === curRoute.routeId) {
            segStops.push(s.stopName);
        } else {
            pushSegment();
            segments.push({ interchange: s.stopName, fromLine: curRoute.routeName, toLine: s.routeName });
            transfers++;
            segStops = [s.stopName];
            curRoute = s;
        }
    }
    pushSegment();

    return {
        source: path[0]!.stopName,
        destination: path[path.length - 1]!.stopName,
        totalStops: path.length, totalTransfers: transfers, segments,
    };
}

// ─── HELPERS ────────────────────────────────────────────────────

export const isGraphReady = () => graph.size > 0;
export const getStopIdByName = (name: string) => stopIds.get(name);
export const stopExistsInGraph = (id: string) => stopNames.has(id);
export const getStopName = (id: string) => stopNames.get(id);

// ───CACHED ROUTE FINDING ───────────────────────────────────────

export async function findOptimalRouteCached(
    sourceId: string, destId: string,
    strategy: OptimizationStrategy = OptimizationStrategy.BALANCED
): Promise<{ result: RouteResult | null; cacheHit: boolean }> {
    const cacheKey = `route:${sourceId}:${destId}:${strategy}`;
    try {
        const cached = await redis.get(cacheKey);
        if (cached) return { result: JSON.parse(cached), cacheHit: true };
    } catch (err) { console.error('[Redis] Cache read error:', err); }

    const result = findOptimalRoute(sourceId, destId, strategy);
    if (result) {
        try { await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600); }
        catch (err) { console.error('[Redis] Cache write error:', err); }
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