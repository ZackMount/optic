# Optic

<div align="center">

**A lightweight image processing tool**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
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

## Getting Started

### Quick Start

Try Optic online without installation:

**[https://optic.zackmount.blog/](https://optic.zackmount.blog/)**

### Prerequisites

- Node.js 18+ 
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
# or
yarn install
# or
pnpm install
```

3. Run the development server
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
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
- **Expanded Mode** - Click the expand button to see full labels and sliders

## Tech Stack

- **Framework** - [Next.js 15](https://nextjs.org/) (App Router)
- **Language** - [TypeScript](https://www.typescriptlang.org/)
- **Styling** - [Tailwind CSS](https://tailwindcss.com/)
- **Animations** - [Framer Motion](https://www.framer.com/motion/)
- **Icons** - [Lucide React](https://lucide.dev/)
- **GIF Processing** - [gifuct-js](https://github.com/matt-way/gifuct-js) & [gif.js](https://github.com/jnordberg/gif.js)
- **Image Processing** - Native Canvas API

## Supported Formats

- **Input**: JPG, PNG, WebP, GIF
- **Output**: PNG (for static images), GIF (for animated GIFs)

## Privacy

All image processing happens **entirely in your browser**. No data is sent to any server. Your images never leave your device.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**ZackMount**

- GitHub: [@ZackMount](https://github.com/ZackMount)
- Project: [https://github.com/ZackMount/optic](https://github.com/ZackMount/optic)

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Icons by [Lucide](https://lucide.dev/)
- GIF processing powered by [gifuct-js](https://github.com/matt-way/gifuct-js) and [gif.js](https://github.com/jnordberg/gif.js)
