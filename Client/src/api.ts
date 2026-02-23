import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
    baseURL: API_BASE,
    headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Auto-logout on 401
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

// ─── AUTH ────────────────────────────────────────────────────────

export const authAPI = {
    login: (email: string, password: string) =>
        api.post('/auth/login', { email, password }),

    register: (name: string, email: string, password: string) =>
        api.post('/auth/register', { name, email, password }),
};

// ─── METRO ──────────────────────────────────────────────────────

export const metroAPI = {
    getStops: () => api.get('/metro/stops'),

    findRoute: (from: string, to: string, strategy: string) =>
        api.get('/metro/find-route', { params: { from, to, strategy } }),
};

// ─── BOOKING ────────────────────────────────────────────────────

export const bookingAPI = {
    create: (sourceStopId: string, destinationStopId: string, strategy: string) =>
        api.post('/booking/create', { sourceStopId, destinationStopId, strategy }),

    myBookings: () => api.get('/booking/my-bookings'),

    getById: (id: string) => api.get(`/booking/${id}`),

    cancel: (id: string) => api.post(`/booking/${id}/cancel`),

    validateQR: (qrString: string) => api.post('/booking/validate-qr', { qrString }),
};

export default api;
