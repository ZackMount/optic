'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type SelectOption = { value: string; label: string };
type SelectProps = {
  label: string;
  value: string;
  options: SelectOption[];
  onValueChange: (value: string) => void;
};

export function Select({ label, value, options, onValueChange }: SelectProps) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = Math.max(0, options.findIndex(option => option.value === value));
  const highlighted = Math.min(active, options.length - 1);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', dismiss, true);
    return () => document.removeEventListener('pointerdown', dismiss, true);
  }, [open]);

  const choose = (index: number) => {
    onValueChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(open ? (active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length : selected);
      setOpen(true);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); setActive(event.key === 'Home' ? 0 : options.length - 1); setOpen(true);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(highlighted); else { setActive(selected); setOpen(true); }
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      setOpen(false);
      if (event.key === 'Escape' && open) event.preventDefault();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const text = (now - search.current.time < 700 ? search.current.text : '') + event.key.toLowerCase();
      search.current = { text, time: now };
      const index = options.findIndex(option => option.label.toLowerCase().startsWith(text));
      if (index >= 0) { event.preventDefault(); if (open) setActive(index); else onValueChange(options[index].value); }
    }
  };

  return (
    <div ref={root} className="relative inline-flex">
      <button ref={trigger} type="button" role="combobox" aria-label={label}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${id}-options` : undefined}
        aria-activedescendant={open ? `${id}-option-${highlighted}` : undefined}
        onKeyDown={handleKeyDown} onBlur={event => { if (!root.current?.contains(event.relatedTarget)) setOpen(false); }}
        onClick={() => { setActive(selected); setOpen(previous => !previous); }}
        className={cn('flex h-8 min-w-[94px] items-center justify-between gap-5 rounded-lg border px-3 text-xs font-medium text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40',
          open ? 'border-primary/40 bg-secondary' : 'border-border-strong bg-secondary/50 hover:bg-secondary-hover')}>
        <span>{options[selected].label}</span>
        <ChevronDown size={13} aria-hidden="true" className={cn('shrink-0 text-muted transition-transform duration-150', open && 'rotate-180')} />
      </button>
      {open && (
        <div id={`${id}-options`} role="listbox" aria-label={`${label} options`}
          className="absolute left-0 top-full z-[60] mt-1.5 min-w-[140px] rounded-xl border border-border-strong bg-input p-1 shadow-lg">
          {options.map((option, index) => (
            <div key={option.value} id={`${id}-option-${index}`} role="option" aria-selected={option.value === value}
              onPointerMove={() => setActive(index)} onPointerDown={event => event.preventDefault()} onClick={() => choose(index)}
              className={cn('flex h-8 cursor-pointer select-none items-center justify-between gap-5 rounded-lg px-2.5 text-xs transition-colors',
                option.value === value ? 'text-primary' : 'text-foreground', index === highlighted && 'bg-secondary-hover')}>
              <span>{option.label}</span>
              <Check size={13} strokeWidth={2.5} aria-hidden="true" className={cn('shrink-0 text-primary', option.value !== value && 'invisible')} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
