import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { bookingAPI } from '../api';

interface Booking {
    id: string;
    status: string;
    createdAt: string;
    expiresAt: string;
    sourceStop: { name: string };
    destinationStop: { name: string };
    routeDetails: any;
}

export default function Dashboard() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchBookings();
    }, []);

    const fetchBookings = async () => {
        try {
            const res = await bookingAPI.myBookings();
            setBookings(res.data.bookings);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load bookings');
        } finally {
            setLoading(false);
        }
    };

    const statusClass = (status: string) => {
        if (status === 'CONFIRMED') return 'status-confirmed';
        if (status === 'CANCELLED') return 'status-cancelled';
        return 'status-expired';
    };

    if (loading) return <div className="page"><p>Loading...</p></div>;

    return (
        <div className="page">
            <div className="page-header">
                <h1>My Bookings</h1>
                <Link to="/book" className="btn">+ Book a Ticket</Link>
            </div>

            {error && <div className="error">{error}</div>}

            {bookings.length === 0 ? (
                <div className="empty">
                    <p>No bookings yet.</p>
                    <Link to="/book">Book your first ticket →</Link>
                </div>
            ) : (
                <div className="bookings-list">
                    {bookings.map(b => (
                        <Link to={`/booking/${b.id}`} key={b.id} className="booking-card">
                            <div className="booking-route">
                                <span>{b.sourceStop.name}</span>
                                <span className="arrow">→</span>
                                <span>{b.destinationStop.name}</span>
                            </div>
                            <div className="booking-meta">
                                <span className={statusClass(b.status)}>{b.status}</span>
                                <span className="date">{new Date(b.createdAt).toLocaleDateString()}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
