import crypto from 'crypto';
import prisma from '../db';
import { findOptimalRoute, stopExistsInGraph, OptimizationStrategy } from './graph';

const EXPIRY_HOURS = 24;

// ─── QR STRING GENERATION ───────────────────────────────────────

/**
 * Generates a tamper-resistant QR string for a booking.
 * Format: MIS_<bookingId>_<HMAC-SHA256 signature>
 */
function generateQRString(
    bookingId: string,
    userId: string,
    sourceStopId: string,
    destStopId: string
): string {
    const secret = process.env.JWT_SECRET || 'secret123';
    const payload = `${bookingId}:${userId}:${sourceStopId}:${destStopId}`;
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return `MIS_${bookingId}_${signature}`;
}

// ─── CREATE BOOKING ─────────────────────────────────────────────

/**
 * Creates a booking:
 * 1. Finds optimal route between source and destination
 * 2. If no route → throws error
 * 3. If route found → saves booking with route details + QR string
 */
export async function createBooking(
    userId: string,
    sourceStopId: string,
    destStopId: string,
    strategy: OptimizationStrategy = OptimizationStrategy.BALANCED
) {
    // Find the optimal route
    const routeResult = findOptimalRoute(sourceStopId, destStopId, strategy);

    if (!routeResult) {
        throw new Error('NO_ROUTE');
    }

    // Set expiry to 24 hours from now
    const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

    // Create the booking in DB
    const booking = await prisma.booking.create({
        data: {
            userId,
            sourceStopId,
            destinationStopId: destStopId,
            routeDetails: routeResult as any,    // Prisma stores this as JSON
            qrString: '',                 // placeholder, will update below
            expiresAt,
        },
    });

    // Generate QR string with the booking ID
    const qrString = generateQRString(booking.id, userId, sourceStopId, destStopId);

    // Update the booking with the QR string
    const updatedBooking = await prisma.booking.update({
        where: { id: booking.id },
        data: { qrString },
        include: {
            sourceStop: true,
            destinationStop: true,
        },
    });

    return updatedBooking;
}

// ─── GET USER BOOKINGS ──────────────────────────────────────────

/**
 * Returns all bookings for a user, newest first.
 */
export async function getUserBookings(userId: string) {
    const bookings = await prisma.booking.findMany({
        where: { userId },
        include: {
            sourceStop: true,
            destinationStop: true,
        },
        orderBy: { createdAt: 'desc' },
    });

    // Lazy-expire any old bookings
    for (const booking of bookings) {
        if (booking.status === 'CONFIRMED' && new Date() > booking.expiresAt) {
            await prisma.booking.update({
                where: { id: booking.id },
                data: { status: 'EXPIRED' },
            });
            booking.status = 'EXPIRED';
        }
    }

    return bookings;
}

// ─── GET BOOKING BY ID ──────────────────────────────────────────

export async function getBookingById(bookingId: string) {
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            sourceStop: true,
            destinationStop: true,
        },
    });

    if (!booking) return null;

    // Lazy-expire if needed
    if (booking.status === 'CONFIRMED' && new Date() > booking.expiresAt) {
        await prisma.booking.update({
            where: { id: booking.id },
            data: { status: 'EXPIRED' },
        });
        booking.status = 'EXPIRED';
    }

    return booking;
}

// ─── CANCEL BOOKING ─────────────────────────────────────────────

export async function cancelBooking(bookingId: string, userId: string) {
    // Find the booking
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
    });

    if (!booking) {
        throw new Error('BOOKING_NOT_FOUND');
    }

    if (booking.userId !== userId) {
        throw new Error('NOT_YOUR_BOOKING');
    }

    if (booking.status !== 'CONFIRMED') {
        throw new Error('ALREADY_' + booking.status);
    }

    // Cancel it
    return prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED' },
        include: {
            sourceStop: true,
            destinationStop: true,
        },
    });
}

// ─── VALIDATE QR STRING ─────────────────────────────────────────

/**
 * Validates a QR string:
 * 1. Parses the MIS_<bookingId>_<signature> format
 * 2. Looks up the booking
 * 3. Re-computes HMAC and compares
 * 4. Checks if booking is expired
 */
export async function validateQR(qrString: string) {
    // Parse: MIS_<bookingId (36 chars UUID)>_<signature>
    const parts = qrString.split('_');

    // Should be: ['MIS', bookingId, signature]
    if (parts.length !== 3 || parts[0] !== 'MIS') {
        return { valid: false, message: 'Invalid QR format' };
    }

    const bookingId = parts[1]!;
    const providedSignature = parts[2]!;

    // Look up the booking
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            sourceStop: true,
            destinationStop: true,
            user: { select: { id: true, name: true, email: true } },
        },
    });

    if (!booking) {
        return { valid: false, message: 'Booking not found' };
    }

    // Re-compute the HMAC signature
    const secret = process.env.JWT_SECRET || 'secret123';
    const payload = `${booking.id}:${booking.userId}:${booking.sourceStopId}:${booking.destinationStopId}`;
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // Compare signatures
    if (providedSignature !== expectedSignature) {
        return { valid: false, message: 'QR string has been tampered with' };
    }

    // Check expiry
    if (booking.status === 'CONFIRMED' && new Date() > booking.expiresAt) {
        await prisma.booking.update({
            where: { id: booking.id },
            data: { status: 'EXPIRED' },
        });
        return { valid: false, message: 'Booking has expired', booking };
    }

    // Check status
    if (booking.status === 'CANCELLED') {
        return { valid: false, message: 'Booking has been cancelled', booking };
    }

    if (booking.status === 'EXPIRED') {
        return { valid: false, message: 'Booking has expired', booking };
    }

    return { valid: true, message: 'Valid ticket', booking };
}
