import { Router } from 'express';
import { authenticate, authorizeAdmin } from '../middleware';
import * as metroController from '../controllers/metro';

const router = Router();

// All metro admin routes require authentication + admin role
router.use(authenticate, authorizeAdmin);

// ─── STOP ROUTES ────────────────────────────────────────────────

router.post('/stops', metroController.createStop);
router.get('/stops', metroController.getAllStops);
router.get('/stops/:id', metroController.getStopById);
router.put('/stops/:id', metroController.updateStop);
router.delete('/stops/:id', metroController.deleteStop);

// ─── ROUTE (METRO LINE) ROUTES ──────────────────────────────────

router.post('/routes', metroController.createRoute);
router.get('/routes', metroController.getAllRoutes);
router.get('/routes/:id', metroController.getRouteById);
router.put('/routes/:id', metroController.updateRoute);
router.delete('/routes/:id', metroController.deleteRoute);

// ─── BULK IMPORT ────────────────────────────────────────────────

router.post('/bulk-import', metroController.bulkImport);

export default router;
