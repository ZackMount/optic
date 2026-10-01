import { dimensions, isGeometryOnly, type Raster, type Transformations } from './types';
import { artistic, grade, hashNoise, hasWarp, luminance, samplePixel, texture, tone, warpedPoint, type Color } from './creative';

export function sourcePoint(x: number, y: number, width: number, height: number, t: Transformations) {
  let sx = x, sy = y;
  if (t.rotation === 90) { sx = y; sy = height - 1 - x; }
  if (t.rotation === 180) { sx = width - 1 - x; sy = height - 1 - y; }
  if (t.rotation === 270) { sx = width - 1 - y; sy = x; }
  if (t.flipHorizontal) sx = width - 1 - sx;
  if (t.flipVertical) sy = height - 1 - sy;
  return [sx, sy];
}

export function geometry(source: Raster, t: Transformations): Raster {
  const { width, height } = dimensions(source.width, source.height, t.rotation);
  const warped = hasWarp(t);
  if (!t.rotation && !t.flipHorizontal && !t.flipVertical && !warped) return { width, height, data: source.data.slice() };
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const [px, py] = warped ? warpedPoint(x, y, width, height, t) : [x, y];
    const [sx, sy] = sourcePoint(px, py, source.width, source.height, t);
    if (warped) { data.set(samplePixel(source, sx, sy), (y * width + x) * 4); continue; }
    const from = (sy * source.width + sx) * 4, to = (y * width + x) * 4;
    data[to] = source.data[from]; data[to + 1] = source.data[from + 1]; data[to + 2] = source.data[from + 2]; data[to + 3] = source.data[from + 3];
  }
  return { data, width, height };
}

export function gaussianKernel(sigma: number) {
  const radius = Math.min(60, Math.ceil(sigma * 3));
  const weights = new Float32Array(radius * 2 + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) { const weight = Math.exp(-(i * i) / (2 * sigma * sigma)); weights[i + radius] = weight; sum += weight; }
  for (let i = 0; i < weights.length; i++) weights[i] /= sum;
  return { radius, weights };
}

function blur(source: Raster, sigma: number): Raster {
  const { width, height, data } = source;
  const { weights, radius } = gaussianKernel(sigma);
  const horizontal = new Float32Array(data.length);
  const output = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const to = (y * width + x) * 4;
    for (let k = -radius; k <= radius; k++) {
      if (x + k < 0 || x + k >= width) continue;
      const from = (y * width + x + k) * 4, w = weights[k + radius], a = data[from + 3] / 255;
      horizontal[to] += data[from] * a * w;
      horizontal[to + 1] += data[from + 1] * a * w;
      horizontal[to + 2] += data[from + 2] * a * w;
      horizontal[to + 3] += a * w;
    }
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const to = (y * width + x) * 4;
    let r = 0, g = 0, b = 0, a = 0;
    for (let k = -radius; k <= radius; k++) {
      if (y + k < 0 || y + k >= height) continue;
      const from = ((y + k) * width + x) * 4, w = weights[k + radius];
      r += horizontal[from] * w; g += horizontal[from + 1] * w; b += horizontal[from + 2] * w; a += horizontal[from + 3] * w;
    }
    if (a > 0) { output[to] = r / a; output[to + 1] = g / a; output[to + 2] = b / a; }
    output[to + 3] = a * 255;
  }
  return { width, height, data: output };
}

const clamp = (n: number) => Math.min(255, Math.max(0, n));
export function pixelNoise(index: number, seed: number) {
  return hashNoise(index, seed);
}
export function frameOrder(count: number, shuffle: boolean, seed: number, reverse = false, pingPong = false) {
  const order = Array.from({ length: count }, (_, i) => i);
  if (shuffle) for (let i = count - 1; i > 0; i--) {
    const j = Math.floor((pixelNoise(i, seed) + 0.5) * (i + 1));
    const safe = Math.min(i, j);
    [order[i], order[safe]] = [order[safe], order[i]];
  }
  if (reverse) order.reverse();
  if (pingPong && count > 2) order.push(...order.slice(1, -1).reverse());
  return order;
}

function hue(r: number, g: number, b: number, angle: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min, l = (max + min) / 2;
  if (!delta) return [r * 255, g * 255, b * 255];
  const s = delta / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  h = ((h / 6 + angle / 360) % 1 + 1) % 1;
  const c = (1 - Math.abs(2 * l - 1)) * s, v = h * 6, m = l - c / 2;
  const q = c * (1 - Math.abs(v % 2 - 1));
  const rgb = v < 1 ? [c, q, 0] : v < 2 ? [q, c, 0] : v < 3 ? [0, c, q] : v < 4 ? [0, q, c] : v < 5 ? [q, 0, c] : [c, 0, q];
  return rgb.map(n => (n + m) * 255);
}

export function mirrorPoint(x: number, y: number, w: number, h: number, mode: Transformations['mirrorMode']) {
  if ((mode === 'left' || mode === 'center') && x >= Math.ceil(w / 2)) x = w - 1 - x;
  if (mode === 'right' && x < Math.floor(w / 2)) x = w - 1 - x;
  if ((mode === 'top' || mode === 'center') && y >= Math.ceil(h / 2)) y = h - 1 - y;
  if (mode === 'bottom' && y < Math.floor(h / 2)) y = h - 1 - y;
  return [x, y];
}

export function renderPixels(source: Raster, t: Transformations, seed: number, noiseSize?: { width: number; height: number }): Raster {
  let raster = geometry(source, t);
  const { width, height } = raster;
  if (isGeometryOnly({ ...t, shuffleFrames: false, reverseFrames: false, pingPong: false, gifSpeed: 100 })) return raster;
  if (t.pixelate > 1) {
    const data = new Uint8ClampedArray(raster.data.length), size = Math.max(1, Math.round(t.pixelate));
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const sx = Math.min(width - 1, Math.floor(x / size) * size + Math.floor(size / 2));
      const sy = Math.min(height - 1, Math.floor(y / size) * size + Math.floor(size / 2));
      const from = (sy * width + sx) * 4;
      data.set(raster.data.subarray(from, from + 4), (y * width + x) * 4);
    }
    raster = { width, height, data };
  }
  if (t.blur > 0) raster = blur(raster, t.blur);
  const noiseWidth = noiseSize?.width ?? width, noiseHeight = noiseSize?.height ?? height;
  const glow = t.bloom ? blur(raster, Math.max(0.5, 4 * width / noiseWidth)) : null;
  const adjust = (pixel: number[]): Color => {
    let [r, g, b] = pixel;
    const brightness = t.brightness / 100 * 2 ** t.exposure, contrast = t.contrast / 100, saturation = t.saturation / 100;
    r = clamp(r * brightness); g = clamp(g * brightness); b = clamp(b * brightness);
    r = clamp(r * contrast + 128 * (1 - contrast)); g = clamp(g * contrast + 128 * (1 - contrast)); b = clamp(b * contrast + 128 * (1 - contrast));
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = clamp(gray + saturation * (r - gray)); g = clamp(gray + saturation * (g - gray)); b = clamp(gray + saturation * (b - gray));
    if (t.hueRotate) [r, g, b] = hue(r, g, b, t.hueRotate);
    [r, g, b] = tone([r, g, b], t);
    if (t.grayscale) r = g = b = 0.299 * r + 0.587 * g + 0.114 * b;
    if (t.invert) { r = 255 - r; g = 255 - g; b = 255 - b; }
    if (t.sepia) [r, g, b] = [clamp(0.393 * r + 0.769 * g + 0.189 * b), clamp(0.349 * r + 0.686 * g + 0.168 * b), clamp(0.272 * r + 0.534 * g + 0.131 * b)];
    return [r, g, b];
  };
  const sample = (x: number, y: number): [number, number, number, number] => {
    if (Number.isInteger(x) && Number.isInteger(y)) {
      if (x < 0 || y < 0 || x >= width || y >= height) return [0, 0, 0, 0];
      const p = (y * width + x) * 4;
      return [raster.data[p], raster.data[p + 1], raster.data[p + 2], raster.data[p + 3]];
    }
    return samplePixel(raster, x, y);
  };
  const output = new Uint8ClampedArray(raster.data.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const px = (x + 0.5) * noiseWidth / width - 0.5, py = (y + 0.5) * noiseHeight / height - 0.5;
    const band = Math.floor((py + 0.5) / 24);
    const shifted = t.glitch && pixelNoise(band, seed) > 0.25 ? x + Math.round(pixelNoise(band + 17, seed) * t.glitch * 0.005 * width) : x;
    const [sx, sy] = mirrorPoint(shifted, y, width, height, t.mirrorMode);
    const input = sample(sx, sy), out = (y * width + x) * 4;
    let c = adjust(input);
    if (t.rgbSplit) c = [adjust(samplePixel(raster, sx + t.rgbSplit, sy))[0], c[1], adjust(samplePixel(raster, sx - t.rgbSplit, sy))[2]];
    c = grade(c, t);
    if (['neon', 'blueprint', 'comic'].includes(t.artStyle)) {
      const get = (x: number, y: number) => { const rgba = sample(x, y); return luminance(adjust(rgba)) * rgba[3] / 255; };
      const tl = get(sx - 1, sy - 1), tc = get(sx, sy - 1), tr = get(sx + 1, sy - 1);
      const ml = get(sx - 1, sy), mr = get(sx + 1, sy), bl = get(sx - 1, sy + 1), bc = get(sx, sy + 1), br = get(sx + 1, sy + 1);
      const edge = Math.min(1, Math.sqrt((tr + 2 * mr + br - tl - 2 * ml - bl) ** 2 + (bl + 2 * bc + br - tl - 2 * tc - tr) ** 2));
      c = artistic(c, edge, px + 0.5, py + 0.5, t);
    }
    if (glow) {
      const rgba = samplePixel(glow, sx, sy), light = adjust(rgba);
      c = c.map((value, channel) => clamp(value + Math.max(0, light[channel] - 140.25) * t.bloom / 100 * 1.5)) as Color;
    }
    c = texture(c, px, py, noiseWidth, noiseHeight, t);
    const noiseX = Math.floor((sx + 0.5) * noiseWidth / width), noiseY = Math.floor((sy + 0.5) * noiseHeight / height);
    const noise = pixelNoise(noiseY * noiseWidth + noiseX, seed) * t.noise * 2.55;
    output[out] = clamp(c[0] + noise); output[out + 1] = clamp(c[1] + noise); output[out + 2] = clamp(c[2] + noise); output[out + 3] = input[3];
  }
  return { width, height, data: output };
}
