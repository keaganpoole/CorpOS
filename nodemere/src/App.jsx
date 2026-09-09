import React, { Suspense, lazy, useEffect, useState } from 'react';
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
import VisitorTracking from './components/VisitorTracking';
import { WorkforceGate } from './components/WorkforceSecurity';
import CustomerExperienceFeedback from './components/CustomerExperienceFeedback';

// Sonar Dashboard
import SonarDashboard from './sonar/SonarDashboard';
import ProjectIntelligenceReport from './sonar/pages/ProjectIntelligenceReport';
import { visitorIntelligenceApi } from './lib/visitorIntelligenceApi';

const VisitorsPage = lazy(() => import('./pages/VisitorsPage'));
const ConceptsPage = lazy(() => import('./pages/concepts/ConceptsPage'));

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

function VisitorGate() {
  const { session, profile, isLoading } = useAuth();
  const [access, setAccess] = useState('checking');
  const localVisitorAccess = import.meta.env.DEV && (!import.meta.env.VITE_API_URL || /localhost|127\.0\.0\.1/.test(String(import.meta.env.VITE_API_URL)));
  useEffect(() => {
    let cancelled = false;
    if (!session) { setAccess('checking'); return () => { cancelled = true; }; }
    if (localVisitorAccess) { setAccess('allowed'); return () => { cancelled = true; }; }
    visitorIntelligenceApi.access()
      .then((result) => { if (!cancelled) setAccess(result?.authorized === true ? 'allowed' : 'denied'); })
      .catch((error) => { if (!cancelled) setAccess(error?.status === 403 ? 'denied' : 'unavailable'); });
    return () => { cancelled = true; };
  }, [localVisitorAccess, session?.access_token]);
  if (isLoading) return <SplashScreen />;
  if (!session) return <Navigate to="/auth" replace />;
  if (profile?.account_status === 'pending_deletion') return <AccountRecoveryPage />;
  if (access === 'denied') return <Navigate to="/dashboard" replace />;
  if (access === 'unavailable') return <div className="flex min-h-screen items-center justify-center bg-[#020202] p-6 text-center text-sm text-zinc-500">This internal page is temporarily unavailable.</div>;
  if (access !== 'allowed') return <SplashScreen />;
  return <Suspense fallback={<SplashScreen />}><VisitorsPage /></Suspense>;
}


function AppContent() {
  const { isLoading, isAppLoading } = useAuth();
  const location = useLocation();
  const isVoiceCloneEntry = location.pathname.startsWith('/clone');
  const isPublicStats = location.pathname === '/stats';
  const isVisitors = location.pathname.startsWith('/visitors');
  const isConcepts = location.pathname === '/concepts';

  if (isConcepts) {
    return <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0b0d0e' }} />}><ConceptsPage /></Suspense>;
  }

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
        <Route path="/visitors" element={<VisitorGate />} />

        {/* --- Fallback Route --- */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CookieNotice />
      {!isVisitors && <CustomerExperienceFeedback />}
    </>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <VisitorTracking />
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
