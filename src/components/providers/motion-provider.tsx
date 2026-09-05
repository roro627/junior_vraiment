"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

import { duration, easing } from "@/lib/motion/tokens";

export function MotionProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: duration.base, ease: easing.standard }}
    >
      {children}
    </MotionConfig>
  );
}
