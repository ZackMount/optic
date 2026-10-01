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
  flipHorizontal: false, flipVertical: false, rotation: 0, mirrorMode: 'none',
  grayscale: false, invert: false, sepia: false, brightness: 100, contrast: 100,
  saturation: 100, hueRotate: 0, blur: 0, pixelate: 1, noise: 0, shuffleFrames: false,
};

export type ImageFormat = 'png' | 'jpeg' | 'gif' | 'webp' | 'avif' | 'bmp' | 'tiff';
export const mimeTypes: Record<ImageFormat, string> = {
  png: 'image/png', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  avif: 'image/avif', bmp: 'image/bmp', tiff: 'image/tiff',
};
export type ImageInput = { id: string; name: string; blob: Blob; url: string; format: ImageFormat };
export type ImageInfo = {
  sourceId: string;
  width: number; height: number; format: ImageFormat; frameCount: number;
  hasAlpha: boolean; animated: boolean; delays: number[]; iterations: number;
};
export type Raster = { width: number; height: number; data: Uint8ClampedArray };
export type Preview = {
  sourceId: string;
  displayWidth: number; displayHeight: number;
  frames: ImageBitmap[]; width: number; height: number; delays: number[];
  iterations: number; backend: 'webgl2' | 'cpu';
  gpu?: GpuInfo; fallbackReason?: string;
};
export type ExportOptions = {
  format: 'auto' | 'png' | 'jpeg' | 'webp' | 'gif';
  quality: number; background: string; lossless: boolean; dither: boolean;
};
export const defaultExportOptions: ExportOptions = {
  format: 'auto', quality: 92, background: '#ffffff', lossless: true, dither: true,
};
export type GpuInfo = { renderer: string; acceleration: 'hardware' | 'software' | 'unknown' };
export type ExportResult = { blob: Blob; format: string; preserved: boolean; backend: 'original' | 'indexed' | 'webgl2' | 'cpu'; fallbackReason?: string };
export type EngineStats = { decodes: number; sourceHits: number; renderHits: number; exportHits: number; gpuUploads: number; gpuFrames: number; cpuFrames: number; gpu?: GpuInfo; fallbackReason?: string };
export type EngineRequest =
  | { id: number; type: 'open'; sourceId: string; bytes: ArrayBuffer; format: ImageFormat; assetBase: string }
  | { id: number; type: 'preview'; sourceId: string; transforms: Transformations; seed: number; forceCpu?: boolean }
  | { id: number; type: 'export'; sourceId: string; transforms: Transformations; seed: number; options: ExportOptions }
  | { id: number; type: 'encode'; sourceId: string; bytes: ArrayBuffer; format: ImageFormat; assetBase: string; transforms: Transformations; seed: number; options: ExportOptions }
  | { id: number; type: 'close' }
  | { id: number; type: 'stats' };
export type EngineResponse =
  | { id: number; type: 'opened'; info: ImageInfo }
  | { id: number; type: 'preview'; preview: Preview }
  | { id: number; type: 'export'; result: ExportResult }
  | { id: number; type: 'progress'; progress: number }
  | { id: number; type: 'closed' }
  | { id: number; type: 'stats'; stats: EngineStats }
  | { id: number; type: 'error'; message: string };

export function isIdentity(t: Transformations) {
  return Object.entries(defaultTransformations).every(([key, value]) => t[key as keyof Transformations] === value);
}
export function isGeometryOnly(t: Transformations) {
  return isIdentity({ ...t, rotation: 0, flipHorizontal: false, flipVertical: false });
}
export function dimensions(width: number, height: number, rotation: number) {
  return rotation % 180 === 0 ? { width, height } : { width: height, height: width };
}
