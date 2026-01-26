"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, Link as LinkIcon, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { KeyboardHint } from "@/components/keyboard-hint";

interface ImageDropzoneProps {
  onImageSelect: (dataUrl: string) => void;
  className?: string;
}

export function ImageDropzone({ onImageSelect, className }: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const dropzoneRef = useRef<HTMLDivElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    
    if (file.type === 'image/gif') {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          onImageSelect(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!e.target?.result) return;
      
      const arrayBuffer = e.target.result as ArrayBuffer;
      const bytes = new Uint8Array(arrayBuffer.slice(0, 6));
      
      // Check for GIF signature: "GIF87a" or "GIF89a" (0x47 0x49 0x46)
      const isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;

      const base64 = btoa(
        Array.from(new Uint8Array(arrayBuffer))
          .map(byte => String.fromCharCode(byte))
          .join('')
      );
      
      const mimeType = isGif ? 'image/gif' : (file.type || 'image/png');
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      onImageSelect(dataUrl);
    };
    
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput) {
      onImageSelect(urlInput);
    }
  };

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        
        const file = item.getAsFile();
        if (!file) continue;

        if (file.type === 'image/gif') {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              onImageSelect(event.target.result as string);
            }
          };
          reader.readAsDataURL(file);
          return;
        }
        
        const reader = new FileReader();
        reader.onload = (event) => {
          if (!event.target?.result) return;
          
          const arrayBuffer = event.target.result as ArrayBuffer;
          const bytes = new Uint8Array(arrayBuffer.slice(0, 6));
          const isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
          
          const base64 = btoa(
            Array.from(new Uint8Array(arrayBuffer))
              .map(byte => String.fromCharCode(byte))
              .join('')
          );
          
          const mimeType = isGif ? 'image/gif' : (file.type || 'image/png');
          const dataUrl = `data:${mimeType};base64,${base64}`;
          
          onImageSelect(dataUrl);
        };
        
        reader.readAsArrayBuffer(file);
        break;
      }
    }
  }, [onImageSelect]);

  useEffect(() => {
    const element = dropzoneRef.current;
    if (!element) return;

    element.addEventListener('paste', handlePaste);
    return () => {
      element.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  return (
    <motion.div 
      ref={dropzoneRef}
      tabIndex={0}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "relative rounded-2xl transition-all duration-300 flex flex-col items-center justify-center overflow-hidden focus:outline-none",
        isDragging 
          ? "bg-primary/5 border-2 border-dashed border-primary/30" 
          : "bg-secondary/30 border-2 border-dashed border-border",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input 
        type="file" 
        accept="image/*" 
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        onChange={handleFileInput}
      />
      
      <motion.div 
        className="flex flex-col items-center gap-5 z-0 pointer-events-none"
        animate={isDragging ? { scale: 1.02 } : { scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {/* Icon */}
        <div className={cn(
          "w-16 h-16 rounded-2xl flex items-center justify-center transition-colors",
          isDragging ? "bg-primary/10" : "bg-secondary"
        )}>
          <ImageIcon className={cn(
            "w-7 h-7 transition-colors",
            isDragging ? "text-primary" : "text-muted"
          )} strokeWidth={1.5} />
        </div>

        {/* Text */}
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {isDragging ? "Release to upload" : "Drop image here"}
          </p>
          <KeyboardHint />
        </div>
      </motion.div>

      {/* URL Input */}
      <div className="absolute bottom-4 z-20 pointer-events-auto">
        <AnimatePresence mode="wait">
          {!showUrlInput ? (
            <motion.button 
              key="url-trigger"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUrlInput(true)}
              className="text-xs text-muted hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-secondary transition-all"
            >
              <LinkIcon size={12} />
              Paste URL
            </motion.button>
          ) : (
            <motion.form 
              key="url-input"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              onSubmit={handleUrlSubmit} 
              className="flex items-center gap-1.5 bg-background p-1 rounded-lg border border-border shadow-sm"
            >
              <input 
                type="url" 
                placeholder="https://..." 
                className="bg-transparent border-none outline-none text-xs px-2 w-48 text-foreground placeholder:text-muted"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                autoFocus
                onBlur={() => !urlInput && setShowUrlInput(false)}
              />
              <button 
                type="submit" 
                className="w-6 h-6 rounded bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary-hover transition-colors"
              >
                <Upload size={12} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
