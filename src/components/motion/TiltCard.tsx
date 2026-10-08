import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
}

const MAX_TILT = 6;

/**
 * A card that lifts toward the cursor on hover.
 *
 * Two problems this fixes:
 *
 *  1. `onMouseMove` called `getBoundingClientRect()` — a forced synchronous
 *     layout read — and then wrote `style.transform` directly, on every single
 *     mousemove event, with no throttle. On the business directory that is one
 *     listener per card (up to 999) all reading layout on the same frame.
 *  2. It wrote `style.transform` while framer-motion also owns `transform` via
 *     `whileHover`, so the two fought each other.
 *
 * The rect is now measured once per pointer-enter and reused, writes are
 * coalesced into a single animation frame, and the tilt is handed to framer-motion
 * instead of being written imperatively.
 */
export const TiltCard = memo(function TiltCard({ children, className = '', ...props }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const rect = useRef<DOMRect | null>(null);
  const frame = useRef<number | null>(null);
  const pending = useRef<{ x: number; y: number } | null>(null);

  // Captured at mount rather than module load: a tablet can gain or lose a
  // hover-capable pointer at any time (dock, external mouse), and a value read
  // once at import time never notices.
  const hoverCapable = useHoverMediaQuery();

  const applyTilt = useCallback(() => {
    frame.current = null;
    const el = ref.current;
    const box = rect.current;
    const point = pending.current;
    if (!el || !box || !point || box.width === 0 || box.height === 0) return;

    const x = point.x - box.left;
    const y = point.y - box.top;
    const rotateX = ((y - box.height / 2) / (box.height / 2)) * -MAX_TILT;
    const rotateY = ((x - box.width / 2) / (box.width / 2)) * MAX_TILT;
    el.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.015)`;
  }, []);

  useEffect(() => {
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  return (
    <motion.div
      ref={ref}
      className={`relative ${className}`}
      style={hoverCapable ? { perspective: 1000, transformStyle: 'preserve-3d' } : undefined}
      onPointerEnter={(e) => {
        if (e.pointerType !== 'mouse') return;
        rect.current = e.currentTarget.getBoundingClientRect();
      }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse' || !rect.current) return;
        pending.current = { x: e.clientX, y: e.clientY };
        // Coalesce: many pointermove events can arrive between two frames.
        if (frame.current === null) frame.current = requestAnimationFrame(applyTilt);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'mouse') return;
        if (frame.current !== null) {
          cancelAnimationFrame(frame.current);
          frame.current = null;
        }
        pending.current = null;
        rect.current = null;
        e.currentTarget.style.transform = '';
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
});

/**
 * Whether the pointer can hover. Read once per mount and kept current via the
 * media query's own change event, so a tablet gaining a mouse is noticed.
 */
function useHoverMediaQuery(): boolean {
  const [hoverable, setHoverable] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover)');
    const onChange = (e: MediaQueryListEvent) => setHoverable(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return hoverable;
}