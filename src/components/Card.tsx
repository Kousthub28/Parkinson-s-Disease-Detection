import React from 'react';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';

type CardProps = HTMLMotionProps<'div'> & {
  children: React.ReactNode;
  className?: string;
};

const Card = ({ children, className = '', ...rest }: CardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`bg-card border border-border rounded-xl shadow-lg p-6 ${className}`}
      {...rest}
    >
      {children}
    </motion.div>
  );
};

export default Card;
