'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type CheckboxProps = { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void };

export function Checkbox({ label, checked, onCheckedChange }: CheckboxProps) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2.5 text-xs text-foreground/80">
      <input type="checkbox" checked={checked} onChange={event => onCheckedChange(event.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className={cn('flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
        checked ? 'border-primary bg-primary text-primary-foreground hover:bg-primary-hover' : 'border-border-strong bg-secondary/50 text-transparent hover:border-muted')}>
        <Check size={12} strokeWidth={3} className={cn('transition-opacity duration-150', !checked && 'opacity-0')} />
      </span>
      <span>{label}</span>
    </label>
  );
}
