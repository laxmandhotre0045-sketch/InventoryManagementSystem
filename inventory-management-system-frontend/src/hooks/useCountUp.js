import { useEffect, useRef, useState } from 'react';

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Animates a number towards `target` with ease-out timing.
 *
 * Counts from whatever is currently displayed — so the first render counts up
 * from 0, and a later data refresh tweens from the old value to the new one
 * instead of snapping. Honours prefers-reduced-motion by jumping straight to
 * the value.
 */
export default function useCountUp(target, duration = 1000) {
  const to = Number(target) || 0;
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion() || fromRef.current === to) {
      fromRef.current = to;
      setValue(to);
      return undefined;
    }

    const from = fromRef.current;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(from + (to - from) * easeOutCubic(progress));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Keep the last painted value as the start of the next tween.
      fromRef.current = value;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, duration]);

  return Math.round(value);
}
