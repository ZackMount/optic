"use client";

import { useState, type ElementType } from 'react';
import { motion } from 'framer-motion';
import { RotateCw, RotateCcw, FlipHorizontal, FlipVertical, Columns2, Rows2, Grid2x2, ChevronsLeft, ChevronsRight, Search, X, GalleryVerticalEnd } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/select';
import { defaultTransformations, type Transformations } from '@/lib/image-engine/types';
import { effectGroups, effectPresets, presetTransformations, symmetryControls, transformControls, type EffectControl } from './effect-catalog';

interface ToolbarProps {
  transformations: Transformations;
  setTransformations: (value: Transformations | ((previous: Transformations) => Transformations)) => void;
  isGif?: boolean;
}

export function Toolbar({ transformations: t, setTransformations, isGif }: ToolbarProps) {
  const [expanded, setExpanded] = useState(true);
  const [query, setQuery] = useState('');
  const search = query.trim().toLowerCase();
  const matches = (group: string, label: string, keywords = '') => !search || (group + ' ' + label + ' ' + keywords).toLowerCase().includes(search);
  const change = (key: keyof Transformations, value: Transformations[keyof Transformations]) => setTransformations(previous => ({ ...previous, [key]: value }));
  const mirror = (value: Transformations['mirrorMode']) => change('mirrorMode', t.mirrorMode === value ? 'none' : value);
  const controls = (group: string, items: EffectControl[]) => items.filter(control => (!control.when || control.when(t)) && matches(group, control.label, control.keywords)).map(control =>
    <EffectField key={control.key} control={control} transformations={t} expanded={expanded} onChange={change} onExpand={() => setExpanded(true)} />);
  const transformItems = controls('Transform', transformControls);
  const symmetryItems = controls('Symmetry', symmetryControls);
  const groups = effectGroups.filter(group => !group.gifOnly || isGif).map(group => ({ ...group, fields: controls(group.title, group.controls) })).filter(group => group.fields.length);
  const presets = effectPresets.filter(preset => matches('Looks', preset.name, preset.description));
  const transformActions = matches('Transform', 'Rotate Flip H Flip V');
  const symmetryActions = matches('Symmetry', 'Mirror LR Mirror TB Kaleido');
  const empty = !transformActions && !symmetryActions && !transformItems.length && !symmetryItems.length && !groups.length && !presets.length;

  return <motion.div initial={false} animate={{ width: expanded ? 240 : 60 }}
    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }} role="complementary" aria-label="Image effects"
    className="flex h-full flex-col overflow-hidden">
    <button type="button" onClick={() => setExpanded(!expanded)} aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
      aria-expanded={expanded} className="flex h-11 shrink-0 items-center justify-center text-muted transition-colors hover:text-foreground">
      {expanded ? <ChevronsLeft size={16} /> : <ChevronsRight size={16} />}
    </button>
    <div className="shrink-0 px-2 pb-2">
      {expanded ? <div className="flex h-8 items-center gap-2 rounded-lg border border-border bg-secondary/40 px-2">
        <Search size={13} className="shrink-0 text-muted" />
        <input type="search" aria-label="Search effects" placeholder="Search effects" value={query} onChange={event => setQuery(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted" />
        {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear effect search" className="text-muted hover:text-foreground"><X size={12} /></button>}
      </div> : <button type="button" onClick={() => setExpanded(true)} aria-label="Search effects" title="Search effects"
        className={cn('flex h-8 w-full items-center justify-center rounded-lg hover:bg-secondary', search ? 'text-primary' : 'text-muted')}><Search size={16} /></button>}
    </div>
    <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-1.5">
      {(transformActions || transformItems.length > 0) && <ToolGroup title="Transform" expanded={expanded}>
        {transformActions && <>
          <ToolButton icon={RotateCw} label="Rotate" onClick={() => change('rotation', ((t.rotation + 90) % 360) as Transformations['rotation'])}
            expanded={expanded} badge={t.rotation ? t.rotation + '°' : undefined} />
          <ToolButton icon={FlipHorizontal} label="Flip H" active={t.flipHorizontal} onClick={() => change('flipHorizontal', !t.flipHorizontal)} expanded={expanded} />
          <ToolButton icon={FlipVertical} label="Flip V" active={t.flipVertical} onClick={() => change('flipVertical', !t.flipVertical)} expanded={expanded} />
        </>}
        {transformItems}
      </ToolGroup>}
      {(symmetryActions || symmetryItems.length > 0) && <ToolGroup title="Symmetry" expanded={expanded}>
        {symmetryActions && <>
          <ToolButton icon={Columns2} label="Mirror LR" active={t.mirrorMode === 'left'} onClick={() => mirror('left')} expanded={expanded} />
          <ToolButton icon={Rows2} label="Mirror TB" active={t.mirrorMode === 'top'} onClick={() => mirror('top')} expanded={expanded} />
          <ToolButton icon={Grid2x2} label="Kaleido" active={t.mirrorMode === 'center'} onClick={() => mirror('center')} expanded={expanded} />
        </>}
        {symmetryItems}
      </ToolGroup>}
      {groups.map(group => <ToolGroup key={group.title} title={group.title} expanded={expanded}>{group.fields}</ToolGroup>)}
      {presets.length > 0 && <ToolGroup title="Looks" expanded={expanded}>
        {expanded ? <div className="grid grid-cols-2 gap-1.5 px-1 py-1">
          {presets.map(preset => <button type="button" key={preset.name} title={preset.description}
            onClick={() => setTransformations(previous => presetTransformations(previous, preset.values))}
            className="min-h-9 rounded-lg border border-border bg-secondary/30 px-2 py-2 text-left text-xs text-foreground/80 transition-colors hover:border-border-strong hover:bg-secondary hover:text-foreground">
            {preset.name}
          </button>)}
        </div> : <ToolButton icon={GalleryVerticalEnd} label="Looks" expanded={false} onClick={() => setExpanded(true)} />}
      </ToolGroup>}
      {empty && <p className="px-2 py-4 text-xs text-muted">No matching effects.</p>}
    </div>
    <div className="flex shrink-0 justify-center border-t border-border px-1.5 py-2">
      <button type="button" onClick={() => setTransformations(defaultTransformations)} title="Reset all effects" aria-label="Reset"
        className={cn('flex items-center justify-center gap-2 rounded-lg text-muted transition-colors hover:bg-secondary hover:text-foreground', expanded ? 'w-full px-3 py-2' : 'h-10 w-10')}>
        <RotateCcw size={16} strokeWidth={1.8} />{expanded && <span className="text-sm">Reset</span>}
      </button>
    </div>
  </motion.div>;
}

function EffectField({ control, transformations: t, expanded, onChange, onExpand }: {
  control: EffectControl; transformations: Transformations; expanded: boolean; onExpand: () => void;
  onChange: (key: keyof Transformations, value: Transformations[keyof Transformations]) => void;
}) {
  const Icon = control.kind === 'select' ? control.options.find(option => option.value === t[control.key])?.icon || control.icon : control.icon;
  if (control.kind === 'toggle') return <ToolButton icon={Icon} label={control.label} active={t[control.key]}
    onClick={() => onChange(control.key, !t[control.key])} expanded={expanded} />;
  if (control.kind === 'slider') return <SliderControl icon={Icon} label={control.label} value={t[control.key]}
    onChange={value => onChange(control.key, value)} min={control.min} max={control.max} step={control.step}
    defaultValue={defaultTransformations[control.key]} format={control.format} expanded={expanded} onExpand={onExpand}
    editable={control.editable} unit={control.unit} />;
  if (!expanded) return <ToolButton icon={Icon} label={control.label} active={t[control.key] !== defaultTransformations[control.key]} onClick={onExpand} expanded={false} />;
  if (control.kind === 'select') return <div className={cn('flex min-h-16 items-center rounded-lg py-2', t[control.key] !== defaultTransformations[control.key] && 'bg-primary/10')}>
    <div className="flex w-[50px] shrink-0 items-center justify-center text-foreground/70"><Icon size={18} strokeWidth={1.8} /></div>
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 pr-2">
      <span className="text-xs font-medium text-foreground/70">{control.label}</span>
      <Select label={control.label} value={t[control.key]} options={control.options}
        onValueChange={value => onChange(control.key, value as Transformations[typeof control.key])} className="w-full" />
    </div>
  </div>;
  return <label className="flex h-11 items-center gap-0 rounded-lg text-foreground/70 hover:bg-secondary">
    <span className="flex w-[50px] shrink-0 justify-center"><Icon size={18} strokeWidth={1.8} /></span>
    <span className="flex-1 text-xs font-medium">{control.label}</span>
    <input type="color" aria-label={control.label} value={t[control.key]} onChange={event => onChange(control.key, event.target.value)}
      className="mr-2 h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0" />
  </label>;
}

function ToolGroup({ title, children, expanded }: { title: string; children: React.ReactNode; expanded: boolean }) {
  return <div className="flex flex-col gap-0.5 py-1.5">
    <div className={cn('flex h-5 items-center overflow-hidden transition-opacity duration-200', expanded ? 'opacity-100' : 'opacity-0')}>
      <span className="whitespace-nowrap px-2 text-[10px] font-medium uppercase tracking-wider text-muted">{title}</span>
    </div>{children}
  </div>;
}

function ToolButton({ icon: Icon, label, active, onClick, expanded, badge }: {
  icon: ElementType; label: string; active?: boolean; onClick: () => void; expanded: boolean; badge?: string;
}) {
  return <button type="button" onClick={onClick} aria-label={label} aria-pressed={active}
    title={!expanded ? label : undefined}
    className={cn('group relative flex h-9 items-center rounded-lg transition-colors duration-150', active ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:bg-secondary hover:text-foreground')}>
    <span className={cn('flex shrink-0 items-center justify-center', expanded ? 'w-[50px]' : 'w-full')}><Icon size={18} strokeWidth={1.8} /></span>
    {expanded && <span className="min-w-0 flex-1 truncate pr-3 text-left text-sm font-medium">{label}</span>}
    {badge && <span className={cn('absolute rounded bg-secondary px-1 text-[10px]', expanded ? 'right-2 top-1/2 -translate-y-1/2' : 'right-0 top-0 text-[8px]')}>{badge}</span>}
  </button>;
}

function SliderControl({ icon: Icon, label, value, onChange, min, max, step = 1, defaultValue, format, expanded, onExpand, editable, unit }: {
  icon: ElementType; label: string; value: number; onChange: (value: number) => void;
  min: number; max: number; step?: number; defaultValue: number; format?: (value: number) => string; expanded: boolean; onExpand: () => void;
  editable?: boolean; unit?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const modified = value !== defaultValue;
  const display = format ? format(value) : String(Math.round(value * 100) / 100);
  const commit = (raw: string) => {
    const parsed = raw.trim() ? Number(raw) : value;
    const next = Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : value;
    setDraft(null);
    if (next !== value) onChange(next);
  };
  if (!expanded) return <ToolButton icon={Icon} label={label + ': ' + display} active={modified} onClick={onExpand} expanded={false} badge={modified ? display : undefined} />;
  return <div title={label} className={cn('flex min-h-16 items-center rounded-lg py-2 transition-colors', modified ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-secondary hover:text-foreground')}>
    <span className="flex w-[50px] shrink-0 items-center justify-center"><Icon size={18} strokeWidth={1.8} /></span>
    <div className="flex min-w-0 flex-1 flex-col justify-center pr-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium">{label}</span>
        {editable ? <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted">
          <input type="number" aria-label={label + ' value'} min={min} max={max} step={1} value={draft ?? String(value)}
            onFocus={() => setDraft(String(value))} onChange={event => setDraft(event.target.value)}
            onBlur={event => commit(event.target.value)} onKeyDown={event => {
              if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
              if (event.key === 'Escape') { event.preventDefault(); event.currentTarget.value = String(value); event.currentTarget.blur(); }
            }}
            className="h-6 w-14 rounded-md border border-border bg-secondary/40 px-1 text-right text-xs text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30" />
          {unit && <span>{unit}</span>}
        </span> : <span className="shrink-0 text-[10px] text-muted">{display}</span>}
      </div>
      <div className="relative flex h-6 items-center py-1.5">
        <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))}
          onDoubleClick={() => onChange(defaultValue)}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm" />
      </div>
    </div>
  </div>;
}
