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
    // Tags
    tags?: string[];
    activeTag?: string | null;
    onTagSelect?: (tag: string | null) => void;
}

const Navigation: React.FC<NavigationProps> = ({
    currentView,
    onNavigate,
    isDarkMode,
    toggleTheme,
    onRefresh,
    isRefreshing,
    connectionStatus,
    tags = [],
    activeTag,
    onTagSelect,
    isMobile,
    closeMobileMenu,
}) => {
    // Collapsible state - default to expanded
    const [isExpanded, setIsExpanded] = React.useState(true);

    const navItems = [
        { id: 'DASHBOARD' as AppView, label: 'Dashboard', icon: ICONS.Dashboard },
        { id: 'LOGS' as AppView, label: 'Call Logs', icon: ICONS.Logs },
        { id: 'CONTACTS' as AppView, label: 'Contacts', icon: ICONS.Contacts },
        { id: 'ACTIONS' as AppView, label: 'Actions', icon: ICONS.Actions },
        { id: 'LAB' as AppView, label: 'Processing Lab', icon: ICONS.Lab },
    ];

    const handleNavClick = (view: AppView) => {
        onNavigate(view);
        if (onTagSelect) onTagSelect(null); // Clear tag filter when switching apps
        if (isMobile && closeMobileMenu) closeMobileMenu();
    };

    const handleTagClick = (tag: string) => {
        if (onTagSelect) {
            onTagSelect(tag);
            onNavigate('LOGS'); // Switch to Logs view to show filtered results
        }
        if (isMobile && closeMobileMenu) closeMobileMenu();
    };

    return (
        <nav
            className={`flex flex-col h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ${isExpanded ? 'w-64' : 'w-20'} ${isMobile ? 'w-full h-auto border-none' : 'hidden md:flex'}`}
        >
            {/* Header */}
            {!isMobile && (
                <div className={`p-4 flex items-center ${isExpanded ? 'gap-3' : 'justify-center'}`}>
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
            )}

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden thin-scrollbar py-2">
                {/* Apps Section */}
                <div className="px-3 space-y-1">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => handleNavClick(item.id)}
                            className={`w-full flex items-center ${isExpanded ? 'gap-4 px-4' : 'justify-center px-2'} py-3 rounded-r-full rounded-l-full transition-colors ${currentView === item.id && !activeTag
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            title={!isExpanded ? item.label : undefined}
                        >
                            <div className={`${currentView === item.id && !activeTag ? 'text-blue-700 dark:text-blue-300' : ''}`}>
                                {item.icon}
                            </div>
                            {isExpanded && <span className="text-sm tracking-wide">{item.label}</span>}
                        </button>
                    ))}
                </div>

                {/* Divider */}
                <div className="my-4 border-t border-slate-200 dark:border-slate-800 mx-4"></div>

                {/* Labels Section */}
                <div className="px-3 space-y-1">
                    {isExpanded && (
                        <div className="px-4 py-2 flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <span>Labels</span>
                            <button className="hover:text-slate-800 dark:hover:text-slate-200">Edit</button>
                        </div>
                    )}

                    {tags.map((tag) => (
                        <button
                            key={tag}
                            onClick={() => handleTagClick(tag)}
                            className={`w-full flex items-center ${isExpanded ? 'gap-4 px-4' : 'justify-center px-2'} py-3 rounded-r-full rounded-l-full transition-colors ${activeTag === tag
                                ? 'bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-100 font-medium'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            title={!isExpanded ? tag : undefined}
                        >
                            <div className={`${activeTag === tag ? 'text-amber-600' : 'text-slate-400'}`}>
                                {ICONS.Tag}
                            </div>
                            {isExpanded && <span className="text-sm truncate">{tag}</span>}
                        </button>
                    ))}

                    <button
                        onClick={() => { /* Open Edit Modal */ }}
                        className={`w-full flex items-center ${isExpanded ? 'gap-4 px-4' : 'justify-center px-2'} py-3 rounded-r-full rounded-l-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
                    >
                        <div className="text-slate-400">{ICONS.Edit}</div>
                        {isExpanded && <span className="text-sm">Edit labels</span>}
                    </button>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
                <button
                    onClick={onRefresh}
                    className={`w-full flex items-center ${isExpanded ? 'gap-4 px-4' : 'justify-center px-2'} py-3 rounded-r-full rounded-l-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
                    title="Refresh Data"
                >
                    <span className={isRefreshing ? 'animate-spin' : ''}>{ICONS.Refresh}</span>
                    {isExpanded && <span className="text-sm">Refresh</span>}
                </button>

                <button
                    onClick={toggleTheme}
                    className={`w-full flex items-center ${isExpanded ? 'gap-4 px-4' : 'justify-center px-2'} py-3 rounded-r-full rounded-l-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
                    title="Toggle Theme"
                >
                    {isDarkMode ? ICONS.Sun : ICONS.Moon}
                    {isExpanded && <span className="text-sm">{isDarkMode ? 'Light' : 'Dark'}</span>}
                </button>

                {isExpanded && (
                    <div className="px-4 py-2 text-xs text-slate-400 text-center">
                        {connectionStatus === 'connected' ? '● Online' : '○ Offline'}
                    </div>
                )}
            </div>
        </nav>
    );
};

export default Navigation;
