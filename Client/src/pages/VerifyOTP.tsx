import { useState, FormEvent, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../api';

export default function VerifyOTP() {
    const navigate = useNavigate();
    const location = useLocation();
    const email = (location.state as any)?.email || '';

    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const handleChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return; // only digits
        const newOtp = [...otp];
        newOtp[index] = value.slice(-1);
        setOtp(newOtp);

        // Auto-focus next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const otpString = otp.join('');
        if (otpString.length !== 6) return setError('Enter the full 6-digit OTP');
        if (!email) return setError('Email not found. Please register again.');
        setError('');
        setLoading(true);

        try {
            await authAPI.verify(email, otpString);
            setSuccess(true);
            setTimeout(() => navigate('/login'), 2000);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <form className="auth-form" onSubmit={handleSubmit}>
                <h1>Verify Email</h1>
                <p className="subtitle">
                    {email ? `Enter the OTP sent to ${email}` : 'Enter your verification code'}
                </p>

                {error && <div className="error">{error}</div>}
                {success && <div className="success">Account verified! Redirecting to login...</div>}

                <div className="otp-inputs">
                    {otp.map((digit, i) => (
                        <input
                            key={i}
                            ref={el => { inputRefs.current[i] = el; }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={e => handleChange(i, e.target.value)}
                            onKeyDown={e => handleKeyDown(i, e)}
                            className="otp-input"
                        />
                    ))}
                </div>

                <button type="submit" disabled={loading || success}>
                    {loading ? 'Verifying...' : 'Verify'}
                </button>

                <p className="link">
                    <Link to="/register">← Back to Register</Link>
                </p>
            </form>
        </div>
    );
}
