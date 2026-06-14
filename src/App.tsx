/**
 * Horizon PRM — App Entry
 */
import React, { Suspense, useEffect, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { NavigationBar } from '@capgo/capacitor-navigation-bar';
import { motion, AnimatePresence } from 'framer-motion';

import Navigation from './components/Navigation';
import LoadingScreen from './components/LoadingScreen';
import FloatingChat from './components/common/FloatingChat';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useCheckHealth } from './hooks/useHorizonData';
import { useUiStore } from './store/appStore';
import { useDataStore } from './store/dataStore';
import { guardianService } from './services/GuardianService';
import SystemStatusBar from './components/SystemStatusBar';
import { SyncService } from './services/syncService';

// Lazy-load page components
const Dashboard        = lazy(() => import('./components/Dashboard'));
const ContactList      = lazy(() => import('./components/ContactList'));
const CallLog          = lazy(() => import('./components/CallLog'));
const Actions          = lazy(() => import('./components/Actions'));
const Console          = lazy(() => import('./components/Console'));
const IngestionSettings = lazy(() => import('./components/IngestionSettings'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

/**
 * Animated Routes Component to handle page transitions
 */
const AnimatedRoutes: React.FC = () => {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, x: 20, filter: 'blur(10px)' }}
        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, x: -20, filter: 'blur(10px)' }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full"
      >
        <Suspense fallback={<LoadingScreen message="Quantum Synchronization..." />}>
          <Routes location={location}>
            <Route path="/"         element={<Dashboard />} />
            <Route path="/calls"    element={<CallLog />} />
            <Route path="/contacts" element={<ContactList />} />
            <Route path="/actions"  element={<Actions />} />
            <Route path="/console"   element={<Console />} />
            <Route path="/settings"  element={<IngestionSettings />} />
            <Route path="/lab"       element={<Navigate to="/console" replace />} />
            <Route path="*"         element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
};

const AppContent: React.FC = () => {
  const { data: health, isLoading } = useCheckHealth();
  const { theme } = useUiStore();

  // 📱 Capacitor Native Integration & Global DOM Sync
  useEffect(() => {
    const syncUI = async () => {
      // 1. Sync DOM for all platforms (web + native)
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      // 2. Native-specific sync
      if (!Capacitor.isNativePlatform()) return;

      try {
        if (theme === 'dark') {
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#020617' }); // slate-950
          if (Capacitor.getPlatform() === 'android') {
            await NavigationBar.setNavigationBarColor({ color: '#020617', darkButtons: false });
          }
        } else {
          await StatusBar.setStyle({ style: Style.Light });
          await StatusBar.setBackgroundColor({ color: '#f8fafc' }); // slate-50
          if (Capacitor.getPlatform() === 'android') {
            await NavigationBar.setNavigationBarColor({ color: '#f8fafc', darkButtons: true });
          }
        }
      } catch (err) {
        console.warn('Native UI Sync Failed:', err);
      }
    };

    syncUI();
  }, [theme]);

  const [isInitializing, setIsInitializing] = React.useState(true);
  const isDataCacheInitializing = useDataStore((state) => state.isInitializing);

  // Initialize System Guardian and Sync Service
  useEffect(() => {
    guardianService.init();
    SyncService.start();
    const timer = setTimeout(() => setIsInitializing(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  if (isInitializing || isLoading || isDataCacheInitializing) {
    return <LoadingScreen message="Horizon OS Core Initializing..." />;
  }

  const isOnline =
    health?.status === 'online' ||
    health?.status === 'ok' ||
    health?.status === 'healthy';

  return (
    <Router>
      <div className="flex flex-col min-h-[100dvh] horizon-scene text-[rgb(235,230,225)] transition-colors duration-700 w-full overflow-x-hidden bg-mesh selection:bg-[rgba(210,148,158,0.22)]">
        <SystemStatusBar />
        <Navigation isOnline={isOnline} />

        <main className="flex-1 w-full max-w-[1920px] mx-auto px-4 sm:px-8 lg:px-12 py-8 pb-32 md:pb-12">
          <ErrorBoundary>
            <AnimatedRoutes />
          </ErrorBoundary>
        </main>

        <footer 
          className="py-16 border-t border-[rgba(255,255,255,0.07)] text-center relative overflow-hidden"
          style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-100/50 dark:to-white/[0.02] pointer-events-none" />
          <div className="max-w-xs mx-auto space-y-6 relative z-10">
             <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent" />
             <div className="space-y-2">
               <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500 italic">
                 Horizon OS Architecture v2.8
               </p>
               <div className="flex items-center justify-center gap-2">
                 <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                 <p className="text-[10px] text-slate-500 font-medium tracking-widest uppercase">
                   Secured By Quantum Guardian
                 </p>
               </div>
             </div>
             <p className="text-[9px] text-slate-400 dark:text-slate-600 font-medium uppercase tracking-[0.1em]">
               © {new Date().getFullYear()} — Premium Relationship Intelligence
             </p>
          </div>
        </footer>

        <Toaster
          position="bottom-left"
          toastOptions={{
            className: 'glass-effect !rounded-[2rem] !p-6 !text-[13px] !font-bold !border !border-white/10 !shadow-2xl dark:!text-white',
            duration: 5000,
          }}
        />

        <FloatingChat />
      </div>
    </Router>
  );
};


const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <AppContent />
  </QueryClientProvider>
);

export default App;
