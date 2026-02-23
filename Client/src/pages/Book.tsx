import { useState, useEffect, useRef, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { metroAPI, bookingAPI } from '../api';

interface Stop { id: string; name: string; }

// ─── Searchable Stop Picker ─────────────────────────────────────

function StopPicker({ label, stops, value, onChange }: {
    label: string;
    stops: Stop[];
    value: string;
    onChange: (id: string) => void;
}) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Set display name when value changes externally
    useEffect(() => {
        const stop = stops.find(s => s.id === value);
        if (stop) setQuery(stop.name);
        else setQuery('');
    }, [value, stops]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filtered = stops.filter(s =>
        s.name.toLowerCase().includes(query.toLowerCase())
    );

    const handleSelect = (stop: Stop) => {
        onChange(stop.id);
        setQuery(stop.name);
        setOpen(false);
    };

    return (
        <div className="stop-picker" ref={ref}>
            <label>{label}</label>
            <input
                type="text"
                value={query}
                placeholder="Type to search..."
                onChange={e => { setQuery(e.target.value); onChange(''); setOpen(true); }}
                onFocus={() => setOpen(true)}
            />
            {open && filtered.length > 0 && (
                <ul className="stop-dropdown">
                    {filtered.slice(0, 8).map(s => (
                        <li key={s.id} onClick={() => handleSelect(s)}>
                            {s.name}
                        </li>
                    ))}
                    {filtered.length > 8 && (
                        <li className="more">+{filtered.length - 8} more...</li>
                    )}
                </ul>
            )}
        </div>
    );
}

// ─── Book Page ──────────────────────────────────────────────────

export default function Book() {
    const navigate = useNavigate();
    const [stops, setStops] = useState<Stop[]>([]);
    const [source, setSource] = useState('');
    const [dest, setDest] = useState('');
    const [strategy, setStrategy] = useState('balanced');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        metroAPI.getStops().then(res => {
            const sorted = (res.data.stops || []).sort((a: Stop, b: Stop) => a.name.localeCompare(b.name));
            setStops(sorted);
        }).catch(() => setError('Failed to load stops'));
    }, []);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!source || !dest) return setError('Select both stops');
        if (source === dest) return setError('Source and destination must be different');
        setError('');
        setLoading(true);
        try {
            const res = await bookingAPI.create(source, dest, strategy);
            navigate(`/booking/${res.data.booking.id}`);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Booking failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page">
            <h1>Book a Ticket</h1>

            <form className="book-form" onSubmit={handleSubmit}>
                {error && <div className="error">{error}</div>}

                <StopPicker label="From" stops={stops} value={source} onChange={setSource} />
                <StopPicker label="To" stops={stops} value={dest} onChange={setDest} />

                <label>Strategy</label>
                <select value={strategy} onChange={e => setStrategy(e.target.value)}>
                    <option value="balanced">Balanced</option>
                    <option value="minimum_stops">Minimum Stops</option>
                    <option value="minimum_transfers">Minimum Transfers</option>
                </select>

                <button type="submit" disabled={loading}>
                    {loading ? 'Booking...' : 'Book Ticket'}
                </button>
            </form>
        </div>
    );
}
