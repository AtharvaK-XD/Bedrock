"use client";
import { cn } from "@/lib/utils";
import React, { useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  animate,
} from "motion/react";

export const DraggableCardBody = ({
  className,
  children,
  zoomScale = 1,
  initialRotate = 0,
}: {
  className?: string;
  children?: React.ReactNode;
  zoomScale?: number;
  initialRotate?: number;
}) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const [zIndex, setZIndex] = useState(1);
  const isDraggingRef = useRef(false);
  const hasMovedRef = useRef(false);

  // Position motion values
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = {
    stiffness: 120,
    damping: 20,
    mass: 0.5,
  };

  const rotateX = useSpring(
    useTransform(mouseY, [-300, 300], [20, -20]),
    springConfig,
  );
  const rotateY = useSpring(
    useTransform(mouseX, [-300, 300], [-20, 20]),
    springConfig,
  );

  const opacity = useSpring(
    useTransform(mouseX, [-300, 0, 300], [0.85, 1, 0.85]),
    springConfig,
  );

  const glareOpacity = useSpring(
    useTransform(mouseX, [-300, 0, 300], [0.15, 0, 0.15]),
    springConfig,
  );

  // Pointer drag tracking references
  const dragStartRef = useRef({
    x: 0,
    y: 0,
    clientX: 0,
    clientY: 0,
  });
  const lastPointerRef = useRef({
    clientX: 0,
    clientY: 0,
    time: 0,
  });
  const velocityRef = useRef({
    vx: 0,
    vy: 0,
  });

  const updateCardTilt = (clientX: number, clientY: number) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    mouseX.set(clientX - centerX);
    mouseY.set(clientY - centerY);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary button (left click) or touch
    if (e.button !== 0 && e.pointerType === "mouse") return;

    // Do not initiate card drag if interactive child was pressed
    const target = e.target as HTMLElement | null;
    if (target && target.closest("button, a, input, textarea, select")) {
      return;
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore fallback
    }

    isDraggingRef.current = true;
    hasMovedRef.current = false;
    setZIndex(60);
    document.body.style.cursor = "grabbing";

    dragStartRef.current = {
      x: x.get(),
      y: y.get(),
      clientX: e.clientX,
      clientY: e.clientY,
    };
    lastPointerRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      time: performance.now(),
    };
    velocityRef.current = { vx: 0, vy: 0 };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    updateCardTilt(e.clientX, e.clientY);

    if (!isDraggingRef.current) return;

    const deltaScreenX = e.clientX - dragStartRef.current.clientX;
    const deltaScreenY = e.clientY - dragStartRef.current.clientY;

    if (Math.abs(deltaScreenX) > 3 || Math.abs(deltaScreenY) > 3) {
      hasMovedRef.current = true;
    }

    // Scale-calibrated translation: divides screen delta by zoomScale for exact 1:1 tracking
    const scale = zoomScale > 0 ? zoomScale : 1;
    x.set(dragStartRef.current.x + deltaScreenX / scale);
    y.set(dragStartRef.current.y + deltaScreenY / scale);

    const now = performance.now();
    const dt = Math.max(now - lastPointerRef.current.time, 1);
    const vx = (e.clientX - lastPointerRef.current.clientX) / dt;
    const vy = (e.clientY - lastPointerRef.current.clientY) / dt;
    velocityRef.current = { vx, vy };
    lastPointerRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      time: now,
    };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    document.body.style.cursor = "default";

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore fallback
    }

    mouseX.set(0);
    mouseY.set(0);

    // Natural momentum release with spring physics
    const scale = zoomScale > 0 ? zoomScale : 1;
    const currentVx = (velocityRef.current.vx / scale) * 1000;
    const currentVy = (velocityRef.current.vy / scale) * 1000;

    const throwX = Math.max(Math.min(currentVx * 0.16, 1200), -1200);
    const throwY = Math.max(Math.min(currentVy * 0.16, 1200), -1200);

    animate(x, x.get() + throwX, {
      type: "spring",
      stiffness: 80,
      damping: 20,
      mass: 0.6,
    });

    animate(y, y.get() + throwY, {
      type: "spring",
      stiffness: 80,
      damping: 20,
      mass: 0.6,
    });
  };

  const handleMouseLeave = () => {
    if (!isDraggingRef.current) {
      mouseX.set(0);
      mouseY.set(0);
    }
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (hasMovedRef.current) {
      e.stopPropagation();
      hasMovedRef.current = false;
    }
  };

  return (
    <motion.div
      ref={cardRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClickCapture={handleClickCapture}
      onMouseLeave={handleMouseLeave}
      style={{
        x,
        y,
        rotateX,
        rotateY,
        rotateZ: initialRotate,
        opacity,
        zIndex,
        touchAction: "none",
        willChange: "transform",
      }}
      whileHover={{ scale: 1.02 }}
      className={cn(
        "relative min-h-96 w-80 overflow-hidden rounded-md bg-neutral-100 p-6 shadow-2xl transform-3d dark:bg-neutral-900 select-none",
        className,
      )}
    >
      {children}
      <motion.div
        style={{
          opacity: glareOpacity,
        }}
        className="pointer-events-none absolute inset-0 bg-white select-none"
      />
    </motion.div>
  );
};

export const DraggableCardContainer = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div className={cn("[perspective:3000px]", className)}>{children}</div>
  );
};
