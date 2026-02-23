import { Router } from 'express';
import { authenticate } from '../middleware';
import * as bookingController from '../controllers/booking';

const router = Router();

// All booking routes need authentication (any user, not admin)

// Static routes FIRST (before /:id)
router.post('/create', authenticate, bookingController.createBooking);
router.get('/my-bookings', authenticate, bookingController.getMyBookings);
router.post('/validate-qr', authenticate, bookingController.validateQR);

// Dynamic routes with :id
router.get('/:id', authenticate, bookingController.getBooking);
router.get('/:id/qr-image', authenticate, bookingController.getQRImage);
router.post('/:id/cancel', authenticate, bookingController.cancelBooking);

export default router;
