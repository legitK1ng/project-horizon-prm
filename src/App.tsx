import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

import Navigation from "./components/Navigation";
import Dashboard from "./components/Dashboard";
import ContactList from "./components/ContactList";
import Lab from "./components/Lab";
import Console from "./components/Console";
import LoadingScreen from "./components/LoadingScreen";
import FloatingChat from "./components/common/FloatingChat";
import CallLog from "./components/CallLog";
import { useCheckHealth } from "./hooks/useHorizonData";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

const AppContent: React.FC = () => {
  const { data: health, isLoading } = useCheckHealth();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsInitializing(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (isInitializing || isLoading) {
    return <LoadingScreen message="Initializing Horizon Intelligence..." />;
  }

  // REQ-014: Accept 'ok' or 'healthy' from FastAPI health check
  const isOnline = health?.status === "online" || health?.status === "ok" || health?.status === "healthy";

  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
        <Navigation isOnline={isOnline} />

        <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/calls" element={<CallLog />} />
            <Route path="/contacts" element={<ContactList />} />
            <Route path="/lab" element={<Lab />} />
            <Route path="/console" element={<Console />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <footer className="py-6 border-t border-slate-200 dark:border-slate-800 text-center text-slate-500 text-sm">
          <p>© {new Date().getFullYear()} Project Horizon — Relationship Intelligence Platform</p>
        </footer>

        <Toaster
          position="bottom-left"
          toastOptions={{
            className: "dark:bg-slate-800 dark:text-slate-100",
            duration: 4000,
          }}
        />

        {/* Floating AI Chat — persists across all routes */}
        <FloatingChat />
      </div>
    </Router>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
};

export default App;
