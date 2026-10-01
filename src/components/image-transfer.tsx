'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react';
import { Check, Copy, Loader2, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { addFileToDrag, canShareFile, copyFullImage, shareFullImage } from '@/lib/image-transfer/transfer';

class Resource {
  file: File | null = null;
  url: string | null = null;
  private pending: Promise<File> | null = null;
  private disposed = false;
  private dragged = false;

  constructor(private readonly factory: () => Promise<File>) {}

  activate() { this.disposed = false; }
  markDragged() { this.dragged = true; }

  prepare() {
    if (this.file) return Promise.resolve(this.file);
    if (!this.pending) {
      this.pending = this.factory().then(file => {
        if (this.disposed) throw new Error('Processing cancelled');
        this.file = file;
        this.url = URL.createObjectURL(file);
        return file;
      }).finally(() => { this.pending = null; });
    }
    return this.pending;
  }

  dispose() {
    this.disposed = true;
    if (this.url) {
      const url = this.url;
      if (this.dragged) setTimeout(() => URL.revokeObjectURL(url), 60000);
      else URL.revokeObjectURL(url);
    }
  }
}

type TransferContext = {
  file: File | null;
  url: string | null;
  ready: boolean;
  working: boolean;
  action: 'copy' | 'share' | null;
  copied: boolean;
  canShare: boolean;
  copy: () => void;
  share: () => void;
  drag: (event: DragEvent<HTMLElement>) => void;
  prepare: () => void;
};

const Context = createContext<TransferContext | null>(null);

function useTransfer() {
  const context = useContext(Context);
  if (!context) throw new Error('Image transfer controls need an ImageTransfer provider.');
  return context;
}

export function ImageTransfer({ getFile, disabled = false, onError, onWorkingChange, children }: {
  getFile: () => Promise<File>;
  disabled?: boolean;
  onError: (message: string) => void;
  onWorkingChange?: (working: boolean) => void;
  children: ReactNode;
}) {
  const resource = useMemo(() => new Resource(getFile), [getFile]);
  const [version, setVersion] = useState<Resource | null>(null);
  const [action, setAction] = useState<'copy' | 'share' | null>(null);
  const [copiedResource, setCopiedResource] = useState<Resource | null>(null);
  const [sharing, setSharing] = useState<Resource | null>(null);
  const working = action !== null;
  const file = version === resource ? resource.file : null;
  const ready = !!file && !disabled && !working;

  const report = useCallback((error: unknown) => {
    if (error instanceof Error && error.message === 'Processing cancelled') return;
    if (error instanceof DOMException && error.name === 'AbortError') return;
    onError(error instanceof Error ? error.message : 'Image transfer failed.');
  }, [onError]);

  const prepare = useCallback(async () => {
    const prepared = await resource.prepare();
    setVersion(resource);
    setSharing(canShareFile(prepared) ? resource : null);
    return prepared;
  }, [resource]);

  useEffect(() => {
    resource.activate();
    return () => resource.dispose();
  }, [resource]);

  useEffect(() => {
    if (disabled) return;
    const timer = setTimeout(() => { void prepare().catch(report); }, 450);
    return () => clearTimeout(timer);
  }, [disabled, prepare, report]);

  useEffect(() => { onWorkingChange?.(working); }, [working, onWorkingChange]);

  const run = (callback: () => Promise<void>, operation: 'copy' | 'share') => {
    setAction(operation);
    onError('');
    void callback().then(() => {
      if (operation === 'copy') {
        setCopiedResource(resource);
        setTimeout(() => setCopiedResource(current => current === resource ? null : current), 2000);
      }
    }).catch(report).finally(() => setAction(null));
  };

  const copy = () => {
    if (!file) {
      void prepare().catch(report);
      onError('Preparing the complete image. Try Copy again in a moment.');
      return;
    }
    run(() => copyFullImage(file), 'copy');
  };
  const share = () => { if (file) run(() => shareFullImage(file), 'share'); };
  const drag = (event: DragEvent<HTMLElement>) => {
    if (!file || !resource.url || !ready) { event.preventDefault(); return; }
    resource.markDragged();
    addFileToDrag(event.dataTransfer, file, resource.url, event.target instanceof HTMLImageElement);
    const preview = event.currentTarget.querySelector('canvas');
    if (preview) event.dataTransfer.setDragImage(preview, preview.width / 2, preview.height / 2);
  };

  return <Context.Provider value={{
    file, url: resource.url, ready, working, action, copied: copiedResource === resource,
    canShare: sharing === resource, copy, share, drag,
    prepare: () => { if (!disabled) void prepare().catch(report); },
  }}>{children}</Context.Provider>;
}

export function ImageCopyButton() {
  const transfer = useTransfer();
  const label = transfer.file?.type === 'image/gif' ? 'Copy GIF' : 'Copy';
  return <button type="button" onClick={transfer.copy} disabled={!transfer.ready}
    title="Copy the complete image to the clipboard"
    className={cn('btn-secondary flex items-center gap-2 text-xs py-1.5 px-3', !transfer.ready && 'opacity-50 cursor-not-allowed')}>
    {transfer.action === 'copy' ? <Loader2 size={14} className="animate-spin" /> : transfer.copied ? <Check size={14} /> : <Copy size={14} />}
    {transfer.action === 'copy' ? 'Copying…' : transfer.copied ? 'Copied' : label}
  </button>;
}

export function ImageShareButton() {
  const transfer = useTransfer();
  return <button type="button" onClick={transfer.share} disabled={!transfer.ready || !transfer.canShare}
    title={transfer.canShare ? 'Share the complete image using your device' : 'File sharing is unavailable or the image is still being prepared'}
    className="btn-secondary flex items-center gap-2 text-xs py-1.5 px-3 disabled:opacity-50">
    {transfer.action === 'share' ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}Share
  </button>;
}

export function ImageDragSurface({ children, className }: { children: ReactNode; className?: string }) {
  const transfer = useTransfer();
  return <div draggable={transfer.ready} data-transfer-mode={transfer.ready ? 'web' : 'preparing'}
    onDragStart={transfer.drag} onPointerEnter={transfer.prepare}
    title={transfer.ready ? 'Drag the complete image to another app or input' : 'Preparing the complete image for dragging'}
    className={cn(className, 'select-none', transfer.ready && 'cursor-grab active:cursor-grabbing', transfer.working && 'opacity-70')}>
    {children}
    {transfer.ready && transfer.url && <img src={transfer.url} alt="" aria-hidden="true" draggable
      className="absolute inset-0 z-20 h-full w-full object-contain opacity-0" />}
  </div>;
}
