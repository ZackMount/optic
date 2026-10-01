export function filenameFor(name: string, mime: string, suffix = '-optic') {
  const extension = ({
    'image/gif': 'gif', 'image/png': 'png', 'image/jpeg': 'jpg',
    'image/webp': 'webp', 'image/avif': 'avif', 'image/bmp': 'bmp', 'image/tiff': 'tiff',
  } as Record<string, string>)[mime] || 'png';
  const stem = name.replace(/\.[^.]*$/, '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '-') || 'image';
  return stem + suffix + '.' + extension;
}

export function addFileToDrag(data: DataTransfer, file: File, url: string, imagePayload = false) {
  for (const type of ['text/plain', 'text/uri-list', 'text/html']) data.clearData(type);
  data.effectAllowed = 'copy';
  if (!imagePayload) data.items.add(file);
  data.setData('DownloadURL', file.type + ':' + file.name + ':' + url);
}

export function canShareFile(file: File) {
  try {
    return !!navigator.share && !!navigator.canShare?.({ files: [file] });
  } catch {
    return false;
  }
}

export function copyFullImage(file: File): Promise<void> {
  if (!navigator.clipboard || !window.ClipboardItem) {
    return Promise.reject(new Error('Image copying is unavailable in this browser.'));
  }
  if (file.type !== 'image/png' && !ClipboardItem.supports?.(file.type)) {
    return Promise.reject(new Error(file.type === 'image/gif'
      ? 'This browser cannot copy a complete animated GIF. Use Share or Export.'
      : 'This image format cannot be copied in this browser. Use Share or Export.'));
  }
  return navigator.clipboard.write([new ClipboardItem({ [file.type]: file })]);
}

export function shareFullImage(file: File): Promise<void> {
  if (!canShareFile(file)) {
    return Promise.reject(new Error('File sharing is unavailable in this browser.'));
  }
  return navigator.share({ files: [file], title: file.name });
}
