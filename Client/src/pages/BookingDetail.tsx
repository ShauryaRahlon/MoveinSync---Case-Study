import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { bookingAPI } from '../api';

interface BookingDetail {
    id: string;
    status: string;
    qrString: string;
    createdAt: string;
    expiresAt: string;
    sourceStop: { name: string };
    destinationStop: { name: string };
    routeDetails: {
        source: string;
        destination: string;
        totalStops: number;
        totalTransfers: number;
        segments: any[];
    };
}

export default function BookingDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [booking, setBooking] = useState<BookingDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [cancelling, setCancelling] = useState(false);

    useEffect(() => {
        if (!id) return;
        bookingAPI.getById(id)
            .then(res => setBooking(res.data.booking))
            .catch(err => setError(err.response?.data?.error || 'Failed to load booking'))
            .finally(() => setLoading(false));
    }, [id]);

    const handleCancel = async () => {
        if (!id || !confirm('Cancel this booking?')) return;
        setCancelling(true);
        try {
            await bookingAPI.cancel(id);
            setBooking(prev => prev ? { ...prev, status: 'CANCELLED' } : null);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to cancel');
        } finally {
            setCancelling(false);
        }
    };

    if (loading) return <div className="page"><p>Loading...</p></div>;
    if (error) return <div className="page"><div className="error">{error}</div></div>;
    if (!booking) return <div className="page"><p>Booking not found</p></div>;

    const isActive = booking.status === 'CONFIRMED';
    const isExpired = new Date() > new Date(booking.expiresAt);

    return (
        <div className="page">
            <button className="back-btn" onClick={() => navigate('/dashboard')}>← Back</button>

            <div className="booking-detail">
                <div className="detail-header">
                    <h1>{booking.sourceStop.name} → {booking.destinationStop.name}</h1>
                    <span className={`status-${booking.status.toLowerCase()}`}>
                        {isActive && isExpired ? 'EXPIRED' : booking.status}
                    </span>
                </div>

                <div className="detail-meta">
                    <div><strong>Booked:</strong> {new Date(booking.createdAt).toLocaleString()}</div>
                    <div><strong>Expires:</strong> {new Date(booking.expiresAt).toLocaleString()}</div>
                    <div><strong>Total Stops:</strong> {booking.routeDetails.totalStops}</div>
                    <div><strong>Transfers:</strong> {booking.routeDetails.totalTransfers}</div>
                </div>

                {/* Route Segments */}
                <div className="segments">
                    <h2>Route</h2>
                    {booking.routeDetails.segments.map((seg: any, i: number) => (
                        <div key={i} className={seg.interchange ? 'interchange' : 'segment'}>
                            {seg.interchange ? (
                                <div className="interchange-marker">
                                    ↔ Change at <strong>{seg.interchange}</strong>
                                    <span className="line-change">{seg.fromLine} → {seg.toLine}</span>
                                </div>
                            ) : (
                                <div>
                                    <div className="segment-header">
                                        <span className="line-dot" style={{ background: seg.line.color }}></span>
                                        <strong>{seg.line.name}</strong>
                                        <span className="stop-count">{seg.stopCount} stops</span>
                                    </div>
                                    <div className="segment-stops">
                                        {seg.from} → {seg.to}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* QR Code */}
                {isActive && !isExpired && (
                    <div className="qr-section">
                        <h2>Your Ticket QR</h2>
                        <div className="qr-wrapper">
                            <QRCode value={booking.qrString} size={200} />
                        </div>
                        <p className="qr-hint">Show this at the entry gate</p>
                    </div>
                )}

                {isActive && !isExpired && (
                    <button className="cancel-btn" onClick={handleCancel} disabled={cancelling}>
                        {cancelling ? 'Cancelling...' : 'Cancel Booking'}
                    </button>
                )}
            </div>
        </div>
    );
}
