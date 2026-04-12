import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}

/**
 * REQ-049: GlassCard Component
 * Uses established CSS variables for a premium, monochromatic, high-fidelity look.
 * Supports interactive hover effects and glassmorphism.
 */
export const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = '', 
  interactive = false 
}) => {
  const baseClasses = "glass card p-6";
  const interactiveClasses = interactive ? "card-interactive cursor-pointer" : "";
  
  return (
    <div className={`${baseClasses} ${interactiveClasses} ${className}`}>
      {children}
    </div>
  );
};

export default GlassCard;
