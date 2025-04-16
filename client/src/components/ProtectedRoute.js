import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ user, requiredRole, children }) => {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  

  const userRole = user.role || 'patient';
  
  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to={userRole === 'doctor' ? '/doctor-dashboard' : '/patient-dashboard'} replace />;
  }

  return children;
};

export default ProtectedRoute;