import { warpGLSL } from './creative';

export const geometryShader = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uImage;
uniform ivec2 uSource;
uniform int uRotation;
uniform ivec2 uFlip;
uniform int uPixelate;
uniform ivec2 uSize;
uniform vec4 uWarp;
out vec4 color;
${warpGLSL}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  p = min(uSize - 1, (p / uPixelate) * uPixelate + uPixelate / 2);
  if (any(notEqual(uWarp, vec4(0)))) {
    vec2 q = warpPoint(vec2(p));
    if (uRotation == 90) q = vec2(q.y, float(uSource.y) - 1.0 - q.x);
    if (uRotation == 180) q = vec2(uSource) - 1.0 - q;
    if (uRotation == 270) q = vec2(float(uSource.x) - 1.0 - q.y, q.x);
    if (uFlip.x == 1) q.x = float(uSource.x) - 1.0 - q.x;
    if (uFlip.y == 1) q.y = float(uSource.y) - 1.0 - q.y;
    color = sampleSource(q);
  } else {
    ivec2 q = p;
    if (uRotation == 90) q = ivec2(p.y, uSource.y - 1 - p.x);
    if (uRotation == 180) q = uSource - 1 - p;
    if (uRotation == 270) q = ivec2(uSource.x - 1 - p.y, p.x);
    if (uFlip.x == 1) q.x = uSource.x - 1 - q.x;
    if (uFlip.y == 1) q.y = uSource.y - 1 - q.y;
    color = texelFetch(uImage, q, 0);
  }
}`;

export const colorShader = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uImage;
uniform sampler2D uBloom;
uniform ivec2 uSize;
uniform int uMirror;
uniform vec3 uAdjust;
uniform vec4 uTone;
uniform float uHue;
uniform ivec3 uEffects;
uniform float uNoise;
uniform uint uSeed;
uniform ivec2 uNoiseSize;
uniform int uGrade;
uniform float uGradeStrength;
uniform vec3 uDuoDark;
uniform vec3 uDuoLight;
uniform int uArt;
uniform float uArtStrength;
uniform vec4 uTexture;
uniform float uBloomStrength;
uniform float uGlitch;
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
vec4 rawAt(ivec2 p) {
  if (any(lessThan(p,ivec2(0))) || any(greaterThanEqual(p,uSize))) return vec4(0);
  return texelFetch(uImage,p,0);
}
vec4 sampleAt(vec2 point) {
  ivec2 p = ivec2(floor(point)); vec2 f = fract(point);
  vec4 a = rawAt(p), b = rawAt(p+ivec2(1,0)), c = rawAt(p+ivec2(0,1)), d = rawAt(p+ivec2(1,1));
  a.rgb*=a.a; b.rgb*=b.a; c.rgb*=c.a; d.rgb*=d.a;
  vec4 value=mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
  if(value.a>0.0)value.rgb/=value.a;
  return value;
}
vec3 adjustColor(vec3 inputColor) {
  vec3 c=clamp(inputColor*uAdjust.x*exp2(uTone.x),0.0,1.0);
  c=clamp(c*uAdjust.y+(128.0/255.0)*(1.0-uAdjust.y),0.0,1.0);
  float gray=dot(c,vec3(0.299,0.587,0.114));
  c=clamp(vec3(gray)+uAdjust.z*(c-gray),0.0,1.0);
  if(uHue!=0.0)c=rotateHue(c,uHue);
  c=clamp(c*vec3(1.0+uTone.y*0.18+uTone.z*0.04,1.0-uTone.z*0.12,1.0-uTone.y*0.18+uTone.z*0.04),0.0,1.0);
  float saturation=max(c.r,max(c.g,c.b))-min(c.r,min(c.g,c.b));
  float amount=1.0+uTone.w*(uTone.w>0.0?1.0-saturation:1.0);
  gray=dot(c,vec3(0.299,0.587,0.114));
  c=clamp(vec3(gray)+(c-gray)*amount,0.0,1.0);
  if(uEffects.x==1)c=vec3(dot(c,vec3(0.299,0.587,0.114)));
  if(uEffects.y==1)c=1.0-c;
  if(uEffects.z==1)c=min(vec3(dot(c,vec3(0.393,0.769,0.189)),dot(c,vec3(0.349,0.686,0.168)),dot(c,vec3(0.272,0.534,0.131))),vec3(1));
  return c;
}
vec3 gradeColor(vec3 c) {
  float light=dot(c,vec3(0.299,0.587,0.114)); vec3 result=c;
  if(uGrade==1)result=mix(uDuoDark,uDuoLight,light);
  if(uGrade==2)result=mix(vec3(8,32,62)/255.0,vec3(242,245,218)/255.0,pow(light,0.9));
  if(uGrade==3){
    vec3 colors[5]=vec3[5](vec3(23,5,51),vec3(64,20,204),vec3(255,20,56),vec3(255,184,5),vec3(255,255,224));
    float position=min(3.9999,light*4.0); int i=int(floor(position));
    result=mix(colors[i],colors[i+1],fract(position))/255.0;
  }
  if(uGrade==4){
    vec3 colors[4]=vec3[4](vec3(13,48,28),vec3(51,97,61),vec3(140,171,77),vec3(204,219,128));
    result=colors[min(3,int(floor(light*4.0)))]/255.0;
  }
  if(uGrade==5){
    vec3 muted=mix(vec3(light),c,0.75);
    result=clamp(pow(muted,vec3(0.9,0.95,1.08))*vec3(1.03,1.0,0.9)+vec3(10,5,8)/255.0,0.0,1.0);
  }
  if(uGrade==6)result=clamp(vec3(pow(c.r,0.8),pow(c.g,1.08),c.b*0.8+26.0/255.0),0.0,1.0);
  return mix(c,result,uGradeStrength);
}
float lightAt(ivec2 p) {vec4 value=rawAt(p);return dot(adjustColor(value.rgb),vec3(0.299,0.587,0.114))*value.a;}
float edgeAt(ivec2 p) {
  float tl=lightAt(p+ivec2(-1,-1)),tc=lightAt(p+ivec2(0,-1)),tr=lightAt(p+ivec2(1,-1));
  float ml=lightAt(p+ivec2(-1,0)),mr=lightAt(p+ivec2(1,0));
  float bl=lightAt(p+ivec2(-1,1)),bc=lightAt(p+ivec2(0,1)),br=lightAt(p+ivec2(1,1));
  return min(1.0,length(vec2(tr+2.0*mr+br-tl-2.0*ml-bl,bl+2.0*bc+br-tl-2.0*tc-tr)));
}
void main() {
  ivec2 screen=ivec2(int(gl_FragCoord.x),uSize.y-1-int(gl_FragCoord.y));
  vec2 point=(vec2(screen)+0.5)*vec2(uNoiseSize)/vec2(uSize)-0.5;
  ivec2 p=screen;
  int band=int(floor((point.y+0.5)/24.0));
  if(uGlitch>0.0 && noise(uint(band))>0.25)p.x+=int(floor(noise(uint(band+17))*uGlitch*0.005*float(uSize.x)+0.5));
  if((uMirror==1||uMirror==5)&&p.x>=(uSize.x+1)/2)p.x=uSize.x-1-p.x;
  if(uMirror==2&&p.x<uSize.x/2)p.x=uSize.x-1-p.x;
  if((uMirror==3||uMirror==5)&&p.y>=(uSize.y+1)/2)p.y=uSize.y-1-p.y;
  if(uMirror==4&&p.y<uSize.y/2)p.y=uSize.y-1-p.y;
  vec4 inputColor=rawAt(p);vec3 c=adjustColor(inputColor.rgb);
  if(uTexture.y>0.0)c=vec3(adjustColor(sampleAt(vec2(p)+vec2(uTexture.y,0)).rgb).r,c.g,adjustColor(sampleAt(vec2(p)-vec2(uTexture.y,0)).rgb).b);
  c=gradeColor(c);
  if(uArt>0){
    float edge=edgeAt(p);vec3 result=c;
    if(uArt==1)result=clamp(c*0.035+edge*vec3(760,980,1020)/255.0,0.0,1.0);
    if(uArt==2){
      float grid=mod(point.x+0.5,24.0)<1.2||mod(point.y+0.5,24.0)<1.2?0.08:0.0;
      result=mix(vec3(9,31,71)/255.0,vec3(191,237,255)/255.0,min(1.0,edge*5.0+grid));
    }
    if(uArt==3)result=floor(c*5.0+0.5)/5.0*(1.0-smoothstep(0.12,0.4,edge*3.0)*0.85);
    c=mix(c,result,uArtStrength);
  }
  if(uBloomStrength>0.0){
    vec3 bloom=adjustColor(texelFetch(uBloom,clamp(p,ivec2(0),uSize-1),0).rgb);
    c=clamp(c+max(vec3(0),bloom-0.55)*uBloomStrength*1.5,0.0,1.0);
  }
  float factor=1.0;
  vec2 centered=(point+0.5)/vec2(uNoiseSize)-0.5;
  if(uTexture.x>0.0)factor*=1.0-uTexture.x*0.85*smoothstep(0.12,0.7,length(centered));
  if(uTexture.w>0.0 && int(floor(point.y))%3==1)factor*=1.0-uTexture.w*0.65;
  if(uTexture.z>0.0){
    float size=max(2.0,uTexture.z),radius=0.5*sqrt(max(0.0,1.0-dot(c,vec3(0.299,0.587,0.114))));
    vec2 cell=(mod(point,vec2(size))+0.5)/size-0.5;
    float ink=1.0-smoothstep(radius-0.03,radius+0.03,length(cell));
    c=mix(vec3(245,241,225)/255.0,c,ink);
  }
  c*=factor;
  ivec2 noisePoint=ivec2(floor((vec2(p)+0.5)*vec2(uNoiseSize)/vec2(uSize)));
  c=clamp(c+noise(uint(noisePoint.y*uNoiseSize.x+noisePoint.x))*uNoise*0.01,0.0,1.0);
  color=vec4(c,inputColor.a);
}`;
