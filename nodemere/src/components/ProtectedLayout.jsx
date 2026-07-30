// src/components/ProtectedLayout.jsx

import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, Outlet } from 'react-router-dom';
import SplashScreen from './SplashScreen'; // Assuming you have a splash screen component

const ProtectedLayout = () => {
    const { session, profile, isLoading } = useAuth();

    if (isLoading) {
        return <SplashScreen />;
    }

    if (!session) {
        return <Navigate to="/auth" replace />;
    }

    return <Outlet />;};

export default ProtectedLayout;
