import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils';
import { triggerHaptic } from '../../utils/haptics';

interface PremiumButtonProps extends Omit<HTMLMotionProps<"button">, 'children'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
  loading?: boolean; // Added for compatibility with existing code
  icon?: React.ReactNode; // Added for compatibility with existing code
}

export const PremiumButton = React.forwardRef<HTMLButtonElement, PremiumButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, loading, leftIcon, icon, rightIcon, children, onClick, ...props }, ref) => {
    const isActuallyLoading = isLoading || loading;
    const finalLeftIcon = leftIcon || icon;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      triggerHaptic('LIGHT');
      if (onClick) onClick(e);
    };

    const variants = {
      primary: 'bg-horizon-500 text-white shadow-glow hover:bg-horizon-600 border-transparent',
      secondary: 'glass-effect glass-premium hover:bg-white/20 dark:hover:bg-slate-800/30 text-slate-900 dark:text-white border border-white/10 shadow-premium',
      outline: 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50',
      ghost: 'bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white',
      danger: 'bg-premium-error text-white shadow-glow hover:opacity-90 border-transparent',
      success: 'bg-premium-success text-white shadow-glow hover:opacity-90 border-transparent',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs font-bold uppercase tracking-wider',
      md: 'px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em]',
      lg: 'px-8 py-4 text-xs font-black uppercase tracking-[0.25em]',
      icon: 'p-2.5',
    };

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.98, y: 0 }}
        onClick={handleClick}
        className={cn(
          'relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-2xl border transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group font-bold',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {/* Shine Effect */}
        <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
        
        {isActuallyLoading ? (
          <div className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="italic uppercase tracking-widest text-[10px]">Processing</span>
          </div>
        ) : (
          <>
            {finalLeftIcon && <span className="transition-transform group-hover:scale-110">{finalLeftIcon}</span>}
            {children}
            {rightIcon && <span className="transition-transform group-hover:scale-110">{rightIcon}</span>}
          </>
        )}
      </motion.button>
    );
  }
);

PremiumButton.displayName = 'PremiumButton';

export default PremiumButton;

