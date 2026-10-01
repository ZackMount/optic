"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sun, Moon, Monitor, X, Aperture, Info } from "lucide-react";
import { type ThemeMode } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { AboutDialog } from "@/components/about-dialog";

interface HeaderProps {
  themeMode: ThemeMode;
  onCycleTheme: () => void;
  hasImage: boolean;
  onClose?: () => void;
  progress?: number;
  isProcessing?: boolean;
}

const themeIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const themeLabels = {
  light: 'Light',
  dark: 'Dark', 
  system: 'System',
};

export function Header({ themeMode, onCycleTheme, hasImage, onClose, progress = 0, isProcessing = false }: HeaderProps) {
  const [showAbout, setShowAbout] = useState(false);
  const showProgress = isProcessing && progress > 0 && progress < 100;
  const ThemeIcon = themeIcons[themeMode];
  
  return (
    <>
      <header className="relative shrink-0 z-50">
      {showProgress && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute top-0 left-0 right-0 h-1 bg-transparent overflow-hidden"
        >
          <motion.div 
            className="h-full bg-gradient-to-r from-primary via-blue-400 to-primary relative"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            style={{
              boxShadow: '0 0 12px 2px rgba(59, 130, 246, 0.5), 0 0 24px 4px rgba(59, 130, 246, 0.3)'
            }}
          />
        </motion.div>
      )}
      
      <div className="h-14 flex items-center justify-between px-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Aperture className="w-4 h-4 text-primary" strokeWidth={2} />
          </div>
          <span className="font-semibold text-foreground text-l">Optic</span>
        </div>

        {showProgress && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2"
          >
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-medium text-muted">{progress}%</span>
            </div>
          </motion.div>
        )}

        <div className="flex items-center gap-1">
          <button
            onClick={onCycleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-secondary transition-colors"
            title={`Theme: ${themeLabels[themeMode]}`}
          >
            <motion.div
              key={themeMode}
              initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ThemeIcon size={16} />
            </motion.div>
          </button>

          <button
            onClick={() => setShowAbout(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-secondary transition-colors"
            title="About"
          >
            <Info size={16} />
          </button>

          <button
            onClick={onClose}
            disabled={!hasImage}
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
              hasImage
                ? "text-muted hover:text-destructive hover:bg-destructive/10"
                : "text-muted/50 cursor-not-allowed"
            )}
            title={hasImage ? "Close image" : "No image to close"}
          >
            <X size={16} />
          </button>
        </div>
      </div>
      </header>

      <AboutDialog isOpen={showAbout} onClose={() => setShowAbout(false)} />
    </>
  );
}
