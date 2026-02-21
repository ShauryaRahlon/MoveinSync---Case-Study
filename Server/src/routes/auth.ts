// src/routes/auth.ts
import { Router } from 'express';
import prisma from '../db';
import { sendOTPEmail } from '../utils/mailer';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const router = Router();

// 1. REGISTER & SEND OTP
router.post('/register', async (req, res) => {
    const { email, password, name } = req.body;
    const otp = Math.floor(100000 + Math.random() * 600000).toString();
    const expiry = new Date(Date.now() + 10 * 60000); // 10 mins

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                verificationOtp: otp,
                otpExpiry: expiry,
            },
        });

        await sendOTPEmail(email, otp);
        res.status(201).json({ message: "OTP sent to email", userId: user.id });
    } catch (e) {
        res.status(400).json({ error: "User already exists or data invalid" });
    }
});



// 2. VERIFY OTP
router.post('/verify', async (req, res) => {
    const { email, otp } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.verificationOtp !== otp || new Date() > (user.otpExpiry || 0)) {
        return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    const updatedUser = await prisma.user.update({
        where: { email },
        data: {
            isVerified: true,
            verificationOtp: null,
            otpExpiry: null
        },
    });

    res.json({ message: "Account verified!", user: updatedUser });
});

// 3. LOGIN
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(400).json({ error: "Invalid email or password" });
        }

        if (!user.isVerified) {
            return res.status(400).json({ error: "Please verify your email first" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Invalid email or password" });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET || 'secret123',
            { expiresIn: '7d' }
        );

        res.json({
            message: "Login successful",
            token,
            user: { id: user.id, email: user.email, name: user.name }
        });
    } catch (e) {
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;