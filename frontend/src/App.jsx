import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RoleBasedRoute from './components/RoleBasedRoute';
import AppLayout from './layouts/AppLayout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminHistory from './pages/admin/AdminHistory';
import AdminUsers from './pages/admin/AdminUsers';
import AdminIncidents from './pages/admin/AdminIncidents';
import AdminShifts from './pages/admin/AdminShifts';
import AdminDeliveryPolicies from './pages/admin/AdminDeliveryPolicies';
import AdminShelves from './pages/admin/AdminShelves';
import AdminCourierVisits from './pages/admin/AdminCourierVisits';
import AdminAlerts from './pages/admin/AdminAlerts';
import AdminFeedback from './pages/admin/AdminFeedback';
import AdminReports from './pages/admin/AdminReports';
import GuardDashboard from './pages/guard/GuardDashboard';
import ParcelIntake from './pages/guard/ParcelIntake';
import PickupVerification from './pages/guard/PickupVerification';
import CourierVisits from './pages/guard/CourierVisits';
import DeliveryCalendar from './pages/guard/DeliveryCalendar';
import PriorityAlerts from './pages/guard/PriorityAlerts';
import ResidentDashboard from './pages/resident/ResidentDashboard';
import ResidentHistory from './pages/resident/ResidentHistory';
import MyHousehold from './pages/resident/MyHousehold';
import MyFeedback from './pages/resident/MyFeedback';
import Notifications from './pages/resident/Notifications';
import SendDeliveryDetails from './pages/resident/SendDeliveryDetails';
import Landing from './pages/landing/Landing';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected Routes inside Layout */}
          <Route element={<AppLayout />}>
            
            {/* Admin Routes */}
            <Route path="/admin" element={
              <RoleBasedRoute allowedRoles={['ADMIN']}><AdminDashboard /></RoleBasedRoute>
            } />
            <Route path="/admin/alerts" element={
              <RoleBasedRoute allowedRoles={['ADMIN']}><AdminAlerts /></RoleBasedRoute>
            } />
            <Route path="/admin/feedback" element={
              <RoleBasedRoute allowedRoles={['ADMIN']}><AdminFeedback /></RoleBasedRoute>
            } />
            <Route path="/admin/shelves" element={
              <RoleBasedRoute allowedRoles={['ADMIN']}><AdminShelves /></RoleBasedRoute>
            } />
            <Route path="/admin/policies" element={
              <RoleBasedRoute allowedRoles={['ADMIN']}><AdminDeliveryPolicies /></RoleBasedRoute>
            } />
            <Route path="/admin/shifts" element={
              <RoleBasedRoute allowedRoles={['ADMIN']}><AdminShifts /></RoleBasedRoute>
            } />
            <Route path="/admin/incidents" element={
              <RoleBasedRoute allowedRoles={['ADMIN']}><AdminIncidents /></RoleBasedRoute>
            } />
            <Route path="/admin/history" element={
              <RoleBasedRoute allowedRoles={['ADMIN']}><AdminHistory /></RoleBasedRoute>
            } />
            <Route path="/admin/users" element={
              <RoleBasedRoute allowedRoles={['ADMIN']}><AdminUsers /></RoleBasedRoute>
            } />
            <Route path="/admin/courier-visits" element={
              <RoleBasedRoute allowedRoles={['ADMIN']}><AdminCourierVisits /></RoleBasedRoute>
            } />
            <Route path="/admin/reports" element={
              <RoleBasedRoute allowedRoles={['ADMIN']}><AdminReports /></RoleBasedRoute>
            } />

            {/* Guard Routes */}
            <Route path="/guard" element={
              <RoleBasedRoute allowedRoles={['GUARD']}><GuardDashboard /></RoleBasedRoute>
            } />
            <Route path="/guard/alerts" element={
              <RoleBasedRoute allowedRoles={['GUARD']}><PriorityAlerts /></RoleBasedRoute>
            } />
            <Route path="/guard/intake" element={
              <RoleBasedRoute allowedRoles={['GUARD']}><ParcelIntake /></RoleBasedRoute>
            } />
            <Route path="/guard/verify" element={
              <RoleBasedRoute allowedRoles={['GUARD']}><PickupVerification /></RoleBasedRoute>
            } />
            <Route path="/guard/couriers" element={
              <RoleBasedRoute allowedRoles={['GUARD']}><CourierVisits /></RoleBasedRoute>
            } />
            <Route path="/guard/calendar" element={
              <RoleBasedRoute allowedRoles={['GUARD']}><DeliveryCalendar /></RoleBasedRoute>
            } />

            {/* Resident Routes */}
            <Route path="/resident" element={
              <RoleBasedRoute allowedRoles={['RESIDENT']}><ResidentDashboard /></RoleBasedRoute>
            } />
            <Route path="/resident/feedback" element={
              <RoleBasedRoute allowedRoles={['RESIDENT']}><MyFeedback /></RoleBasedRoute>
            } />
            <Route path="/resident/household" element={
              <RoleBasedRoute allowedRoles={['RESIDENT']}><MyHousehold /></RoleBasedRoute>
            } />
            <Route path="/resident/history" element={
              <RoleBasedRoute allowedRoles={['RESIDENT']}><ResidentHistory /></RoleBasedRoute>
            } />
            <Route path="/resident/notifications" element={
              <RoleBasedRoute allowedRoles={['RESIDENT']}><Notifications /></RoleBasedRoute>
            } />
            <Route path="/resident/send-delivery" element={
              <RoleBasedRoute allowedRoles={['RESIDENT']}><SendDeliveryDetails /></RoleBasedRoute>
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
