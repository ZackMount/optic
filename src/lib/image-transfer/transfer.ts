export function filenameFor(name: string, mime: string, suffix = '-optic') {
  const extension = ({
    'image/gif': 'gif', 'image/png': 'png', 'image/jpeg': 'jpg',
    'image/webp': 'webp', 'image/avif': 'avif', 'image/bmp': 'bmp', 'image/tiff': 'tiff',
  } as Record<string, string>)[mime] || 'png';
  const stem = name.replace(/\.[^.]*$/, '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '-') || 'image';
  return stem + suffix + '.' + extension;
}

export function imageDragUrl(file: File): Promise<string> {
  if (!file.size) return Promise.reject(new Error('The prepared image is empty. Try processing it again.'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Unable to prepare the complete image for dragging.'));
    };
    reader.onerror = () => reject(new Error('Unable to read the complete image.'));
    reader.onabort = () => reject(new Error('Processing cancelled'));
    reader.readAsDataURL(file);
  });
}

export function imageCopyUnavailableReason(mimeType: string): string | null {
  if (typeof window === 'undefined') return 'Checking clipboard support…';
  const selectionCopy = typeof document.execCommand === 'function';
  if (!navigator.clipboard?.write || !window.ClipboardItem) {
    if (selectionCopy) return null;
    return 'Image copying is unavailable in this browser. Use Share or Export.';
  }
  if (mimeType !== 'image/png' && !ClipboardItem.supports?.(mimeType) && !selectionCopy) {
    if (mimeType === 'image/gif' && ClipboardItem.supports?.('text/html')) return null;
    return 'This image format cannot be copied in this browser. Use Share or Export.';
  }
  return null;
}

export function canShareFile(file: File) {
  try {
    return !!navigator.share && !!navigator.canShare?.({ files: [file] });
  } catch {
    return false;
  }
}

function copySelectedImage(image: HTMLImageElement): boolean {
  const selection = window.getSelection();
  if (!selection || !image.complete || !image.naturalWidth || typeof document.execCommand !== 'function') return false;
  const ranges = Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange());
  const focused = document.activeElement;
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;pointer-events:none;';
  container.setAttribute('aria-hidden', 'true');
  container.appendChild(image);
  document.body.appendChild(container);
  try {
    const range = document.createRange();
    range.selectNode(image);
    selection.removeAllRanges();
    selection.addRange(range);
    return document.execCommand('copy');
  } finally {
    selection.removeAllRanges();
    container.remove();
    for (const range of ranges) if (range.commonAncestorContainer.isConnected) selection.addRange(range);
    if (focused instanceof HTMLElement) focused.focus({ preventScroll: true });
  }
}

async function copyImageSelection(file: File, getImage?: () => HTMLImageElement | null) {
  let image = getImage?.();
  if (!image) {
    image = new Image();
    image.src = await imageDragUrl(file);
    await image.decode();
  }
  if (!copySelectedImage(image)) throw new Error('Unable to copy the complete image. Focus this page and try again.');
}

export function copyFullImage(file: File | Promise<File>, mimeType: string, getImage?: () => HTMLImageElement | null): Promise<void> {
  const reason = imageCopyUnavailableReason(mimeType);
  if (reason) return Promise.reject(new Error(reason));
  const validate = (prepared: File) => {
    if (!prepared.size) throw new Error('The prepared image is empty. Try processing it again.');
    if (prepared.type !== mimeType) throw new Error('The image format changed. Try Copy again.');
    return prepared;
  };
  if (file instanceof File) {
    try { validate(file); } catch (error) { return Promise.reject(error); }
  }
  const data = Promise.resolve(file).then(validate);
  void data.catch(() => {});
  const image = getImage?.();
  const nativeFormat = mimeType === 'image/png' || !!window.ClipboardItem?.supports?.(mimeType);
  if (file instanceof File && image && !nativeFormat) {
    try {
      if (copySelectedImage(image)) return Promise.resolve();
    } catch {}
  }
  if (!navigator.clipboard?.write || !window.ClipboardItem) return data.then(prepared => copyImageSelection(prepared, getImage));
  const format = mimeType === 'image/gif' && !nativeFormat ? 'text/html' : mimeType;
  const payload = format === 'text/html' ? data.then(async prepared => {
    const url = getImage?.()?.src || await imageDragUrl(prepared);
    return new Blob(['<img src="' + url + '" alt="">'], { type: 'text/html' });
  }) : data;
  void payload.catch(() => {});
  try {
    return navigator.clipboard.write([new ClipboardItem({ [format]: payload })])
      .catch(() => data.then(prepared => copyImageSelection(prepared, getImage)));
  } catch {
    return data.then(prepared => copyImageSelection(prepared, getImage));
  }
}

export function shareFullImage(file: File): Promise<void> {
  if (!canShareFile(file)) {
    return Promise.reject(new Error('File sharing is unavailable in this browser.'));
  }
  return navigator.share({ files: [file], title: file.name });
}
