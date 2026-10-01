"use client";

import { useState } from 'react';
import { Upload, Link as LinkIcon, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { KeyboardHint } from "@/components/keyboard-hint";
import { createImageInput, loadImageUrl } from "@/lib/image-engine/input";
import type { ImageInput } from "@/lib/image-engine/types";

interface ImageDropzoneProps {
  onImageSelect: (input: ImageInput) => void;
  className?: string;
}

export function ImageDropzone({ onImageSelect, className }: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const processFile = async (file: File) => {
    setError(null);
    try { onImageSelect(await createImageInput(file, file.name)); }
    catch (error) { setError(error instanceof Error ? error.message : 'Unable to open the image.'); }
  };
  const handleDragOver = (event: React.DragEvent) => { event.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault(); setIsDragging(false);
    if (event.dataTransfer.files?.[0]) void processFile(event.dataTransfer.files[0]);
  };
  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) void processFile(event.target.files[0]);
    event.target.value = '';
  };
  const handleUrlSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true); setError(null);
    try { onImageSelect(await loadImageUrl(urlInput)); }
    catch (error) { setError(error instanceof Error ? error.message : 'Unable to download the image.'); }
    finally { setLoading(false); }
  };

  return (
    <motion.div 
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
      {error && <p role="alert" className="absolute top-4 z-20 px-4 text-sm text-destructive text-center">{error}</p>}
      <input 
        type="file" 
        accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.avif,.bmp,.tiff,.tif"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        onChange={handleFileInput}
      />
      
      <motion.div 
        className="flex flex-col items-center gap-5 z-0 pointer-events-none"
        animate={isDragging ? { scale: 1.02 } : { scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <div className={cn(
          "w-16 h-16 rounded-2xl flex items-center justify-center transition-colors",
          isDragging ? "bg-primary/10" : "bg-secondary"
        )}>
          <ImageIcon className={cn(
            "w-7 h-7 transition-colors",
            isDragging ? "text-primary" : "text-muted"
          )} strokeWidth={1.5} />
        </div>

        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {isDragging ? "Release to upload" : "Drop image here"}
          </p>
          <KeyboardHint />
        </div>
      </motion.div>

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
                disabled={loading}
                aria-label={loading ? "Loading image" : "Load image URL"}
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
