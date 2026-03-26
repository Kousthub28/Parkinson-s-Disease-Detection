import React from 'react';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';

type CardProps = HTMLMotionProps<'div'> & {
  children: React.ReactNode;
  className?: string;
};

const Card = ({ children, className = '', ...rest }: CardProps) => {
  // Randomly assign a subtle organic shape if none is provided in className,
  // or we can just use default rounded-[2rem] and let the caller add asymmetric classes.
  // The design calls for `rounded-[2rem]` base. Let's make it the default.
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`relative overflow-hidden bg-background/80 dark:bg-accent/40 backdrop-blur-sm border border-border/50 rounded-4xl shadow-soft hover:shadow-float hover:-translate-y-1 transition-all duration-500 p-6 ${className}`}
      {...rest}
    >
      {/* Noise texture for the card itself to match the tactile feel */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.02] mix-blend-multiply dark:mix-blend-screen z-0" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\\\'0 0 200 200\\\' xmlns=\\\'http://www.w3.org/2000/svg\\\'%3E%3Cfilter id=\\\'noiseFilter\\\'%3E%3CfeTurbulence type=\\\'fractalNoise\\\' baseFrequency=\\\'0.85\\\' numOctaves=\\\'3\\\' stitchTiles=\\\'stitch\\\'/%3E%3C/filter%3E%3Crect width=\\\'100%25\\\' height=\\\'100%25\\\' filter=\\\'url(%23noiseFilter)\\\'/%3E%3C/svg%3E")' }} />
      
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
};

export default Card;
