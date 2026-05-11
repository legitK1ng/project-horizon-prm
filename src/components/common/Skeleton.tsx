import React from 'react';
import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'rectangular' | 'circular' | 'text';
}

/**
 * REQ-050: Skeleton Component
 * Provides a shimmering placeholder for loading states to maintain layout stability
 * and provide a premium "loading" experience.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ 
  className, 
  variant = 'rectangular' 
}) => {
  return (
    <div
      className={cn(
        "animate-shimmer",
        "bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200",
        "dark:from-slate-800 dark:via-slate-700 dark:to-slate-800",
        "background-animate",
        variant === 'rectangular' && "rounded-2xl",
        variant === 'circular' && "rounded-full",
        variant === 'text' && "rounded h-4 w-full mb-2",
        className
      )}
      style={{
        backgroundSize: '200% 100%',
      }}
    />
  );
};

export default Skeleton;
