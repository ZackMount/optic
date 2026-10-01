'use client';
import { useEffect } from 'react';
import { createImageInput } from '@/lib/image-engine/input';
import type { ImageInput } from '@/lib/image-engine/types';

export function useClipboardPaste(onImagePaste: (input: ImageInput) => void, onError: (message: string) => void) {
  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items || []).find(item => item.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (!file) return;
      event.preventDefault();
      try { onImagePaste(await createImageInput(file, file.name || 'pasted-image')); }
      catch (error) { onError(error instanceof Error ? error.message : 'Unable to paste the image.'); }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onImagePaste, onError]);
}
