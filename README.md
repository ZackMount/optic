# Optic

<div align="center">

**A lightweight image processing tool**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

Image processing tool for transform, flip, mirror, and apply effects to images. All operations are performed locally in the browser.

[Features](#features) • [Getting Started](#getting-started) • [Usage](#usage) • [License](#license)

</div>

---

## Features

### Image Transformations
- **Rotate** - 90°, 180°, 270° rotations
- **Flip** - Horizontal and vertical flipping
- **Mirror** - Left/right, top/bottom, and kaleidoscope (center) mirroring

### Color Effects
- **Grayscale** - Convert to black and white
- **Invert** - Invert colors
- **Sepia** - Apply vintage sepia tone

### Adjustments
- **Brightness** - Adjust image brightness (0-200%)
- **Contrast** - Adjust image contrast (0-200%)
- **Saturation** - Adjust color saturation (0-200%)
- **Hue** - Rotate color hue (0-360°)

### Special Effects
- **Blur** - Apply blur effect (0-20px)
- **Pixelate** - Pixelation effect (1-50px)
- **Noise** - Add noise to image (0-100%)

### GIF Support
- Full GIF frame processing
- Frame shuffling for creative effects
- Preserves animation and transparency
- Keeps local frame palettes, delays, disposal rules, and finite loops
- Exact indexed rotation and flipping without color quantization

### Processing Engine
- ImageMagick / WebAssembly runs locally in a dedicated Web Worker
- File signatures determine the actual format, including images with incorrect extensions
- WebGL 2 accelerates preview and full-resolution filter exports; genuine GPU failures have an explicit CPU fallback reason
- Preview and encoding use separate workers; editing interrupts stale transfer preparations without cancelling previews
- Decoded frames, preview pixels, GPU textures and exports use bounded caches
- The complete transfer file is cached after edits settle; unchanged files reuse their source bytes and GIF geometry skips pixel decoding
- Adaptive GIF preview buffers keep the original logical display size
- Unedited files are exported byte for byte; static edits default to lossless PNG
- JPEG exports have an explicit background color; WebP supports lossless export

## Getting Started

### Quick Start

Try Optic online without installation:

**[https://optic.zackmount.blog/](https://optic.zackmount.blog/)**

### Prerequisites

- Node.js 20.9+ (Node.js 22 recommended)
- npm, yarn, pnpm, or bun

### Installation

1. Clone the repository
```bash
git clone https://github.com/ZackMount/optic.git
cd optic
```

2. Install dependencies
```bash
npm install
```

3. Run the development server
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Import Images

- **Drag & Drop** - Drag an image file onto the dropzone
- **Click to Browse** - Click the dropzone to open file picker
- **Paste** - Copy an image and press `Cmd+V` (Mac) or `Ctrl+V` (Windows/Linux)
- **URL** - Click "Paste URL" and enter an image URL

### Apply Effects

1. Select an image using any of the methods above
2. Use the toolbar on the left to apply transformations and effects
3. View the result in real-time in the preview panel
4. Click "Export" to download the processed image

### Toolbar

- **Collapsed Mode** - Hover over icons to see tooltips
- **Expanded Mode** - Opens by default with full labels and sliders; click the toggle to collapse

## Tech Stack

- **Framework** - [Next.js 16](https://nextjs.org/) (App Router)
- **Language** - [TypeScript](https://www.typescriptlang.org/)
- **Styling** - [Tailwind CSS](https://tailwindcss.com/)
- **Animations** - [Framer Motion](https://www.framer.com/motion/)
- **Icons** - [Lucide React](https://lucide.dev/)
- **Image Core** - [ImageMagick / magick-wasm](https://github.com/dlemstra/magick-wasm), pinned to 0.0.44
- **GIF Geometry** - [omggif](https://github.com/deanm/omggif), preserving indexed colors and frame metadata
- **Preview** - WebGL 2 shaders, OffscreenCanvas and transferable ImageBitmap frames
- **Scheduling** - Separate preview/encoding workers, latest-request handling and interruptible image switches
- **Color** - sRGB working pixels; embedded ICC profiles are converted using ImageMagick and a [Compact ICC Profile](https://github.com/saucecontrol/Compact-ICC-Profiles)

## Supported Formats

- **Input**: JPEG, PNG, WebP, GIF, AVIF, BMP and TIFF (detected by content)
- **Output**: PNG, JPEG, WebP and GIF; Auto preserves unedited source bytes and selects PNG / GIF after editing
- **Clipboard**: PNG for static images; complete GIF copying requires browser support for the GIF clipboard format
- **Transfer**: drag the prepared image file or use the browser's device share sheet when supported

Optic is a browser application. The reusable `ImageTransfer` component accepts a factory for a complete encoded file and uses the Clipboard, Web Share and HTML drag APIs. Unsupported GIF clipboard formats produce a visible error instead of copying a poster frame. Dragging into another application depends on that application's browser file-drop support. The Share control remains visible to the right of Export and is disabled when file sharing is unavailable.

GIF has at most 256 colors per palette and binary transparency. Filters that add colors or semi-transparent pixels require quantization and an alpha threshold when exporting GIF. PNG and lossless WebP preserve full alpha for static images.

The browser engine currently processes 8-bit sRGB pixels. The total decoded frame budget is 64 million pixels, with a smaller adaptive preview budget. Files larger than 100 MB or animations beyond the memory budget are rejected with a visible error.

## Development and Validation

`npm install`, `npm run dev`, and `npm run build` prepare versioned WASM assets from the installed dependency. The JavaScript codec is bundled with the image worker. No runtime image-processing CDN is used. Generated assets live in `public/vendor/magick` and include the engine's third-party license notices.

```bash
npm run lint
npx tsc --noEmit
npm run build
```

The header reports GPU, software WebGL, or CPU based on the actual renderer. CPU fallbacks include a diagnostic reason in the preview attributes and worker console. ImageMagick's file decoding, GIF palette quantization and compression still run in WASM on the CPU; the shader effects run on the GPU. Pixel-exact indexed GIF and lossless geometry paths do not need shader processing.

## Privacy

All image processing happens **entirely in your browser**. Imported files are not uploaded. URL imports download directly from the image server; if that server blocks browser access, save the file and import it locally.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**ZackMount**

- GitHub: [@ZackMount](https://github.com/ZackMount)
- Project: [https://github.com/ZackMount/optic](https://github.com/ZackMount/optic)

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Icons by [Lucide](https://lucide.dev/)
- Image codecs and composition by [ImageMagick / magick-wasm](https://github.com/dlemstra/magick-wasm)
- Indexed GIF geometry by [omggif](https://github.com/deanm/omggif)
- sRGB profile from [Compact ICC Profiles](https://github.com/saucecontrol/Compact-ICC-Profiles), released under CC0
