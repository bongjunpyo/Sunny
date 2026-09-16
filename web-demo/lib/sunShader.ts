// 태양 셰이더(GLSL). Three.js 예제와 React Three Fiber 예제가 같은 코드를 쓴다.
// uTime: 시간(초), uHeat: 자외선 세기 0~1

// Simplex noise 3D — Ashima Arts / Stefan Gustavson (MIT)
const noise = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){
  float f=0.0;
  float a=0.5;
  for(int i=0;i<5;i++){ f+=a*snoise(p); p*=2.02; a*=0.5; }
  return f;
}
`;

export const sunVertex = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vPos;
void main(){
  vPos = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

// 태양 표면: 끓는 듯한 쌀알무늬 + 가장자리 어두워짐(주연감광)
export const sunFragment = /* glsl */ `
uniform float uTime;
uniform float uHeat;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vPos;
${noise}
void main(){
  vec3 p = normalize(vPos);
  float t = uTime * 0.06;
  float cells = fbm(p * 3.0 + vec3(t, -t * 0.7, t * 0.4));
  float fine = fbm(p * 9.0 - vec3(t * 1.6));
  float n = cells * 0.7 + fine * 0.3;

  float mu = clamp(dot(vNormal, vView), 0.0, 1.0);
  float limb = pow(mu, 0.45);

  vec3 deep = vec3(0.55, 0.12, 0.02);
  vec3 mid  = vec3(1.0, 0.45, 0.08);
  vec3 hot  = vec3(1.0, 0.86, 0.55);
  float k = clamp(0.5 + n * 0.9, 0.0, 1.0);
  vec3 col = mix(deep, mid, smoothstep(0.0, 0.6, k));
  col = mix(col, hot, smoothstep(0.55, 1.0, k));
  col *= limb * (0.6 + uHeat * 1.4);
  col += hot * pow(1.0 - mu, 3.0) * 0.25 * uHeat;

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// 코로나: 태양보다 큰 구의 뒷면만 그려서 가장자리 빛 번짐을 만든다
export const coronaFragment = /* glsl */ `
uniform float uTime;
uniform float uHeat;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vPos;
${noise}
void main(){
  float d = dot(vNormal, vView);
  float glow = pow(clamp(-d, 0.0, 1.0), 3.0);
  float flicker = 0.75 + 0.25 * snoise(normalize(vPos) * 3.0 + vec3(0.0, 0.0, uTime * 0.15));
  float strength = glow * flicker * (0.35 + uHeat * 1.25);
  vec3 col = mix(vec3(1.0, 0.35, 0.08), vec3(1.0, 0.8, 0.45), glow);
  gl_FragColor = vec4(col * strength, strength);
  #include <colorspace_fragment>
}
`;

export const SUN_RADIUS = 1.5;
export const CORONA_RADIUS = SUN_RADIUS * 1.9;
