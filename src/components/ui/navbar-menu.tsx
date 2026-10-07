"use client";
import React from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const transition = {
  type: "spring" as const,
  mass: 0.5,
  damping: 11.5,
  stiffness: 100,
  restDelta: 0.001,
  restSpeed: 0.001,
};

export const MenuItem = ({
  setActive,
  active,
  item,
  to,
  isActive,
  className,
  children,
}: {
  setActive: (item: string) => void;
  active: string | null;
  item: string;
  to?: string;
  isActive?: boolean;
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div 
      onMouseEnter={() => setActive(item)} 
      className="relative flex items-center"
    >
      {to ? (
        <Link
          to={to}
          className={cn(
            "px-3.5 lg:px-4 py-1.5 lg:py-2 rounded-xl text-xs lg:text-sm font-medium transition-all duration-200 whitespace-nowrap cursor-pointer select-none",
            isActive 
              ? "bg-white/15 text-white shadow-sm font-semibold border border-white/15" 
              : "text-gray-400 hover:text-white hover:bg-white/5",
            className
          )}
        >
          {item}
        </Link>
      ) : (
        <motion.p
          transition={{ duration: 0.3 }}
          className={cn(
            "px-3.5 lg:px-4 py-1.5 lg:py-2 rounded-xl text-xs lg:text-sm font-medium transition-all duration-200 whitespace-nowrap cursor-pointer select-none",
            isActive 
              ? "bg-white/15 text-white shadow-sm font-semibold border border-white/15" 
              : "text-gray-400 hover:text-white hover:bg-white/5",
            className
          )}
        >
          {item}
        </motion.p>
      )}

      {active !== null && children && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={transition}
          className="pointer-events-auto"
        >
          {active === item && (
            <div className="absolute top-[calc(100%_+_0.6rem)] left-1/2 transform -translate-x-1/2 pt-2 z-50">
              <motion.div
                transition={transition}
                layoutId="active"
                className="bg-[#0c0c0e]/95 backdrop-blur-2xl rounded-2xl overflow-hidden border border-white/15 shadow-2xl shadow-black/80 ring-1 ring-white/10"
              >
                <motion.div
                  layout
                  className="w-max h-full p-4"
                >
                  {children}
                </motion.div>
              </motion.div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export const Menu = ({
  setActive,
  children,
  className,
}: {
  setActive: (item: string | null) => void;
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <nav
      onMouseLeave={() => setActive(null)}
      className={cn(
        "pointer-events-auto hidden md:flex items-center gap-1 bg-black/45 p-1.5 rounded-2xl border border-white/10 shadow-lg shadow-black/30 backdrop-blur-xl absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
        className
      )}
    >
      {children}
    </nav>
  );
};

export const ProductItem = ({
  title,
  description,
  href,
  to,
  src,
  icon: Icon,
}: {
  title: string;
  description: string;
  href?: string;
  to?: string;
  src?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) => {
  const content = (
    <>
      {src && (
        <img
          src={src}
          width={120}
          height={60}
          alt={title}
          className="shrink-0 rounded-lg shadow-2xl object-cover h-14 w-24 border border-white/10"
        />
      )}
      {Icon && !src && (
        <div className="w-9 h-9 rounded-xl bg-copper-500/10 border border-copper-500/20 flex items-center justify-center shrink-0 group-hover:bg-copper-500/20 group-hover:border-copper-500/30 transition-all">
          <Icon className="w-4 h-4 text-copper-400" />
        </div>
      )}
      <div>
        <h4 className="text-xs lg:text-sm font-semibold mb-0.5 text-white group-hover:text-copper-400 transition-colors">
          {title}
        </h4>
        <p className="text-neutral-400 text-[11px] lg:text-xs max-w-[12rem] leading-relaxed">
          {description}
        </p>
      </div>
    </>
  );

  const sharedClassName = "flex space-x-3 group p-2 rounded-xl hover:bg-white/[0.05] transition-all text-left";

  if (to) {
    return (
      <Link to={to} className={sharedClassName}>
        {content}
      </Link>
    );
  }

  return (
    <a href={href || "#"} className={sharedClassName}>
      {content}
    </a>
  );
};

export const HoveredLink = ({ 
  children, 
  href, 
  to, 
  className, 
  ...rest 
}: {
  children: React.ReactNode;
  href?: string;
  to?: string;
  className?: string;
  [key: string]: any;
}) => {
  const target = to || href || "#";
  const isInternal = Boolean(to || (href && href.startsWith("/")));

  const classes = cn(
    "text-neutral-400 hover:text-copper-400 transition-colors text-xs lg:text-sm font-normal py-1 block",
    className
  );

  if (isInternal) {
    return (
      <Link to={target} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <a href={target} className={classes} {...rest}>
      {children}
    </a>
  );
};
