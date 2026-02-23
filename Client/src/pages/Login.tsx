import { useState, FormEvent } from 'react';
import { useAuth } from '../auth';
import { useToast } from '../toast';
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
    const { login } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(email, password);
            toast('Login successful', 'success');
            navigate('/dashboard');
        } catch (err: any) {
            toast(err.response?.data?.error || 'Login failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <form className="auth-form" onSubmit={handleSubmit}>
                <h1>Login</h1>
                <p className="subtitle">Metro Booking Service</p>

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
                />

                <button type="submit" disabled={loading}>
                    {loading ? 'Logging in...' : 'Login'}
                </button>

                <p className="link" style={{ textAlign: 'center', marginTop: '15px' }}>
                    Want to just explore? <a href="#" onClick={(e) => {
                        e.preventDefault();
                        setEmail('test@example.com');
                        setPassword('password123');
                    }}>Fill Test Credentials</a>
                </p>

                <p className="link">
                    Don't have an account? <Link to="/register">Register</Link>
                </p>
            </form>
        </div>
    );
}
