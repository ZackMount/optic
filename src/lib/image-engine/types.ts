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
  swirl: number;
  bulge: number;
  ripple: number;
  wave: number;
  waveLength: number;
  radialSymmetry: number;
  autoLevel: boolean;
  autoGamma: boolean;
  normalize: boolean;
  moonlight: number;
  solarize: number;
  threshold: number;
  paletteColors: number;
  colorGrade: 'none' | 'duotone' | 'cyanotype' | 'thermal' | 'gameboy' | 'vintage' | 'crossprocess';
  gradeStrength: number;
  duotoneDark: string;
  duotoneLight: string;
  gamma: number;
  exposure: number;
  vibrance: number;
  temperature: number;
  tint: number;
  clarity: number;
  softContrast: number;
  sharpen: number;
  denoise: number;
  motionBlur: number;
  motionAngle: number;
  artStyle: 'none' | 'oil' | 'charcoal' | 'emboss' | 'ink' | 'canny' | 'neon' | 'blueprint' | 'comic';
  artStrength: number;
  bloom: number;
  vignette: number;
  rgbSplit: number;
  halftone: number;
  scanlines: number;
  glitch: number;
  reverseFrames: boolean;
  pingPong: boolean;
  gifSpeed: number;
};

export const defaultTransformations: Transformations = {
  flipHorizontal: false, flipVertical: false, rotation: 0, mirrorMode: 'none',
  grayscale: false, invert: false, sepia: false, brightness: 100, contrast: 100,
  saturation: 100, hueRotate: 0, blur: 0, pixelate: 1, noise: 0, shuffleFrames: false,
  swirl: 0, bulge: 0, ripple: 0, wave: 0, waveLength: 25, radialSymmetry: 0,
  autoLevel: false, autoGamma: false, normalize: false, moonlight: 0, solarize: 0,
  threshold: 0, paletteColors: 256, colorGrade: 'none', gradeStrength: 100,
  duotoneDark: '#1e1b4b', duotoneLight: '#fbbf24', gamma: 100, exposure: 0,
  vibrance: 0, temperature: 0, tint: 0, clarity: 0, softContrast: 0,
  sharpen: 0, denoise: 0, motionBlur: 0, motionAngle: 0,
  artStyle: 'none', artStrength: 100, bloom: 0, vignette: 0, rgbSplit: 0,
  halftone: 0, scanlines: 0, glitch: 0, reverseFrames: false, pingPong: false, gifSpeed: 100,
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
export type EngineStats = { decodes: number; sourceHits: number; renderHits: number; exportHits: number; gpuUploads: number; gpuFrames: number; cpuFrames: number; nativeFrames: number; nativeHits: number; gpu?: GpuInfo; fallbackReason?: string };
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

export function effectiveTransformations(t: Transformations): Transformations {
  const result = { ...defaultTransformations, ...t };
  if (!result.motionBlur) result.motionAngle = defaultTransformations.motionAngle;
  if (!result.wave) result.waveLength = defaultTransformations.waveLength;
  if (!result.artStrength) result.artStyle = 'none';
  if (result.artStyle === 'none') result.artStrength = defaultTransformations.artStrength;
  if (!result.gradeStrength) result.colorGrade = 'none';
  if (result.colorGrade === 'none') result.gradeStrength = defaultTransformations.gradeStrength;
  if (result.colorGrade !== 'duotone') {
    result.duotoneDark = defaultTransformations.duotoneDark;
    result.duotoneLight = defaultTransformations.duotoneLight;
  }
  return result;
}

export function isIdentity(t: Transformations) {
  const result = effectiveTransformations(t);
  return Object.entries(defaultTransformations).every(([key, value]) => result[key as keyof Transformations] === value);
}
export function isGeometryOnly(t: Transformations) {
  return isIdentity({ ...t, rotation: 0, flipHorizontal: false, flipVertical: false });
}

export function isIndexedGifCompatible(t: Transformations) {
  return isGeometryOnly({ ...t, gifSpeed: 100 });
}
export function dimensions(width: number, height: number, rotation: number) {
  return rotation % 180 === 0 ? { width, height } : { width: height, height: width };
}
