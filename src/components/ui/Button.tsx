import React from 'react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

export interface ButtonProps extends React.ComponentProps<typeof motion.button> {
  variant?: 'primary' | 'secondary' | 'ghost';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', isLoading, children, disabled, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center rounded-xl font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-500 disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden group";
    
    const variants = {
      primary: "bg-copper-500 text-white hover:bg-copper-400 shadow-[0_0_20px_rgba(44,154,139,0.3)] hover:shadow-[0_0_25px_rgba(44,154,139,0.5)] border border-copper-400/50",
      secondary: "bg-white/10 backdrop-blur-sm text-white hover:bg-white/15 border border-white/10 hover:border-white/20 shadow-sm",
      ghost: "hover:bg-white/10 hover:text-white text-gray-400",
    };
    
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(baseStyles, variants[variant], "h-11 px-5 py-2 text-sm", className)}
        disabled={isLoading || disabled}
        {...props}
      >
        {variant === 'primary' && (
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"></div>
        )}
        {isLoading ? (
          <span className="mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
        ) : null}
        <span className="relative z-10 flex items-center">{children as React.ReactNode}</span>
      </motion.button>
    );
  }
);
Button.displayName = 'Button';
