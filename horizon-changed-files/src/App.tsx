import React, { useState, useEffect, useCallback, Suspense, memo } from 'react';
import { AppView, ConnectionStatus } from '@/types';
import { APP_VIEW } from '@/constants';
import { HistoryProvider } from '@/contexts/HistoryContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useContacts, useCalls } from '@/hooks/useHorizonData';
import { healthApi } from '@/services/apiClient';
import { useTheme } from '@/hooks/useTheme';

// Core Components
import Navigation from '@/components/Navigation';
import LoadingScreen from '@/components/LoadingScreen';
import CommandPalette from '@/components/CommandPalette';
import UnifiedContactDrawer from '@/components/common/UnifiedContactDrawer';
import AssistantChat from '@/components/AssistantChat';
import { ToastProvider } from '@/components/common/Toast';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

// Lazy Loaded Views
const Dashboard = React.lazy(() => import('@/components/Dashboard'));
const CallLog = React.lazy(() => import('@/components/CallLog'));
const ContactList = React.lazy(() => import('@/components/ContactList'));
const ActionsLog = React.lazy(() => import('@/components/ActionsLog'));
const Lab = React.lazy(() => import('@/components/Lab'));

const MobileHeader = memo(({ isMobileMenuOpen, setIsMobileMenuOpen }: {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (o: boolean) => void;
}) => (
  <header className="md:hidden flex items-center justify-between px-6 py-4 glass border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
    <div className="flex items-center space-x-2">
      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
        <span className="font-bold text-lg">H</span>
      </div>
      <span className="font-bold text-slate-800 dark:text-white">Horizon PRM</span>
    </div>
    <button
      onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
      aria-label="Toggle menu"
    >
      <div className="text-2xl">{isMobileMenuOpen ? '×' : '☰'}</div>
    </button>
  </header>
));

const FallbackLoader = () => (
  <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
    <p className="mt-4 text-slate-500 font-medium">Loading module...</p>
  </div>
);

const MainLayout: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(APP_VIEW.DASHBOARD);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [drawerContact, setDrawerContact] = useState<string | null>(null);

  const { isDarkMode, toggleTheme } = useTheme();
  const queryClient = useQueryClient();

  const { data: contactsData, isLoading: isContactsLoading } = useContacts();
  const { data: callsData, isLoading: isCallsLoading } = useCalls();

  // FIX: Health check — accept 'ok', 'healthy', or 'online' as connected
  const { data: healthData } = useQuery({
    queryKey: ['health'],
    queryFn: () => healthApi.check().catch(() => null),
    retry: 1,
    refetchInterval: 30_000,
  });

  const contacts = Array.isArray(contactsData) ? contactsData : (contactsData as any)?.data || [];
  const calls = Array.isArray(callsData) ? callsData : (callsData as any)?.data || [];

  // Only block render if we have zero data AND are still on first fetch
  const isLoading = (isContactsLoading && contacts.length === 0) || (isCallsLoading && calls.length === 0);

  // FIX: accept any truthy status string as connected; only show offline if health call explicitly failed
  const connectionStatus: ConnectionStatus = healthData
    ? (['ok', 'healthy', 'online'].includes(healthData.status) ? 'connected' : 'offline')
    : 'offline';

  const tags: string[] = [];

  // FIX: use TanStack invalidation instead of full page reload
  const refreshData = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  const addCall = () => {
    console.warn('Direct addCall from App.tsx is deprecated. Use Lab or ACR sync.');
  };

  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setIsCommandPaletteOpen(prev => !prev);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

  const handleMobileNav = useCallback((view: AppView) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false);
  }, []);

  const handleTagSelect = useCallback((tag: string | null) => {
    setActiveTag(tag);
    setIsMobileMenuOpen(false);
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Desktop Sidebar */}
      <Navigation
        currentView={currentView}
        onNavigate={setCurrentView}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        onRefresh={refreshData}
        isRefreshing={isLoading}
        connectionStatus={connectionStatus}
        tags={tags}
        activeTag={activeTag}
        onTagSelect={setActiveTag}
      />

      <MobileHeader isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

      {isMobileMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40 animate-in fade-in duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="md:hidden fixed inset-y-0 left-0 w-72 bg-white dark:bg-slate-900 z-50 shadow-xl pt-4 flex flex-col">
            <Navigation
              currentView={currentView}
              onNavigate={handleMobileNav}
              isDarkMode={isDarkMode}
              toggleTheme={toggleTheme}
              isMobile={true}
              closeMobileMenu={() => setIsMobileMenuOpen(false)}
              onRefresh={refreshData}
              isRefreshing={isLoading}
              connectionStatus={connectionStatus}
              tags={tags}
              activeTag={activeTag}
              onTagSelect={handleTagSelect}
            />
          </div>
        </>
      )}

      <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12">
        <div className="max-w-6xl mx-auto" key={currentView}>
          <ErrorBoundary>
            <Suspense fallback={<FallbackLoader />}>
              {currentView === APP_VIEW.DASHBOARD && (
                <Dashboard onNavigate={setCurrentView} connectionStatus={connectionStatus} />
              )}
              {currentView === APP_VIEW.LOGS && (
                <CallLog activeTag={activeTag} onContactClick={setDrawerContact} />
              )}
              {currentView === APP_VIEW.CONTACTS && <ContactList />}
              {currentView === APP_VIEW.ACTIONS && <ActionsLog />}
              {currentView === APP_VIEW.LAB && <Lab onSaveLog={addCall} />}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={setCurrentView}
        calls={calls}
        contacts={contacts}
      />

      <UnifiedContactDrawer
        contactName={drawerContact}
        onClose={() => setDrawerContact(null)}
        calls={calls}
        contacts={contacts}
      />

      <AssistantChat />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <HistoryProvider>
        <ToastProvider>
          <MainLayout />
        </ToastProvider>
      </HistoryProvider>
    </ErrorBoundary>
  );
};

export default App;
