"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Github, ExternalLink, Code, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />
          
          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md glass-panel rounded-2xl p-6 z-50 shadow-2xl"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X size={18} />
            </button>

            {/* Content */}
            <div className="flex flex-col items-center gap-4">
              {/* Avatar */}
              <div className="relative">
                <img
                  src="https://avatars.githubusercontent.com/u/118198354?v=4"
                  alt="ZackMount"
                  className="w-20 h-20 rounded-full border-2 border-border"
                />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center border-2 border-background">
                  <Heart className="w-3 h-3 text-primary-foreground fill-current" />
                </div>
              </div>

              {/* Name & Title */}
              <div className="text-center">
                <h2 className="text-xl font-semibold text-foreground">ZackMount</h2>
                <p className="text-sm text-muted mt-1">Creator of Optic</p>
              </div>

              {/* Description */}
              <p className="text-sm text-foreground/70 text-center max-w-sm">
                Image processing tool for transform, flip, mirror, and apply effects to images.
                All operations are performed locally in the browser.
              </p>

              {/* Links */}
              <div className="w-full flex flex-col gap-2 mt-2">
                <a
                  href="https://github.com/ZackMount/optic"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-secondary hover:bg-secondary-hover transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-foreground/5 flex items-center justify-center">
                      <Github className="w-5 h-5 text-foreground" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-medium text-foreground">GitHub Repository</div>
                      <div className="text-xs text-muted">View source code</div>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted group-hover:text-foreground transition-colors" />
                </a>
              </div>

              {/* License & Tech */}
              <div className="w-full pt-4 border-t border-border flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">License</span>
                  <span className="font-medium text-foreground">MIT</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Built with</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">Next.js</span>
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">TypeScript</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="text-xs text-muted text-center pt-2">
                Made with <Heart className="w-3 h-3 inline text-red-500 fill-current" /> by ZackMount
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
