import React, { Suspense, useState, useCallback, useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Capacitor } from '@capacitor/core';
import OfflineBanner from '@/components/chat/OfflineBanner';
import { CallProvider } from '@/contexts/CallContext';
import NotificationProvider from '@/components/NotificationProvider';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { PWAInstallBanner } from '@/components/PWAInstallBanner';
import SplashScreen from '@/components/SplashScreen';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useBiometric } from '@/hooks/useBiometric';
import BiometricLockScreen from '@/components/BiometricLockScreen';
import { recordActivity } from '@/services/biometric';

const Pagos = React.lazy(() => import('./pages/Pagos'));
// Global call system
import GlobalIncomingCallOverlay from '@/components/GlobalIncomingCallOverlay';
import GlobalActiveCallOverlay from '@/components/GlobalActiveCallOverlay';
import { useGlobalCallManager } from '@/hooks/useGlobalCallManager';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';

// ===============================================================================
// LAZY-LOADED PAGES
// ===============================================================================

const Auth = React.lazy(() => import('./pages/Auth').then((m) => ({ default: m.Auth ?? m.default })));
const HomeScreen = React.lazy(() => import('./pages/HomeScreen'));
const Mensajes = React.lazy(() => import('./pages/Mensajes'));
const Comunidad = React.lazy(() => import('./pages/Comunidad'));
const Perfil = React.lazy(() => import('./pages/Perfil'));
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = React.lazy(() => import('./pages/TermsOfService'));
const NotFound = React.lazy(() => import('./pages/NotFound'));
const AdminReports = React.lazy(() => import('./pages/AdminReports'));
const Landing = React.lazy(() => import('./pages/Landing'));

// ===============================================================================
// LOADING FALLBACK
// ===============================================================================

const PageLoader: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-950">
    <div className="text-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 mx-auto mb-3" />
      <p className="text-sm font-medium text-gray-400">Cargando...</p>
    </div>
  </div>
);

// ===============================================================================
// QUERY CLIENT
// ===============================================================================

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
    },
  },
});

// ===============================================================================
// ROUTES
// ===============================================================================

const isNativeApp = Capacitor.isNativePlatform();

const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="auth" element={user ? <Navigate to="/home" replace /> : <Auth />} />

        {/* Public legal pages -- accessible without auth */}
        <Route path="privacidad" element={<PrivacyPolicy />} />
        <Route path="terminos" element={<TermsOfService />} />

        {/* Native: skip Landing, go straight to home or auth */}
        {/* Web: show Landing for visitors, redirect logged-in to home */}
        <Route index element={
          isNativeApp
            ? <Navigate to={user ? '/home' : '/auth'} replace />
            : (user ? <Navigate to="/home" replace /> : <Landing />)
        } />

        {/* Home screen -- icon grid (authenticated) */}
        <Route path="home" element={
          <ProtectedRoute><HomeScreen /></ProtectedRoute>
        } />

        {/* Pagos */}
        <Route path="pagos" element={
          <ProtectedRoute><Pagos /></ProtectedRoute>
        } />

        {/* Messaging -- individual chats & groups */}
        <Route path="mensajes" element={
          <ProtectedRoute><Mensajes /></ProtectedRoute>
        } />

        {/* Comunidad -- MexiVanza community feed */}
        <Route path="comunidad" element={
          <ProtectedRoute><Comunidad /></ProtectedRoute>
        } />

        {/* Perfil -- MexiVanza user profile (in-app) */}
        <Route path="perfil/:userId" element={
          <ProtectedRoute><Perfil /></ProtectedRoute>
        } />

        {/* Everything else -> 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

// ===============================================================================
// CALL MANAGER
// ===============================================================================

const CallManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    acceptCall,
    rejectCall,
    endActiveCall,
    toggleMute,
    toggleVideo,
  } = useGlobalCallManager();

  return (
    <>
      {children}
      <GlobalIncomingCallOverlay
        onAccept={acceptCall}
        onReject={rejectCall}
      />
      <GlobalActiveCallOverlay
        onEndCall={endActiveCall}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
      />
    </>
  );
};

// Push handled by useServiceWorker in AppInner

// ===============================================================================
// INNER APP
// ===============================================================================

const AppInner: React.FC = () => {
  const { user } = useAuth();
  useServiceWorker(user?.id);
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashFinished = useCallback(() => setSplashDone(true), []);

  // Biometric gate on app open + inactivity
  const biometric = useBiometric();
  const [biometricVerified, setBiometricVerified] = useState(false);

  useEffect(() => {
    if (!user || !splashDone) return;
    if (!biometric.config.enabled) { setBiometricVerified(true); return; }

    // Auto-verify on mount (triggers biometric prompt on native)
    biometric.gateAppOpen().then(ok => {
      setBiometricVerified(ok || !biometric.status.isAvailable);
      if (ok) recordActivity();
    });
  }, [user, splashDone, biometric.config.enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Inactivity lock overlay
  const showInactivityLock = biometric.isLocked && biometricVerified;

  return (
    <>
      {!splashDone && <SplashScreen onFinished={handleSplashFinished} />}

      {/* Biometric gate: blocks app until verified */}
      {splashDone && user && biometric.config.enabled && !biometricVerified && (
        <BiometricLockScreen
          reason="Desbloquea MexiChat para continuar"
          onUnlocked={() => { setBiometricVerified(true); recordActivity(); }}
          onPinFallback={(pin) => {
            const stored = localStorage.getItem('mc_chat_lock_pin');
            return stored ? btoa(pin + '_mc_salt') === stored : false;
          }}
        />
      )}

      {/* Inactivity lock overlay */}
      {showInactivityLock && (
        <BiometricLockScreen
          reason="Sesion inactiva â€” verifica tu identidad"
          onUnlocked={() => biometric.unlockInactivity()}
          onPinFallback={(pin) => {
            const stored = localStorage.getItem('mc_chat_lock_pin');
            return stored ? btoa(pin + '_mc_salt') === stored : false;
          }}
        />
      )}

      <NotificationProvider>
        <CallManager>
          <OfflineBanner />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
          <PWAInstallBanner />
        </CallManager>
      </NotificationProvider>
    </>
  );
};

// ===============================================================================
// APP
// ===============================================================================

const App: React.FC = () => {
  return (
    <HelmetProvider>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <LanguageProvider>
              <TooltipProvider>
                <CallProvider>
                  <AppInner />
                </CallProvider>
              </TooltipProvider>
            </LanguageProvider>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
    </HelmetProvider>
  );
};

export default App;
