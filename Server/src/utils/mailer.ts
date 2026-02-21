// src/utils/mailer.ts
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export const sendOTPEmail = async (email: string, otp: string) => {
    await transporter.sendMail({
        from: `"Metro Service" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Verify your Metro Account",
        html: `<h1>Your OTP is: ${otp}</h1><p>Valid for 10 minutes.</p>`,
    });
};