import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RoleBasedRoute from './components/RoleBasedRoute';
import AppLayout from './layouts/AppLayout';

// Pages
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminHistory from './pages/admin/AdminHistory';
import GuardDashboard from './pages/guard/GuardDashboard';
import ParcelIntake from './pages/guard/ParcelIntake';
import PickupVerification from './pages/guard/PickupVerification';
import ResidentDashboard from './pages/resident/ResidentDashboard';
import ResidentHistory from './pages/resident/ResidentHistory';
import Landing from './pages/landing/Landing';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          
          {/* Protected Routes inside Layout */}
          <Route element={<AppLayout />}>
            
            {/* Admin Routes */}
            <Route path="/admin" element={
              <RoleBasedRoute allowedRoles={['ADMIN']}><AdminDashboard /></RoleBasedRoute>
            } />
            <Route path="/admin/history" element={
              <RoleBasedRoute allowedRoles={['ADMIN']}><AdminHistory /></RoleBasedRoute>
            } />

            {/* Guard Routes */}
            <Route path="/guard" element={
              <RoleBasedRoute allowedRoles={['GUARD']}><GuardDashboard /></RoleBasedRoute>
            } />
            <Route path="/guard/intake" element={
              <RoleBasedRoute allowedRoles={['GUARD']}><ParcelIntake /></RoleBasedRoute>
            } />
            <Route path="/guard/verify" element={
              <RoleBasedRoute allowedRoles={['GUARD']}><PickupVerification /></RoleBasedRoute>
            } />

            {/* Resident Routes */}
            <Route path="/resident" element={
              <RoleBasedRoute allowedRoles={['RESIDENT']}><ResidentDashboard /></RoleBasedRoute>
            } />
            <Route path="/resident/history" element={
              <RoleBasedRoute allowedRoles={['RESIDENT']}><ResidentHistory /></RoleBasedRoute>
            } />

          </Route>

          {/* Default Route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
