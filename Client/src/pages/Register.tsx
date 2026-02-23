import { useState, FormEvent } from 'react';
import { useAuth } from '../auth';
import { useToast } from '../toast';
import { Link, useNavigate } from 'react-router-dom';

export default function Register() {
    const { register } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await register(name, email, password);
            toast('OTP sent to your email', 'success');
            navigate('/verify-otp', { state: { email } });
        } catch (err: any) {
            toast(err.response?.data?.error || 'Registration failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <form className="auth-form" onSubmit={handleSubmit}>
                <h1>Register</h1>
                <p className="subtitle">Create your account</p>

                <label>Name</label>
                <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    required
                />

                <label>Email</label>
                <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    required
                />

                <label>Password</label>
                <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                />

                <button type="submit" disabled={loading}>
                    {loading ? 'Creating account...' : 'Register'}
                </button>

                <p className="link">
                    Already have an account? <Link to="/login">Login</Link>
                </p>
            </form>
        </div>
    );
}
