/**
 * Horizon PRM — App Entry
 * Items 4 (error handling), 22 (lazy loading), 10/11 (Actions route)
 */
import React, { Suspense, useEffect, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import Navigation from './components/Navigation';
import LoadingScreen from './components/LoadingScreen';
import FloatingChat from './components/common/FloatingChat';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useCheckHealth } from './hooks/useHorizonData';
import { useUiStore } from './store/appStore';

// Item 22: Lazy-load all page-level components for code splitting
const Dashboard   = lazy(() => import('./components/Dashboard'));
const ContactList = lazy(() => import('./components/ContactList'));
const CallLog     = lazy(() => import('./components/CallLog'));
const Actions     = lazy(() => import('./components/Actions'));   // Item 11
const Console     = lazy(() => import('./components/Console'));   // Item 9: merged Lab + Console

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

const AppContent: React.FC = () => {
  const { data: health, isLoading } = useCheckHealth();
  const { theme } = useUiStore();

  // Apply persisted theme on mount
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const [isInitializing, setIsInitializing] = React.useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setIsInitializing(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (isInitializing || isLoading) {
    return <LoadingScreen message="Initializing Horizon Intelligence..." />;
  }

  const isOnline =
    health?.status === 'online' ||
    health?.status === 'ok' ||
    health?.status === 'healthy';

  return (
    <Router>
      <div className="flex flex-col min-h-[100dvh] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 w-full overflow-x-hidden">
        <Navigation isOnline={isOnline} />

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
          <ErrorBoundary>
            {/* Item 22: Suspense boundary for lazy routes */}
            <Suspense fallback={<LoadingScreen message="Loading..." />}>
              <Routes>
                <Route path="/"         element={<Dashboard />} />
                <Route path="/calls"    element={<CallLog />} />
                <Route path="/contacts" element={<ContactList />} />
                <Route path="/actions"  element={<Actions />} />   {/* Item 10 */}
                <Route path="/console"  element={<Console />} />   {/* Item 9 */}
                {/* Legacy route redirect */}
                <Route path="/lab"      element={<Navigate to="/console" replace />} />
                <Route path="*"         element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>

        <footer 
          className="py-6 border-t border-slate-200 dark:border-slate-800 text-center text-slate-500 text-sm"
          style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <p>© {new Date().getFullYear()} Project Horizon — Relationship Intelligence Platform</p>
        </footer>

        <Toaster
          position="bottom-left"
          toastOptions={{
            className: 'dark:bg-slate-800 dark:text-slate-100',
            duration: 4000,
          }}
        />

        {/* Floating AI Chat — persists across all routes */}
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
