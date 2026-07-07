import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
}

export function TiltCard({ children, className = '', ...props }: Props) {
  return (
    <motion.div
      className={`relative ${className}`}
      whileHover={{ scale: 1.015 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      style={{ perspective: 1000, transformStyle: 'preserve-3d' }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -6;
        const rotateY = ((x - centerX) / centerX) * 6;
        e.currentTarget.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.015)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)';
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
TiltCard.displayName = 'TiltCard';
