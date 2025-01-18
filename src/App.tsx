import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Gallery from './pages/Gallery';
import Upload from './pages/Upload';
import Settings from './pages/Settings';

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading, initialize } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (!loading) {
      // Check if this is a callback from SSO with access_token in the URL
      const hasAuthToken = window.location.hash.includes('access_token');
      
      if (hasAuthToken) {
        // If we have a token, wait briefly for auth state to update
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 500);
      } else if (user && location.pathname === '/login') {
        navigate('/', { replace: true });
      } else if (!user && location.pathname !== '/login') {
        navigate('/login', { replace: true });
      }
    }
  }, [user, loading, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <AuthWrapper>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Gallery />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthWrapper>
    </BrowserRouter>
  );
}

export default App;