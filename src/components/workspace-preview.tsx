"use client";

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { ImageActionButton } from '@/components/ui/image-action-button';
import { animationFrame } from '@/lib/image-engine/animation';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {ImageTransfer,ImageCopyButton,ImageShareButton,ImageDragSurface} from '@/components/image-transfer';
import {filenameFor} from '@/lib/image-transfer/transfer';
import { defaultExportOptions, type ExportOptions, type ExportResult, type ImageInfo, type ImageInput, type Preview } from '@/lib/image-engine/types';

interface WorkspacePreviewProps {
  original: ImageInput;
  preview: Preview | null;
  info: ImageInfo | null;
  isProcessing: boolean;
  isExporting: boolean;
  error: string | null;
  onExport: (options: ExportOptions) => Promise<ExportResult>;
  onPrepare: (options: ExportOptions) => Promise<ExportResult>;
}

function formatSize(size: number) {
  return size < 1024 ? size + ' B' : size < 1024 * 1024 ? (size / 1024).toFixed(1) + ' KB' : (size / (1024 * 1024)).toFixed(1) + ' MB';
}

export function WorkspacePreview({ original, preview, info, isProcessing, isExporting, error, onExport, onPrepare }: WorkspacePreviewProps) {
  const [transferring,setTransferring]=useState(false);
  const [options, setOptions] = useState<ExportOptions>(defaultExportOptions);
  const [exportSize, setExportSize] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const busy = isProcessing || isExporting || transferring;
  const animated = info?.animated ?? original.format === 'gif';
  const chosenFormat = options.format === 'auto' ? animated ? 'gif' : 'png' : options.format;
  const gif=animated;
  const getTransferFile=useCallback(async()=>{
    const result=await onPrepare({...defaultExportOptions,format:gif?'gif':'png',dither:options.dither});
    return new File([result.blob],filenameFor(original.name,result.blob.type),{type:result.blob.type});
  },[onPrepare,gif,options.dither,original.name]);
  const getOriginalFile=useCallback(async()=>new File([original.blob],filenameFor(original.name,original.blob.type,''),{type:original.blob.type}),[original]);

  const handleDownload = async () => {
    setActionError(null);
    try {
      const result = await onExport(options);
      const url = URL.createObjectURL(result.blob), link = document.createElement('a');
      link.href = url;
      link.download = original.name.replace(/\.[^.]*$/, '') + '-optic.' + (result.format === 'jpeg' ? 'jpg' : result.format);
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportSize(result.blob.size);
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Export failed.'); }
  };

  return (
    <ImageTransfer getFile={getTransferFile} mimeType={gif?'image/gif':'image/png'} disabled={!preview||isProcessing||isExporting||transferring} onError={setActionError} onWorkingChange={setTransferring}>
    <div className="relative w-full h-full flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3 text-xs text-muted">
          <span>{original.format === 'jpeg' ? 'JPG' : original.format.toUpperCase()}</span>
          <span>{formatSize(original.blob.size)}</span>
          {info && <span>{info.width} × {info.height}{info.animated ? ' · ' + info.frameCount + ' frames' : ''}</span>}
          {exportSize !== null && <span className="text-primary">→ {formatSize(exportSize)}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImageCopyButton />
          <ImageActionButton onClick={handleDownload} disabled={!preview || busy}>
            {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Export
          </ImageActionButton>
          <ImageShareButton />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 border-b border-border text-xs">
        <div className="flex items-center gap-2 text-muted">
          <span>Format</span>
          <Select label="Export format" value={options.format}
            onValueChange={format => setOptions(previous => ({ ...previous, format: format as ExportOptions['format'] }))}
            options={[{ value: 'auto', label: 'Auto' },
              ...(!animated ? [{ value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPEG' }, { value: 'webp', label: 'WebP' }] : []),
              { value: 'gif', label: 'GIF' }]} />
        </div>
        {chosenFormat === 'jpeg' && <label className="flex items-center gap-2 text-muted">Background
          <input aria-label="JPEG background" type="color" value={options.background} onChange={event => setOptions(previous => ({ ...previous, background: event.target.value }))} className="w-7 h-6 bg-transparent" />
        </label>}
        {chosenFormat === 'webp' && <Checkbox label="Lossless" checked={options.lossless}
          onCheckedChange={lossless => setOptions(previous => ({ ...previous, lossless }))} />}
        {(chosenFormat === 'jpeg' || (chosenFormat === 'webp' && !options.lossless)) && <label className="flex items-center gap-2 text-muted">Quality {options.quality}%
          <input aria-label="Export quality" type="range" min={1} max={100} value={options.quality} onChange={event => setOptions(previous => ({ ...previous, quality: Number(event.target.value) }))} className="w-24" />
        </label>}
        {chosenFormat === 'gif' && <Checkbox label="Dither new colors" checked={options.dither}
          onCheckedChange={dither => setOptions(previous => ({ ...previous, dither }))} />}
      </div>
      {(error || actionError) && <p role="alert" className="px-4 py-2 text-sm text-destructive">{error || actionError}</p>}
      <div className="flex-1 flex flex-col md:flex-row gap-3 p-4 overflow-auto min-h-0">
        <div className="flex-1 relative rounded-xl overflow-hidden bg-secondary/30 flex items-center justify-center min-h-[140px] md:min-h-0">
          <CheckerboardBg />
          <ImageTransfer getFile={getOriginalFile} mimeType={original.blob.type} disabled={transferring||isExporting} onError={setActionError} onWorkingChange={setTransferring}>
          <ImageDragSurface className="relative z-10 flex h-full w-full items-center justify-center">
          <img src={original.url} alt="Original" draggable={false} style={info ? {width:info.width,height:info.height} : undefined}
            className="relative z-10 max-w-full max-h-full object-contain" />
          </ImageDragSurface>
          </ImageTransfer>
        </div>
        <div className="flex-1 relative rounded-xl overflow-hidden bg-secondary/30 flex items-center justify-center min-h-[140px] md:min-h-0">
          <CheckerboardBg />
          {preview && <ImageDragSurface className="relative z-10 flex h-full w-full items-center justify-center"><FramePreview preview={preview} /></ImageDragSurface>}
          {isProcessing && <div className="absolute inset-0 flex items-center justify-center bg-background/40 z-30"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>}
        </div>
      </div>
    </div>
    </ImageTransfer>
  );
}

function FramePreview({ preview }: { preview: Preview }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current, context = canvas?.getContext('2d');
    if (!canvas || !context || !preview.frames.length) return;
    canvas.width = preview.width; canvas.height = preview.height;
    let frameId = 0, last = -1, active = true;
    const started = performance.now();
    const draw = (now: number) => {
      if (!active) return;
      const frame = animationFrame(now - started, preview.delays, preview.iterations);
      const bitmap = preview.frames[frame.index];
      if (!bitmap?.width || !bitmap.height) return;
      if (frame.index !== last) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0); last = frame.index;
      }
      if (preview.frames.length > 1 && !frame.finished) frameId = requestAnimationFrame(draw);
    };
    draw(started);
    return () => { active = false; cancelAnimationFrame(frameId); };
  }, [preview]);
  return <canvas ref={ref} role="img" aria-label="Processed" data-backend={preview.backend}
    data-gpu-renderer={preview.gpu?.renderer} data-fallback-reason={preview.fallbackReason}
    style={{width:preview.displayWidth,height:preview.displayHeight}}
    className="relative z-10 max-w-full max-h-full object-contain" />;
}

function CheckerboardBg() {
  return <div className="absolute inset-0 opacity-[0.05]" style={{
    backgroundImage: 'linear-gradient(45deg, currentColor 25%, transparent 25%), linear-gradient(-45deg, currentColor 25%, transparent 25%), linear-gradient(45deg, transparent 75%, currentColor 75%), linear-gradient(-45deg, transparent 75%, currentColor 75%)',
    backgroundSize: '16px 16px', backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
  }} />;
}
