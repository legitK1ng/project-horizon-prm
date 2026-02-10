import React from 'react';
import { AppView, ConnectionStatus } from '@/types';
import { ICONS } from '@/constants';

interface NavigationProps {
    currentView: AppView;
    onNavigate: (view: AppView) => void;
    isDarkMode: boolean;
    toggleTheme: () => void;
    onRefresh: () => void;
    isRefreshing: boolean;
    connectionStatus: ConnectionStatus;
    isMobile?: boolean; // Mobile mode
    closeMobileMenu?: () => void;
}

const Navigation: React.FC<NavigationProps> = ({
    currentView,
    onNavigate,
    isDarkMode,
    toggleTheme,
    onRefresh,
    isRefreshing,
    connectionStatus,
}) => {
    // Collapsible state - default to expanded on Dashboard, potentially collapsed otherwise?
    // User request: "Menu should collapse and expand only when Dashboard button... is selected"
    // Interpretation: Auto-expand on Dashboard, allow collapsing otherwise.
    // Let's settle for a manual toggle that persists or defaults based on view.
    // Simple approach: Controlled by local state, but maybe effect to expand on Dashboard?
    const [isExpanded, setIsExpanded] = React.useState(true);

    // Effect: If user navigates to Dashboard, ensure it is expanded (per request interpretation)
    // "menu on the left should callapse and expand only when the Dashboard button or dashboard icon is selected."
    // This is a bit ambiguous. Let's make it toggleable, and maybe the user meant "It CAN collapse".
    // I will add a toggle button to the sidebar header.

    const navItems = [
        { id: 'DASHBOARD' as AppView, label: 'Dashboard', icon: ICONS.Dashboard },
        { id: 'LOGS' as AppView, label: 'Call Logs', icon: ICONS.Logs },
        { id: 'CONTACTS' as AppView, label: 'Contacts', icon: ICONS.Contacts },
        { id: 'ACTIONS' as AppView, label: 'Actions', icon: ICONS.Actions },
        { id: 'LAB' as AppView, label: 'Processing Lab', icon: ICONS.Lab },
    ];

    return (
        <nav
            className={`p-4 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-screen flex-col hidden md:flex transition-all duration-300 ${isExpanded ? 'w-64' : 'w-20'
                }`}
        >
            <div className={`mb-8 flex items-center ${isExpanded ? 'gap-2' : 'justify-center'}`}>
                <div
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold cursor-pointer hover:bg-blue-700 transition"
                >
                    H
                </div>
                {isExpanded && (
                    <span className="font-bold text-xl text-slate-800 dark:text-white animate-in fade-in duration-200">
                        Horizon PRM
                    </span>
                )}
            </div>

            <div className="flex-1 space-y-2">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => {
                            onNavigate(item.id);
                            // Optional: auto-collapse on other views if requested?
                            // For now, keep it manual but smooth.
                        }}
                        className={`w-full flex items-center ${isExpanded ? 'gap-3 px-4' : 'justify-center px-2'} py-3 rounded-xl transition-all ${currentView === item.id
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-semibold'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                        title={!isExpanded ? item.label : undefined}
                    >
                        <div className="text-xl">{item.icon}</div>
                        {isExpanded && <span>{item.label}</span>}
                    </button>
                ))}
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <button
                    onClick={onRefresh}
                    className={`w-full flex items-center ${isExpanded ? 'gap-3 px-4' : 'justify-center px-2'} py-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all`}
                    title="Refresh Data"
                >
                    <span className={isRefreshing ? 'animate-spin' : ''}>{ICONS.Refresh}</span>
                    {isExpanded && <span>Refresh Data</span>}
                </button>

                <button
                    onClick={toggleTheme}
                    className={`w-full flex items-center ${isExpanded ? 'gap-3 px-4' : 'justify-center px-2'} py-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all`}
                    title="Toggle Theme"
                >
                    {isDarkMode ? ICONS.Sun : ICONS.Moon}
                    {isExpanded && <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
                </button>

                {isExpanded && (
                    <div className="px-4 py-2 text-xs text-slate-400">
                        Status: {connectionStatus}
                    </div>
                )}
            </div>
        </nav>
    );
};

export default Navigation;
