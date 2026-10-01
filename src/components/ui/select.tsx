'use client';

import { useCallback, useEffect, useId, useRef, useState, type ElementType } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type SelectOption = { value: string; label: string; icon?: ElementType };
type SelectProps = {
  label: string; value: string; options: SelectOption[];
  onValueChange: (value: string) => void; className?: string;
};

export function Select({ label, value, options, onValueChange, className }: SelectProps) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 140, maxHeight: 280 });
  const selected = Math.max(0, options.findIndex(option => option.value === value));
  const highlighted = Math.min(active, options.length - 1);

  const measure = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const height = Math.min(280, options.length * 32 + 8);
    const below = window.innerHeight - rect.bottom - 12;
    const above = below < Math.min(height, 140) && rect.top > below;
    const maxHeight = Math.max(64, Math.min(height, above ? rect.top - 12 : below));
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(140, rect.width) - 8)),
      top: above ? rect.top - maxHeight - 6 : rect.bottom + 6,
      width: Math.max(140, rect.width), maxHeight,
    });
  }, [options.length]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss, true);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      document.removeEventListener('pointerdown', dismiss, true);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, measure]);

  useEffect(() => {
    if (open) document.getElementById(id + '-option-' + highlighted)?.scrollIntoView({ block: 'nearest' });
  }, [open, highlighted, id]);

  const choose = (index: number) => {
    onValueChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  };
  const show = () => { measure(); setActive(selected); setOpen(true); };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) show();
      else setActive((active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); measure(); setActive(event.key === 'Home' ? 0 : options.length - 1); setOpen(true);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); if (open) choose(highlighted); else show();
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      setOpen(false); if (event.key === 'Escape' && open) event.preventDefault();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const text = (now - search.current.time < 700 ? search.current.text : '') + event.key.toLowerCase();
      search.current = { text, time: now };
      const index = options.findIndex(option => option.label.toLowerCase().startsWith(text));
      if (index >= 0) { event.preventDefault(); if (open) setActive(index); else onValueChange(options[index].value); }
    }
  };

  return <div ref={root} className={cn('relative inline-flex', className)}>
    <button ref={trigger} type="button" role="combobox" aria-label={label}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id + '-options' : undefined}
      aria-activedescendant={open ? id + '-option-' + highlighted : undefined}
      onKeyDown={handleKeyDown} onBlur={event => {
        if (!root.current?.contains(event.relatedTarget) && !menu.current?.contains(event.relatedTarget)) setOpen(false);
      }}
      onClick={() => { if (open) setOpen(false); else show(); }}
      className={cn('flex h-8 w-full min-w-[94px] items-center justify-between gap-2 rounded-lg border px-3 text-xs font-medium text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40',
        open ? 'border-primary/40 bg-secondary' : 'border-border-strong bg-secondary/50 hover:bg-secondary-hover')}>
      <span className="truncate">{options[selected].label}</span>
      <ChevronDown size={13} aria-hidden="true" className={cn('shrink-0 text-muted transition-transform duration-150', open && 'rotate-180')} />
    </button>
    {open && createPortal(<div ref={menu} id={id + '-options'} role="listbox" aria-label={label + ' options'}
      style={position} className="fixed z-[80] overflow-y-auto overscroll-contain rounded-xl border border-border-strong bg-input p-1 shadow-xl">
      {options.map((option, index) => {
        const Icon = option.icon;
        return <div key={option.value} id={id + '-option-' + index} role="option" aria-selected={option.value === value}
        onPointerMove={() => setActive(index)} onPointerDown={event => event.preventDefault()} onClick={() => choose(index)}
        className={cn('flex h-8 cursor-pointer select-none items-center justify-between gap-5 rounded-lg px-2.5 text-xs transition-colors',
          option.value === value ? 'text-primary' : 'text-foreground', index === highlighted && 'bg-secondary-hover')}>
        <span className="flex items-center gap-2">{Icon && <Icon size={14} strokeWidth={1.8} aria-hidden="true" />}<span>{option.label}</span></span>
        <Check size={13} strokeWidth={2.5} aria-hidden="true" className={cn('shrink-0 text-primary', option.value !== value && 'invisible')} />
      </div>;
      })}
    </div>, document.body)}
  </div>;
}
