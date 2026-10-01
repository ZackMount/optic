import { mimeTypes, type ImageFormat, type ImageInput } from './types';

export function sniffFormat(bytes: Uint8Array): ImageFormat {
  const ascii = (offset: number, count: number) => String.fromCharCode(...bytes.subarray(offset, offset + count));
  if (bytes[0] === 137 && ascii(1, 3) === 'PNG' && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) return 'png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpeg';
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return 'gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'webp';
  if (ascii(4, 4) === 'ftyp' && /avif|avis/.test(ascii(8, Math.min(48, bytes.length - 8)))) return 'avif';
  if (ascii(0, 2) === 'BM') return 'bmp';
  if ((ascii(0, 2) === 'II' && bytes[2] === 42 && bytes[3] === 0) || (ascii(0, 2) === 'MM' && bytes[2] === 0 && bytes[3] === 42)) return 'tiff';
  throw new Error('Unsupported image. Choose a PNG, JPEG, GIF, WebP, AVIF, BMP or TIFF file.');
}

export async function createImageInput(file: Blob, name = 'image'): Promise<ImageInput> {
  if (file.size > 100 * 1024 * 1024) throw new Error('This file is too large. Choose an image smaller than 100 MB.');
  const format = sniffFormat(new Uint8Array(await file.slice(0, 64).arrayBuffer()));
  const blob = file.slice(0, file.size, mimeTypes[format]);
  return { id: crypto.randomUUID(), name, blob, format, url: URL.createObjectURL(blob) };
}

export async function loadImageUrl(value: string): Promise<ImageInput> {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an http or https image URL.');
  let response: Response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(30000) }); }
  catch { throw new Error('The image server does not allow this download. Save the image and drop the file here.'); }
  if (!response.ok) throw new Error(`Image download failed (${response.status}).`);
  return createImageInput(await response.blob(), decodeURIComponent(url.pathname.split('/').pop() || 'image'));
}
