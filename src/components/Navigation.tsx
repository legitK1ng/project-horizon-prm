import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FlaskConical,
  Terminal,
  Menu,
  X,
  Zap,
  ZapOff,
  PhoneCall
} from 'lucide-react';
import { cn } from '@/utils/ui';

interface NavigationProps {
  isOnline: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ isOnline }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/calls', label: 'Call Logs', icon: PhoneCall },
    { to: '/contacts', label: 'Contacts', icon: Users },
    { to: '/lab', label: 'Processing Lab', icon: FlaskConical },
    { to: '/console', label: 'System Console', icon: Terminal },
  ];

  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
              <span className="font-black text-xl">H</span>
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white leading-none block">Horizon</span>
              <div className="flex items-center gap-1.5 mt-1">
                {isOnline ? (
                  <>
                    <Zap size={10} className="text-emerald-500 fill-emerald-500" />
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter">Engine Online</span>
                  </>
                ) : (
                  <>
                    <ZapOff size={10} className="text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Offline Mode</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => cn(
                  "flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300",
                  isActive
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                )}
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Mobile Toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={cn(
        "md:hidden absolute top-20 left-0 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 transition-all duration-300 origin-top",
        isOpen ? "scale-y-100 opacity-100 visible" : "scale-y-0 opacity-0 invisible"
      )}>
        <div className="flex flex-col gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) => cn(
                "flex items-center gap-4 px-6 py-4 rounded-2xl text-base font-bold transition-all",
                isActive
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
