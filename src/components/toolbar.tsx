"use client";

import { useState } from "react";
import { 
  RotateCw, 
  FlipHorizontal, 
  FlipVertical, 
  Moon, 
  Contrast, 
  Columns2,
  Rows2,
  Grid2x2,
  Shuffle,
  RotateCcw,
  ChevronsLeft,
  ChevronsRight,
  Sun,
  Droplets,
  Palette,
  Grid3x3,
  Sparkles,
  SunDim
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type Transformations, defaultTransformations } from "@/hooks/use-image-processor";
import { motion } from "framer-motion";

interface ToolbarProps {
  transformations: Transformations;
  setTransformations: (t: Transformations | ((prev: Transformations) => Transformations)) => void;
  isGif?: boolean;
}

const COLLAPSED_WIDTH = 60;
const EXPANDED_WIDTH = 240;

export function Toolbar({ transformations, setTransformations, isGif }: ToolbarProps) {
  const [expanded, setExpanded] = useState(false);
  
  const toggle = (key: keyof Transformations) => {
    setTransformations(prev => ({ ...prev, [key]: !prev[key as keyof Transformations] }));
  };

  const setMirror = (mode: Transformations['mirrorMode']) => {
    setTransformations(prev => ({ ...prev, mirrorMode: prev.mirrorMode === mode ? 'none' : mode }));
  };

  const rotate = () => {
    setTransformations(prev => ({ 
      ...prev, 
      rotation: ((prev.rotation + 90) % 360) as 0 | 90 | 180 | 270 
    }));
  };

  const reset = () => {
    setTransformations(defaultTransformations);
  };

  const setSlider = (key: keyof Transformations, value: number) => {
    setTransformations(prev => ({ ...prev, [key]: value }));
  };

  return (
    <motion.div 
      initial={false}
      animate={{ width: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col h-full overflow-hidden"
    >
      {/* Expand Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="h-11 flex items-center justify-center text-muted hover:text-foreground transition-colors shrink-0"
      >
        {expanded ? <ChevronsLeft size={16} /> : <ChevronsRight size={16} />}
      </button>
      
      <div className="flex-1 flex flex-col gap-0.5 px-1.5 overflow-y-auto overflow-x-hidden">
        {/* Transform */}
        <ToolGroup title="Transform" expanded={expanded}>
          <ToolButton 
            icon={RotateCw} 
            label="Rotate" 
            onClick={rotate} 
            expanded={expanded}
            badge={transformations.rotation > 0 ? `${transformations.rotation}°` : undefined}
          />
          <ToolButton 
            icon={FlipHorizontal} 
            label="Flip H" 
            active={transformations.flipHorizontal}
            onClick={() => toggle('flipHorizontal')} 
            expanded={expanded}
          />
          <ToolButton 
            icon={FlipVertical} 
            label="Flip V" 
            active={transformations.flipVertical}
            onClick={() => toggle('flipVertical')} 
            expanded={expanded}
          />
        </ToolGroup>

        {/* Symmetry */}
        <ToolGroup title="Symmetry" expanded={expanded}>
          <ToolButton 
            icon={Columns2}
            label="Mirror LR"
            active={transformations.mirrorMode === 'left'}
            onClick={() => setMirror('left')}
            expanded={expanded}
          />
          <ToolButton 
            icon={Rows2}
            label="Mirror TB"
            active={transformations.mirrorMode === 'top'}
            onClick={() => setMirror('top')}
            expanded={expanded}
          />
          <ToolButton 
            icon={Grid2x2}
            label="Kaleido"
            active={transformations.mirrorMode === 'center'}
            onClick={() => setMirror('center')}
            expanded={expanded}
          />
        </ToolGroup>

        {/* Colors */}
        <ToolGroup title="Colors" expanded={expanded}>
          <ToolButton 
            icon={Moon} 
            label="Grayscale" 
            active={transformations.grayscale}
            onClick={() => toggle('grayscale')} 
            expanded={expanded}
          />
          <ToolButton 
            icon={Contrast} 
            label="Invert" 
            active={transformations.invert}
            onClick={() => toggle('invert')} 
            expanded={expanded}
          />
          <ToolButton 
            icon={SunDim} 
            label="Sepia" 
            active={transformations.sepia}
            onClick={() => toggle('sepia')} 
            expanded={expanded}
          />
        </ToolGroup>

        {/* Adjustments */}
        <ToolGroup title="Adjust" expanded={expanded}>
          <SliderControl
            icon={Sun}
            label="Brightness"
            value={transformations.brightness}
            onChange={(v) => setSlider('brightness', v)}
            min={0}
            max={200}
            defaultValue={100}
            expanded={expanded}
          />
          <SliderControl
            icon={Contrast}
            label="Contrast"
            value={transformations.contrast}
            onChange={(v) => setSlider('contrast', v)}
            min={0}
            max={200}
            defaultValue={100}
            expanded={expanded}
          />
          <SliderControl
            icon={Droplets}
            label="Saturation"
            value={transformations.saturation}
            onChange={(v) => setSlider('saturation', v)}
            min={0}
            max={200}
            defaultValue={100}
            expanded={expanded}
          />
          <SliderControl
            icon={Palette}
            label="Hue"
            value={transformations.hueRotate}
            onChange={(v) => setSlider('hueRotate', v)}
            min={0}
            max={360}
            defaultValue={0}
            expanded={expanded}
          />
        </ToolGroup>

        {/* Effects */}
        <ToolGroup title="Effects" expanded={expanded}>
          <SliderControl
            icon={Droplets}
            label="Blur"
            value={transformations.blur}
            onChange={(v) => setSlider('blur', v)}
            min={0}
            max={20}
            defaultValue={0}
            expanded={expanded}
          />
          <SliderControl
            icon={Grid3x3}
            label="Pixelate"
            value={transformations.pixelate}
            onChange={(v) => setSlider('pixelate', v)}
            min={1}
            max={50}
            defaultValue={1}
            expanded={expanded}
          />
          <SliderControl
            icon={Sparkles}
            label="Noise"
            value={transformations.noise}
            onChange={(v) => setSlider('noise', v)}
            min={0}
            max={100}
            defaultValue={0}
            expanded={expanded}
          />
        </ToolGroup>
        
        {/* GIF */}
        {isGif && (
          <ToolGroup title="GIF" expanded={expanded}>
            <ToolButton 
              icon={Shuffle} 
              label="Shuffle" 
              active={transformations.shuffleFrames}
              onClick={() => toggle('shuffleFrames')} 
              expanded={expanded}
            />
          </ToolGroup>
        )}
      </div>

      {/* Reset */}
      <div className="py-2 px-1.5 border-t border-border shrink-0 flex justify-center">
        <button
          onClick={reset}
          className={cn(
            "group relative flex items-center justify-center gap-2 rounded-lg text-muted hover:text-foreground hover:bg-secondary transition-all",
            expanded ? "px-3 py-2 w-full" : "w-10 h-10"
          )}
          title={!expanded ? "Reset" : undefined}
        >
          <RotateCcw size={16} strokeWidth={1.8} />
          {expanded && <span className="text-sm">Reset</span>}
          {!expanded && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-foreground text-background text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
              Reset
            </div>
          )}
        </button>
      </div>
    </motion.div>
  );
}

function ToolGroup({ title, children, expanded }: { title: string, children: React.ReactNode, expanded: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5">
      <div 
        className={cn(
          "h-5 flex items-center overflow-hidden transition-opacity duration-200",
          expanded ? "opacity-100" : "opacity-0"
        )}
      >
        <span className="text-[10px] font-medium text-muted uppercase tracking-wider px-2 whitespace-nowrap">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function ToolButton({ 
  icon: Icon, 
  label, 
  active, 
  onClick,
  expanded,
  badge,
  variant = "default"
}: { 
  icon: React.ElementType, 
  label: string, 
  active?: boolean, 
  onClick: () => void,
  expanded: boolean,
  badge?: string,
  variant?: "default" | "muted"
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative h-9 flex items-center rounded-lg transition-colors duration-150",
        active 
          ? "bg-primary text-primary-foreground" 
          : variant === "muted"
            ? "text-muted hover:text-foreground hover:bg-secondary"
            : "text-foreground/70 hover:text-foreground hover:bg-secondary"
      )}
      title={!expanded ? label : undefined}
    >
      <div className={cn(
        "flex items-center justify-center shrink-0",
        expanded ? "w-[50px]" : "w-full"
      )}>
        <Icon size={18} strokeWidth={1.8} />
      </div>
      
      <div 
        className={cn(
          "flex-1 flex items-center overflow-hidden transition-all duration-200",
          expanded ? "opacity-100" : "opacity-0 w-0"
        )}
      >
        <span className="text-sm font-medium whitespace-nowrap pr-3">
          {label}
        </span>
      </div>

      {badge && (
        <span className={cn(
          "absolute text-[10px] px-1 rounded transition-all duration-200",
          active ? "bg-white/20" : "bg-secondary",
          expanded 
            ? "right-2 top-1/2 -translate-y-1/2" 
            : "top-0 right-0 text-[8px]"
        )}>
          {badge}
        </span>
      )}

      {!expanded && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-foreground text-background text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity duration-150">
          {label}
        </div>
      )}
    </button>
  );
}

function SliderControl({
  icon: Icon,
  label,
  value,
  onChange,
  min,
  max,
  defaultValue,
  expanded
}: {
  icon: React.ElementType,
  label: string,
  value: number,
  onChange: (value: number) => void,
  min: number,
  max: number,
  defaultValue: number,
  expanded: boolean
}) {
  const isModified = value !== defaultValue;
  
  const handleDoubleClick = () => {
    onChange(defaultValue);
  };

  return (
    <div
      className={cn(
        "group relative rounded-lg transition-colors duration-150",
        expanded ? "min-h-[64px] py-2" : "h-9",
        "flex items-center",
        isModified 
          ? "bg-primary/10 text-primary" 
          : "text-foreground/70 hover:text-foreground hover:bg-secondary"
      )}
      title={!expanded ? `${label}: ${value}` : undefined}
    >
      <div className={cn(
        "flex items-center justify-center shrink-0",
        expanded ? "w-[50px]" : "w-full"
      )}>
        <Icon size={18} strokeWidth={1.8} />
      </div>
      
      <div 
        className={cn(
          "flex-1 flex flex-col justify-center overflow-visible transition-all duration-200 pr-2",
          expanded ? "opacity-100" : "opacity-0 w-0"
        )}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium whitespace-nowrap">{label}</span>
          <span className="text-[10px] text-muted">{value}</span>
        </div>
        <div className="relative h-6 flex items-center py-1.5">
          <input
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            onDoubleClick={handleDoubleClick}
            className="w-full h-1 bg-border rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-sm"
          />
        </div>
      </div>

      {!expanded && isModified && (
        <span className="absolute top-0 right-0 text-[8px] px-1 rounded bg-primary/20">
          {value}
        </span>
      )}

      {!expanded && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-foreground text-background text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity duration-150">
          {label}: {value}
        </div>
      )}
    </div>
  );
}
