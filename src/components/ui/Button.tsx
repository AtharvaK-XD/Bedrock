import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', isLoading, children, disabled, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-500 disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden group";
    
    const variants = {
      primary: "bg-copper-500 text-white hover:bg-copper-400 shadow-[0_0_20px_rgba(44,154,139,0.3)] hover:shadow-[0_0_25px_rgba(44,154,139,0.5)] border border-copper-400/50",
      secondary: "bg-basalt-800/80 backdrop-blur-sm text-sandstone-100 hover:bg-basalt-700/80 border border-white/10 hover:border-white/20 shadow-sm",
      ghost: "hover:bg-basalt-800/50 hover:text-sandstone-50",
    };
    
    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], "h-11 px-5 py-2", className)}
        disabled={isLoading || disabled}
        {...props}
      >
        {variant === 'primary' && (
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"></div>
        )}
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        <span className="relative z-10 flex items-center">{children}</span>
      </button>
    );
  }
);
Button.displayName = 'Button';
