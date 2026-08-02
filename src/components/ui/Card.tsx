import React from 'react';
import { cn } from '../../lib/utils';

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn(
        "bg-white/60 backdrop-blur-2xl border border-basalt-900/10 rounded-2xl shadow-strata relative overflow-hidden transition-all duration-300",
        "before:absolute before:inset-0 before:rounded-2xl before:border before:border-basalt-900/10 before:pointer-events-none",
        className
      )} 
      {...props}
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-px bg-gradient-to-r from-transparent via-copper-500/30 to-transparent"></div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-2 p-8 pb-6", className)} {...props}>{children}</div>;
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-display text-2xl md:text-3xl font-semibold leading-none tracking-tight text-basalt-900", className)} {...props}>{children}</h3>;
}

export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-base text-basalt-700/80 leading-relaxed", className)} {...props}>{children}</p>;
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-8 pt-0", className)} {...props}>{children}</div>;
}

export function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-8 pt-0", className)} {...props}>{children}</div>;
}
