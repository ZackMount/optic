'use client';

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, useSyncExternalStore, type DragEvent, type ReactNode } from 'react';
import { Check, Copy, Loader2, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImageActionButton } from '@/components/ui/image-action-button';
import { canShareFile, copyFullImage, imageCopyUnavailableReason, imageDragUrl, shareFullImage } from '@/lib/image-transfer/transfer';

class Resource {
  file: File | null = null;
  url: string | null = null;
  image: HTMLImageElement | null = null;
  private pending: Promise<File> | null = null;
  private disposed = false;

  constructor(private readonly factory: () => Promise<File>) {}

  activate() { this.disposed = false; }

  prepare() {
    if (this.file) return Promise.resolve(this.file);
    if (!this.pending) {
      this.pending = this.factory().then(async file => {
        if (this.disposed) throw new Error('Processing cancelled');
        const url = await imageDragUrl(file);
        const image = new Image();
        image.src = url;
        await image.decode();
        if (this.disposed) throw new Error('Processing cancelled');
        this.file = file;
        this.url = url;
        this.image = image;
        return file;
      }).finally(() => { this.pending = null; });
    }
    return this.pending;
  }

  dispose() {
    this.disposed = true;
    this.file = null;
    this.url = null;
    this.image = null;
  }
}

type TransferContext = {
  file: File | null;
  url: string | null;
  ready: boolean;
  available: boolean;
  mimeType: string;
  copyUnavailableReason: string | null;
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

function subscribeClipboardSupport(listener: () => void) {
  window.addEventListener('focus', listener);
  return () => window.removeEventListener('focus', listener);
}

function useTransfer() {
  const context = useContext(Context);
  if (!context) throw new Error('Image transfer controls need an ImageTransfer provider.');
  return context;
}

export function ImageTransfer({ getFile, mimeType, disabled = false, onError, onWorkingChange, children }: {
  getFile: () => Promise<File>;
  mimeType: string;
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
  const copyUnavailableReason = useSyncExternalStore(subscribeClipboardSupport,
    () => imageCopyUnavailableReason(mimeType), () => 'Checking clipboard support…');

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
    if (disabled || working || copyUnavailableReason) return;
    run(() => copyFullImage(file || prepare(), mimeType, () => resource.image), 'copy');
  };
  const share = () => { if (file) run(() => shareFullImage(file), 'share'); };
  const drag = (event: DragEvent<HTMLElement>) => {
    const image = event.target;
    if (!file?.size || !ready || !(image instanceof HTMLImageElement) || !image.complete || !image.naturalWidth) {
      event.preventDefault(); return;
    }
    event.dataTransfer.effectAllowed = 'copy';
    const preview = event.currentTarget.querySelector<HTMLCanvasElement | HTMLImageElement>('canvas, img:not([data-transfer-image])');
    if (preview) {
      const bounds = preview.getBoundingClientRect();
      event.dataTransfer.setDragImage(preview, bounds.width / 2, bounds.height / 2);
    }
  };

  return <Context.Provider value={{
    file, url: resource.url, ready, available: !disabled && !working, mimeType, copyUnavailableReason,
    working, action, copied: copiedResource === resource,
    canShare: sharing === resource, copy, share, drag,
    prepare: () => { if (!disabled) void prepare().catch(report); },
  }}>{children}</Context.Provider>;
}

export function ImageCopyButton() {
  const transfer = useTransfer();
  const descriptionId = useId();
  const unsupported = !!transfer.copyUnavailableReason;
  const label = transfer.mimeType === 'image/gif' ? 'Copy GIF' : 'Copy';
  const disabled = !transfer.available || unsupported;
  return <span title={transfer.copyUnavailableReason || 'Copy the complete image to the clipboard'} className="inline-flex">
    <ImageActionButton onClick={transfer.copy} disabled={disabled}
    aria-label={label} aria-describedby={unsupported ? descriptionId : undefined}
    >
    {transfer.action === 'copy' ? <Loader2 size={14} className="animate-spin" /> : transfer.copied ? <Check size={14} /> : <Copy size={14} />}
    {transfer.action === 'copy' ? 'Copying…' : transfer.copied ? 'Copied' : label}
  </ImageActionButton>
    {unsupported && <span id={descriptionId} className="sr-only">{transfer.copyUnavailableReason}</span>}
  </span>;
}

export function ImageShareButton() {
  const transfer = useTransfer();
  return <ImageActionButton onClick={transfer.share} disabled={!transfer.ready || !transfer.canShare}
    title={transfer.canShare ? 'Share the complete image using your device' : 'File sharing is unavailable or the image is still being prepared'}>
    {transfer.action === 'share' ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}Share
  </ImageActionButton>;
}

export function ImageDragSurface({ children, className }: { children: ReactNode; className?: string }) {
  const transfer = useTransfer();
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const ready = transfer.ready && !!transfer.url && loadedUrl === transfer.url;
  return <div draggable={false} data-transfer-mode={ready ? 'web' : 'preparing'}
    onDragStart={transfer.drag} onPointerEnter={transfer.prepare}
    title={ready ? 'Drag the complete image to another app or input' : 'Preparing the complete image for dragging'}
    className={cn(className, 'select-none', ready && 'cursor-grab active:cursor-grabbing', transfer.working && 'opacity-70')}>
    {children}
    {transfer.url && <img src={transfer.url} alt="" aria-hidden="true" data-transfer-image
      onLoad={event => setLoadedUrl(event.currentTarget.currentSrc)} draggable={ready}
      className="absolute inset-0 z-20 h-full w-full object-contain opacity-0" />}
  </div>;
}
