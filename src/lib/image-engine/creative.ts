import type { Raster, Transformations } from './types';

export const colorGrades = ['none', 'duotone', 'cyanotype', 'thermal', 'gameboy', 'vintage', 'crossprocess'];
export const gpuArtStyles = ['none', 'neon', 'blueprint', 'comic'];
export type Color = [number, number, number];
const clamp = (value: number) => Math.max(0, Math.min(255, value));
const mix = (a: Color, b: Color, amount: number): Color => a.map((value, index) => value * (1 - amount) + b[index] * amount) as Color;
export const luminance = (c: Color) => (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114) / 255;
const smooth = (a: number, b: number, value: number) => {
  const x = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

export function hashNoise(index: number, seed: number) {
  let value = (index ^ seed) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b) >>> 0;
  return (((value ^ (value >>> 16)) >>> 0) & 65535) / 65535 - 0.5;
}

export function hasWarp(t: Transformations) {
  return !!(t.swirl || t.bulge || t.ripple || t.radialSymmetry);
}

export function warpedPoint(x: number, y: number, width: number, height: number, t: Transformations) {
  const cx = (width - 1) / 2, cy = (height - 1) / 2, size = Math.max(1, Math.min(width, height) / 2);
  const dx = (x - cx) / size, dy = (y - cy) / size;
  const radius = Math.sqrt(dx * dx + dy * dy);
  if (radius < 0.00001) return [x, y];
  let angle = Math.atan2(dy, dx), r = radius;
  if (t.radialSymmetry > 0) {
    const slice = Math.PI * 2 / t.radialSymmetry;
    angle = Math.abs(((angle + slice / 2) % slice + slice) % slice - slice / 2);
  }
  if (radius < 1) {
    angle += t.swirl * Math.PI / 180 * (1 - radius) ** 2;
    if (t.bulge) r = Math.pow(Math.max(0.00001, radius), Math.max(0.2, 1 + t.bulge / 125));
    if (t.ripple) r += Math.sin(radius * 24) * t.ripple / 400 * (1 - radius) * Math.min(1, radius / 0.15);
  }
  return [cx + Math.cos(angle) * r * size, cy + Math.sin(angle) * r * size];
}

export function samplePixel(source: Raster, x: number, y: number): [number, number, number, number] {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  let r = 0, g = 0, b = 0, alpha = 0;
  for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
    const sx = ix + dx, sy = iy + dy;
    if (sx < 0 || sy < 0 || sx >= source.width || sy >= source.height) continue;
    const p = (sy * source.width + sx) * 4;
    const weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy);
    const a = source.data[p + 3] / 255 * weight;
    r += source.data[p] * a; g += source.data[p + 1] * a; b += source.data[p + 2] * a; alpha += a;
  }
  return alpha > 0 ? [r / alpha, g / alpha, b / alpha, alpha * 255] : [0, 0, 0, 0];
}

export function tone(c: Color, t: Transformations): Color {
  const temp = t.temperature / 100, tint = t.tint / 100;
  let result = [c[0] * (1 + temp * 0.18 + tint * 0.04),
    c[1] * (1 - tint * 0.12), c[2] * (1 - temp * 0.18 + tint * 0.04)].map(clamp) as Color;
  if (t.vibrance) {
    const saturation = (Math.max(...result) - Math.min(...result)) / 255;
    const amount = 1 + t.vibrance / 100 * (t.vibrance > 0 ? 1 - saturation : 1);
    const gray = luminance(result) * 255;
    result = result.map(value => clamp(gray + (value - gray) * amount)) as Color;
  }
  return result;
}

export function hexColor(value: string): Color {
  if (!/^#[0-9a-f]{6}$/i.test(value)) return [0, 0, 0];
  return [1, 3, 5].map(offset => parseInt(value.slice(offset, offset + 2), 16)) as Color;
}

export function grade(c: Color, t: Transformations): Color {
  const light = luminance(c);
  let result = c;
  if (t.colorGrade === 'duotone') result = mix(hexColor(t.duotoneDark), hexColor(t.duotoneLight), light);
  if (t.colorGrade === 'cyanotype') result = mix([8, 32, 62], [242, 245, 218], Math.pow(light, 0.9));
  if (t.colorGrade === 'thermal') {
    const colors: Color[] = [[23, 5, 51], [64, 20, 204], [255, 20, 56], [255, 184, 5], [255, 255, 224]];
    const position = Math.min(3.9999, light * 4), index = Math.floor(position);
    result = mix(colors[index], colors[index + 1], position - index);
  }
  if (t.colorGrade === 'gameboy') {
    const colors: Color[] = [[13, 48, 28], [51, 97, 61], [140, 171, 77], [204, 219, 128]];
    result = colors[Math.min(3, Math.floor(light * 4))];
  }
  if (t.colorGrade === 'vintage') {
    const muted = mix([light * 255, light * 255, light * 255], c, 0.75);
    result = [Math.pow(muted[0] / 255, 0.9) * 255 * 1.03 + 10,
      Math.pow(muted[1] / 255, 0.95) * 255 + 5, Math.pow(muted[2] / 255, 1.08) * 255 * 0.9 + 8].map(clamp) as Color;
  }
  if (t.colorGrade === 'crossprocess') result = [255 * Math.pow(c[0] / 255, 0.8), 255 * Math.pow(c[1] / 255, 1.08), c[2] * 0.8 + 26].map(clamp) as Color;
  return t.colorGrade === 'none' ? c : mix(c, result, t.gradeStrength / 100);
}

export function edgeAt(x: number, y: number, get: (x: number, y: number) => number) {
  const tl = get(x - 1, y - 1), tc = get(x, y - 1), tr = get(x + 1, y - 1);
  const ml = get(x - 1, y), mr = get(x + 1, y);
  const bl = get(x - 1, y + 1), bc = get(x, y + 1), br = get(x + 1, y + 1);
  return Math.min(1, Math.sqrt((tr + 2 * mr + br - tl - 2 * ml - bl) ** 2 +
    (bl + 2 * bc + br - tl - 2 * tc - tr) ** 2));
}

export function artistic(c: Color, edge: number, x: number, y: number, t: Transformations): Color {
  let result = c;
  if (t.artStyle === 'neon') result = [c[0] * 0.035 + edge * 760, c[1] * 0.035 + edge * 980, c[2] * 0.035 + edge * 1020].map(clamp) as Color;
  if (t.artStyle === 'blueprint') {
    const grid = x % 24 < 1.2 || y % 24 < 1.2 ? 0.08 : 0;
    result = mix([9, 31, 71], [191, 237, 255], Math.min(1, edge * 5 + grid));
  }
  if (t.artStyle === 'comic') {
    const ink = smooth(0.12, 0.4, edge * 3) * 0.85;
    result = c.map(value => Math.round(value / 255 * 5) / 5 * 255 * (1 - ink)) as Color;
  }
  return gpuArtStyles.includes(t.artStyle) ? mix(c, result, t.artStrength / 100) : c;
}

export function texture(c: Color, x: number, y: number, width: number, height: number, t: Transformations): Color {
  let factor = 1;
  if (t.vignette) {
    const dx = (x + 0.5) / width - 0.5, dy = (y + 0.5) / height - 0.5;
    factor *= 1 - t.vignette / 100 * 0.85 * smooth(0.12, 0.7, Math.sqrt(dx * dx + dy * dy));
  }
  if (t.scanlines && Math.floor(y) % 3 === 1) factor *= 1 - t.scanlines / 100 * 0.65;
  let result = c.map(value => value * factor) as Color;
  if (t.halftone) {
    const size = Math.max(2, t.halftone), dx = (x % size + 0.5) / size - 0.5, dy = (y % size + 0.5) / size - 0.5;
    const radius = 0.5 * Math.sqrt(Math.max(0, 1 - luminance(c)));
    const ink = 1 - smooth(radius - 0.03, radius + 0.03, Math.sqrt(dx * dx + dy * dy));
    result = mix([245 * factor, 241 * factor, 225 * factor], result, ink);
  }
  return result;
}

export const warpGLSL = `
vec2 warpPoint(vec2 p) {
  vec2 center = (vec2(uSize) - 1.0) * 0.5;
  float size = max(1.0, min(float(uSize.x), float(uSize.y)) * 0.5);
  vec2 delta = (p - center) / size;
  float radius = length(delta), r = radius, angle = atan(delta.y, delta.x);
  if (radius < 0.00001) return p;
  if (uWarp.w > 0.0) {
    float slice = 6.28318530718 / uWarp.w;
    angle = abs(mod(angle + slice * 0.5, slice) - slice * 0.5);
  }
  if (radius < 1.0) {
    angle += uWarp.x * pow(1.0 - radius, 2.0);
    if (uWarp.y != 0.0) r = pow(max(0.00001, radius), max(0.2, 1.0 + uWarp.y));
    if (uWarp.z != 0.0) r += sin(radius * 24.0) * uWarp.z * (1.0 - radius) * min(1.0, radius / 0.15);
  }
  return center + vec2(cos(angle), sin(angle)) * r * size;
}
vec4 safeTexel(ivec2 q) {
  if (any(lessThan(q, ivec2(0))) || any(greaterThanEqual(q, uSource))) return vec4(0);
  return texelFetch(uImage, q, 0);
}
vec4 sampleSource(vec2 q) {
  ivec2 p = ivec2(floor(q));
  vec2 f = fract(q);
  vec4 a = safeTexel(p), b = safeTexel(p + ivec2(1,0));
  vec4 c = safeTexel(p + ivec2(0,1)), d = safeTexel(p + ivec2(1,1));
  a.rgb *= a.a; b.rgb *= b.a; c.rgb *= c.a; d.rgb *= d.a;
  vec4 result = mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
  if (result.a > 0.0) result.rgb /= result.a;
  return result;
}`;
