'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EngineClient } from '@/lib/image-engine/client';
import type { ExportOptions, ImageInfo, ImageInput, Preview, Transformations } from '@/lib/image-engine/types';
export { defaultTransformations, type Transformations } from '@/lib/image-engine/types';

export function useImageProcessor(source: ImageInput | null, transformations: Transformations) {
  const client = useRef<EngineClient | null>(null);
  const encoder = useRef<EngineClient | null>(null);
  const encoderSource = useRef<string | undefined>(undefined);
  const generation = useRef(0);
  const displayed = useRef<Preview | null>(null);
  const seed = useRef(0x6d2b79f5);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [info, setInfo] = useState<ImageInfo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const engine = new EngineClient(); client.current = engine;
    const version = generation;
    return () => { version.current++; displayed.current?.frames.forEach(frame => frame.close()); displayed.current = null; engine.dispose(); encoder.current?.dispose(); encoder.current = null; client.current = null; };
  }, []);

  useEffect(() => {
    const current = ++generation.current, engine = client.current;
    let active = true;
    if (!engine) return;
    if (encoderSource.current !== source?.id) {
      encoder.current?.dispose(); encoder.current = null; encoderSource.current = source?.id;
    } else encoder.current?.cancelPending();
    if (displayed.current && displayed.current.sourceId !== source?.id) {
      displayed.current.frames.forEach(frame => frame.close()); displayed.current = null;
    }
    if (!source) {
      displayed.current?.frames.forEach(frame => frame.close()); displayed.current = null; engine.close();
      encoder.current?.dispose(); encoder.current = null;
      setPreview(null); setInfo(null); setError(null); setIsProcessing(false); setProgress(0);
      return;
    }
    setIsProcessing(true); setError(null); setProgress(0);
    const report = (value: number) => { if (active && generation.current === current) setProgress(value); };
    const timer = setTimeout(async () => {
      try {
        const metadata = await engine.open(source, report);
        if (!active || generation.current !== current) return;
        setInfo(metadata);
        const result = await engine.preview(source.id, transformations, seed.current, report);
        if (!active || generation.current !== current) { result.frames.forEach(frame => frame.close()); return; }
        const old = displayed.current; displayed.current = result; setPreview(result);
        requestAnimationFrame(() => old?.frames.forEach(frame => frame.close()));
      } catch (error) {
        if (active && generation.current === current && error instanceof Error && error.message !== 'Processing cancelled') setError(error.message);
      } finally { if (active && generation.current === current) setIsProcessing(false); }
    }, 70);
    return () => { active = false; clearTimeout(timer); };
  }, [source, transformations]);

  const exportImage = useCallback(async (options: ExportOptions) => {
    if (!source) throw new Error('Open an image first.');
    setIsExporting(true); setError(null);
    try {
      const engine = encoder.current ??= new EngineClient('encode');
      return await engine.encode(source, transformations, seed.current, options, setProgress);
    } catch (error) { if (error instanceof Error && error.message !== 'Processing cancelled') setError(error.message); throw error; }
    finally { setIsExporting(false); }
  }, [source, transformations]);

  const prepareImage = useCallback(async (options: ExportOptions) => {
    if(!source) throw new Error('Open an image first.');
    const engine=encoder.current ??= new EngineClient('encode');
    return engine.encode(source,transformations,seed.current,options);
  },[source,transformations]);

  return {
    preview: preview?.sourceId === source?.id ? preview : null,
    info: info?.sourceId === source?.id ? info : null,
    isProcessing, isExporting, progress, error, exportImage, prepareImage,
  };
}
