import { Response } from 'express';
import { AuthRequest } from '../middleware';
import * as metroService from '../services/metro';

// ─── STOP CONTROLLERS ───────────────────────────────────────────

export const createStop = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            res.status(400).json({ error: 'Stop name is required' });
            return;
        }

        const stop = await metroService.createStop(name.trim());
        res.status(201).json({ message: 'Stop created successfully', stop });
    } catch (err: any) {
        if (err.code === 'P2002') {
            res.status(409).json({ error: 'A stop with this name already exists' });
            return;
        }
        console.error('Error creating stop:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getAllStops = async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const stops = await metroService.getAllStops();
        res.json({ stops });
    } catch (err) {
        console.error('Error fetching stops:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getStopById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const stop = await metroService.getStopById(id);

        if (!stop) {
            res.status(404).json({ error: 'Stop not found' });
            return;
        }

        res.json({ stop });
    } catch (err) {
        console.error('Error fetching stop:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateStop = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const { name } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            res.status(400).json({ error: 'Stop name is required' });
            return;
        }

        const stop = await metroService.updateStop(id, name.trim());
        res.json({ message: 'Stop updated successfully', stop });
    } catch (err: any) {
        if (err.code === 'P2025') {
            res.status(404).json({ error: 'Stop not found' });
            return;
        }
        if (err.code === 'P2002') {
            res.status(409).json({ error: 'A stop with this name already exists' });
            return;
        }
        console.error('Error updating stop:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteStop = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        await metroService.deleteStop(id);
        res.json({ message: 'Stop deleted successfully' });
    } catch (err: any) {
        if (err.code === 'P2025') {
            res.status(404).json({ error: 'Stop not found' });
            return;
        }
        console.error('Error deleting stop:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── ROUTE CONTROLLERS ──────────────────────────────────────────

export const createRoute = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { name, color, stopIds } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            res.status(400).json({ error: 'Route name is required' });
            return;
        }
        if (!color || typeof color !== 'string' || color.trim().length === 0) {
            res.status(400).json({ error: 'Route color is required' });
            return;
        }
        if (!Array.isArray(stopIds) || stopIds.length === 0) {
            res.status(400).json({ error: 'At least one stop ID is required' });
            return;
        }

        const route = await metroService.createRoute(name.trim(), color.trim(), stopIds);
        res.status(201).json({ message: 'Route created successfully', route });
    } catch (err: any) {
        if (err.code === 'P2002') {
            res.status(409).json({ error: 'A route with this name already exists' });
            return;
        }
        if (err.code === 'P2003') {
            res.status(400).json({ error: 'One or more stop IDs are invalid' });
            return;
        }
        console.error('Error creating route:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getAllRoutes = async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const routes = await metroService.getAllRoutes();
        res.json({ routes });
    } catch (err) {
        console.error('Error fetching routes:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getRouteById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const route = await metroService.getRouteById(id);

        if (!route) {
            res.status(404).json({ error: 'Route not found' });
            return;
        }

        res.json({ route });
    } catch (err) {
        console.error('Error fetching route:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateRoute = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const { name, color, stopIds } = req.body;

        // At least one field must be provided
        if (!name && !color && !stopIds) {
            res.status(400).json({ error: 'At least one field (name, color, stopIds) is required' });
            return;
        }

        const route = await metroService.updateRoute(id, name, color, stopIds);
        res.json({ message: 'Route updated successfully', route });
    } catch (err: any) {
        if (err.code === 'P2025') {
            res.status(404).json({ error: 'Route not found' });
            return;
        }
        if (err.code === 'P2002') {
            res.status(409).json({ error: 'A route with this name already exists' });
            return;
        }
        if (err.code === 'P2003') {
            res.status(400).json({ error: 'One or more stop IDs are invalid' });
            return;
        }
        console.error('Error updating route:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteRoute = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        await metroService.deleteRoute(id);
        res.json({ message: 'Route deleted successfully' });
    } catch (err: any) {
        if (err.code === 'P2025') {
            res.status(404).json({ error: 'Route not found' });
            return;
        }
        console.error('Error deleting route:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ─── BULK IMPORT CONTROLLER ─────────────────────────────────────

export const bulkImport = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { stops, routes } = req.body;

        if (!Array.isArray(stops)) {
            res.status(400).json({ error: '"stops" must be an array of stop names' });
            return;
        }

        if (!Array.isArray(routes)) {
            res.status(400).json({ error: '"routes" must be an array of route objects' });
            return;
        }

        // Validate route objects
        for (const route of routes) {
            if (!route.name || !route.color || !Array.isArray(route.stops)) {
                res.status(400).json({
                    error: 'Each route must have "name", "color", and "stops" (array of stop names)',
                });
                return;
            }
        }

        const result = await metroService.bulkImport({ stops, routes });
        res.status(201).json({ message: 'Bulk import successful', ...result });
    } catch (err) {
        console.error('Error during bulk import:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
