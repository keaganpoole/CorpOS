import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';

// Pages and Components
import HomePage from './pages/HomePage';
import PricingPage from './pages/PricingPage';
import AuthPage from './pages/AuthPage';
import Onboarding2Page from './pages/Onboarding2Page';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import VerificationPage from './pages/VerificationPage';
import DocumentUploadPage from './pages/DocumentUploadPage';
import SplashScreen from './components/SplashScreen';

// Sonar Dashboard
import SonarDashboard from './sonar/SonarDashboard';

function DashboardGate() {
  const { session, profile, isLoading } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  if (!profile?.onboarded) {
    return <Navigate to="/onboarding" replace />;
  }

  return <SonarDashboard />;
}

function OnboardingGate() {
  const { session, profile, isLoading } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  if (profile?.onboarded) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Onboarding2Page />;
}


function AppContent() {
  const { isLoading, isAppLoading } = useAuth();

  if (isLoading || isAppLoading) {
    return <SplashScreen />;
  }

  return (
    <>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: '#333',
            color: '#fff',
          },
        }}
      />
      <Routes>
        {/* --- Public Routes --- */}
        <Route path="/" element={<HomePage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/onboarding" element={<OnboardingGate />} />
        <Route path="/onboarding2" element={<Navigate to="/onboarding" replace />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/verify/:token" element={<VerificationPage />} />
        <Route path="/upload/:token" element={<DocumentUploadPage />} />

        {/* --- Dashboard (Sonar) --- */}
        <Route path="/dashboard" element={<DashboardGate />} />
        <Route path="/dashboard/*" element={<DashboardGate />} />

        {/* --- Fallback Route --- */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
