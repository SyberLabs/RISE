/**
 * Ostensoria — Iris Plates.
 *
 * Engine extracted from ostensoria.html. The attractor, density field,
 * develop, and look math are unchanged. Chamber supplies seed and a
 * destination canvas in place of the demo chrome.
 */
import {
  buildPlateOrder,
  capturePlateData,
  chamberPlateQuality,
  fitPlateBlit,
  OSTENSORIA_PAPER_RGB,
  revealPlate
} from './plate-draw.js';
import { measureFieldVoid, VOID_FRACTION_LIMIT } from './ostensoria-coverage.js';

const VOID = '#0A0A0C';

function xmur3(str){ let h=1779033703^str.length;
  for(let i=0;i<str.length;i++){ h=Math.imul(h^str.charCodeAt(i),3432918353); h=h<<13|h>>>19; }
  return function(){ h=Math.imul(h^h>>>16,2246822507); h=Math.imul(h^h>>>13,3266489909); h^=h>>>16; return h>>>0; };
}
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const smooth=(a,b,x)=>{ let t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
const fract=x=>x-Math.floor(x);
function hsv2rgb(h,s,v,out){
  h=fract(h)*6; const i=Math.floor(h), f=h-i;
  const p=v*(1-s), q=v*(1-f*s), t=v*(1-(1-f)*s);
  switch(i%6){
    case 0: out[0]=v;out[1]=t;out[2]=p;break;
    case 1: out[0]=q;out[1]=v;out[2]=p;break;
    case 2: out[0]=p;out[1]=v;out[2]=t;break;
    case 3: out[0]=p;out[1]=q;out[2]=v;break;
    case 4: out[0]=t;out[1]=p;out[2]=v;break;
    default:out[0]=v;out[1]=p;out[2]=q;break;
  }
}

const RAMPS={
  iris:[[0,[0,0,0]],[0.10,[0.13,0.05,0.55]],[0.27,[0.85,0.10,0.20]],[0.44,[1.0,0.45,0.06]],[0.59,[1.0,0.86,0.20]],[0.71,[0.45,0.90,0.40]],[0.83,[0.15,0.70,1.0]],[0.93,[0.45,0.30,0.90]],[1,[0,0,0]]],
  reliquary:[[0,[0,0,0]],[0.18,[0.10,0.20,0.85]],[0.40,[0.55,0.80,1.0]],[0.50,[1,1,1]],[0.60,[1.0,0.80,0.40]],[0.80,[0.75,0.45,0.10]],[1,[0,0,0]]],
  ember:[[0,[0,0,0]],[0.20,[0.55,0.05,0.10]],[0.42,[0.95,0.20,0.05]],[0.60,[1.0,0.55,0.10]],[0.76,[1.0,0.85,0.35]],[0.88,[1,1,0.85]],[1,[0,0,0]]],
  ice:[[0,[0,0,0]],[0.22,[0.10,0.25,0.75]],[0.45,[0.20,0.65,1.0]],[0.62,[0.55,0.90,1.0]],[0.78,[0.90,0.98,1.0]],[0.90,[1,1,1]],[1,[0,0,0]]],
  verdant:[[0,[0,0,0]],[0.16,[0.05,0.22,0.10]],[0.36,[0.10,0.55,0.20]],[0.54,[0.45,0.80,0.25]],[0.70,[0.80,0.95,0.45]],[0.85,[0.97,1.0,0.80]],[1,[0,0,0]]],
  lilac:[[0,[0,0,0]],[0.16,[0.20,0.12,0.38]],[0.36,[0.45,0.35,0.80]],[0.54,[0.65,0.55,0.95]],[0.70,[0.82,0.75,1.0]],[0.86,[0.95,0.92,1.0]],[1,[0,0,0]]],
  teal:[[0,[0,0,0]],[0.16,[0.02,0.22,0.24]],[0.36,[0.05,0.55,0.55]],[0.54,[0.20,0.80,0.75]],[0.70,[0.55,0.95,0.88]],[0.86,[0.90,1.0,0.97]],[1,[0,0,0]]],
  sepia:[[0,[0,0,0]],[0.18,[0.25,0.15,0.08]],[0.40,[0.55,0.38,0.20]],[0.58,[0.80,0.62,0.40]],[0.76,[0.95,0.85,0.68]],[0.90,[1.0,0.98,0.92]],[1,[0,0,0]]],
  peacock:[[0,[0,0,0]],[0.14,[0.05,0.20,0.15]],[0.32,[0.05,0.50,0.45]],[0.50,[0.10,0.55,0.85]],[0.66,[0.35,0.80,0.90]],[0.82,[0.75,0.95,0.85]],[0.92,[0.97,1.0,0.95]],[1,[0,0,0]]]
};
const PALETTES={
  iris:{hue:0.0,bands:1.4,sat:0.95},
  reliquary:{hue:0.0,bands:1.1,sat:0.85},
  ember:{hue:0.0,bands:1.5,sat:0.95},
  ice:{hue:0.0,bands:1.2,sat:0.85},
  verdant:{hue:0.0,bands:1.3,sat:0.90},
  lilac:{hue:0.0,bands:1.25,sat:0.85},
  teal:{hue:0.0,bands:1.3,sat:0.88},
  sepia:{hue:0.0,bands:1.1,sat:0.80},
  peacock:{hue:0.0,bands:1.3,sat:0.90},
  custom:{hue:0.0,bands:1.6,sat:0.95}
};
function buildLUT(anchors, sat){
  const L=new Float32Array(256*3);
  for(let i=0;i<256;i++){
    const u=i/255; let j=0;
    while(j<anchors.length-1 && u>anchors[j+1][0]) j++;
    const a=anchors[j], b=anchors[Math.min(j+1,anchors.length-1)];
    const span=(b[0]-a[0])||1, f=clamp((u-a[0])/span,0,1);
    let r=a[1][0]+(b[1][0]-a[1][0])*f, g=a[1][1]+(b[1][1]-a[1][1])*f, bl=a[1][2]+(b[1][2]-a[1][2])*f;
    const lum=0.299*r+0.587*g+0.114*bl;
    L[i*3]=lum+(r-lum)*sat; L[i*3+1]=lum+(g-lum)*sat; L[i*3+2]=lum+(bl-lum)*sat;
  }
  return L;
}

function makeAttractor(kind, rnd){
  const R=(a,b)=>a+(b-a)*rnd();
  if(kind==="clifford"){
    const a=R(-2,2),b=R(-2,2),c=R(-2,2),d=R(-2,2);
    return {name:"Clifford", coeff:[a,b,c,d], step:(x,y,o)=>{ o[0]=Math.sin(a*y)+c*Math.cos(a*x); o[1]=Math.sin(b*x)+d*Math.cos(b*y); }};
  }
  if(kind==="dejong"){
    const a=R(-3,3),b=R(-3,3),c=R(-3,3),d=R(-3,3);
    return {name:"De Jong", coeff:[a,b,c,d], step:(x,y,o)=>{ o[0]=Math.sin(a*y)-Math.cos(b*x); o[1]=Math.sin(c*x)-Math.cos(d*y); }};
  }
  if(kind==="svensson"){
    const a=R(-3,3),b=R(-3,3),c=R(-3,3),d=R(-3,3);
    return {name:"Svensson", coeff:[a,b,c,d], step:(x,y,o)=>{ o[0]=d*Math.sin(a*x)-Math.sin(b*y); o[1]=c*Math.cos(a*x)+Math.cos(b*y); }};
  }
  const a=R(-3,3),b=R(-3,3),c=R(-1.5,1.5),d=R(-1.5,1.5);
  return {name:"Fractal dream", coeff:[a,b,c,d], step:(x,y,o)=>{ o[0]=Math.sin(y*b)+c*Math.sin(x*b); o[1]=Math.sin(x*a)+d*Math.sin(y*a); }};
}

function qualifyAttractor(attr, rnd){
  const o=[0,0], oe=[0,0];
  let x=rnd()*2-1, y=rnd()*2-1;
  for(let i=0;i<600;i++){ attr.step(x,y,o); x=o[0]; y=o[1]; if(!isFinite(x)||!isFinite(y)) return {ok:false}; }
  const d0=1e-6; let xe=x+d0, ye=y, sum=0, n=0;
  let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9;
  for(let i=0;i<8000;i++){
    attr.step(x,y,o); attr.step(xe,ye,oe); x=o[0]; y=o[1];
    if(!isFinite(x)||!isFinite(y)) return {ok:false};
    if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y;
    let dx=oe[0]-x, dy=oe[1]-y, dist=Math.hypot(dx,dy);
    if(dist===0){ xe=x+d0; ye=y; continue; }
    sum+=Math.log(dist/d0); n++;
    xe=x + d0*dx/dist; ye=y + d0*dy/dist;
  }
  const lyap=sum/Math.max(n,1);
  const ok = isFinite(lyap) && lyap>0.04 && Math.max(maxx-minx,maxy-miny)>0.4 && (maxx-minx)>0.08 && (maxy-miny)>0.08;
  return {ok, lyap, minx, maxx, miny, maxy, x, y};
}

function fallbackAttractor(kind){
  const sets={clifford:[-1.4,1.6,1.0,0.7], dejong:[1.641,1.902,0.316,1.525], svensson:[1.5,-1.8,1.6,0.9], fractal:[-0.966918,2.879879,0.765145,0.744728]};
  const c=sets[kind]||sets.clifford; const a=c[0],b=c[1],cc=c[2],d=c[3];
  if(kind==="dejong")  return {name:"De Jong", coeff:c, step:(x,y,o)=>{ o[0]=Math.sin(a*y)-Math.cos(b*x); o[1]=Math.sin(cc*x)-Math.cos(d*y); }};
  if(kind==="svensson")return {name:"Svensson",coeff:c, step:(x,y,o)=>{ o[0]=d*Math.sin(a*x)-Math.sin(b*y); o[1]=cc*Math.cos(a*x)+Math.cos(b*y); }};
  if(kind==="fractal") return {name:"Fractal dream", coeff:c, step:(x,y,o)=>{ o[0]=Math.sin(y*b)+cc*Math.sin(x*b); o[1]=Math.sin(x*a)+d*Math.sin(y*a); }};
  return {name:"Clifford", coeff:c, step:(x,y,o)=>{ o[0]=Math.sin(a*y)+cc*Math.cos(a*x); o[1]=Math.sin(b*x)+d*Math.cos(b*y); }};
}

function boxBlur(buf,W,H,r){
  const tmp=new Float32Array(buf.length);
  const norm=1/(2*r+1);
  for(let y=0;y<H;y++){
    let acc=0; const row=y*W;
    for(let k=-r;k<=r;k++) acc+=buf[row+clamp(k,0,W-1)];
    for(let x=0;x<W;x++){
      tmp[row+x]=acc*norm;
      const add=buf[row+clamp(x+r+1,0,W-1)], sub=buf[row+clamp(x-r,0,W-1)];
      acc+=add-sub;
    }
  }
  for(let x=0;x<W;x++){
    let acc=0;
    for(let k=-r;k<=r;k++) acc+=tmp[clamp(k,0,H-1)*W+x];
    for(let y=0;y<H;y++){
      buf[y*W+x]=acc*norm;
      const add=tmp[clamp(y+r+1,0,H-1)*W+x], sub=tmp[clamp(y-r,0,H-1)*W+x];
      acc+=add-sub;
    }
  }
}

const QUALITY_RES=[0,760,1000,1200,1440];
const QUALITY_SPLATS=[0,2.2e6,4.2e6,7.5e6,1.2e7];
const paper=[10/255,10/255,12/255];
const SEED_WORDS=["CRISTO","REX","LUX","VERBUM","ROSA","STELLA","AVE","SPES","VIA","CORPUS","IGNIS","AURORA","NOX","EIDOLON","SIGNUM","VELUM","ARCA","SOL"];
function randomSeed(){
  const r=Math.random;
  return SEED_WORDS[(r()*SEED_WORDS.length)|0]+"-"+Math.floor(r()*9000+1000);
}

function coverBlit(ctx, canvas, src){
  fitPlateBlit(ctx, canvas, src, VOID);
}

export const OSTENSORIA_SPARSE_TRIES = 12;

export class Ostensoria {
  constructor() {
    this.cur = null;
    this.plate = null;
    this.plateData = null;
    this.order = null;
    this.ready = false;
    this.coverage = null;
    this.queue = [];
    this.maxQueueSize = 3;
    this._destroyed = false;
    this._fillPromise = null;
    this._generation = 0;
  }

  /**
   * Bake a plate, then discard it if the field is ≥95% void and roll a
   * new seed. An omitted seed is a fresh random plate each try. A pinned
   * seed retries as `seed:v1`, `seed:v2`, … so catalog takes stay
   * reproducible. Pass `acceptSparse` to keep a blank (the coverage probe).
   */
  generate(signal, seed, options = {}) {
    const acceptSparse = options.acceptSparse === true;
    const maxTries = Number.isFinite(Number(options.maxSparseTries))
      ? Math.max(1, Number(options.maxSparseTries))
      : OSTENSORIA_SPARSE_TRIES;
    const pinned = seed == null ? null : (String(seed).trim() || 'OSTENSORIA');
    let current = pinned;
    for (let attempt = 0; attempt < maxTries; attempt++) {
      this._bake(signal, current, options);
      const coverage = measureFieldVoid(this.fieldDev, this.fMax);
      this.coverage = coverage;
      this.acceptedSeed = this.cur?.seed ?? current;
      if (acceptSparse || coverage.voidFraction < VOID_FRACTION_LIMIT) return true;
      current = pinned == null ? null : `${pinned}:v${attempt + 1}`;
    }
    return true;
  }

  isReady() {
    return this.queue.length > 0;
  }

  beginSession() {
    this._generation++;
    this.queue = [];
  }

  async preload(count) {
    const target = Math.min(Math.max(1, count | 0), this.maxQueueSize);
    await this.fillQueue(target);
  }

  async fillQueue(targetCount) {
    if (this._destroyed) return;
    const generation = this._generation;
    const target = Math.min(Math.max(1, targetCount | 0), this.maxQueueSize);
    if (this._fillPromise) {
      await this._fillPromise.catch(() => {});
      if (!this._destroyed && this.queue.length < target) return this.fillQueue(target);
      return;
    }
    this._fillPromise = (async () => {
      while (!this._destroyed && generation === this._generation && this.queue.length < target) {
        const plate = new Ostensoria();
        plate.generate(null, undefined);
        if (generation === this._generation && !this._destroyed) this.queue.push(plate);
        await new Promise(r => setTimeout(r, 50));
      }
    })();
    try {
      await this._fillPromise;
    } finally {
      this._fillPromise = null;
    }
  }

  takePlate() {
    const item = this.queue.shift();
    if (!item) {
      this.fillQueue(this.maxQueueSize);
      return false;
    }
    this._adopt(item);
    if (this.queue.length < 2) this.fillQueue(this.maxQueueSize);
    return true;
  }

  _adopt(src) {
    this.cur = src.cur;
    this.look = src.look;
    this.coverage = src.coverage;
    this.acceptedSeed = src.acceptedSeed;
    this.fieldDev = src.fieldDev;
    this.fW = src.fW;
    this.fH = src.fH;
    this.fMax = src.fMax;
    this.plate = src.plate;
    this.plateData = src.plateData;
    this.order = src.order;
    this.ready = src.ready;
    this.baseR = src.baseR;
    this.baseG = src.baseG;
    this.baseB = src.baseB;
    this.glowW = src.glowW;
    this.glowH = src.glowH;
    this.glowSmall = src.glowSmall;
    this._plateScratch = src._plateScratch;
  }

  destroy() {
    this._destroyed = true;
    this._generation++;
    this.queue = [];
  }

  /**
   * @param {Object} [signal]
   * @param {string|number} [seed]
   * @param {Object} [options] original form/look knobs; quality defaults
   *   to Chamber-adaptive (never HTML draft 760)
   */
  _bake(signal, seed, options = {}) {
    const seedStr = seed == null ? randomSeed() : (String(seed).trim() || 'OSTENSORIA');
    const sr = mulberry32(xmur3(seedStr)());
    const orders = [1,2,2,2,4,4,6,8,12];
    const form = {
      seed: seedStr,
      family: options.family || 'auto',
      order: options.order != null ? +options.order : orders[(sr()*orders.length)|0],
      mirror: options.mirror != null ? !!options.mirror : sr()>0.12,
      quality: options.quality != null ? +options.quality : chamberPlateQuality()
    };
    const rolledPalette = sr() < 0.5 ? 'reliquary' : 'ice';
    const palette = RAMPS[options.palette] ? options.palette : rolledPalette;
    const preset = PALETTES[palette] || PALETTES.reliquary;
    const look = {
      exposure: options.exposure != null ? +options.exposure : 2.1,
      gamma: options.gamma != null ? +options.gamma : 0.9,
      bloom: options.bloom != null ? +options.bloom : 0.6,
      hue: options.hue != null ? +options.hue : preset.hue,
      bands: options.bands != null ? +options.bands : preset.bands,
      sat: options.sat != null ? +options.sat : preset.sat,
      chroma: options.chroma != null ? +options.chroma : 2.2,
      grain: options.grain != null ? +options.grain : 0.05,
      palette
    };

    const seedRng=mulberry32(xmur3(form.seed)());
    let kind=form.family;
    if(kind==="auto"){ const fams=["clifford","dejong","svensson","fractal"]; kind=fams[Math.floor(seedRng()*fams.length)]; }
    let attr=null, qual=null, tries=0;
    while(tries<48){
      const cand=makeAttractor(kind, seedRng);
      const q=qualifyAttractor(cand, seedRng);
      if(q.ok){ attr=cand; qual=q; break; }
      tries++;
    }
    if(!attr){ attr=fallbackAttractor(kind); qual=qualifyAttractor(attr, seedRng); }

    const res=QUALITY_RES[form.quality] || QUALITY_RES[1];
    const fW=res, fH=res;
    const field=new Float32Array(res*res);
    const order=clamp(form.order,1,12);
    const rots=[];
    for(let k=0;k<order;k++){ const a=2*Math.PI*k/order; rots.push([Math.cos(a),Math.sin(a)]); }
    const mirror=form.mirror;
    const cur={ seed:form.seed, family:attr.name, kind, order, mirror, quality:form.quality,
          palette: look.palette, coeff:attr.coeff, res, phase:seedRng() };

    let x=qual.x, y=qual.y;
    const o=[0,0];
    const cx0=(qual.minx+qual.maxx)/2, cy0=(qual.miny+qual.maxy)/2;
    const span=Math.max(qual.maxx-qual.minx, qual.maxy-qual.miny, 0.5)/2;
    const target=res*0.40;
    const scale=target/span;
    const ccx=res/2, ccy=res/2;
    const copies=order*(mirror?2:1);
    const totalSplats=QUALITY_SPLATS[form.quality] || QUALITY_SPLATS[1];
    const iters=Math.max(50000, Math.floor(totalSplats/copies));
    const F=field, W=res;
    for(let i=0;i<iters;i++){
      attr.step(x,y,o); x=o[0]; y=o[1];
      const px=(x-cx0)*scale, py=(y-cy0)*scale;
      for(let k=0;k<rots.length;k++){
        const cr=rots[k][0], sr=rots[k][1];
        let ax=px*cr - py*sr, ay=px*sr + py*cr;
        let sx=(ccx+ax)|0, sy=(ccy+ay)|0;
        if(sx>=0&&sx<W&&sy>=0&&sy<W) F[sy*W+sx]+=1;
        if(mirror){
          sx=(ccx-ax)|0;
          if(sx>=0&&sx<W&&sy>=0&&sy<W) F[sy*W+sx]+=1;
        }
      }
    }

    const fieldDev=Float32Array.from(field);
    boxBlur(fieldDev,fW,fH,1);
    let m=1;
    for(let i=0;i<fieldDev.length;i++){ if(fieldDev[i]>m)m=fieldDev[i]; }
    this.cur = cur;
    this.look = look;
    this.fieldDev = fieldDev;
    this.fW = fW;
    this.fH = fH;
    this.fMax = m;
    this.baseR=new Float32Array(fW*fH); this.baseG=new Float32Array(fW*fH); this.baseB=new Float32Array(fW*fH);
    this.glowW=fW>>2; this.glowH=fH>>2; this.glowSmall=new Float32Array(this.glowW*this.glowH);
    this.ready = true;
    this.plate = this._developPlate();
    this.plateData = capturePlateData(this.plate, this.fW, this.fH);
    this.order = buildPlateOrder(this.fieldDev, this.fW, this.fH, 'radial');
    this._plateScratch = null;
    return true;
  }

  _developPlate(){
    if(!this.fieldDev || typeof document === 'undefined') return null;
    const plate = document.createElement('canvas');
    plate.width = this.fW;
    plate.height = this.fH;
    const ctx = plate.getContext && plate.getContext('2d');
    if(!ctx?.createImageData) return null;
    this._develop(ctx);
    return plate;
  }

  _develop(ctx){
    const look=this.look;
    const W=this.fW,H=this.fH,N=W*H;
    const fieldDev=this.fieldDev, fMax=this.fMax, cur=this.cur;
    const baseR=this.baseR, baseG=this.baseG, baseB=this.baseB, glowSmall=this.glowSmall;
    const glowW=this.glowW, glowH=this.glowH;
    const logMax=Math.log(1+fMax*look.exposure);
    const gm=look.gamma;
    const bands=look.bands, phaseHue=look.hue + cur.phase*0.27, sat=look.sat;
    let rampName=look.palette; if(!RAMPS[rampName]) rampName="iris";
    const LUT=buildLUT(RAMPS[rampName], clamp(sat,0,1));

    glowSmall.fill(0);
    for(let i=0;i<N;i++){
      const d=fieldDev[i];
      let t = d>0 ? Math.log(1+d*look.exposure)/logMax : 0;
      t = Math.pow(clamp(t,0,1), gm);
      const u = fract(t*bands + phaseHue);
      const idx=(u*255)|0, o3=idx*3;
      let r=LUT[o3], g=LUT[o3+1], b=LUT[o3+2];
      const env = smooth(0.0,0.11,t);
      const hot = smooth(0.80,1.0,t);
      r*=env; g*=env; b*=env;
      r=r+(1-r)*hot; g=g+(1-g)*hot; b=b+(1-b)*hot;
      const cov = smooth(0.0,0.02,t);
      const ir=1-cov;
      baseR[i]=paper[0]*ir + r*cov;
      baseG[i]=paper[1]*ir + g*cov;
      baseB[i]=paper[2]*ir + b*cov;
      const gsrc = t>0.6 ? Math.pow((t-0.6)/0.4,2) : 0;
      if(gsrc>0){ const gx=(i%W)>>2, gy=((i/W)|0)>>2; glowSmall[gy*glowW+gx]+=gsrc; }
    }

    if(look.bloom>0){
      boxBlur(glowSmall,glowW,glowH,3);
      boxBlur(glowSmall,glowW,glowH,3);
      let gm2=1e-6; for(let i=0;i<glowSmall.length;i++){ if(glowSmall[i]>gm2)gm2=glowSmall[i]; }
      const gInv=1/gm2;
      for(let i=0;i<glowSmall.length;i++) glowSmall[i]*=gInv;
    }

    const img=ctx.createImageData(W,H);
    const data=img.data;
    const cxp=W/2, cyp=H/2, maxR=Math.hypot(cxp,cyp);
    const ca=look.chroma, bloom=look.bloom, grain=look.grain;
    const gW=glowW, gH=glowH;
    const grnd=mulberry32(xmur3(cur.seed+"|grain")());
    const GT=4096, gtab=new Float32Array(GT);
    for(let i=0;i<GT;i++) gtab[i]=(grnd()-0.5);

    function sampleBloom(x,y){
      const gx=x/4, gy=y/4;
      let x0=gx|0, y0=gy|0; const fx=gx-x0, fy=gy-y0;
      let x1=x0+1<gW?x0+1:x0, y1=y0+1<gH?y0+1:y0;
      if(x0<0)x0=0; if(y0<0)y0=0;
      const a=glowSmall[y0*gW+x0], b=glowSmall[y0*gW+x1], c=glowSmall[y1*gW+x0], e=glowSmall[y1*gW+x1];
      return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+e*fx)*fy;
    }
    function samp(buf,x,y){
      if(x<0)x=0; else if(x>=W)x=W-1;
      if(y<0)y=0; else if(y>=H)y=H-1;
      return buf[(y|0)*W+(x|0)];
    }

    let gi=0;
    for(let y=0;y<H;y++){
      const dy=y-cyp;
      for(let x=0;x<W;x++){
        const i=y*W+x;
        const dx=x-cxp;
        const rr=Math.hypot(dx,dy)/maxR;
        const off=ca*rr*rr;
        const ux=dx/(Math.hypot(dx,dy)||1), uy=dy/(Math.hypot(dx,dy)||1);
        let R = ca>0 ? samp(baseR, x+ux*off, y+uy*off) : baseR[i];
        let G = baseG[i];
        let B = ca>0 ? samp(baseB, x-ux*off, y-uy*off) : baseB[i];
        if(bloom>0){
          const gl=sampleBloom(x,y)*bloom;
          R=1-(1-R)*(1-gl*1.0);
          G=1-(1-G)*(1-gl*0.96);
          B=1-(1-B)*(1-gl*0.85);
        }
        const vig=1 - 0.10*rr*rr;
        R*=vig; G*=vig; B*=vig;
        if(grain>0){
          const n=gtab[(gi++)&(GT-1)]*grain;
          R+=n; G+=n; B+=n;
        }
        const o=i*4;
        data[o]  =clamp(R,0,1)*255;
        data[o+1]=clamp(G,0,1)*255;
        data[o+2]=clamp(B,0,1)*255;
        data[o+3]=255;
      }
    }
    ctx.putImageData(img,0,0);
  }

  render(canvas, options = {}) {
    if (!this.ready || !canvas) return false;
    const progress = options.progress == null ? 1 : options.progress;
    if (this.order && this.plateData && progress < 1) {
      const spec = {
        plate: this.plate,
        plateData: this.plateData,
        order: this.order,
        width: this.fW,
        height: this.fH,
        progress,
        paperRgb: OSTENSORIA_PAPER_RGB,
        scratch: this._plateScratch
      };
      const ok = revealPlate(canvas, spec);
      this._plateScratch = spec.scratch;
      return ok;
    }
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return false;
    if (this.plate) {
      coverBlit(ctx, canvas, this.plate);
      return true;
    }
    if (ctx.createImageData) {
      this._develop(ctx);
      return true;
    }
    return false;
  }
}

void hsv2rgb;
