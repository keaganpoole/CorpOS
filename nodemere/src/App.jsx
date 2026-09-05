import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';

// Pages and Components
import HomePage from './pages/HomePage';
import PricingPage from './pages/PricingPage';
import AuthPage from './pages/AuthPage';
import AccountRecoveryPage from './pages/AccountRecoveryPage';
import Onboarding2Page from './pages/Onboarding2Page';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import DocumentUploadPage from './pages/DocumentUploadPage';
import VoiceClonePage from './pages/VoiceClonePage';
import SplashScreen from './components/SplashScreen';
import LegalDocumentPage from './components/LegalDocumentPage';
import LegalAcceptanceGate from './components/LegalAcceptanceGate';
import CookieNotice from './components/CookieNotice';
import { WorkforceGate } from './components/WorkforceSecurity';
import CustomerExperienceFeedback from './components/CustomerExperienceFeedback';

// Sonar Dashboard
import SonarDashboard from './sonar/SonarDashboard';
import ProjectIntelligenceReport from './sonar/pages/ProjectIntelligenceReport';

function DashboardGate() {
  const { session, profile, isLoading, workforce } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  if (profile?.account_status === 'pending_deletion') {
    return <AccountRecoveryPage />;
  }

  return <LegalAcceptanceGate><WorkforceGate>{!profile?.onboarded && !workforce?.tenant ? <Navigate to="/onboarding" replace /> : <SonarDashboard />}</WorkforceGate></LegalAcceptanceGate>;
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

  return <LegalAcceptanceGate><Onboarding2Page /></LegalAcceptanceGate>;
}


function AppContent() {
  const { isLoading, isAppLoading } = useAuth();
  const location = useLocation();
  const isVoiceCloneEntry = location.pathname.startsWith('/clone');
  const isPublicStats = location.pathname === '/stats';

  if ((isLoading || isAppLoading) && !isVoiceCloneEntry && !isPublicStats) {
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
        <Route path="/terms" element={<LegalDocumentPage documentKey="terms" />} />
        <Route path="/acceptable-use-policy" element={<LegalDocumentPage documentKey="acceptableUse" />} />
        <Route path="/communications-notice" element={<LegalDocumentPage documentKey="communications" />} />
        <Route path="/data-processing-addendum" element={<LegalDocumentPage documentKey="dpa" />} />
        <Route path="/subprocessors" element={<LegalDocumentPage documentKey="subprocessors" />} />
        <Route path="/cookie-notice" element={<LegalDocumentPage documentKey="cookies" />} />
        <Route path="/upload/:token" element={<DocumentUploadPage />} />
        <Route path="/clone/:token" element={<VoiceClonePage />} />
        <Route path="/clone" element={<VoiceClonePage />} />

        {/* --- Dashboard (Sonar) --- */}
        <Route path="/dashboard" element={<DashboardGate />} />
        <Route path="/dashboard/*" element={<DashboardGate />} />
        <Route path="/stats" element={<ProjectIntelligenceReport publicView />} />

        {/* --- Fallback Route --- */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CookieNotice />
      <CustomerExperienceFeedback />
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
