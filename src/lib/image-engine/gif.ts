import { GifReader, GifWriter, type GifOptions, type FrameOptions } from 'omggif';
import { dimensions, type Transformations } from './types';
import { sourcePoint } from './pixels';
import { scaledFrameDelay } from './animation';

const emptyControl = new Uint8Array([0x21, 0xf9, 4, 0, 0, 0, 0, 0]);
function normalizeControls(bytes: Uint8Array) {
  let offset = 13 + ((bytes[10] & 128) ? 3 * (1 << ((bytes[10] & 7) + 1)) : 0);
  const chunks: Uint8Array[] = [bytes.subarray(0, offset)];
  const extensions: Uint8Array[] = [];
  let loop: number | null = null;
  let control = false;
  const skipBlocks = () => {
    while (offset < bytes.length) {
      const length = bytes[offset++];
      if (!length) return;
      offset += length;
      if (offset > bytes.length) throw new Error('Truncated GIF data.');
    }
    throw new Error('Truncated GIF data.');
  };
  while (offset < bytes.length) {
    const start = offset, marker = bytes[offset++];
    if (marker === 0x3b) { chunks.push(bytes.subarray(start, offset)); break; }
    if (marker === 0x21) {
      const label = bytes[offset++]; skipBlocks();
      if (label === 0xf9) control = true;
      if (label === 0x01) throw new Error('GIF plain-text graphics are not supported.');
      const application = label === 0xff ? String.fromCharCode(...bytes.subarray(start + 3, start + 3 + bytes[start + 2])) : '';
      if (application === 'NETSCAPE2.0' || application === 'ANIMEXTS1.0') {
        const data = start + 3 + bytes[start + 2];
        if (bytes[data] === 3 && bytes[data + 1] === 1) loop = bytes[data + 2] | (bytes[data + 3] << 8);
      } else if (label !== 0xf9) extensions.push(bytes.subarray(start, offset));
    } else if (marker === 0x2c) {
      if (!control) chunks.push(emptyControl);
      const packed = bytes[offset + 8]; offset += 9;
      if (packed & 128) offset += 3 * (1 << ((packed & 7) + 1));
      offset++; skipBlocks(); control = false;
    } else if (marker !== 0) throw new Error('Invalid GIF block.');
    chunks.push(bytes.subarray(start, offset));
  }
  const normalized = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let cursor = 0; for (const chunk of chunks) { normalized.set(chunk, cursor); cursor += chunk.length; }
  return { bytes: normalized, extensions, loop };
}

export function gifMetadata(bytes: Uint8Array) {
  const normalized = normalizeControls(bytes), decoderBytes = normalized.bytes;
  const reader = new GifReader(decoderBytes);
  const frames = Array.from({ length: reader.numFrames() }, (_, i) => reader.frameInfo(i));
  const loop = normalized.loop;
  return { reader, frames, decoderBytes, extensions: normalized.extensions, loop, width: reader.width, height: reader.height, delays: frames.map(frame => frame.delay * 10), iterations: loop === null ? 1 : loop === 0 ? 0 : loop + 1 };
}

function paletteAt(bytes: Uint8Array, offset: number, size: number) {
  return Array.from({ length: size }, (_, i) => (bytes[offset + i * 3] << 16) | (bytes[offset + i * 3 + 1] << 8) | bytes[offset + i * 3 + 2]);
}

export function transformGif(bytes: Uint8Array, t: Transformations): Uint8Array {
  const { reader, frames, decoderBytes, extensions, loop } = gifMetadata(bytes);
  const size = dimensions(reader.width, reader.height, t.rotation);
  const hasGlobal = !!(bytes[10] & 128), globalSize = 1 << ((bytes[10] & 7) + 1);
  const options: GifOptions = {};
  if (hasGlobal) options.palette = paletteAt(bytes, 13, globalSize);
  if (hasGlobal && bytes[11] !== 0) options.background = bytes[11];
  if (loop !== null) options.loop = loop;
  const totalPixels = frames.reduce((sum, frame) => sum + frame.width * frame.height, 0);
  const output = new Uint8Array(totalPixels * 2 + frames.length * 2048 + 1024 + extensions.reduce((size, extension) => size + extension.length, 0));
  const writer = new GifWriter(output, size.width, size.height, options);
  for (const extension of extensions) {
    const position = writer.getOutputBufferPosition(); output.set(extension, position);
    writer.setOutputBufferPosition(position + extension.length);
  }
  const rgba = new Uint8ClampedArray(reader.width * reader.height * 4);
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (frame.x + frame.width > reader.width || frame.y + frame.height > reader.height) throw new Error('GIF patch exceeds its logical canvas');
    const palette = paletteAt(decoderBytes, frame.palette_offset!, frame.palette_size!);
    const colors = new Map<number, number>();
    palette.forEach((rgb, index) => { if (index !== frame.transparent_index && !colors.has(rgb)) colors.set(rgb, index); });
    rgba.fill(0); reader.decodeAndBlitFrameRGBA(i, rgba);
    const patch = new Uint8Array(frame.width * frame.height);
    for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
      const p = ((frame.y + y) * reader.width + frame.x + x) * 4;
      const rgb = (rgba[p] << 16) | (rgba[p + 1] << 8) | rgba[p + 2];
      const index = rgba[p + 3] === 0 && frame.transparent_index !== null ? frame.transparent_index : colors.get(rgb);
      if (index === undefined) throw new Error('GIF palette is invalid');
      patch[y * frame.width + x] = index;
    }
    const patchSize = dimensions(frame.width, frame.height, t.rotation), transformed = new Uint8Array(patch.length);
    for (let y = 0; y < patchSize.height; y++) for (let x = 0; x < patchSize.width; x++) {
      const [sx, sy] = sourcePoint(x, y, frame.width, frame.height, t);
      transformed[y * patchSize.width + x] = patch[sy * frame.width + sx];
    }
    let x = t.flipHorizontal ? reader.width - frame.x - frame.width : frame.x;
    let y = t.flipVertical ? reader.height - frame.y - frame.height : frame.y;
    if (t.rotation === 90) [x, y] = [reader.height - y - frame.height, x];
    else if (t.rotation === 180) [x, y] = [reader.width - x - frame.width, reader.height - y - frame.height];
    else if (t.rotation === 270) [x, y] = [y, reader.width - x - frame.width];
    const delay = scaledFrameDelay(frame.delay * 10, t.gifSpeed) / 10;
    const frameOptions: FrameOptions = { delay, disposal: frame.disposal };
    if (frame.has_local_palette) frameOptions.palette = palette;
    if (frame.transparent_index !== null) frameOptions.transparent = frame.transparent_index;
    if (!delay && !frame.disposal && frame.transparent_index === null) {
      const position = writer.getOutputBufferPosition(); output.set(emptyControl, position);
      writer.setOutputBufferPosition(position + emptyControl.length);
    }
    writer.addFrame(x, y, patchSize.width, patchSize.height, transformed as unknown as number[], frameOptions);
  }
  const length = writer.end();
  if (length > output.length) throw new Error('GIF output exceeds its buffer');
  output[10] = (output[10] & 0x87) | (bytes[10] & 0x78);
  output[12] = bytes[12];
  return output.slice(0, length);
}
