import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';

export default function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (!user) return null;

    return (
        <nav className="navbar">
            <Link to="/dashboard" className="nav-brand">Metro</Link>
            <div className="nav-links">
                <Link to="/dashboard">Bookings</Link>
                <Link to="/book">Book</Link>
                <button onClick={handleLogout} className="logout-btn">Logout</button>
            </div>
        </nav>
    );
}
