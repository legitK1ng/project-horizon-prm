import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '../lib/utils';

export interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}

/**
 * REQ-049: GlassCard Component
 * Uses established CSS variables for a premium, monochromatic, high-fidelity look.
 * Supports interactive hover effects and glassmorphism via Framer Motion.
 */
export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(({ 
  children, 
  className, 
  interactive = false,
  ...props
}, ref) => {
  return (
    <motion.div
      ref={ref}
      className={cn(
        "glass card p-6",
        interactive && "card-interactive cursor-pointer",
        className
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      whileHover={interactive ? { y: -2, scale: 1.01 } : undefined}
      whileTap={interactive ? { y: 0, scale: 0.99 } : undefined}
      {...props}
    >
      {children}
    </motion.div>
  );
});

GlassCard.displayName = "GlassCard";

export default GlassCard;
