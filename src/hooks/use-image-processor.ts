import { useState, useEffect, useCallback, useRef } from 'react';
// @ts-ignore
import { parseGIF, decompressFrames } from 'gifuct-js';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export type Transformations = {
  flipHorizontal: boolean;
  flipVertical: boolean;
  rotation: 0 | 90 | 180 | 270;
  
  mirrorMode: 'none' | 'left' | 'right' | 'top' | 'bottom' | 'center';
  
  grayscale: boolean;
  invert: boolean;
  sepia: boolean;
  
  brightness: number;
  contrast: number;
  saturation: number;
  hueRotate: number;
  
  blur: number;
  pixelate: number;
  noise: number;
  
  shuffleFrames: boolean;
};

export const defaultTransformations: Transformations = {
  flipHorizontal: false,
  flipVertical: false,
  rotation: 0,
  mirrorMode: 'none',
  grayscale: false,
  invert: false,
  sepia: false,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hueRotate: 0,
  blur: 0,
  pixelate: 1,
  noise: 0,
  shuffleFrames: false,
};

export function useImageProcessor(sourceImage: string | null, transformations: Transformations) {
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const processingRef = useRef(false);

  const processImage = useCallback(async () => {
    if (!sourceImage) {
      setResultImage(null);
      setProgress(0);
      return;
    }

    if (processingRef.current) return;
    processingRef.current = true;

    setIsProcessing(true);
    setProgress(0);

    try {
      const isGif = sourceImage.startsWith('data:image/gif');

      if (isGif) {
        await processGif(sourceImage, transformations, setResultImage, setProgress);
      } else {
        await processStaticImage(sourceImage, transformations, setResultImage);
        setProgress(100);
      }
      
    } catch (e) {
      console.error("Processing failed", e);
    } finally {
      setIsProcessing(false);
      processingRef.current = false;
    }
  }, [sourceImage, transformations]);

  useEffect(() => {
    const timer = setTimeout(() => {
      processImage();
    }, 300);
    return () => clearTimeout(timer);
  }, [processImage]);

  return { resultImage, isProcessing, progress };
}

async function processStaticImage(
  src: string, 
  transformations: Transformations, 
  setResult: (s: string) => void
) {
  let imageSrc = src;
  let originalFormat: string | null = null;
  
  if (src.startsWith('http://') || src.startsWith('https://')) {
    const fetchWithFallback = async (url: string): Promise<Blob> => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const blob = await response.blob();
          // Try to detect format from Content-Type or URL extension
          if (blob.type) {
            originalFormat = blob.type;
          } else {
            const urlLower = url.toLowerCase();
            if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) {
              originalFormat = 'image/jpeg';
            } else if (urlLower.includes('.png')) {
              originalFormat = 'image/png';
            } else if (urlLower.includes('.webp')) {
              originalFormat = 'image/webp';
            }
          }
          return blob;
        }
      } catch {
      }
      
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      const proxyResponse = await fetch(proxyUrl);
      if (!proxyResponse.ok) {
        throw new Error('Failed to fetch image');
      }
      const blob = await proxyResponse.blob();
      if (blob.type) {
        originalFormat = blob.type;
      }
      return blob;
    };

    try {
      const blob = await fetchWithFallback(src);
      imageSrc = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error('Failed to fetch image from URL:', e);
      throw new Error('Unable to load image from URL. Please download the image and upload it directly.');
    }
  } else if (src.startsWith('data:')) {
    // Extract format from data URL
    const match = src.match(/^data:image\/([^;]+)/);
    if (match) {
      const format = match[1].toLowerCase();
      if (format === 'jpeg' || format === 'jpg') {
        originalFormat = 'image/jpeg';
      } else if (format === 'png') {
        originalFormat = 'image/png';
      } else if (format === 'webp') {
        originalFormat = 'image/webp';
      }
    }
  }
  
  const img = new Image();
  img.src = imageSrc;
  await new Promise((resolve, reject) => { 
    img.onload = resolve; 
    img.onerror = reject;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const isRotated90or270 = transformations.rotation === 90 || transformations.rotation === 270;
  canvas.width = isRotated90or270 ? img.height : img.width;
  canvas.height = isRotated90or270 ? img.width : img.height;

  applyTransformsToCanvas(canvas, ctx, img, img.width, img.height, transformations);

  const outputFormat = originalFormat === 'image/jpeg' ? 'image/jpeg' : 'image/png';

  if (outputFormat === 'image/jpeg') {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('JPEG encoding failed'));
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        0.88
      );
    });
    setResult(dataUrl);
  } else {
    setResult(canvas.toDataURL('image/png'));
  }
}

async function processGif(
  src: string, 
  transformations: Transformations, 
  setResult: (s: string) => void,
  setProgress: (p: number) => void
) {
  setProgress(5);
  
  const resp = await fetch(src);
  const buff = await resp.arrayBuffer();
  const gif = parseGIF(buff);
  const frames = decompressFrames(gif, true);
  
  if (!frames || frames.length === 0) {
    console.error("No frames found in GIF");
    return;
  }

  console.log(`Processing GIF: ${frames.length} frames`);
  setProgress(10);

  const gifWidth = gif.lsd.width;
  const gifHeight = gif.lsd.height;

  const isRotated = transformations.rotation === 90 || transformations.rotation === 270;
  const finalWidth = isRotated ? gifHeight : gifWidth;
  const finalHeight = isRotated ? gifWidth : gifHeight;

  // --- Phase 1: Detect if the source GIF actually uses transparency ---
  let gifHasTransparency = false;
  for (const frame of frames) {
    if (frame.transparentIndex !== undefined && frame.transparentIndex !== null && frame.transparentIndex >= 0) {
      gifHasTransparency = true;
      break;
    }
  }

  // --- Phase 2: Render all frames to full-size snapshots (composited) ---
  // We always render in original order to respect disposal methods,
  // then shuffle the fully-rendered snapshots if needed.
  const fullFrameSnapshots: { canvas: HTMLCanvasElement; delay: number }[] = [];
  
  const accCanvas = document.createElement('canvas');
  accCanvas.width = gifWidth;
  accCanvas.height = gifHeight;
  const accCtx = accCanvas.getContext('2d')!;

  // For non-transparent GIFs, fill with white background to prevent
  // transparent areas from appearing
  if (!gifHasTransparency) {
    accCtx.fillStyle = '#ffffff';
    accCtx.fillRect(0, 0, gifWidth, gifHeight);
  }
  
  const prevCanvas = document.createElement('canvas');
  prevCanvas.width = gifWidth;
  prevCanvas.height = gifHeight;
  const prevCtx = prevCanvas.getContext('2d')!;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    
    // Save state before drawing for disposal type 3 (restore to previous)
    prevCtx.clearRect(0, 0, gifWidth, gifHeight);
    prevCtx.drawImage(accCanvas, 0, 0);
    
    // Draw current frame patch onto accumulator
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = frame.dims.width;
    frameCanvas.height = frame.dims.height;
    const frameCtx = frameCanvas.getContext('2d')!;
    
    const imageData = new ImageData(
      new Uint8ClampedArray(frame.patch),
      frame.dims.width,
      frame.dims.height
    );
    frameCtx.putImageData(imageData, 0, 0);
    
    accCtx.drawImage(frameCanvas, frame.dims.left, frame.dims.top);
    
    // Take a full snapshot of the composited frame
    const snapshotCanvas = document.createElement('canvas');
    snapshotCanvas.width = gifWidth;
    snapshotCanvas.height = gifHeight;
    const snapshotCtx = snapshotCanvas.getContext('2d')!;
    snapshotCtx.drawImage(accCanvas, 0, 0);
    
    fullFrameSnapshots.push({
      canvas: snapshotCanvas,
      delay: frame.delay || 100
    });
    
    // Handle disposal AFTER taking snapshot
    const disposalType = frame.disposalType;
    if (disposalType === 2) {
      // Dispose: restore to background
      accCtx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
      if (!gifHasTransparency) {
        accCtx.fillStyle = '#ffffff';
        accCtx.fillRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
      }
    } else if (disposalType === 3) {
      // Dispose: restore to previous
      accCtx.clearRect(0, 0, gifWidth, gifHeight);
      accCtx.drawImage(prevCanvas, 0, 0);
    }
    
    const frameProgress = 10 + Math.round(((i + 1) / frames.length) * 25);
    setProgress(frameProgress);
    
    if (i % 3 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // --- Phase 3: Shuffle the fully-rendered snapshots if needed ---
  let orderedSnapshots = fullFrameSnapshots;
  if (transformations.shuffleFrames && orderedSnapshots.length > 1) {
    orderedSnapshots = [...fullFrameSnapshots];
    for (let i = orderedSnapshots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [orderedSnapshots[i], orderedSnapshots[j]] = [orderedSnapshots[j], orderedSnapshots[i]];
    }
  }

  // --- Phase 4: Apply visual transforms to each snapshot ---
  const renderedFrames: { canvas: HTMLCanvasElement; delay: number }[] = [];
  for (let i = 0; i < orderedSnapshots.length; i++) {
    const { canvas: snapshotCanvas, delay } = orderedSnapshots[i];
    
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = finalWidth;
    resultCanvas.height = finalHeight;
    const resultCtx = resultCanvas.getContext('2d')!;
    
    applyTransformsToCanvas(resultCanvas, resultCtx, snapshotCanvas, gifWidth, gifHeight, transformations);
    
    renderedFrames.push({ canvas: resultCanvas, delay });
    
    const frameProgress = 35 + Math.round(((i + 1) / orderedSnapshots.length) * 15);
    setProgress(frameProgress);
    
    if (i % 3 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  setProgress(50);

  // --- Phase 5: Extract pixel data and handle transparency ---
  const framePixels: Uint8ClampedArray[] = [];
  for (let i = 0; i < renderedFrames.length; i++) {
    const { canvas } = renderedFrames[i];
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = new Uint8ClampedArray(imgData.data);

    if (gifHasTransparency) {
      // Replace transparent pixels with a key color for GIF transparency
      for (let j = 0; j < data.length; j += 4) {
        if (data[j + 3] < 128) {
          data[j] = 0;
          data[j + 1] = 255;
          data[j + 2] = 0;
          data[j + 3] = 255;
        }
      }
    }

    framePixels.push(data);
    setProgress(50 + Math.round(((i + 1) / renderedFrames.length) * 35));

    if (i % 3 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // --- Phase 6: Quantize and encode ---
  const quantizeOpts: Parameters<typeof quantize>[2] = gifHasTransparency
    ? {
        format: 'rgba4444' as const,
        oneBitAlpha: 128,
        clearAlpha: true,
        clearAlphaThreshold: 128,
        clearAlphaColor: 0x00ff00
      }
    : {
        format: 'rgba4444' as const
      };

  const palette = quantize(framePixels[0], 256, quantizeOpts);

  let transparentIdx = -1;
  if (gifHasTransparency) {
    const transparentIndex = palette.findIndex(
      (c: number[]) => c[0] === 0 && c[1] === 255 && c[2] === 0
    );
    transparentIdx = transparentIndex >= 0 ? transparentIndex : 0;
  }

  const encoder = GIFEncoder();
  for (let i = 0; i < renderedFrames.length; i++) {
    const { delay } = renderedFrames[i];
    const index = applyPalette(framePixels[i], palette, 'rgba4444');

    const frameOpts: Parameters<typeof encoder.writeFrame>[3] = {
      palette: i === 0 ? palette : undefined,
      delay,
      repeat: i === 0 ? 0 : undefined,
      dispose: 2, // Each frame fully replaces the previous one
    };

    if (gifHasTransparency && transparentIdx >= 0) {
      frameOpts.transparent = true;
      frameOpts.transparentIndex = transparentIdx;
    }

    encoder.writeFrame(index, finalWidth, finalHeight, frameOpts);
    setProgress(85 + Math.round(((i + 1) / renderedFrames.length) * 15));

    if (i % 3 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }
  encoder.finish();

  const bytes = encoder.bytes();
  const blob = new Blob([new Uint8Array(bytes)], { type: 'image/gif' });

  return new Promise<void>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setResult(reader.result as string);
      setProgress(100);
      resolve();
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function applyTransformsToCanvas(
  canvas: HTMLCanvasElement, 
  ctx: CanvasRenderingContext2D, 
  imageSource: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  transformations: Transformations
) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((transformations.rotation * Math.PI) / 180);
  if (transformations.flipHorizontal) ctx.scale(-1, 1);
  if (transformations.flipVertical) ctx.scale(1, -1);
  
  ctx.drawImage(imageSource, -srcWidth / 2, -srcHeight / 2, srcWidth, srcHeight);
  ctx.restore();

  if (transformations.pixelate > 1) {
    const pixelSize = transformations.pixelate;
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;
    
    const smallWidth = Math.ceil(canvas.width / pixelSize);
    const smallHeight = Math.ceil(canvas.height / pixelSize);
    
    tempCanvas.width = smallWidth;
    tempCanvas.height = smallHeight;
    
    tempCtx.drawImage(canvas, 0, 0, smallWidth, smallHeight);
    
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0, smallWidth, smallHeight, 0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
  }

  if (transformations.blur > 0) {
    ctx.filter = `blur(${transformations.blur}px)`;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCanvas.getContext('2d')!.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.filter = 'none';
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    
    if (transformations.brightness !== 100) {
      const factor = transformations.brightness / 100;
      r = Math.min(255, r * factor);
      g = Math.min(255, g * factor);
      b = Math.min(255, b * factor);
    }
    
    if (transformations.contrast !== 100) {
      const factor = (transformations.contrast / 100);
      const intercept = 128 * (1 - factor);
      r = Math.min(255, Math.max(0, r * factor + intercept));
      g = Math.min(255, Math.max(0, g * factor + intercept));
      b = Math.min(255, Math.max(0, b * factor + intercept));
    }
    
    if (transformations.saturation !== 100) {
      const factor = transformations.saturation / 100;
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = Math.min(255, Math.max(0, gray + factor * (r - gray)));
      g = Math.min(255, Math.max(0, gray + factor * (g - gray)));
      b = Math.min(255, Math.max(0, gray + factor * (b - gray)));
    }
    
    if (transformations.hueRotate !== 0) {
      const [h, s, l] = rgbToHsl(r, g, b);
      const newH = (h + transformations.hueRotate / 360) % 1;
      [r, g, b] = hslToRgb(newH, s, l);
    }
    
    if (transformations.grayscale) {
      const avg = (r * 0.299 + g * 0.587 + b * 0.114);
      r = g = b = avg;
    }

    if (transformations.invert) {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }
    
    if (transformations.sepia) {
      const tr = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
      const tg = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
      const tb = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
      r = tr;
      g = tg;
      b = tb;
    }
    
    if (transformations.noise > 0) {
      const noise = (Math.random() - 0.5) * transformations.noise * 2.55;
      r = Math.min(255, Math.max(0, r + noise));
      g = Math.min(255, Math.max(0, g + noise));
      b = Math.min(255, Math.max(0, b + noise));
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  ctx.putImageData(imageData, 0, 0);

  if (transformations.mirrorMode !== 'none') {
    const w = canvas.width;
    const h = canvas.height;
    
    const temp = document.createElement('canvas');
    temp.width = w;
    temp.height = h;
    const tempCtx = temp.getContext('2d');
    if (!tempCtx) return;
    tempCtx.drawImage(canvas, 0, 0);

    if (transformations.mirrorMode === 'left') {
      ctx.clearRect(w / 2, 0, w / 2, h);
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(temp, 0, 0, w / 2, h, 0, 0, w / 2, h);
      ctx.restore();
    } else if (transformations.mirrorMode === 'right') {
      ctx.clearRect(0, 0, w / 2, h);
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(temp, w / 2, 0, w / 2, h, w / 2, 0, w / 2, h);
      ctx.restore();
    } else if (transformations.mirrorMode === 'top') {
      ctx.clearRect(0, h / 2, w, h / 2);
      ctx.save();
      ctx.translate(0, h);
      ctx.scale(1, -1);
      ctx.drawImage(temp, 0, 0, w, h / 2, 0, 0, w, h / 2);
      ctx.restore();
    } else if (transformations.mirrorMode === 'bottom') {
      ctx.clearRect(0, 0, w, h / 2);
      ctx.save();
      ctx.translate(0, h);
      ctx.scale(1, -1);
      ctx.drawImage(temp, 0, h / 2, w, h / 2, 0, h / 2, w, h / 2);
      ctx.restore();
    } else if (transformations.mirrorMode === 'center') {
      const halfW = w / 2;
      const halfH = h / 2;
      
      ctx.clearRect(halfW, 0, halfW, halfH);
      ctx.clearRect(0, halfH, halfW, halfH);
      ctx.clearRect(halfW, halfH, halfW, halfH);
      
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(temp, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
      ctx.restore();
      
      ctx.save();
      ctx.translate(0, h);
      ctx.scale(1, -1);
      ctx.drawImage(temp, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
      ctx.restore();
      
      ctx.save();
      ctx.translate(w, h);
      ctx.scale(-1, -1);
      ctx.drawImage(temp, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
      ctx.restore();
    }
  }
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
