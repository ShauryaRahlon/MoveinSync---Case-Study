import { Response } from 'express';
import QRCode from 'qrcode';
import { AuthRequest } from '../middleware';
import * as bookingService from '../services/booking';
import { stopExistsInGraph, isGraphReady, OptimizationStrategy } from '../services/graph';

/**
 * POST /booking/create
 * Body: { sourceStopId, destinationStopId, strategy? }
 */
export const createBooking = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!isGraphReady()) {
            res.status(503).json({ error: 'Metro graph not loaded yet' });
            return;
        }

        const userId = req.user!.userId;
        const { sourceStopId, destinationStopId, strategy } = req.body;

        // Validate inputs
        if (!sourceStopId || !destinationStopId) {
            res.status(400).json({ error: 'sourceStopId and destinationStopId are required' });
            return;
        }

        if (sourceStopId === destinationStopId) {
            res.status(400).json({ error: 'Source and destination cannot be the same' });
            return;
        }

        if (!stopExistsInGraph(sourceStopId)) {
            res.status(404).json({ error: 'Source stop not found' });
            return;
        }

        if (!stopExistsInGraph(destinationStopId)) {
            res.status(404).json({ error: 'Destination stop not found' });
            return;
        }

        // Validate strategy if provided
        const validStrategies = ['minimum_stops', 'minimum_transfers', 'balanced'];
        if (strategy && !validStrategies.includes(strategy)) {
            res.status(400).json({ error: `Invalid strategy. Use: ${validStrategies.join(', ')}` });
            return;
        }

        const booking = await bookingService.createBooking(
            userId,
            sourceStopId,
            destinationStopId,
            (strategy as OptimizationStrategy) || undefined
        );

        res.status(201).json({
            message: 'Booking created successfully',
            booking,
        });
    } catch (err: any) {
        if (err.message === 'NO_ROUTE') {
            res.status(400).json({ error: 'No route found between these stops. Booking not created.' });
            return;
        }
        console.error('Error creating booking:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * GET /booking/my-bookings
 */
export const getMyBookings = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const bookings = await bookingService.getUserBookings(userId);
        res.json({ bookings });
    } catch (err) {
        console.error('Error fetching bookings:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * GET /booking/:id
 */
export const getBooking = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const booking = await bookingService.getBookingById(id);

        if (!booking) {
            res.status(404).json({ error: 'Booking not found' });
            return;
        }

        // Only let users see their own bookings
        if (booking.userId !== req.user!.userId) {
            res.status(403).json({ error: 'You can only view your own bookings' });
            return;
        }

        res.json({ booking });
    } catch (err) {
        console.error('Error fetching booking:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * POST /booking/:id/cancel
 */
export const cancelBooking = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const userId = req.user!.userId;

        const booking = await bookingService.cancelBooking(id, userId);
        res.json({ message: 'Booking cancelled successfully', booking });
    } catch (err: any) {
        if (err.message === 'BOOKING_NOT_FOUND') {
            res.status(404).json({ error: 'Booking not found' });
            return;
        }
        if (err.message === 'NOT_YOUR_BOOKING') {
            res.status(403).json({ error: 'You can only cancel your own bookings' });
            return;
        }
        if (err.message.startsWith('ALREADY_')) {
            res.status(400).json({ error: `Booking is already ${err.message.replace('ALREADY_', '').toLowerCase()}` });
            return;
        }
        console.error('Error cancelling booking:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * POST /booking/validate-qr
 * Body: { qrString }
 */
export const validateQR = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { qrString } = req.body;

        if (!qrString || typeof qrString !== 'string') {
            res.status(400).json({ error: 'qrString is required' });
            return;
        }

        const result = await bookingService.validateQR(qrString);
        res.json(result);
    } catch (err) {
        console.error('Error validating QR:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * GET /booking/:id/qr-image
 * Returns the actual QR code as a PNG image
 */
export const getQRImage = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const booking = await bookingService.getBookingById(id);

        if (!booking) {
            res.status(404).json({ error: 'Booking not found' });
            return;
        }

        if (booking.userId !== req.user!.userId) {
            res.status(403).json({ error: 'You can only view your own bookings' });
            return;
        }

        // Generate QR code as PNG buffer
        const qrBuffer = await QRCode.toBuffer(booking.qrString, {
            width: 300,
            margin: 2,
        });

        res.setHeader('Content-Type', 'image/png');
        res.send(qrBuffer);
    } catch (err) {
        console.error('Error generating QR image:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
