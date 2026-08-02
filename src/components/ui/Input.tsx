import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-lg border border-basalt-900/10 bg-white/50 px-4 py-2 text-sm text-basalt-900 transition-all duration-300",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-basalt-500/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-500/50 focus-visible:border-copper-500/50 focus-visible:bg-white/80",
          "hover:border-basalt-900/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
