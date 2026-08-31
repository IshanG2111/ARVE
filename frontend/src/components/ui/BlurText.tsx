import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, type TargetAndTransition } from 'framer-motion';

export interface BlurTextProps {
  text?: string;
  delay?: number;
  initialDelay?: number;
  className?: string;
  animateBy?: 'words' | 'letters';
  direction?: 'top' | 'bottom';
  threshold?: number;
  rootMargin?: string;
  animationFrom?: TargetAndTransition;
  animationTo?: TargetAndTransition[];
  easing?: (t: number) => number | string;
  onAnimationComplete?: () => void;
  stepDuration?: number;
  style?: React.CSSProperties;
  trigger?: boolean;
}

const buildKeyframes = (
  from: Record<string, any>,
  steps: Record<string, any>[]
): Record<string, any[]> => {
  const keys = new Set([...Object.keys(from), ...steps.flatMap((s) => Object.keys(s))]);

  const keyframes: Record<string, any[]> = {};
  keys.forEach((k) => {
    keyframes[k] = [from[k], ...steps.map((s) => s[k])];
  });
  return keyframes;
};

export const BlurText: React.FC<BlurTextProps> = ({
  text = '',
  delay = 40,
  initialDelay = 0,
  className = '',
  animateBy = 'letters',
  direction = 'top',
  threshold = 0.1,
  rootMargin = '0px',
  animationFrom,
  animationTo,
  easing = (t) => t,
  onAnimationComplete,
  stepDuration = 0.3,
  style = {},
  trigger,
}) => {
  const elements = animateBy === 'words' ? text.split(' ') : text.split('');
  const [internalInView, setInternalInView] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (trigger !== undefined) {
      setInternalInView(trigger);
      return;
    }
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInternalInView(true);
          observer.unobserve(ref.current!);
        }
      },
      { threshold, rootMargin }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold, rootMargin, trigger]);

  const inView = trigger !== undefined ? trigger : internalInView;

  const defaultFrom = useMemo(
    () =>
      direction === 'top'
        ? { filter: 'blur(12px)', opacity: 0, y: -24 }
        : { filter: 'blur(12px)', opacity: 0, y: 24 },
    [direction]
  );

  const defaultTo = useMemo(
    () => [
      {
        filter: 'blur(4px)',
        opacity: 0.6,
        y: direction === 'top' ? 3 : -3,
      },
      { filter: 'blur(0px)', opacity: 1, y: 0 },
    ],
    [direction]
  );

  const fromSnapshot = animationFrom ?? defaultFrom;
  const toSnapshots = animationTo ?? defaultTo;

  const stepCount = toSnapshots.length + 1;
  const totalDuration = stepDuration * (stepCount - 1);
  const times = Array.from({ length: stepCount }, (_, i) =>
    stepCount === 1 ? 0 : i / (stepCount - 1)
  );

  return (
    <div
      ref={ref}
      className={className}
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        rowGap: '0.1em',
        ...style,
      }}
    >
      {elements.map((segment, index) => {
        const animateKeyframes = buildKeyframes(fromSnapshot, toSnapshots);

        const spanTransition: any = {
          duration: totalDuration,
          times,
          delay: initialDelay + (index * delay) / 1000,
          ease: easing,
        };

        return (
          <motion.span
            className="inline-block will-change-[transform,filter,opacity]"
            key={index}
            initial={fromSnapshot}
            animate={inView ? animateKeyframes : fromSnapshot}
            transition={spanTransition}
            onAnimationComplete={
              index === elements.length - 1 ? onAnimationComplete : undefined
            }
            style={{ display: 'inline-block', color: 'inherit' }}
          >
            {segment === ' ' ? '\u00A0' : segment}
            {animateBy === 'words' && index < elements.length - 1 && '\u00A0'}
          </motion.span>
        );
      })}
    </div>
  );
};

export default BlurText;
