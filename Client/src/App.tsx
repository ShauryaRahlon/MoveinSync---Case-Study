import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { ToastProvider } from './toast';
import Navbar from './Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Book from './pages/Book';
import BookingDetail from './pages/BookingDetail';
import VerifyOTP from './pages/VerifyOTP';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { token, isLoading } = useAuth();
    if (isLoading) return <div className="page"><p>Loading...</p></div>;
    if (!token) return <Navigate to="/login" />;
    return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
    const { token, isLoading } = useAuth();
    if (isLoading) return <div className="page"><p>Loading...</p></div>;
    if (token) return <Navigate to="/dashboard" />;
    return <>{children}</>;
}

function AppRoutes() {
    return (
        <>
            <Navbar />
            <Routes>
                <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
                <Route path="/verify-otp" element={<PublicRoute><VerifyOTP /></PublicRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/book" element={<ProtectedRoute><Book /></ProtectedRoute>} />
                <Route path="/booking/:id" element={<ProtectedRoute><BookingDetail /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/dashboard" />} />
            </Routes>
        </>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <ToastProvider>
                    <AppRoutes />
                </ToastProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}
