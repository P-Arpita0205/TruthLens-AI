import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import VideoAnalysis from './pages/VideoAnalysis';
import PhotoAnalysis from './pages/PhotoAnalysis';
import Profile from './pages/Profile';
import DashboardLayout from './layouts/DashboardLayout';

// Mock auth logic for UI demonstration
const isAuthenticated = () => {
  return localStorage.getItem('auth') === 'true';
};

const ProtectedRoute = ({ children }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/auth" replace />;
  }
  return children;
};

export default function App() {
  console.log('App component is rendering...');
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="video" element={<VideoAnalysis />} />
          <Route path="photo" element={<PhotoAnalysis />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
