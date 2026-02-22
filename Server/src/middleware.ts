import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request to include user info
export interface AuthRequest extends Request {
    user?: {
        userId: string;
        role: string;
    };
}

/**
 * Middleware to verify JWT token from Authorization header.
 * Attaches decoded user info to req.user.  manually set role to ADMIN for now
 */
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: No token provided' });
        return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        res.status(401).json({ error: 'Unauthorized: No token provided' });
        return;
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123') as {
            userId: string;
            role: string;
        };

        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
};

/**
 * Middleware to restrict access to ADMIN role only.
 * Must be used after `authenticate`.
 */
export const authorizeAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || req.user.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden: Admin access required' });
        return;
    }
    next();
};
