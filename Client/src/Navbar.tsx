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

    const initial = (user.name || user.email)?.[0]?.toUpperCase() || '?';

    return (
        <nav className="navbar">
            <Link to="/dashboard" className="nav-brand">
                <img src="/logo.png" alt="MoveInSync" className="nav-logo" />
                MoveInSync Metro
            </Link>
            <div className="nav-links">
                <Link to="/dashboard">Bookings</Link>
                <Link to="/book">Book</Link>
                <div className="nav-profile" title={user.email}>
                    <span className="avatar">{initial}</span>
                    <span className="profile-name">{user.name || user.email}</span>
                </div>
                <button onClick={handleLogout} className="logout-btn">Logout</button>
            </div>
        </nav>
    );
}
