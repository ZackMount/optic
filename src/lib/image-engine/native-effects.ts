import type { IMagickImage } from '@imagemagick/magick-wasm';
import { effectiveTransformations, type Raster, type Transformations } from './types';

export type MagickApi = typeof import('@imagemagick/magick-wasm');

export function nativeSettings(transforms: Transformations) {
  const t = effectiveTransformations(transforms);
  const nativeArt = ['oil', 'charcoal', 'emboss', 'ink', 'canny'].includes(t.artStyle);
  return {
    wave: t.wave, waveLength: t.waveLength, autoLevel: t.autoLevel, autoGamma: t.autoGamma,
    normalize: t.normalize, moonlight: t.moonlight, solarize: t.solarize,
    threshold: t.threshold, paletteColors: t.paletteColors, gamma: t.gamma,
    clarity: t.clarity, softContrast: t.softContrast, sharpen: t.sharpen,
    denoise: t.denoise, motionBlur: t.motionBlur, motionAngle: t.motionAngle,
    artStyle: nativeArt ? t.artStyle : 'none', artStrength: nativeArt ? t.artStrength : 100,
  };
}

export function hasNativeEffects(t: Transformations) {
  const settings = nativeSettings(t);
  return !!(settings.wave || settings.autoLevel || settings.autoGamma || settings.normalize ||
    settings.moonlight || settings.solarize || settings.threshold || settings.paletteColors < 256 ||
    settings.gamma !== 100 || settings.clarity || settings.softContrast || settings.sharpen ||
    settings.denoise || settings.motionBlur || settings.artStyle !== 'none');
}

export function rasterToImage(magick: MagickApi, raster: Raster): IMagickImage {
  const collection = magick.MagickImageCollection.create();
  try {
    collection.read(new Uint8Array(raster.data), new magick.MagickReadSettings({
      width: raster.width, height: raster.height, depth: 8, format: magick.MagickFormat.Rgba,
    }));
    const image = collection.shift()!;
    image.colorSpace = magick.ColorSpace.sRGB;
    return image;
  } finally { collection.dispose(); }
}

function pixels(image: IMagickImage): Raster {
  const data = image.getPixels(values => values.toByteArray(0, 0, image.width, image.height, 'RGBA'));
  if (!data) throw new Error('Unable to read effect pixels.');
  return { width: image.width, height: image.height, data: new Uint8ClampedArray(data) };
}

export function applyNativeEffects(magick: MagickApi, source: Raster, t: Transformations, seed: number, scale = 1): Raster {
  if (!hasNativeEffects(t)) return source;
  const image = rasterToImage(magick, source);
  const rgb = magick.Channels.Red | magick.Channels.Green | magick.Channels.Blue;
  magick.Magick.setRandomSeed(seed >>> 0);
  try {
    image.backgroundColor = magick.MagickColors.Transparent;
    image.virtualPixelMethod = magick.VirtualPixelMethod.Transparent;
    if (t.wave) {
      image.wave(magick.PixelInterpolateMethod.Bilinear, source.height * t.wave / 100,
        Math.max(4, source.width * t.waveLength / 100));
      image.crop(source.width, source.height, magick.Gravity.Center);
      image.resetPage();
    }
    const alphaSource = t.wave ? pixels(image) : source;
    if (t.autoLevel) image.autoLevel(rgb);
    if (t.autoGamma) image.autoGamma(rgb);
    if (t.normalize) image.normalize();
    if (t.gamma !== 100) image.gammaCorrect(t.gamma / 100, rgb);
    if (t.softContrast > 0) image.sigmoidalContrast(t.softContrast, new magick.Percentage(50));
    if (t.softContrast < 0) image.inverseSigmoidalContrast(-t.softContrast, new magick.Percentage(50));
    if (t.clarity && Math.min(source.width, source.height) >= 16) {
      image.clahe(new magick.Percentage(25), new magick.Percentage(25), 256, 1 + t.clarity / 20);
    }
    if (t.moonlight) image.blueShift(1 + t.moonlight / 100);
    if (t.denoise) {
      const radius = Math.max(1, Math.round(t.denoise * scale / 2));
      image.bilateralBlur(radius * 2 + 1, radius * 2 + 1, 10 + t.denoise * 4, Math.max(0.5, t.denoise * scale / 2));
    }
    if (t.sharpen) image.sharpen(0, Math.max(0.25, t.sharpen * scale / 4), rgb);
    if (t.motionBlur) image.motionBlur(0, Math.max(0.35, t.motionBlur * scale), t.motionAngle);
    if (t.paletteColors < 256) {
      const settings = new magick.QuantizeSettings();
      settings.colors = Math.max(2, Math.round(t.paletteColors));
      settings.ditherMethod = magick.DitherMethod.No;
      image.quantize(settings);
    }
    if (t.solarize) image.solarize(new magick.Percentage(100 - t.solarize));
    if (t.threshold) image.threshold(new magick.Percentage(t.threshold), rgb);
    const base = pixels(image);
    if (t.artStyle === 'oil') image.oilPaint(Math.max(1, 3 * scale));
    if (t.artStyle === 'charcoal') image.charcoal(0, Math.max(0.5, 1.4 * scale));
    if (t.artStyle === 'emboss') {
      const settings = new magick.MorphologySettings(magick.MorphologyMethod.Convolve, '3x3:-2,-1,0,-1,0,1,0,1,2');
      settings.channels = rgb; settings.convolveBias = new magick.Percentage(50);
      image.morphology(settings);
    }
    if (t.artStyle === 'ink') {
      const window = Math.max(3, Math.round(17 * scale) | 1);
      image.adaptiveThreshold(window, window, new magick.Percentage(5), rgb);
    }
    if (t.artStyle === 'canny') {
      image.cannyEdge(0, Math.max(0.5, 1.2 * scale), new magick.Percentage(10), new magick.Percentage(30));
    }
    const result = pixels(image);
    const blend = ['oil', 'charcoal', 'emboss', 'ink', 'canny'].includes(t.artStyle) ? t.artStrength / 100 : 1;
    for (let p = 0; p < result.data.length; p += 4) {
      for (let c = 0; c < 3; c++) result.data[p + c] = base.data[p + c] * (1 - blend) + result.data[p + c] * blend;
      result.data[p + 3] = alphaSource.data[p + 3];
    }
    return result;
  } finally { image.dispose(); }
}
