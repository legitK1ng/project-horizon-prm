import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils';

export interface PremiumButtonProps extends Omit<HTMLMotionProps<"button">, 'children'> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const PremiumButton = React.forwardRef<HTMLButtonElement, PremiumButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  loading,
  icon,
  ...props
}, ref) => {
  const variants = {
    primary: 'bg-horizon-500 hover:bg-horizon-600 text-white shadow-lg hover:shadow-xl-premium',
    secondary: 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white',
    ghost: 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs font-semibold',
    md: 'px-4 py-2 text-sm font-semibold',
    lg: 'px-6 py-3 text-base font-semibold',
  };

  return (
    <motion.button
      ref={ref}
      className={cn(
        'relative overflow-hidden rounded-lg font-semibold transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-horizon-500/50 focus:ring-offset-2 dark:focus:ring-offset-slate-950',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'group',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      {...props}
    >
      {/* Ripple effect overlay */}
      <span className="absolute inset-0 bg-white/20 opacity-0 group-active:opacity-100 transition-opacity pointer-events-none" />

      <span className="relative inline-flex items-center gap-2">
        {loading && (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {icon && !loading && icon}
        {children}
      </span>
    </motion.button>
  );
});

PremiumButton.displayName = 'PremiumButton';

export default PremiumButton;
