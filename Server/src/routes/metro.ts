import { Router } from 'express';
import { authenticate, authorizeAdmin } from '../middleware';
import * as metroController from '../controllers/metro';
import * as routeController from '../controllers/route';

const router = Router();

// ─── PUBLIC ROUTES (any authenticated user) ─────────────────────

// Find optimal route between two stops
router.get('/find-route', authenticate, routeController.findRoute);

// ─── ADMIN-ONLY ROUTES ──────────────────────────────────────────

// Rebuild the in-memory graph after data changes
router.post('/refresh-graph', authenticate, authorizeAdmin, routeController.refreshGraph);

// ─── STOP ROUTES (admin only) ───────────────────────────────────

router.post('/stops', authenticate, authorizeAdmin, metroController.createStop);
router.get('/stops', authenticate, authorizeAdmin, metroController.getAllStops);
router.get('/stops/:id', authenticate, authorizeAdmin, metroController.getStopById);
router.put('/stops/:id', authenticate, authorizeAdmin, metroController.updateStop);
router.delete('/stops/:id', authenticate, authorizeAdmin, metroController.deleteStop);

// ─── ROUTE (METRO LINE) ROUTES (admin only) ─────────────────────

router.post('/routes', authenticate, authorizeAdmin, metroController.createRoute);
router.get('/routes', authenticate, authorizeAdmin, metroController.getAllRoutes);
router.get('/routes/:id', authenticate, authorizeAdmin, metroController.getRouteById);
router.put('/routes/:id', authenticate, authorizeAdmin, metroController.updateRoute);
router.delete('/routes/:id', authenticate, authorizeAdmin, metroController.deleteRoute);

// ─── BULK IMPORT (admin only) ───────────────────────────────────

router.post('/bulk-import', authenticate, authorizeAdmin, metroController.bulkImport);

export default router;
