
import React from 'react';
import { AppView } from '../types';
import { ICONS } from '../constants';

interface NavigationProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  isMobile?: boolean;
  closeMobileMenu?: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  connectionStatus?: 'connected' | 'offline';
}

const NavItem: React.FC<{ 
  view: AppView; 
  currentView: AppView;
  label: string; 
  icon: React.ReactNode;
  onClick: () => void;
}> = ({ view, currentView, label, icon, onClick }) => {
  const isActive = currentView === view;
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 w-full text-left ${
        isActive 
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold shadow-sm border border-blue-100 dark:border-blue-800' 
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};

const Navigation: React.FC<NavigationProps> = ({ 
  currentView, 
  onNavigate, 
  isDarkMode, 
  toggleTheme,
  isMobile = false,
  closeMobileMenu,
  onRefresh,
  isRefreshing,
  connectionStatus = 'offline'
}) => {
  const handleNav = (view: AppView) => {
    onNavigate(view);
    if (closeMobileMenu) closeMobileMenu();
  };

  const navContent = (
    <nav className={`flex flex-col space-y-2 flex-1 ${isMobile ? '' : 'mt-10'}`}>
      <NavItem 
        view={AppView.DASHBOARD} 
        currentView={currentView}
        label="Dashboard" 
        icon={ICONS.Dashboard} 
        onClick={() => handleNav(AppView.DASHBOARD)} 
      />
      <NavItem 
        view={AppView.LOGS} 
        currentView={currentView}
        label="Call Logs" 
        icon={ICONS.Logs} 
        onClick={() => handleNav(AppView.LOGS)} 
      />
      <NavItem 
        view={AppView.CONTACTS} 
        currentView={currentView}
        label="Contacts" 
        icon={ICONS.Contacts} 
        onClick={() => handleNav(AppView.CONTACTS)} 
      />
      <NavItem 
        view={AppView.ACTIONS} 
        currentView={currentView}
        label="Actions" 
        icon={ICONS.Actions} 
        onClick={() => handleNav(AppView.ACTIONS)} 
      />
      <NavItem 
        view={AppView.LAB} 
        currentView={currentView}
        label="AI Processing" 
        icon={ICONS.Lab} 
        onClick={() => handleNav(AppView.LAB)} 
      />
    </nav>
  );

  const RefreshButton = (
    <button
      onClick={onRefresh}
      disabled={isRefreshing}
      className={`w-full flex items-center justify-center space-x-2 px-4 py-3 mb-2 rounded-xl border border-slate-200 dark:border-slate-700 font-medium transition-all ${
        isRefreshing 
          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-wait' 
          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400'
      }`}
    >
      <div className={isRefreshing ? 'animate-spin' : ''}>{ICONS.Refresh}</div>
      <span>{isRefreshing ? 'Syncing...' : 'Refresh Data'}</span>
    </button>
  );

  if (isMobile) {
    return (
      <>
        {navContent}
        <div className="mt-auto">
          {RefreshButton}
        </div>
      </>
    );
  }

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 sticky top-0 h-screen transition-colors duration-300">
      <div className="flex items-center space-x-3 px-2">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200 dark:shadow-none">
          <span className="font-bold text-xl">H</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">Horizon</h1>
      </div>

      {navContent}

      <div className="mt-auto space-y-4">
        {RefreshButton}

        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        >
          <span className="text-sm font-medium">Theme</span>
          {isDarkMode ? ICONS.Sun : ICONS.Moon}
        </button>

        {/* User / Status Profile */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 relative overflow-hidden">
          <div className="flex items-center space-x-3 relative z-10">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden">
              <img src="https://picsum.photos/32/32" alt="Avatar" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-white">Citizen Dev</p>
              <div className="flex items-center space-x-1.5">
                <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">{connectionStatus === 'connected' ? 'Live Sync' : 'Offline Mode'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Navigation;
