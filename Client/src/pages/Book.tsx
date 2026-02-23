import { useState, useEffect, useRef, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../toast';
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

    useEffect(() => {
        const stop = stops.find(s => s.id === value);
        if (stop) setQuery(stop.name);
        else setQuery('');
    }, [value, stops]);

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
    const { toast } = useToast();
    const [stops, setStops] = useState<Stop[]>([]);
    const [source, setSource] = useState('');
    const [dest, setDest] = useState('');
    const [strategy, setStrategy] = useState('balanced');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        metroAPI.getStops().then(res => {
            const sorted = (res.data.stops || []).sort((a: Stop, b: Stop) => a.name.localeCompare(b.name));
            setStops(sorted);
        }).catch(() => toast('Failed to load stops', 'error'));
    }, []);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!source || !dest) return toast('Select both stops', 'error');
        if (source === dest) return toast('Source and destination must be different', 'error');
        setLoading(true);
        try {
            const res = await bookingAPI.create(source, dest, strategy);
            toast('Ticket booked!', 'success');
            navigate(`/booking/${res.data.booking.id}`);
        } catch (err: any) {
            toast(err.response?.data?.error || 'Booking failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page">
            <h1>Book a Ticket</h1>

            <form className="book-form" onSubmit={handleSubmit}>
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
