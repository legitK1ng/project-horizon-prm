import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils';

interface GlassCardProps extends Omit<HTMLMotionProps<"div">, 'children'> {
  children?: React.ReactNode;
  gradient?: boolean;
  hoverEffect?: boolean;
  blur?: 'sm' | 'md' | 'lg' | 'xl';
  scanlines?: boolean;
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, gradient = true, hoverEffect = true, blur = 'xl', scanlines = false, children, ...props }, ref) => {
    const blurs = {
      sm: 'backdrop-blur-sm',
      md: 'backdrop-blur-md',
      lg: 'backdrop-blur-lg',
      xl: 'backdrop-blur-xl',
    };

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className={cn(
          'relative overflow-hidden rounded-[2.5rem] border border-white/20 dark:border-slate-800/50 shadow-2xl group transition-all duration-500',
          blurs[blur],
          gradient ? 'bg-white/40 dark:bg-slate-900/40' : 'bg-white/10 dark:bg-slate-900/10',
          hoverEffect && 'hover:shadow-glow hover:border-horizon-500/30 hover:-translate-y-1',
          className
        )}
        {...props}
      >
        {/* Scanline Effect */}
        {scanlines && (
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.07] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
        )}

        {/* Subtle Inner Glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent dark:from-white/5 pointer-events-none" />
        
        {/* Animated Accent Light (Visible on Hover) */}
        {hoverEffect && (
          <div className="absolute -inset-px bg-gradient-to-r from-transparent via-horizon-500/10 to-transparent opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-1000" />
        )}

        <div className="relative z-10 h-full">
          {children}
        </div>
      </motion.div>
    );
  }
);

GlassCard.displayName = 'GlassCard';

export default GlassCard;

