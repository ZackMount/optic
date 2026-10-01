'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

export function ImageActionButton({ className, ...props }: HTMLMotionProps<'button'>) {
  return <motion.button type="button" whileTap={{ scale: 0.95 }}
    className={cn('btn-secondary flex h-8 items-center justify-center gap-2 px-3 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50', className)}
    {...props} />;
}
