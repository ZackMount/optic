import {
  Aperture, ArrowRightLeft, Binary, Blend, BookOpen, BrushCleaning, Camera, ChartColumnIncreasing,
  CircleDashed, CircleDot, Compass, Contrast, DraftingCompass, Droplets, Eclipse, Expand,
  Film, FlaskConical, Flower2, Focus, Gamepad2, Gauge, Gem, Grid3x3, Grip, Layers, Lightbulb,
  Moon, MoonStar, MoveHorizontal, Orbit, Paintbrush, PaintBucket, PaintRoller, Palette,
  Pencil, PencilRuler, PenTool, Radar, Rainbow, Repeat2, Rewind, Rows3, Ruler, ScanLine,
  ScanSearch, Shuffle, SlidersHorizontal, Sparkles, Spline, SquareFunction, Stamp,
  StretchHorizontal, Sun, SunDim, Sunrise, Sunset, SwatchBook, Thermometer, ThermometerSun,
  Unplug, WandSparkles, Waves, Zap, type LucideIcon,
} from 'lucide-react';
import { defaultTransformations, type Transformations } from '@/lib/image-engine/types';

export type BooleanKey = { [K in keyof Transformations]: Transformations[K] extends boolean ? K : never }[keyof Transformations];
export type NumberKey = { [K in keyof Transformations]: Transformations[K] extends number ? K : never }[keyof Transformations];
type Common = { label: string; icon: LucideIcon; keywords?: string; when?: (t: Transformations) => boolean };
export type EffectControl = Common & (
  { kind: 'toggle'; key: BooleanKey } |
  { kind: 'slider'; key: NumberKey; min: number; max: number; step?: number; format?: (value: number) => string; editable?: boolean; unit?: string } |
  { kind: 'select'; key: 'colorGrade' | 'artStyle'; options: { value: string; label: string; icon?: LucideIcon }[] } |
  { kind: 'color'; key: 'duotoneDark' | 'duotoneLight' }
);
export type EffectGroup = { title: string; controls: EffectControl[]; gifOnly?: boolean };
const percent = (value: number) => value + '%';
const offPercent = (value: number) => value ? percent(value) : 'Off';
const number = (value: number) => String(Math.round(value * 100) / 100);
const toggle = (key: BooleanKey, label: string, icon: LucideIcon): EffectControl => ({ kind: 'toggle', key, label, icon });
const slider = (key: NumberKey, label: string, icon: LucideIcon, min: number, max: number, extra: Partial<Extract<EffectControl, {kind:'slider'}>> = {}): EffectControl =>
  ({ kind: 'slider', key, label, icon, min, max, ...extra });

export const transformControls: EffectControl[] = [
  slider('swirl', 'Swirl', Orbit, -180, 180, { format: value => value ? value + '°' : 'Off' }),
  slider('bulge', 'Bulge / pinch', Expand, -100, 100, { format: offPercent }),
  slider('ripple', 'Ripple', Radar, 0, 40, { format: offPercent }),
  slider('wave', 'Wave', Waves, 0, 20, { format: offPercent }),
  slider('waveLength', 'Wavelength', Ruler, 5, 100, { format: percent, when: t => t.wave > 0 }),
];
export const symmetryControls: EffectControl[] = [
  slider('radialSymmetry', 'Radial kaleidoscope', Aperture, 0, 16, { format: value => value ? value + ' sides' : 'Off' }),
];

export const effectGroups: EffectGroup[] = [
  { title: 'Colors', controls: [
    toggle('grayscale', 'Grayscale', Moon), toggle('invert', 'Invert', ArrowRightLeft), toggle('sepia', 'Sepia', SunDim),
    slider('moonlight', 'Moonlight', MoonStar, 0, 100, { format: offPercent }),
    slider('solarize', 'Solarize', Eclipse, 0, 100, { format: offPercent }),
    slider('threshold', 'Black & white', Binary, 0, 100, { format: offPercent }),
    slider('paletteColors', 'Color limit', SwatchBook, 2, 256, { format: value => value === 256 ? 'Off' : value + ' colors' }),
    { kind: 'select', key: 'colorGrade', label: 'Color grade', icon: Palette,
      keywords: 'duotone cyanotype thermal gameboy vintage cross process retro',
      options: [
        { value: 'none', label: 'Original' }, { value: 'duotone', label: 'Duotone', icon: Blend },
        { value: 'cyanotype', label: 'Cyanotype', icon: Flower2 }, { value: 'thermal', label: 'Thermal', icon: ThermometerSun },
        { value: 'gameboy', label: 'Game Boy', icon: Gamepad2 }, { value: 'vintage', label: 'Vintage film', icon: Film },
        { value: 'crossprocess', label: 'Cross process', icon: FlaskConical },
      ] },
    slider('gradeStrength', 'Grade strength', SlidersHorizontal, 0, 100, { format: percent, keywords: 'duotone cyanotype thermal gameboy vintage cross process', when: t => t.colorGrade !== 'none' }),
    { kind: 'color', key: 'duotoneDark', label: 'Shadow color', icon: Sunset, keywords: 'duotone', when: t => t.colorGrade === 'duotone' },
    { kind: 'color', key: 'duotoneLight', label: 'Highlight color', icon: Sunrise, keywords: 'duotone', when: t => t.colorGrade === 'duotone' },
  ] },
  { title: 'Adjust', controls: [
    toggle('autoLevel', 'Auto levels', ChartColumnIncreasing), toggle('autoGamma', 'Auto gamma', WandSparkles), toggle('normalize', 'Normalize', StretchHorizontal),
    slider('brightness', 'Brightness', Sun, 0, 200), slider('contrast', 'Contrast', Contrast, 0, 200),
    slider('saturation', 'Saturation', CircleDot, 0, 200), slider('hueRotate', 'Hue', Rainbow, 0, 360),
    slider('exposure', 'Exposure', Camera, -3, 3, { step: 0.1, format: value => (value > 0 ? '+' : '') + value.toFixed(1) + ' EV' }),
    slider('gamma', 'Gamma', SquareFunction, 25, 300, { format: value => (value / 100).toFixed(2) }),
    slider('vibrance', 'Vibrance', Gem, -100, 100),
    slider('temperature', 'Temperature', Thermometer, -100, 100),
    slider('tint', 'Tint', PaintBucket, -100, 100),
    slider('clarity', 'Local contrast', ScanSearch, 0, 100, { format: offPercent }),
    slider('softContrast', 'S-curve contrast', Spline, -10, 10, { step: 0.5, format: number }),
  ] },
  { title: 'Effects', controls: [
    slider('blur', 'Blur', Droplets, 0, 20), slider('pixelate', 'Pixelate', Grid3x3, 1, 50), slider('noise', 'Noise', Sparkles, 0, 100),
    slider('sharpen', 'Sharpen', Focus, 0, 10, { step: 0.25, format: number }),
    slider('denoise', 'Denoise', BrushCleaning, 0, 10),
    slider('motionBlur', 'Motion blur', MoveHorizontal, 0, 20),
    slider('motionAngle', 'Blur direction', Compass, -180, 180, { format: value => value + '°', when: t => t.motionBlur > 0 }),
  ] },
  { title: 'GIF', gifOnly: true, controls: [
    toggle('shuffleFrames', 'Shuffle', Shuffle), toggle('reverseFrames', 'Reverse', Rewind), toggle('pingPong', 'Ping-pong', Repeat2),
    slider('gifSpeed', 'Speed', Gauge, 25, 800, { step: 1, format: percent, editable: true, unit: '%' }),
  ] },
  { title: 'Artistic', controls: [
    { kind: 'select', key: 'artStyle', label: 'Art style', icon: PaintRoller,
      keywords: 'oil painting charcoal emboss ink line art canny neon blueprint comic',
      options: [
        { value: 'none', label: 'Original' }, { value: 'oil', label: 'Oil painting', icon: Paintbrush },
        { value: 'charcoal', label: 'Charcoal', icon: Pencil }, { value: 'ink', label: 'Ink drawing', icon: PenTool },
        { value: 'emboss', label: 'Emboss', icon: Stamp },
        { value: 'canny', label: 'Line art', icon: ScanLine }, { value: 'neon', label: 'Neon outline', icon: Zap },
        { value: 'blueprint', label: 'Blueprint', icon: DraftingCompass }, { value: 'comic', label: 'Comic', icon: BookOpen },
      ] },
    slider('artStrength', 'Art strength', PencilRuler, 0, 100, { format: percent, keywords: 'oil painting charcoal emboss ink line art canny neon blueprint comic', when: t => t.artStyle !== 'none' }),
  ] },
  { title: 'Light & texture', controls: [
    slider('bloom', 'Bloom', Lightbulb, 0, 100, { format: offPercent }),
    slider('vignette', 'Vignette', CircleDashed, 0, 100, { format: offPercent }),
    slider('rgbSplit', 'RGB split', Layers, 0, 30, { step: 0.5, format: number }),
    slider('halftone', 'Halftone dots', Grip, 0, 24, { format: value => value ? value + ' px' : 'Off' }),
    slider('scanlines', 'Scanlines', Rows3, 0, 100, { format: offPercent }),
    slider('glitch', 'Glitch', Unplug, 0, 100, { format: offPercent }),
  ] },
];

export const effectPresets: { name: string; description: string; values: Partial<Transformations> }[] = [
  { name: 'Neon sticker', description: 'Bright edge light with a subtle color split.', values: { artStyle: 'neon', bloom: 15, rgbSplit: 2, saturation: 140 } },
  { name: 'Retro console', description: 'Four green shades and chunky pixels.', values: { colorGrade: 'gameboy', pixelate: 6, scanlines: 20 } },
  { name: 'Comic print', description: 'Bold outlines and warm paper dots.', values: { artStyle: 'comic', halftone: 7, saturation: 125 } },
  { name: 'Blueprint', description: 'Cyan contours on a drafting grid.', values: { artStyle: 'blueprint', contrast: 120 } },
  { name: 'Cyanotype', description: 'Blue photographic print with soft edges.', values: { colorGrade: 'cyanotype', contrast: 110, vignette: 20, noise: 3 } },
  { name: 'Vintage film', description: 'Warm faded color with grain and shading.', values: { colorGrade: 'vintage', vignette: 25, noise: 8, saturation: 85 } },
  { name: 'VHS tape', description: 'Scanlines, shifted channels and broken bands.', values: { glitch: 45, rgbSplit: 4, scanlines: 35, noise: 10 } },
  { name: 'Dream glow', description: 'Soft highlights and a gentle light lift.', values: { bloom: 70, blur: 1.5, exposure: 0.2, saturation: 90 } },
];

export function presetTransformations(current: Transformations, values: Partial<Transformations>): Transformations {
  return {
    ...defaultTransformations, ...values, rotation: current.rotation,
    flipHorizontal: current.flipHorizontal, flipVertical: current.flipVertical,
    mirrorMode: current.mirrorMode, radialSymmetry: current.radialSymmetry,
    shuffleFrames: current.shuffleFrames, reverseFrames: current.reverseFrames,
    pingPong: current.pingPong, gifSpeed: current.gifSpeed,
  };
}
