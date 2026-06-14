import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Terminal,
  PhoneCall,
  ListTodo,
  Sun,
  Moon,
  Activity,
  Settings2
} from 'lucide-react';
import { cn } from '@/utils/ui';
import { useUiStore } from '@/store/appStore';
import { triggerHaptic } from '@/utils/haptics';

interface NavigationProps {
  isOnline: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ isOnline }) => {
  const [isScrolled, setIsScrolled] = React.useState(false);
  const { theme, toggleTheme } = useUiStore();
  const location = useLocation();

  // Handle scroll effect for top bar

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { to: '/',          label: 'Dashboard', icon: LayoutDashboard },
    { to: '/calls',     label: 'Calls',     icon: PhoneCall },
    { to: '/contacts',  label: 'Contacts',  icon: Users },
    { to: '/actions',   label: 'Actions',   icon: ListTodo },
    { to: '/console',   label: 'Console',   icon: Terminal },
    { to: '/settings',  label: 'Ingest',    icon: Settings2 },
  ];

  const containerVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
        type: 'spring',
        stiffness: 100,
        damping: 20
      } as const,
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.9, y: -10 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 200, damping: 20 } as const
    }
  };

  return (
    <>
      {/* Desktop/Web Navigation (Top Bar) — Refined for Luxury */}
      <nav
        className={cn(
          "sticky top-0 z-50 w-full transition-all duration-1000",
          isScrolled 
            ? "bg-white/60 dark:bg-slate-950/60 backdrop-blur-[50px] border-b border-slate-200/40 dark:border-white/5 h-16 shadow-xl-premium" 
            : "bg-transparent h-20",
          "hidden md:block px-6 lg:px-12"
        )}
      >
        <div className="max-w-[1800px] mx-auto h-full">
          <div className="flex items-center justify-between h-full">
            {/* Logo Section */}
            <motion.div 
              className="flex items-center gap-8"
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="relative group cursor-pointer" onClick={() => triggerHaptic('MEDIUM')}>
                <div className="absolute -inset-2 bg-blue-600 blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-1000 rounded-full" />
                <motion.div 
                  whileHover={{ scale: 1.1, rotate: -3 }}
                  whileTap={{ scale: 0.9 }}
                  className="relative w-10 h-10 bg-slate-950 dark:bg-white rounded-[1rem] flex items-center justify-center text-white dark:text-slate-950 shadow-2xl overflow-hidden border border-white/10 dark:border-black/5"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="font-black text-2xl tracking-tighter italic relative z-10">H</span>
                </motion.div>
              </div>
              <div className="space-y-1">
                <h1 className="font-black text-2xl tracking-[0.15em] text-slate-950 dark:text-white leading-none uppercase italic text-glow">
                  Horizon<span className="text-blue-500 not-italic">_</span>PRM
                </h1>
                <div className="flex items-center gap-3 bg-slate-200/50 dark:bg-white/5 px-3 py-1 rounded-full border border-slate-300/30 dark:border-white/5">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    isOnline ? "bg-emerald-500 animate-pulse shadow-glow-emerald" : "bg-slate-400"
                  )} />
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-[0.2em] leading-none italic",
                    isOnline ? "text-emerald-500" : "text-slate-400"
                  )}>
                    {isOnline ? 'Core_Link_Established' : 'Signal_Interrupted'}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Desktop Nav Items */}
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="flex items-center gap-3 bg-slate-100/40 dark:bg-white/5 p-2 rounded-[2rem] border border-slate-200/30 dark:border-white/5 backdrop-blur-xl shadow-inner"
            >
              {navItems.map((item) => {
                const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
                return (
                  <motion.div key={item.to} variants={itemVariants}>
                    <NavLink
                      to={item.to}
                      onClick={() => triggerHaptic('LIGHT')}
                      className={cn(
                        'relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-700 overflow-hidden group',
                        isActive
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="nav-active-pill"
                          className="absolute inset-0 bg-white dark:bg-slate-900 shadow-elevated border border-slate-200/40 dark:border-white/10 rounded-[1.5rem] z-0"
                          transition={{ type: 'spring', stiffness: 350, damping: 35 } as const}
                        />
                      )}
                      <item.icon size={16} className={cn("relative z-10 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6", isActive && "text-blue-500 scale-110 shadow-glow")} />
                      <span className="relative z-10 italic group-hover:tracking-[0.25em] transition-all duration-700">{item.label}</span>
                    </NavLink>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Right Side Controls */}
            <motion.div 
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-6"
            >
              <div className="hidden lg:flex items-center gap-6 px-6 border-r border-slate-200/50 dark:border-white/5 h-10">
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic">System_Resonance</span>
                    <Activity size={12} className="text-blue-500 animate-pulse" />
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="w-24 h-1.5 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden p-[1px]">
                      <motion.div 
                        animate={{ width: '68%' }}
                        transition={{ duration: 2, ease: "easeInOut" }}
                        className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full shadow-glow-blue"
                      />
                    </div>
                    <span className="text-[10px] font-black text-blue-500 font-mono">68%</span>
                  </div>
                </div>
              </div>
              
              <motion.button
                whileHover={{ scale: 1.1, rotate: 180 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 } as const}
                onClick={() => {
                  toggleTheme();
                  triggerHaptic('MEDIUM');
                }}
                className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-700',
                  'bg-white dark:bg-slate-900 shadow-xl-premium border border-slate-200/40 dark:border-white/10',
                  'text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 group'
                )}
              >
                {theme === 'dark' ? <Sun size={18} className="group-hover:text-amber-400 transition-colors" /> : <Moon size={18} className="group-hover:text-blue-600 transition-colors" />}
              </motion.button>
            </motion.div>
          </div>
        </div>
      </nav>

      {/* Mobile Header (Top) — Floating Clean Design */}
      <div 
        className={cn(
          "md:hidden sticky top-0 z-50 transition-all duration-700",
          isScrolled 
            ? "bg-white/90 dark:bg-slate-950/90 backdrop-blur-3xl h-14 shadow-xl border-b border-slate-200/30 dark:border-white/5" 
            : "bg-white/40 dark:bg-slate-900/40 backdrop-blur-md h-16",
          "flex items-center justify-between px-6"
        )}
      >
        <div className="flex items-center gap-5">
          <motion.div 
            whileHover={{ scale: 1.1 }}
            className="w-10 h-10 bg-slate-950 dark:bg-white rounded-xl flex items-center justify-center text-white dark:text-slate-950 font-black italic shadow-2xl border border-white/10"
          >
            <span className="text-xl">H</span>
          </motion.div>
          <div className="space-y-0.5">
            <span className="font-black tracking-[0.1em] text-lg text-slate-950 dark:text-white uppercase italic leading-none block">HORIZON</span>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.3em] italic block">SYSTEM_ACTIVE</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              toggleTheme();
              triggerHaptic('MEDIUM');
            }}
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-white/5 shadow-premium flex items-center justify-center"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </motion.button>
        </div>
      </div>

      {/* Mobile Navigation (Bottom Bar) — Floating Luxurious Design */}
      <div className="md:hidden fixed bottom-6 left-6 right-6 z-50">
        <nav 
          className="bg-white/80 dark:bg-slate-950/80 backdrop-blur-3xl border border-slate-200/30 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[2rem] overflow-hidden"
        >
          <div className="flex items-center justify-around h-16 px-4">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => triggerHaptic('LIGHT')}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 w-full h-full transition-all duration-700 relative group",
                    isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400"
                  )}
                >
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        layoutId="mobile-nav-pill"
                        className="absolute inset-1.5 bg-blue-600/10 dark:bg-blue-400/10 rounded-2xl border border-blue-600/20 dark:border-blue-400/20 z-0"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 } as const}
                      />
                    )}
                  </AnimatePresence>

                  <div className="relative z-10 flex flex-col items-center">
                    <motion.div
                      animate={isActive ? { scale: 1.1, y: -2 } : { scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 15 } as const}
                    >
                      <item.icon 
                        size={22} 
                        className={cn(
                          "transition-all duration-500", 
                          isActive ? "text-blue-600 dark:text-blue-400 shadow-glow" : "opacity-70 group-hover:opacity-100"
                        )} 
                      />
                    </motion.div>
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-widest italic transition-all duration-500 mt-1",
                      isActive ? "opacity-100 scale-100" : "opacity-0 scale-90"
                    )}>
                      {item.label}
                    </span>
                  </div>
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Spacer for mobile bottom nav */}
      <div className="md:hidden h-24 pb-safe" />
    </>
  );
};

export default Navigation;
