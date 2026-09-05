export const duration = {
  instant: 0.09,
  fast: 0.16,
  base: 0.24,
  slow: 0.36,
  page: 0.44,
} as const;

export const easing = {
  standard: [0.22, 1, 0.36, 1],
  enter: [0.16, 1, 0.3, 1],
  exit: [0.4, 0, 1, 1],
  linear: [0, 0, 1, 1],
} as const;

export const spring = {
  control: { type: "spring", stiffness: 420, damping: 34, mass: 0.75 },
  layout: { type: "spring", stiffness: 360, damping: 32, mass: 0.85 },
  panel: { type: "spring", stiffness: 300, damping: 34, mass: 0.95 },
} as const;

export const distance = {
  micro: 2,
  control: 4,
  content: 8,
  panel: 20,
} as const;
