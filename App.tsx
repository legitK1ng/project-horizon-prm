
import React, { useState, useEffect } from 'react';
import { AppView, CallRecord, Contact } from './types';
import { MOCK_CALLS, MOCK_CONTACTS } from './services/mockData';
import { fetchProjectHorizonData } from './services/api';
import CallLog from './components/CallLog';
import Dashboard from './components/Dashboard';
import ContactList from './components/ContactList';
import ProcessingLab from './components/ProcessingLab';
import ActionsLog from './components/ActionsLog';
import Navigation from './components/Navigation';
import { HistoryProvider } from './context/HistoryContext';
import { ICONS } from './constants';

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'offline'>('offline');

  // Initial Data Fetch
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Attempt to fetch from API
      const data = await fetchProjectHorizonData();
      
      if (data) {
        setCalls(data.calls);
        setContacts(data.contacts);
        setConnectionStatus('connected');
        // Also save to local storage for offline capabilities/persistence
        localStorage.setItem('horizon_prm_calls', JSON.stringify(data.calls));
      } else {
        // Fallback to Mocks if URL is not configured
        console.log("Using Mock Data (API Not Configured)");
        setConnectionStatus('offline');
        loadMocksOrCached();
      }
    } catch (e) {
      console.error("Failed to load live data, falling back to cache/mocks", e);
      setConnectionStatus('offline');
      loadMocksOrCached();
    } finally {
      setIsLoading(false);
    }
  };

  const loadMocksOrCached = () => {
    const saved = localStorage.getItem('horizon_prm_calls');
    if (saved) {
      try {
        setCalls(JSON.parse(saved));
        setContacts(MOCK_CONTACTS); // Contacts usually static in mocks
      } catch (e) {
        setCalls(MOCK_CALLS);
        setContacts(MOCK_CONTACTS);
      }
    } else {
      setCalls(MOCK_CALLS);
      setContacts(MOCK_CONTACTS);
    }
  };

  // Theme Persistence
  useEffect(() => {
    const savedTheme = localStorage.getItem('horizon_theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newMode = !prev;
      if (newMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('horizon_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('horizon_theme', 'light');
      }
      return newMode;
    });
  };

  const saveCalls = (newCalls: CallRecord[]) => {
    setCalls(newCalls);
    localStorage.setItem('horizon_prm_calls', JSON.stringify(newCalls));
  };

  const addCall = (call: CallRecord) => {
    const newCalls = [call, ...calls];
    saveCalls(newCalls);
  };

  // Loading Screen
  if (isLoading && calls.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-slate-950">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 animate-pulse">
            <span className="font-bold text-3xl">H</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Connecting to Horizon</h2>
          <p className="text-slate-500 dark:text-slate-400">Syncing with Google Database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col md:flex-row bg-[#f8fafc] dark:bg-slate-950 transition-colors duration-300`}>
      {/* Sidebar - Desktop */}
      <Navigation 
        currentView={currentView}
        onNavigate={setCurrentView}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        onRefresh={loadData}
        isRefreshing={isLoading}
        connectionStatus={connectionStatus}
      />

      {/* Mobile Top Bar */}
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
        >
          {isMobileMenuOpen ? <div className="text-2xl">×</div> : <div className="text-2xl">☰</div>}
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
            onRefresh={loadData}
            isRefreshing={isLoading}
            connectionStatus={connectionStatus}
          />
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12">
        <div className="max-w-6xl mx-auto">
          {currentView === AppView.DASHBOARD && (
            <Dashboard 
              calls={calls} 
              contacts={contacts} 
              onNavigate={setCurrentView}
              connectionStatus={connectionStatus}
            />
          )}
          {currentView === AppView.LOGS && (
            <CallLog calls={calls} onAddCall={addCall} onUpdateCalls={saveCalls} />
          )}
          {currentView === AppView.CONTACTS && (
            <ContactList contacts={contacts} />
          )}
          {currentView === AppView.ACTIONS && (
             <ActionsLog />
          )}
          {currentView === AppView.LAB && (
            <ProcessingLab onProcessed={addCall} />
          )}
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
