import { Response } from 'express';
import { AuthRequest } from '../middleware';
import {
    findOptimalRoute,
    findOptimalRouteCached,
    buildGraph,
    isGraphReady,
    stopExistsInGraph,
    getStopName,
    OptimizationStrategy,
} from '../services/graph';

/**
 * GET /metro/find-route?from=<stopId>&to=<stopId>&strategy=balanced
 * 
 * Finds the optimal route between two stops.
 * Strategy options: minimum_stops, minimum_transfers, balanced (default)
 */
export const findRoute = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        // 1. Check if graph is loaded
        if (!isGraphReady()) {
            res.status(503).json({ error: 'Metro graph not loaded yet. Please try again shortly.' });
            return;
        }

        // 2. Get query params
        const from = req.query.from as string;
        const to = req.query.to as string;
        const strategyParam = (req.query.strategy as string) || 'balanced';

        // 3. Validate inputs
        if (!from || !to) {
            res.status(400).json({ error: 'Both "from" and "to" stop IDs are required as query params' });
            return;
        }

        if (from === to) {
            res.status(400).json({ error: 'Source and destination cannot be the same stop' });
            return;
        }

        // 4. Check stops exist
        if (!stopExistsInGraph(from)) {
            res.status(404).json({ error: `Source stop not found: ${from}` });
            return;
        }
        if (!stopExistsInGraph(to)) {
            res.status(404).json({ error: `Destination stop not found: ${to}` });
            return;
        }

        // 5. Parse strategy
        const validStrategies = ['minimum_stops', 'minimum_transfers', 'balanced'];
        if (!validStrategies.includes(strategyParam)) {
            res.status(400).json({
                error: `Invalid strategy. Must be one of: ${validStrategies.join(', ')}`,
            });
            return;
        }
        const strategy = strategyParam as OptimizationStrategy;

        // 6. Find the route (with Redis cache)
        const { result, cacheHit } = await findOptimalRouteCached(from, to, strategy);

        if (!result) {
            res.status(200).json({
                path: null,
                message: `No route found between "${getStopName(from)}" and "${getStopName(to)}"`,
            });
            return;
        }

        res.json({
            strategy: strategyParam,
            cacheHit,
            route: result,
        });

    } catch (err) {
        console.error('Error finding route:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * POST /metro/refresh-graph
 * 
 * Admin-only: rebuilds the in-memory graph from the database.
 * Call this after adding/removing stops or routes.
 */
export const refreshGraph = async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        await buildGraph();
        res.json({ message: 'Metro graph rebuilt successfully' });
    } catch (err) {
        console.error('Error rebuilding graph:', err);
        res.status(500).json({ error: 'Failed to rebuild graph' });
    }
};
