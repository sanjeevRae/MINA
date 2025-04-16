import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './services/firebase';
import { doc, getDoc } from 'firebase/firestore';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import PatientDashboard from './pages/PatientDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import About from './pages/About';
import Contact from './pages/Contact';
import AIAssistance from './pages/AIAssistance';

// Components
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {

          const userDocRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          let role = 'patient'; 
          if (userDoc.exists()) {
            role = userDoc.data().role || 'patient';
          }
          
         
          const userWithRole = {
            ...currentUser,
            role: role
          };
          
          setUserRole(role);
          setUser(userWithRole);
        } catch (error) {
          console.error("Error getting user role:", error);
          setUser(currentUser);
          setUserRole('patient');
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-16 h-16 border-t-4 border-primary border-solid rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light">
      <Navbar user={user} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={user ? <Navigate to={userRole === 'doctor' ? '/doctor-dashboard' : '/patient-dashboard'} /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to={userRole === 'doctor' ? '/doctor-dashboard' : '/patient-dashboard'} /> : <Register />} />
        <Route 
          path="/patient-dashboard/*" 
          element={
            <ProtectedRoute user={user} requiredRole="patient">
              <PatientDashboard user={user} />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/doctor-dashboard/*" 
          element={
            <ProtectedRoute user={user} requiredRole="doctor">
              <DoctorDashboard user={user} />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/ai-assistance/*" 
          element={<AIAssistance user={user} />} 
        />
      </Routes>
    </div>
  );
}

export default App;