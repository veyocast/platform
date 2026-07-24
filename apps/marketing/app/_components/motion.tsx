"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export function Reveal({
  children,
  className,
  delay = 0
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      transition={{
        delay,
        duration: 0.48,
        ease: [0.2, 0, 0, 1]
      }}
      viewport={{ amount: 0.18, once: true }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  );
}

export function FloatStage({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      animate={reduceMotion ? undefined : { y: [0, -5, 0] }}
      className={className}
      transition={{
        duration: 8,
        ease: "easeInOut",
        repeat: Number.POSITIVE_INFINITY
      }}
    >
      {children}
    </motion.div>
  );
}
