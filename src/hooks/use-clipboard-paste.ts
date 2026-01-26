"use client";

import { useEffect, useCallback } from 'react';

export function useClipboardPaste(onImagePaste: (dataUrl: string) => void) {
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // Find image item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        
        const file = item.getAsFile();
        if (!file) continue;

        // Read file as ArrayBuffer to check actual content type
        const reader = new FileReader();
        reader.onload = (event) => {
          if (!event.target?.result) return;
          
          const arrayBuffer = event.target.result as ArrayBuffer;
          const bytes = new Uint8Array(arrayBuffer.slice(0, 6));
          
          // Check for GIF signature
          const isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
          
          // Convert to base64
          const base64 = btoa(
            Array.from(new Uint8Array(arrayBuffer))
              .map(byte => String.fromCharCode(byte))
              .join('')
          );
          
          // Use correct MIME type
          const mimeType = isGif ? 'image/gif' : (file.type || 'image/png');
          const dataUrl = `data:${mimeType};base64,${base64}`;
          
          onImagePaste(dataUrl);
        };
        
        reader.readAsArrayBuffer(file);
        break;
      }
    }
  }, [onImagePaste]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);
}
