import React, { useState } from 'react';
import { AppView } from '@/types';
import { APP_VIEW } from '@/constants';
import { HistoryProvider } from '@/contexts/HistoryContext';
import { useData } from '@/hooks/useData';
import { useTheme } from '@/hooks/useTheme';

// Components
import Navigation from '@/components/Navigation';
import Dashboard from '@/components/Dashboard';
import CallLog from '@/components/CallLog';
import ContactList from '@/components/ContactList';
import ActionsLog from '@/components/ActionsLog';
import Lab from '@/components/Lab';
import LoadingScreen from '@/components/LoadingScreen';

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(APP_VIEW.DASHBOARD);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { isDarkMode, toggleTheme } = useTheme();
  const { calls, contacts, isLoading, connectionStatus, refreshData, addCall } =
    useData();

  // Show loading screen on initial load
  if (isLoading && calls.length === 0) {
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
      />

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <span className="font-bold text-lg">H</span>
          </div>
          <span className="font-bold text-slate-800 dark:text-white">Horizon PRM</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-600 dark:text-slate-300"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? (
            <div className="text-2xl">×</div>
          ) : (
            <div className="text-2xl">☰</div>
          )}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-white dark:bg-slate-900 z-40 pt-20 px-6 flex flex-col space-y-4">
          <Navigation
            currentView={currentView}
            onNavigate={setCurrentView}
            isDarkMode={isDarkMode}
            toggleTheme={toggleTheme}
            isMobile={true}
            closeMobileMenu={() => setIsMobileMenuOpen(false)}
            onRefresh={refreshData}
            isRefreshing={isLoading}
            connectionStatus={connectionStatus}
          />
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12">
        <div className="max-w-6xl mx-auto">
          {currentView === APP_VIEW.DASHBOARD && (
            <Dashboard
              calls={calls}
              contacts={contacts}
              onNavigate={setCurrentView}
              connectionStatus={connectionStatus}
            />
          )}

          {currentView === APP_VIEW.LOGS && (
            <CallLog calls={calls} />
          )}

          {currentView === APP_VIEW.CONTACTS && <ContactList contacts={contacts} />}

          {currentView === APP_VIEW.ACTIONS && <ActionsLog />}

          {currentView === APP_VIEW.LAB && <Lab onSaveLog={addCall} />}
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HistoryProvider>
      <AppContent />
    </HistoryProvider>
  );
};

export default App;
