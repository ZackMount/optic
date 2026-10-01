import { ByteCache } from './cache';
import { gaussianKernel } from './pixels';
import { colorGrades, gpuArtStyles, hexColor } from './creative';
import { geometryShader, colorShader } from './shaders';
import { dimensions, type GpuInfo, type Raster, type Transformations } from './types';

const vertex = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const blurShader = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uImage;
uniform ivec2 uSize;
uniform int uRadius;
uniform float uWeights[121];
uniform int uHorizontal;
out vec4 color;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 sum = vec4(0);
  for (int k = -60; k <= 60; k++) {
    if (abs(k) > uRadius) continue;
    ivec2 q = p + (uHorizontal == 1 ? ivec2(k, 0) : ivec2(0, k));
    if (any(lessThan(q, ivec2(0))) || any(greaterThanEqual(q, uSize))) continue;
    vec4 c = texelFetch(uImage, q, 0);
    if (uHorizontal == 1) c.rgb *= c.a;
    sum += c * uWeights[k + 60];
  }
  if (uHorizontal == 0 && sum.a > 0.0) sum.rgb /= sum.a;
  color = sum;
}`;

export class GpuRenderer {
  private readonly canvas = new OffscreenCanvas(1, 1);
  private readonly gl: WebGL2RenderingContext;
  private readonly programs: WebGLProgram[];
  private readonly sources: ByteCache<WebGLTexture>;
  private targets: WebGLTexture[] = [];
  private transient?: WebGLTexture;
  private readonly framebuffer: WebGLFramebuffer;
  private width = 0;
  private height = 0;
  private readonly floatBuffers: boolean;
  readonly info: GpuInfo;
  uploads = 0;

  constructor() {
    const gl = this.canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL 2 is unavailable');
    this.gl = gl;
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    this.info = { renderer, acceleration: /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer) ? 'software' : debug ? 'hardware' : 'unknown' };
    this.floatBuffers = !!gl.getExtension('EXT_color_buffer_float');
    this.programs = [geometryShader, blurShader, colorShader].map(fragment => this.program(vertex, fragment));
    this.framebuffer = gl.createFramebuffer()!;
    this.sources = new ByteCache(64 * 1024 * 1024, texture => gl.deleteTexture(texture));
    gl.disable(gl.BLEND);
    gl.disable(gl.DITHER);
  }

  private program(vs: string, fs: string) {
    const gl = this.gl;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const message = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(message || 'Shader compilation failed'); }
      return shader;
    };
    const v = compile(gl.VERTEX_SHADER, vs), f = compile(gl.FRAGMENT_SHADER, fs), program = gl.createProgram()!;
    gl.attachShader(program, v); gl.attachShader(program, f); gl.linkProgram(program);
    gl.deleteShader(v); gl.deleteShader(f);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Shader linking failed');
    return program;
  }

  private texture(width: number, height: number, data?: Uint8ClampedArray, float = false) {
    const gl = this.gl, texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, float ? gl.RGBA32F : gl.RGBA8, width, height, 0, gl.RGBA, float ? gl.FLOAT : gl.UNSIGNED_BYTE, data || null);
    return texture;
  }

  private begin(program: WebGLProgram, input: WebGLTexture, output: WebGLTexture | null) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, output ? this.framebuffer : null);
    if (output) {
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, output, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('GPU framebuffer is unavailable');
    }
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, input);
    gl.uniform1i(gl.getUniformLocation(program, 'uImage'), 0);
    gl.uniform2i(gl.getUniformLocation(program, 'uSize'), this.width, this.height);
  }

  private blurTexture(input: WebGLTexture, horizontal: WebGLTexture, vertical: WebGLTexture, sigma: number) {
    const gl = this.gl, program = this.programs[1], kernel = gaussianKernel(sigma), weights = new Float32Array(121);
    weights.set(kernel.weights, 60 - kernel.radius);
    for (let direction = 1; direction >= 0; direction--) {
      this.begin(program, direction ? input : horizontal, direction ? horizontal : vertical);
      gl.uniform1i(gl.getUniformLocation(program, 'uRadius'), kernel.radius);
      gl.uniform1fv(gl.getUniformLocation(program, 'uWeights[0]'), weights);
      gl.uniform1i(gl.getUniformLocation(program, 'uHorizontal'), direction);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    return vertical;
  }

  private draw(source: Raster, t: Transformations, seed: number, key: string, readback: boolean, noiseSize?: { width:number; height:number }) {
    const gl = this.gl;
    this.releaseTransient();
    if (gl.isContextLost()) throw new Error('The WebGL context was lost');
    if ((t.blur > 0 || t.bloom > 0) && !this.floatBuffers) throw new Error('This GPU does not support floating-point blur buffers');
    const size = dimensions(source.width, source.height, t.rotation);
    if (Math.max(source.width, source.height, size.width, size.height) > gl.getParameter(gl.MAX_TEXTURE_SIZE)) throw new Error('Image exceeds GPU texture size');
    if (size.width !== this.width || size.height !== this.height) {
      this.width = size.width; this.height = size.height;
      this.canvas.width = this.width; this.canvas.height = this.height;
      this.targets.forEach(texture => gl.deleteTexture(texture));
      this.targets = [this.texture(this.width, this.height), this.texture(this.width, this.height, undefined, this.floatBuffers), this.texture(this.width, this.height), this.texture(this.width, this.height)];
    }
    let texture = this.sources.get(key);
    if (!texture) {
      texture = this.texture(source.width, source.height, source.data);
      if (source.data.byteLength <= 64 * 1024 * 1024) this.sources.set(key, texture, source.data.byteLength);
      else this.transient = texture;
      this.uploads++;
    }
    const geometryProgram = this.programs[0];
    this.begin(geometryProgram, texture, this.targets[0]);
    gl.uniform2i(gl.getUniformLocation(geometryProgram, 'uSource'), source.width, source.height);
    gl.uniform1i(gl.getUniformLocation(geometryProgram, 'uRotation'), t.rotation);
    gl.uniform2i(gl.getUniformLocation(geometryProgram, 'uFlip'), Number(t.flipHorizontal), Number(t.flipVertical));
    gl.uniform1i(gl.getUniformLocation(geometryProgram, 'uPixelate'), Math.max(1, Math.round(t.pixelate)));
    gl.uniform4f(gl.getUniformLocation(geometryProgram, 'uWarp'), t.swirl * Math.PI / 180, t.bulge / 125, t.ripple / 400, t.radialSymmetry);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    let filtered = this.targets[0];
    if (t.blur > 0) {
      filtered = this.blurTexture(filtered, this.targets[1], this.targets[2], t.blur);
    }
    let glow: WebGLTexture | undefined;
    if (t.bloom > 0) {
      this.targets[4] ??= this.texture(this.width, this.height, undefined, true);
      this.targets[5] ??= this.texture(this.width, this.height);
      glow = this.blurTexture(filtered, this.targets[4], this.targets[5], Math.max(0.5, 4 * this.width / (noiseSize?.width ?? this.width)));
    }
    const program = this.programs[2];
    this.begin(program, filtered, readback ? this.targets[3] : null);
    const modes = ['none', 'left', 'right', 'top', 'bottom', 'center'];
    gl.uniform1i(gl.getUniformLocation(program, 'uMirror'), modes.indexOf(t.mirrorMode));
    gl.uniform3f(gl.getUniformLocation(program, 'uAdjust'), t.brightness / 100, t.contrast / 100, t.saturation / 100);
    gl.uniform4f(gl.getUniformLocation(program, 'uTone'), t.exposure, t.temperature / 100, t.tint / 100, t.vibrance / 100);
    gl.uniform1f(gl.getUniformLocation(program, 'uHue'), t.hueRotate);
    gl.uniform3i(gl.getUniformLocation(program, 'uEffects'), Number(t.grayscale), Number(t.invert), Number(t.sepia));
    gl.uniform1f(gl.getUniformLocation(program, 'uNoise'), t.noise);
    gl.uniform1ui(gl.getUniformLocation(program, 'uSeed'), seed >>> 0);
    gl.uniform2i(gl.getUniformLocation(program, 'uNoiseSize'), noiseSize?.width ?? this.width, noiseSize?.height ?? this.height);
    gl.uniform1i(gl.getUniformLocation(program, 'uGrade'), Math.max(0, colorGrades.indexOf(t.colorGrade)));
    gl.uniform1f(gl.getUniformLocation(program, 'uGradeStrength'), t.gradeStrength / 100);
    const dark = hexColor(t.duotoneDark), light = hexColor(t.duotoneLight);
    gl.uniform3f(gl.getUniformLocation(program, 'uDuoDark'), dark[0] / 255, dark[1] / 255, dark[2] / 255);
    gl.uniform3f(gl.getUniformLocation(program, 'uDuoLight'), light[0] / 255, light[1] / 255, light[2] / 255);
    gl.uniform1i(gl.getUniformLocation(program, 'uArt'), Math.max(0, gpuArtStyles.indexOf(t.artStyle)));
    gl.uniform1f(gl.getUniformLocation(program, 'uArtStrength'), t.artStrength / 100);
    gl.uniform4f(gl.getUniformLocation(program, 'uTexture'), t.vignette / 100, t.rgbSplit, t.halftone, t.scanlines / 100);
    gl.uniform1f(gl.getUniformLocation(program, 'uGlitch'), t.glitch);
    gl.uniform1f(gl.getUniformLocation(program, 'uBloomStrength'), t.bloom / 100);
    gl.uniform1i(gl.getUniformLocation(program, 'uBloom'), glow ? 1 : 0);
    if (glow) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, glow); }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.releaseTransient();
    if (gl.getError() !== gl.NO_ERROR) throw new Error('GPU rendering failed');
  }

  render(source: Raster, t: Transformations, seed: number, key: string, noiseSize?: { width:number; height:number }): ImageBitmap {
    this.draw(source, t, seed, key, false, noiseSize);
    return this.canvas.transferToImageBitmap();
  }

  renderRaster(source: Raster, t: Transformations, seed: number, key: string): Raster {
    this.draw(source, t, seed, key, true);
    const bytes = new Uint8Array(this.width * this.height * 4), data = new Uint8ClampedArray(bytes.length);
    this.gl.readPixels(0, 0, this.width, this.height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, bytes);
    if (this.gl.getError() !== this.gl.NO_ERROR) throw new Error('GPU pixel readback failed');
    const stride = this.width * 4;
    for (let y = 0; y < this.height; y++) data.set(bytes.subarray(y * stride, (y + 1) * stride), (this.height - y - 1) * stride);
    return { width:this.width, height:this.height, data };
  }

  clear() { this.sources.clear(); }
  private releaseTransient() { if (this.transient) { this.gl.deleteTexture(this.transient); this.transient = undefined; } }
  get lost() { return this.gl.isContextLost(); }
  dispose() {
    this.clear(); this.releaseTransient(); this.targets.forEach(texture => this.gl.deleteTexture(texture));
    this.programs.forEach(program => this.gl.deleteProgram(program));
    this.gl.deleteFramebuffer(this.framebuffer);
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
