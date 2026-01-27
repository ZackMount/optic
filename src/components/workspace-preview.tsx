"use client";

import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Loader2, Copy, Check } from 'lucide-react';
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
  const [copied, setCopied] = useState(false);
  const [isVertical, setIsVertical] = useState(false);
  
  useEffect(() => {
    const checkOrientation = () => {
      setIsVertical(window.innerWidth < 768); // md breakpoint
    };
    
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);
  
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

  const handleCopy = async () => {
    if (!processed) return;
    
    const isGif = processed.includes('image/gif');
    
    try {
      if (isGif) {
        // For GIF: Try multiple workarounds to copy
        const response = await fetch(processed);
        const gifBlob = await response.blob();
        
        // Method 1: Try copying GIF blob with different MIME type combinations
        if (navigator.clipboard && window.ClipboardItem) {
          // Try with 'image/png' wrapper (some browsers might accept)
          try {
            const item = new ClipboardItem({ 
              'image/png': gifBlob,
              'image/gif': gifBlob 
            });
            await navigator.clipboard.write([item]);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            return;
          } catch (err1) {
            // Method 2: Create a temporary img element and use execCommand
            try {
              const tempImg = document.createElement('img');
              tempImg.src = processed;
              tempImg.style.cssText = 'position:fixed;left:-9999px;opacity:0;pointer-events:none;';
              document.body.appendChild(tempImg);
              
              await new Promise((resolve) => {
                if (tempImg.complete) {
                  resolve(undefined);
                } else {
                  tempImg.onload = resolve;
                  tempImg.onerror = resolve;
                  setTimeout(resolve, 3000);
                }
              });
              
              // Try to copy the image element
              const range = document.createRange();
              range.selectNode(tempImg);
              const selection = window.getSelection();
              if (selection) {
                selection.removeAllRanges();
                selection.addRange(range);
                
                const copied = document.execCommand('copy');
                selection.removeAllRanges();
                
                if (copied) {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                  document.body.removeChild(tempImg);
                  return;
                }
              }
              
              document.body.removeChild(tempImg);
            } catch (err2) {
              // Method 3: Fallback to PNG (first frame)
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.src = processed;
              
              await new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
                setTimeout(resolve, 3000);
              });
              
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                canvas.toBlob(async (pngBlob) => {
                  if (pngBlob && navigator.clipboard && window.ClipboardItem) {
                    try {
                      const item = new ClipboardItem({ 'image/png': pngBlob });
                      await navigator.clipboard.write([item]);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch (err3) {
                      console.warn('GIF copying limited by browser. Use Export for full GIF.');
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }
                  }
                }, 'image/png');
              }
            }
          }
        }
      } else {
        // For non-GIF images, use Clipboard API normally
        const response = await fetch(processed);
        const blob = await response.blob();
        
        if (navigator.clipboard && window.ClipboardItem) {
          const item = new ClipboardItem({ [blob.type]: blob });
          await navigator.clipboard.write([item]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }
    } catch (err) {
      console.error('Failed to copy image:', err);
    }
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
        
        <div className="flex items-center gap-2">
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={handleCopy}
            disabled={!processed || isProcessing}
            className={cn(
              "btn-secondary flex items-center gap-2 text-xs py-1.5 px-3",
              (!processed || isProcessing) && "opacity-50 cursor-not-allowed"
            )}
            title="Copy image to clipboard"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </motion.button>
          
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
      </div>

      {/* Preview Area */}
      <div className="flex-1 flex flex-col md:flex-row gap-3 p-4 overflow-auto">
        {/* Original */}
        <motion.div 
          initial={{ opacity: 0, x: isVertical ? 0 : -10, y: isVertical ? -10 : 0 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          className="flex-1 relative rounded-xl overflow-hidden bg-secondary/30 flex items-center justify-center min-h-0"
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
          initial={{ opacity: 0, x: isVertical ? 0 : 10, y: isVertical ? 10 : 0 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          className="flex-1 relative rounded-xl overflow-hidden bg-secondary/30 flex items-center justify-center min-h-0"
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
            <ProcessedImage 
              src={processed}
              isProcessing={isProcessing}
            />
          ) : !isProcessing && (
            <div className="text-muted text-xs">Waiting...</div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function ProcessedImage({ src, isProcessing }: { src: string, isProcessing: boolean }) {
  return (
    <motion.img 
      key={src}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      src={src} 
      alt="Processed" 
      className={cn(
        "relative z-10 max-w-full max-h-full object-contain",
        isProcessing && "opacity-50"
      )}
    />
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
