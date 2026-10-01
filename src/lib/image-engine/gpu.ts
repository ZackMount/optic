import { ByteCache } from './cache';
import { gaussianKernel } from './pixels';
import { dimensions, type GpuInfo, type Raster, type Transformations } from './types';

const vertex = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const geometryShader = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uImage;
uniform ivec2 uSource;
uniform int uRotation;
uniform ivec2 uFlip;
uniform int uPixelate;
uniform ivec2 uSize;
out vec4 color;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  p = min(uSize - 1, (p / uPixelate) * uPixelate + uPixelate / 2);
  ivec2 q = p;
  if (uRotation == 90) q = ivec2(p.y, uSource.y - 1 - p.x);
  if (uRotation == 180) q = uSource - 1 - p;
  if (uRotation == 270) q = ivec2(uSource.x - 1 - p.y, p.x);
  if (uFlip.x == 1) q.x = uSource.x - 1 - q.x;
  if (uFlip.y == 1) q.y = uSource.y - 1 - q.y;
  color = texelFetch(uImage, q, 0);
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
const colorShader = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uImage;
uniform ivec2 uSize;
uniform int uMirror;
uniform vec3 uAdjust;
uniform float uHue;
uniform ivec3 uEffects;
uniform float uNoise;
uniform uint uSeed;
uniform ivec2 uNoiseSize;
out vec4 color;
vec3 rotateHue(vec3 c, float angle) {
  float high = max(c.r, max(c.g, c.b)), low = min(c.r, min(c.g, c.b));
  float d = high - low, l = (high + low) * 0.5;
  if (d == 0.0) return c;
  float s = d / (1.0 - abs(2.0 * l - 1.0));
  float h = high == c.r ? (c.g - c.b) / d : high == c.g ? (c.b - c.r) / d + 2.0 : (c.r - c.g) / d + 4.0;
  h = fract(h / 6.0 + angle / 360.0);
  float chroma = (1.0 - abs(2.0 * l - 1.0)) * s, v = h * 6.0;
  float x = chroma * (1.0 - abs(mod(v, 2.0) - 1.0));
  vec3 rgb = v < 1.0 ? vec3(chroma,x,0) : v < 2.0 ? vec3(x,chroma,0) : v < 3.0 ? vec3(0,chroma,x) : v < 4.0 ? vec3(0,x,chroma) : v < 5.0 ? vec3(x,0,chroma) : vec3(chroma,0,x);
  return rgb + l - chroma * 0.5;
}
float noise(uint p) {
  uint v = p ^ uSeed;
  v = (v ^ (v >> 16)) * 0x7feb352du;
  v = (v ^ (v >> 15)) * 0x846ca68bu;
  v ^= v >> 16;
  return float(v & 65535u) / 65535.0 - 0.5;
}
void main() {
  ivec2 p = ivec2(int(gl_FragCoord.x), uSize.y - 1 - int(gl_FragCoord.y));
  if ((uMirror == 1 || uMirror == 5) && p.x >= (uSize.x + 1) / 2) p.x = uSize.x - 1 - p.x;
  if (uMirror == 2 && p.x < uSize.x / 2) p.x = uSize.x - 1 - p.x;
  if ((uMirror == 3 || uMirror == 5) && p.y >= (uSize.y + 1) / 2) p.y = uSize.y - 1 - p.y;
  if (uMirror == 4 && p.y < uSize.y / 2) p.y = uSize.y - 1 - p.y;
  vec4 inputColor = texelFetch(uImage, p, 0);
  vec3 c = clamp(inputColor.rgb * uAdjust.x, 0.0, 1.0);
  c = clamp(c * uAdjust.y + (128.0 / 255.0) * (1.0 - uAdjust.y), 0.0, 1.0);
  float g = dot(c, vec3(0.299, 0.587, 0.114));
  c = clamp(vec3(g) + uAdjust.z * (c - g), 0.0, 1.0);
  if (uHue != 0.0) c = rotateHue(c, uHue);
  if (uEffects.x == 1) c = vec3(dot(c, vec3(0.299, 0.587, 0.114)));
  if (uEffects.y == 1) c = 1.0 - c;
  if (uEffects.z == 1) c = min(vec3(dot(c,vec3(0.393,0.769,0.189)),dot(c,vec3(0.349,0.686,0.168)),dot(c,vec3(0.272,0.534,0.131))), vec3(1));
  ivec2 noisePoint = ivec2(floor((vec2(p) + 0.5) * vec2(uNoiseSize) / vec2(uSize)));
  c = clamp(c + noise(uint(noisePoint.y * uNoiseSize.x + noisePoint.x)) * uNoise * 0.01, 0.0, 1.0);
  color = vec4(c, inputColor.a);
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

  private draw(source: Raster, t: Transformations, seed: number, key: string, readback: boolean, noiseSize?: { width:number; height:number }) {
    const gl = this.gl;
    this.releaseTransient();
    if (gl.isContextLost()) throw new Error('The WebGL context was lost');
    if (t.blur > 0 && !this.floatBuffers) throw new Error('This GPU does not support floating-point blur buffers');
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
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    let filtered = this.targets[0];
    if (t.blur > 0) {
      const program = this.programs[1], kernel = gaussianKernel(t.blur), weights = new Float32Array(121);
      weights.set(kernel.weights, 60 - kernel.radius);
      for (let horizontal = 1; horizontal >= 0; horizontal--) {
        this.begin(program, horizontal ? this.targets[0] : this.targets[1], horizontal ? this.targets[1] : this.targets[2]);
        gl.uniform1i(gl.getUniformLocation(program, 'uRadius'), kernel.radius);
        gl.uniform1fv(gl.getUniformLocation(program, 'uWeights[0]'), weights);
        gl.uniform1i(gl.getUniformLocation(program, 'uHorizontal'), horizontal);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      filtered = this.targets[2];
    }
    const program = this.programs[2];
    this.begin(program, filtered, readback ? this.targets[3] : null);
    const modes = ['none', 'left', 'right', 'top', 'bottom', 'center'];
    gl.uniform1i(gl.getUniformLocation(program, 'uMirror'), modes.indexOf(t.mirrorMode));
    gl.uniform3f(gl.getUniformLocation(program, 'uAdjust'), t.brightness / 100, t.contrast / 100, t.saturation / 100);
    gl.uniform1f(gl.getUniformLocation(program, 'uHue'), t.hueRotate);
    gl.uniform3i(gl.getUniformLocation(program, 'uEffects'), Number(t.grayscale), Number(t.invert), Number(t.sepia));
    gl.uniform1f(gl.getUniformLocation(program, 'uNoise'), t.noise);
    gl.uniform1ui(gl.getUniformLocation(program, 'uSeed'), seed >>> 0);
    gl.uniform2i(gl.getUniformLocation(program, 'uNoiseSize'), noiseSize?.width ?? this.width, noiseSize?.height ?? this.height);
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
