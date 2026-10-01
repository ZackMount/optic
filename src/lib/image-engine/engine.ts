import type { IColorProfile, IMagickImage, IMagickImageCollection } from '@imagemagick/magick-wasm';
import { ByteCache } from './cache';
import { gifMetadata, transformGif } from './gif';
import { GpuRenderer } from './gpu';
import { frameOrder, renderPixels } from './pixels';
import { applyNativeEffects, hasNativeEffects, nativeSettings, rasterToImage } from './native-effects';
import { scaledFrameDelay } from './animation';
import { dimensions, effectiveTransformations, isGeometryOnly, isIdentity, isIndexedGifCompatible, mimeTypes, type EngineStats, type ExportOptions, type ExportResult, type ImageFormat, type ImageInfo, type Preview, type Raster, type Transformations } from './types';

type Magick = typeof import('@imagemagick/magick-wasm');
const MAX_PIXELS = 64 * 1024 * 1024;
const MAX_PREVIEW_PIXELS = 12 * 1024 * 1024;
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));
export class Cancelled extends Error { constructor() { super('Processing cancelled'); } }

export class ImageEngine {
  private magick?: Magick;
  private loading?: Promise<void>;
  private profile?: IColorProfile;
  private source?: { id: string; bytes: Uint8Array; images: IMagickImageCollection; info: ImageInfo };
  private readonly previewSources = new ByteCache<Raster>(64 * 1024 * 1024);
  private readonly rendered = new ByteCache<Raster>(32 * 1024 * 1024);
  private readonly exports = new ByteCache<ExportResult>(32 * 1024 * 1024);
  private readonly nativeSources = new ByteCache<Raster>(32 * 1024 * 1024);
  private gpu?: GpuRenderer;
  private gpuUnavailable = false;
  readonly stats: EngineStats = { decodes: 0, sourceHits: 0, renderHits: 0, exportHits: 0, gpuUploads: 0, gpuFrames: 0, cpuFrames: 0, nativeFrames: 0, nativeHits: 0 };

  private async initialize(assetBase: string) {
    if (!this.loading) this.loading = (async () => {
      const magick = await import('@imagemagick/magick-wasm');
      await magick.initializeImageMagick(new URL(`${assetBase}/magick.wasm`));
      const profile = await fetch(`${assetBase}/srgb.icc`);
      if (!profile.ok) throw new Error('The color profile could not be loaded. Reload to try again.');
      this.profile = new magick.ColorProfile(new Uint8Array(await profile.arrayBuffer()));
      magick.ResourceLimits.memory = BigInt(512 * 1024 * 1024);
      magick.ResourceLimits.disk = BigInt(0);
      magick.ResourceLimits.width = BigInt(32768);
      magick.ResourceLimits.height = BigInt(32768);
      magick.ResourceLimits.listLength = BigInt(1000);
      this.magick = magick;
    })().catch(error => { this.loading = undefined; throw error; });
    await this.loading;
  }

  async open(id: string, bytes: Uint8Array, format: ImageFormat, assetBase: string): Promise<ImageInfo> {
    if (this.source?.id === id) return this.source.info;
    this.close();
    await this.initialize(assetBase);
    const magick = this.magick!;
    const metadata = magick.MagickImageCollection.create();
    try {
      metadata.ping(bytes);
      const pixels = metadata.reduce((sum, image) => sum + Math.max(image.width, image.page.width) * Math.max(image.height, image.page.height), 0);
      if (!metadata.length || metadata.length > 1000 || pixels > MAX_PIXELS) throw new Error('This animation exceeds the browser memory budget. Try a smaller image or fewer frames.');
    } finally { metadata.dispose(); }
    const gif = format === 'gif' ? gifMetadata(bytes) : null;
    let images = magick.MagickImageCollection.create(gif?.decoderBytes ?? bytes);
    try {
      images.forEach(image => {
        image.autoOrient();
        if (image.getColorProfile()) {
          if (!image.transformColorSpace(this.profile!)) throw new Error('Unable to convert this image color profile to sRGB.');
        } else if (image.colorSpace !== magick.ColorSpace.sRGB) image.colorSpace = magick.ColorSpace.sRGB;
      });
      if (gif) images = this.composeGif(images, gif);
      else if (images.length > 1) images.coalesce();
      const first = images[0];
      if (first.width * first.height * images.length > MAX_PIXELS) throw new Error('The decoded animation exceeds the browser memory budget.');
      const info: ImageInfo = {
        sourceId: id,
        width: first.width, height: first.height, format, frameCount: images.length,
        animated: images.length > 1, hasAlpha: images.some(image => !image.isOpaque),
        delays: gif?.delays ?? images.map(image => image.animationDelay * 1000 / (image.animationTicksPerSecond || 100)),
        iterations: gif?.iterations ?? first.animationIterations,
      };
      this.source = { id, bytes, images, info };
      this.stats.decodes++;
      return info;
    } catch (error) { images.dispose(); throw error; }
  }

  close() {
    this.source?.images.dispose(); this.source = undefined;
    this.previewSources.clear(); this.nativeSources.clear(); this.rendered.clear(); this.exports.clear(); this.gpu?.dispose(); this.gpu = undefined;
    this.gpuUnavailable = false; this.stats.gpu = undefined; this.stats.fallbackReason = undefined;
  }

  private fallback(error: unknown) {
    const reason = error instanceof Error ? error.message : 'GPU processing failed';
    if (this.stats.fallbackReason !== reason) console.warn(`[Optic image engine] CPU fallback: ${reason}`);
    this.stats.fallbackReason = reason;
    return reason;
  }

  private renderer(forceCpu = false) {
    if (forceCpu) return undefined;
    if (this.gpu?.lost) { this.gpu.dispose(); this.gpu = undefined; this.gpuUnavailable = false; }
    if (!this.gpu && !this.gpuUnavailable) {
      try { this.gpu = new GpuRenderer(); this.stats.gpu = this.gpu.info; }
      catch (error) { this.gpuUnavailable = true; this.fallback(error); }
    }
    return this.gpu;
  }

  private document(id: string) {
    if (!this.source || this.source.id !== id) throw new Error('The image was closed. Open it again to continue.');
    return this.source;
  }
  private pixels(image: IMagickImage): Raster {
    const data = image.getPixels(pixels => pixels.toByteArray(0, 0, image.width, image.height, 'RGBA'));
    if (!data) throw new Error('Unable to read image pixels.');
    return { width: image.width, height: image.height, data: new Uint8ClampedArray(data) };
  }

  private imageFromPixels(raster: Raster) {
    return rasterToImage(this.magick!, raster);
  }

  private nativeRaster(source: Raster, t: Transformations, seed: number, scale: number, key: string) {
    if (!hasNativeEffects(t)) return source;
    const cached = this.nativeSources.get(key);
    if (cached) { this.stats.nativeHits++; return cached; }
    const result = applyNativeEffects(this.magick!, source, t, seed, scale);
    this.nativeSources.set(key, result, result.data.byteLength);
    this.stats.nativeFrames++;
    return result;
  }

  private composeGif(patches: IMagickImageCollection, gif: ReturnType<typeof gifMetadata>) {
    const magick = this.magick!, composed = magick.MagickImageCollection.create();
    let canvas = magick.MagickImage.create(magick.MagickColors.Transparent, gif.width, gif.height);
    try {
      for (const frame of gif.frames) {
        const patch = patches.shift()!;
        try {
          const previous = frame.disposal === 3 ? this.pixels(canvas) : null;
          canvas.composite(patch, magick.CompositeOperator.Over, new magick.Point(frame.x, frame.y));
          const snapshot = this.imageFromPixels(this.pixels(canvas));
          snapshot.animationDelay = frame.delay; snapshot.animationTicksPerSecond = 100; snapshot.animationIterations = gif.iterations;
          composed.push(snapshot);
          if (frame.disposal === 2) {
            canvas.getPixels(pixels => pixels.setArea(frame.x, frame.y, frame.width, frame.height, new Uint8Array(frame.width * frame.height * canvas.channelCount)));
          } else if (previous) { canvas.dispose(); canvas = this.imageFromPixels(previous); }
        } finally { patch.dispose(); }
      }
      return composed;
    } catch (error) { composed.dispose(); throw error; }
    finally { canvas.dispose(); patches.dispose(); }
  }
  private previewSource(index: number, width: number, height: number) {
    const key = `${index}:${width}:${height}`;
    const cached = this.previewSources.get(key);
    if (cached) { this.stats.sourceHits++; return cached; }
    const source = this.source!.images[index];
    const raster = source.width === width && source.height === height ? this.pixels(source) : source.clone(image => {
      const geometry = new this.magick!.MagickGeometry(width, height); geometry.ignoreAspectRatio = true;
      image.resize(geometry, this.magick!.FilterType.Lanczos);
      return this.pixels(image);
    });
    this.previewSources.set(key, raster, raster.data.byteLength);
    return raster;
  }

  async preview(id: string, transforms: Transformations, seed: number, cancelled: () => boolean, progress: (value: number) => void, forceCpu = false): Promise<Preview> {
    transforms = effectiveTransformations(transforms);
    const document = this.document(id), { info } = document;
    const order = frameOrder(info.frameCount, transforms.shuffleFrames, seed, transforms.reverseFrames, transforms.pingPong);
    const native = hasNativeEffects(transforms), budget = native ? 3 * 1024 * 1024 : MAX_PREVIEW_PIXELS;
    const scale = Math.min(1, (native ? 768 : 1024) / Math.max(info.width, info.height), Math.sqrt(budget / (info.width * info.height * order.length)));
    const width = Math.max(1, Math.round(info.width * scale)), height = Math.max(1, Math.round(info.height * scale));
    const t = { ...transforms, blur: transforms.blur * scale, rgbSplit: transforms.rgbSplit * scale, pixelate: transforms.pixelate > 1 ? Math.max(2, Math.round(transforms.pixelate * scale)) : 1 };
    const signature = native ? JSON.stringify(nativeSettings(transforms)) : '';
    const gpu = this.renderer(forceCpu);
    let useGpu = !!gpu, fallbackReason = forceCpu ? 'CPU reference requested' : gpu ? undefined : this.stats.fallbackReason;
    const frames: ImageBitmap[] = [];
    const noiseSize = dimensions(info.width, info.height, transforms.rotation);
    try {
      for (let n = 0; n < order.length; n++) {
        if (cancelled()) throw new Cancelled();
        const index = order[n], frameSeed = (seed ^ Math.imul(index, 0x9e3779b9)) >>> 0;
        const sourceKey = `preview:${index}:${width}:${height}:${signature}:${native ? frameSeed : ''}`;
        const raster = this.nativeRaster(this.previewSource(index, width, height), transforms, frameSeed, scale, sourceKey);
        let bitmap: ImageBitmap | undefined;
        if (useGpu) {
          try { bitmap = gpu!.render(raster, t, frameSeed, sourceKey, noiseSize); this.stats.gpuUploads = gpu!.uploads; this.stats.gpuFrames++; }
          catch (error) { useGpu = false; fallbackReason = this.fallback(error); }
        }
        if (!bitmap) {
          const key = `preview:${index}:${width}:${height}:${JSON.stringify(t)}:${frameSeed}`;
          let rendered = this.rendered.get(key);
          if (rendered) this.stats.renderHits++;
          else { rendered = renderPixels(raster, t, frameSeed, noiseSize); this.rendered.set(key, rendered, rendered.data.byteLength); }
          const canvas = new OffscreenCanvas(rendered.width, rendered.height), ctx = canvas.getContext('2d')!;
          ctx.putImageData(new ImageData(new Uint8ClampedArray(rendered.data), rendered.width, rendered.height), 0, 0);
          bitmap = canvas.transferToImageBitmap();
          this.stats.cpuFrames++;
        }
        frames.push(bitmap);
        progress(Math.round((n + 1) / order.length * 100));
        await tick();
      }
      if (cancelled()) throw new Cancelled();
      return { sourceId: id, displayWidth:noiseSize.width, displayHeight:noiseSize.height, frames, ...dimensions(width, height, transforms.rotation), delays: order.map(i => scaledFrameDelay(info.delays[i], transforms.gifSpeed)), iterations: info.iterations, backend: useGpu ? 'webgl2' : 'cpu', gpu:gpu?.info, fallbackReason };
    } catch (error) { frames.forEach(frame => frame.close()); throw error; }
  }

  async encode(id: string, bytes: Uint8Array, format: ImageFormat, assetBase: string, t: Transformations, seed: number, options: ExportOptions, cancelled: () => boolean, progress: (value: number) => void): Promise<ExportResult> {
    t = effectiveTransformations(t);
    const key = `encoded:${id}:${JSON.stringify(t)}:${seed}:${JSON.stringify(options)}`;
    const cached = this.exports.get(key);
    if (cached) { this.stats.exportHits++; progress(100); return cached; }
    if (format === 'gif' && (options.format === 'auto' || options.format === 'gif') && isIndexedGifCompatible(t)) {
      if (cancelled()) throw new Cancelled();
      const result: ExportResult = { blob:new Blob([new Uint8Array(transformGif(bytes,t))],{type:'image/gif'}), format:'gif', preserved:true, backend:'indexed' };
      if (cancelled()) throw new Cancelled();
      this.exports.set(key,result,result.blob.size); progress(100); return result;
    }
    await this.open(id,bytes,format,assetBase);
    if (cancelled()) throw new Cancelled();
    return this.export(id,t,seed,options,cancelled,progress);
  }

  async export(id: string, t: Transformations, seed: number, options: ExportOptions, cancelled: () => boolean, progress: (value: number) => void): Promise<ExportResult> {
    t = effectiveTransformations(t);
    const document = this.document(id), { info, bytes } = document, magick = this.magick!;
    const format = options.format === 'auto'
      ? isIdentity(t) ? info.format : info.animated || info.format === 'gif' ? 'gif' : 'png'
      : options.format;
    const key = `${JSON.stringify(t)}:${seed}:${JSON.stringify(options)}`;
    const cached = this.exports.get(key);
    if (cached) { this.stats.exportHits++; progress(100); return cached; }
    let result: ExportResult;
    if (isIdentity(t) && format === info.format && (options.format === 'auto' || format === 'png' || format === 'gif')) {
      result = { blob: new Blob([new Uint8Array(bytes)], { type: mimeTypes[info.format] }), format, preserved: true, backend:'original' };
    } else if (info.format === 'gif' && format === 'gif' && isIndexedGifCompatible(t)) {
      result = { blob: new Blob([new Uint8Array(transformGif(bytes, t))], { type: 'image/gif' }), format, preserved: true, backend:'indexed' };
    } else {
      const order = frameOrder(info.frameCount, t.shuffleFrames, seed, t.reverseFrames, t.pingPong), images = magick.MagickImageCollection.create();
      if (format === 'gif' && (order.length > 1000 || info.width * info.height * order.length > MAX_PIXELS)) {
        images.dispose(); throw new Error('The output animation exceeds the browser memory budget. Reduce its dimensions or turn off Ping-pong.');
      }
      const native = hasNativeEffects(t), signature = native ? JSON.stringify(nativeSettings(t)) : '';
      const exact = isGeometryOnly(t), gpu = exact ? undefined : this.renderer();
      let useGpu = !!gpu, fallbackReason = exact || gpu ? undefined : this.stats.fallbackReason;
      try {
        for (let n = 0; n < (format === 'gif' ? order.length : 1); n++) {
          if (cancelled()) throw new Cancelled();
          const index = order[n], frameSeed = (seed ^ Math.imul(index, 0x9e3779b9)) >>> 0;
          const sourceKey = `export:${index}:${signature}:${native ? frameSeed : ''}`;
          const source = this.nativeRaster(this.pixels(document.images[index]), t, frameSeed, 1, sourceKey);
          let raster: Raster | undefined;
          if (useGpu) {
            try { raster = gpu!.renderRaster(source, t, frameSeed, sourceKey); this.stats.gpuUploads = gpu!.uploads; this.stats.gpuFrames++; }
            catch (error) { useGpu = false; fallbackReason = this.fallback(error); }
          }
          if (!raster) { raster = renderPixels(source, t, frameSeed); this.stats.cpuFrames++; }
          if (format === 'jpeg') {
            if (!/^#[0-9a-f]{6}$/i.test(options.background)) throw new Error('Choose a valid JPEG background color.');
            const bg = [1, 3, 5].map(offset => parseInt(options.background.slice(offset, offset + 2), 16));
            for (let p = 0; p < raster.data.length; p += 4) {
              const alpha = raster.data[p + 3] / 255;
              for (let channel = 0; channel < 3; channel++) raster.data[p + channel] = raster.data[p + channel] * alpha + bg[channel] * (1 - alpha);
              raster.data[p + 3] = 255;
            }
          }
          if (format === 'gif') for (let p = 0; p < raster.data.length; p += 4) {
            if (raster.data[p + 3] < 128) { raster.data[p] = 0; raster.data[p + 1] = 0; raster.data[p + 2] = 0; raster.data[p + 3] = 0; }
            else raster.data[p + 3] = 255;
          }
          const settings = new magick.MagickReadSettings({ width: raster.width, height: raster.height, depth: 8, format: magick.MagickFormat.Rgba });
          const frame = magick.MagickImageCollection.create();
          try { frame.read(new Uint8Array(raster.data), settings); images.push(frame.shift()!); } finally { frame.dispose(); }
          const image = images[images.length - 1];
          image.colorSpace = magick.ColorSpace.sRGB;
          if (format !== 'gif') image.setProfile(this.profile!);
          image.quality = options.quality;
          if (format === 'gif') {
            image.animationDelay = Math.round(scaledFrameDelay(info.delays[index], t.gifSpeed) / 10); image.animationTicksPerSecond = 100;
            image.animationIterations = info.iterations; image.gifDisposeMethod = magick.GifDisposeMethod.Background;
            image.backgroundColor = magick.MagickColors.Transparent;
            if (image.totalColors > 256) {
              const quantize = new magick.QuantizeSettings(); quantize.colors = 256;
              quantize.ditherMethod = options.dither ? magick.DitherMethod.FloydSteinberg : magick.DitherMethod.No;
              image.quantize(quantize);
            }
          }
          if (format === 'webp') image.settings.setDefine(magick.MagickFormat.WebP, 'lossless', options.lossless);
          progress(Math.round((n + 1) / order.length * 85));
          await tick();
        }
        if (cancelled()) throw new Cancelled();
        const formats = { png: magick.MagickFormat.Png, jpeg: magick.MagickFormat.Jpeg, gif: magick.MagickFormat.Gif, webp: magick.MagickFormat.WebP, avif: magick.MagickFormat.Avif, bmp: magick.MagickFormat.Bmp, tiff: magick.MagickFormat.Tiff };
        const output = images.write(formats[format], data => new Uint8Array(data));
        result = { blob: new Blob([new Uint8Array(output)], { type: mimeTypes[format] }), format, preserved: exact && format === 'png', backend: useGpu ? 'webgl2' : 'cpu', fallbackReason };
      } finally { images.dispose(); }
    }
    if (cancelled()) throw new Cancelled();
    this.exports.set(key, result, result.blob.size); progress(100); return result;
  }
}
