"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Loader2 } from 'lucide-react';
import { cn } from "@/lib/utils";

interface WorkspacePreviewProps {
  original: string;
  processed: string | null;
  isProcessing: boolean;
}

function formatFileSize(dataUrl: string): string {
  // Estimate size from base64 data URL
  const base64 = dataUrl.split(',')[1];
  if (!base64) return '';
  const bytes = Math.ceil((base64.length * 3) / 4);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getImageType(dataUrl: string): string {
  if (dataUrl.includes('image/gif')) return 'GIF';
  if (dataUrl.includes('image/png')) return 'PNG';
  if (dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg')) return 'JPG';
  if (dataUrl.includes('image/webp')) return 'WEBP';
  if (dataUrl.startsWith('http')) return 'URL';
  return 'Image';
}

export function WorkspacePreview({ original, processed, isProcessing }: WorkspacePreviewProps) {
  
  const originalInfo = useMemo(() => ({
    type: getImageType(original),
    size: formatFileSize(original)
  }), [original]);

  const processedInfo = useMemo(() => {
    if (!processed) return null;
    return {
      type: getImageType(processed),
      size: formatFileSize(processed)
    };
  }, [processed]);

  const handleDownload = () => {
    if (!processed) return;
    const link = document.createElement('a');
    link.href = processed;
    const ext = processed.includes('image/png') ? 'png' : processed.includes('image/gif') ? 'gif' : 'jpg';
    link.download = `optic-${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-4 text-xs text-muted">
          <span>{originalInfo.type}</span>
          {originalInfo.size && (
            <>
              <span className="w-px h-3 bg-border" />
              <span>{originalInfo.size}</span>
            </>
          )}
          {processedInfo && processedInfo.size !== originalInfo.size && (
            <>
              <span className="w-px h-3 bg-border" />
              <span className="text-primary">→ {processedInfo.size}</span>
            </>
          )}
        </div>
        
        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={handleDownload}
          disabled={!processed || isProcessing}
          className={cn(
            "btn-primary flex items-center gap-2 text-xs py-1.5 px-3",
            (!processed || isProcessing) && "opacity-50 cursor-not-allowed"
          )}
        >
          <Download size={14} />
          Export
        </motion.button>
      </div>

      {/* Preview Area */}
      <div className="flex-1 flex gap-3 p-4 overflow-hidden">
        {/* Original */}
        <motion.div 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex-1 relative rounded-xl overflow-hidden bg-secondary/30 flex items-center justify-center"
        >
          <CheckerboardBg />
          <img 
            src={original} 
            alt="Original" 
            className="relative z-10 max-w-full max-h-full object-contain" 
          />
        </motion.div>

        {/* Processed */}
        <motion.div 
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex-1 relative rounded-xl overflow-hidden bg-secondary/30 flex items-center justify-center"
        >
          <CheckerboardBg />
          
          {/* Processing overlay */}
          <AnimatePresence>
            {isProcessing && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-30"
              >
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </motion.div>
            )}
          </AnimatePresence>
          
          {processed ? (
            <motion.img 
              key={processed}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              src={processed} 
              alt="Processed" 
              className={cn(
                "relative z-10 max-w-full max-h-full object-contain",
                isProcessing && "opacity-50"
              )}
            />
          ) : !isProcessing && (
            <div className="text-muted text-xs">Waiting...</div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function CheckerboardBg() {
  return (
    <div 
      className="absolute inset-0 opacity-[0.02]" 
      style={{
        backgroundImage: `
          linear-gradient(45deg, currentColor 25%, transparent 25%),
          linear-gradient(-45deg, currentColor 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, currentColor 75%),
          linear-gradient(-45deg, transparent 75%, currentColor 75%)
        `,
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
      }}
    />
  );
}
