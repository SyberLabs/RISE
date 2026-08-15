/**
 * Apparitio — Spectral Plates.
 *
 * Engine extracted from apparitio (2).html. The wing, spine, crown,
 * sparkle, and develop math are unchanged. Chamber supplies seed and a
 * destination canvas in place of the demo chrome.
 */
import {
  APPARITIO_VOID_RGB,
  buildPlateOrderFromRgb,
  capturePlateData,
  chamberPlateQuality,
  fitPlateBlit,
  revealPlate
} from './plate-draw.js';

const VOID = '#0A0A0C';
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const smooth=(a,b,x)=>{let t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const fract=x=>x-Math.floor(x);
const lerp=(a,b,t)=>a+(b-a)*t;
const TAU=Math.PI*2;

function xmur3(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19;}return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);h^=h>>>16;return h>>>0;};}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const RAMPS={
  prism:[[0,[0,0,0]],[0.06,[0.9,0.95,1.0]],[0.16,[1.0,0.25,0.22]],[0.30,[1.0,0.55,0.12]],[0.44,[1.0,0.92,0.30]],[0.58,[0.35,0.92,0.45]],[0.72,[0.20,0.75,1.0]],[0.86,[0.35,0.35,0.95]],[0.95,[0.85,0.9,1.0]],[1,[1,1,1]]],
  marian:[[0,[0,0,0]],[0.08,[0.85,0.92,1.0]],[0.24,[0.20,0.45,1.0]],[0.42,[0.10,0.20,0.85]],[0.55,[0.9,0.95,1.0]],[0.70,[1.0,0.45,0.60]],[0.85,[1.0,0.80,0.88]],[1,[1,1,1]]],
  ember:[[0,[0,0,0]],[0.08,[1.0,0.95,0.85]],[0.24,[1.0,0.35,0.10]],[0.42,[0.85,0.12,0.08]],[0.58,[1.0,0.55,0.12]],[0.74,[1.0,0.85,0.35]],[0.9,[1.0,0.97,0.8]],[1,[1,1,1]]],
  holo:[[0,[0,0,0]],[0.07,[1,1,1]],[0.20,[0.55,0.95,1.0]],[0.34,[0.75,0.55,1.0]],[0.48,[1.0,0.55,0.90]],[0.62,[0.55,1.0,0.85]],[0.76,[0.60,0.70,1.0]],[0.9,[1,1,1]],[1,[1,1,1]]]
};
function buildLUT(anchors, sat, rot){
  rot = rot||0;
  const L=new Float32Array(256*3);
  for(let i=0;i<256;i++){
    const u=fract(i/255 + rot); let j=0;
    while(j<anchors.length-1 && u>anchors[j+1][0]) j++;
    const a=anchors[j], b=anchors[Math.min(j+1,anchors.length-1)];
    const span=(b[0]-a[0])||1, f=clamp((u-a[0])/span,0,1);
    let r=a[1][0]+(b[1][0]-a[1][0])*f, g=a[1][1]+(b[1][1]-a[1][1])*f, bl=a[1][2]+(b[1][2]-a[1][2])*f;
    const lum=0.299*r+0.587*g+0.114*bl;
    L[i*3]=lum+(r-lum)*sat; L[i*3+1]=lum+(g-lum)*sat; L[i*3+2]=lum+(bl-lum)*sat;
  }
  return L;
}
function lutRGB(LUT,u,out){ const idx=(clamp(u,0,0.9999)*255)|0, o=idx*3; out[0]=LUT[o];out[1]=LUT[o+1];out[2]=LUT[o+2]; }

function boxBlur3(buf,W,H,r){
  const tmp=new Float32Array(buf.length); const norm=1/(2*r+1);
  for(let y=0;y<H;y++){ let acc=0; const row=y*W;
    for(let k=-r;k<=r;k++) acc+=buf[row+clamp(k,0,W-1)];
    for(let x=0;x<W;x++){ tmp[row+x]=acc*norm; acc+=buf[row+clamp(x+r+1,0,W-1)]-buf[row+clamp(x-r,0,W-1)]; } }
  for(let x=0;x<W;x++){ let acc=0;
    for(let k=-r;k<=r;k++) acc+=tmp[clamp(k,0,H-1)*W+x];
    for(let y=0;y<H;y++){ buf[y*W+x]=acc*norm; acc+=tmp[clamp(y+r+1,0,H-1)*W+x]-tmp[clamp(y-r,0,H-1)*W+x]; } }
}

const Q_RES=[0,760,1000,1240,1500];
const SEED_WORDS=["SERAPH","LUMEN","ADVENT","GLORIA","AURORA","VESPER","STELLA","CANDOR","IGNIS","NIMBUS","ORACLE","VELUM","SANCTA","AXIS","EMPYREAN","THEOPHANY","ANGELUS","PLEROMA"];
function randomSeed(){
  const r=Math.random;
  return SEED_WORDS[(r()*SEED_WORDS.length)|0]+"-"+Math.floor(r()*9000+1000);
}

function coverBlit(ctx, canvas, src){
  fitPlateBlit(ctx, canvas, src, VOID);
}

export class Apparitio {
  constructor() {
    this.cur = null;
    this.plate = null;
    this.plateData = null;
    this.order = null;
    this.ready = false;
  }

  generate(signal, seed, options = {}) {
    const seedStr = seed == null ? randomSeed() : (String(seed).trim() || 'APPARITIO');
    const sr=mulberry32(xmur3(seedStr)());
    const form = {
      seed: seedStr,
      wings: options.wings != null ? +options.wings : [2,3,3,4,4,5,6][(sr()*7)|0],
      reach: options.reach != null ? +options.reach : (0.6+sr()*0.5),
      filigree: options.filigree != null ? +options.filigree : (0.4+sr()*1.1),
      crown: options.crown || 'auto',
      quality: options.quality != null ? +options.quality : chamberPlateQuality()
    };
    const look = {
      exposure: options.exposure != null ? +options.exposure : 1.6,
      gamma: options.gamma != null ? +options.gamma : 0.92,
      bloom: options.bloom != null ? +options.bloom : 0.8,
      sparkle: options.sparkle != null ? +options.sparkle : 0.7,
      hue: options.hue != null ? +options.hue : 0,
      sat: options.sat != null ? +options.sat : 0.92,
      chroma: options.chroma != null ? +options.chroma : 5,
      grain: options.grain != null ? +options.grain : 0.06,
      palette: options.palette || 'prism'
    };

    const res=Q_RES[form.quality] || Q_RES[1];
    const fW=res, fH=res;
    const accR=new Float32Array(res*res); const accG=new Float32Array(res*res); const accB=new Float32Array(res*res);
    const shR=new Float32Array(res*res); const shG=new Float32Array(res*res); const shB=new Float32Array(res*res);

    const seedRng=mulberry32(xmur3(form.seed)());
    let crown=form.crown;
    if(crown==="auto"){ crown=["rings","orb","eclipse","rings","orb"][(seedRng()*5)|0]; }
    const phase = seedRng();
    const cur={ seed:form.seed, wings:form.wings, reach:form.reach, filigree:form.filigree, crown, quality:form.quality,
          phase, flowSig:(seedRng()*1e4|0) };

    const cx=res*0.5;
    const yTop=res*0.10, yBot=res*0.94;
    let rampName=look.palette; if(!RAMPS[rampName]) rampName="prism";
    const LUT=buildLUT(RAMPS[rampName], clamp(look.sat,0,1), look.hue);
    const col=[0,0,0];

    function splatSoft(x,y,rad,r,g,b){
      const W=fW,H=fH;
      const x0=Math.max(0,(x-rad)|0), x1=Math.min(W-1,(x+rad)|0);
      const y0=Math.max(0,(y-rad)|0), y1=Math.min(H-1,(y+rad)|0);
      const inv=1/(rad*rad*0.5+1e-6);
      for(let yy=y0;yy<=y1;yy++){
        const dy=yy-y; const row=yy*W;
        for(let xx=x0;xx<=x1;xx++){
          const dx=xx-x; const d2=dx*dx+dy*dy;
          const w=Math.exp(-d2*inv);
          if(w<0.004) continue;
          const i=row+xx;
          accR[i]+=r*w; accG[i]+=g*w; accB[i]+=b*w;
        }
      }
    }
    function splatSharp(x,y,r,g,b,a){
      const W=fW,H=fH; const xi=x|0, yi=y|0;
      if(xi<1||yi<1||xi>=W-1||yi>=H-1) return;
      const i=yi*W+xi;
      shR[i]+=r*a; shG[i]+=g*a; shB[i]+=b*a;
      const s=a*0.28;
      shR[i-1]+=r*s;shG[i-1]+=g*s;shB[i-1]+=b*s;
      shR[i+1]+=r*s;shG[i+1]+=g*s;shB[i+1]+=b*s;
      shR[i-W]+=r*s;shG[i-W]+=g*s;shB[i-W]+=b*s;
      shR[i+W]+=r*s;shG[i+W]+=g*s;shB[i+W]+=b*s;
    }
    function splatStar(x,y,len,r,g,b,a){
      const W=fW,H=fH; const xi=x|0, yi=y|0;
      if(xi<0||yi<0||xi>=W||yi>=H) return;
      shR[yi*W+xi]+=r*a; shG[yi*W+xi]+=g*a; shB[yi*W+xi]+=b*a;
      for(let k=1;k<=len;k++){
        const f=a*(1-k/(len+1))*0.7;
        const pts=[[xi+k,yi],[xi-k,yi],[xi,yi+k],[xi,yi-k]];
        for(const [px,py] of pts){ if(px<0||py<0||px>=W||py>=H)continue; const i=py*W+px; shR[i]+=r*f;shG[i]+=g*f;shB[i]+=b*f; }
      }
    }

    function drawWing(anchorY, tilt, reachPx, widthPx, bandDir, wide){
      const N = wide ? 2200 : 1600;
      const M = wide ? 40 : 18;
      const softBrush = res*(wide?0.006:0.0026);
      const perInt = wide ? 0.05 : 0.11;
      for(let s=0;s<N;s++){
        const t=s/(N-1), theta=Math.PI*t, lobe=Math.sin(theta);
        let px=Math.sin(theta)*reachPx, py=(-Math.cos(theta))*reachPx*0.62;
        px+=Math.sin(theta*2)*reachPx*0.10; py+=-Math.sin(theta)*reachPx*0.16;
        const ct=Math.cos(tilt), st=Math.sin(tilt);
        const wx=px*ct-py*st, wy=anchorY+px*st+py*ct;
        const taper=smooth(0,0.10,t)*smooth(0,0.14,1-t);
        const nx=Math.cos(tilt+Math.PI/2), ny=Math.sin(tilt+Math.PI/2);
        const halfW=widthPx*lobe*0.5;
        for(let bi=0;bi<M;bi++){
          const bf=bi/(M-1);
          const band = bf<0.16 ? bf/0.16*0.06 : 0.06+(bf-0.16)/0.84*0.82;
          const u=clamp((bandDir>0?band:1-band)+phase*0.12,0,0.999);
          lutRGB(LUT,u,col);
          const off=(bf-0.5)*2*halfW;
          const sx=cx+wx+nx*off, sy=wy+ny*off;
          const inten=perInt*taper;
          splatSoft(sx,sy,softBrush, col[0]*inten,col[1]*inten,col[2]*inten);
          splatSoft(fW-1-sx,sy,softBrush, col[0]*inten,col[1]*inten,col[2]*inten);
        }
      }
    }

    const jobs=[];
    const nWings=form.wings;
    const upper=Math.ceil(nWings/2), lower=nWings-upper;
    const wideLobes = seedRng()<0.5;
    jobs.push(()=>{
      for(let w=0; w<upper; w++){
        const anchorY = res*0.48 - w*res*0.020;
        const tilt = -0.60 - w*0.30;
        const reach = res*(0.17 + 0.05*w) * (0.92+0.12*form.reach);
        drawWing(anchorY, tilt, reach, res*(wideLobes?0.06:0.035), +1, wideLobes && w<2);
      }
    });
    if(lower>0) jobs.push(()=>{
      for(let w=0; w<lower; w++){
        const anchorY = res*0.66 + w*res*0.024;
        const tilt = -Math.PI + 0.55 + w*0.30;
        const reach = res*(0.17 + 0.05*w) * (0.92+0.12*form.reach);
        drawWing(anchorY, tilt, reach, res*(wideLobes?0.05:0.03), -1, wideLobes && w<1);
      }
    });

    if(form.filigree>0){
      jobs.push(()=>{
        const fr=mulberry32(xmur3(form.seed+"|spine")());
        const bandW=res*(0.055+0.03*fr());
        const kBase = 2 + (fr()*4|0);
        const nNodes = (8 + (fr()*6|0));
        const yA = yTop + (yBot-yTop)*0.06, yB = yTop + (yBot-yTop)*0.78;
        const spanY = yB - yA;
        const detail = clamp(form.filigree,0,1.6);
        for(let nd=0; nd<nNodes; nd++){
          const ty = nd/(nNodes-1);
          const cy = yA + ty*spanY;
          const env = Math.sin(Math.PI*ty);
          const scale = bandW*(0.22 + 0.95*env) * (0.7+0.6*fr());
          const kk = kBase + (nd%2);
          const rot = fr()*TAU;
          const steps = (150 + 160*detail)|0;
          const u = clamp(0.03 + fract(0.5+0.11*nd)*0.10 + phase*0.1, 0, 0.999);
          lutRGB(LUT,u,col);
          const tintR=0.72+0.28*col[0], tintG=0.80+0.20*col[1], tintB=0.9+0.1*col[2];
          const a=0.42*(0.5+0.5*env);
          for(let s=0;s<steps;s++){
            const th=s/steps*TAU;
            const rr=Math.cos(kk*th)*scale;
            const lx=Math.cos(th+rot)*rr, ly=Math.sin(th+rot)*rr;
            splatSharp(cx+lx, cy+ly, tintR,tintG,tintB, a);
            splatSharp(cx-lx, cy+ly, tintR,tintG,tintB, a);
          }
          splatSharp(cx, cy, 1,1,1, 0.55*env);
        }
      });
    }

    if(look.sparkle>0){
      jobs.push(()=>{
        const sparkRng=mulberry32(xmur3(form.seed+"|spark")());
        const round = sparkRng()<0.5;
        const arcs = 3 + (sparkRng()*3|0);
        const perArc = (26 + 46*look.sparkle)|0;
        const topY = res*0.14;
        for(let ai=0; ai<arcs; ai++){
          const arcR = res*(0.15 + 0.11*ai + sparkRng()*0.04);
          const y0 = topY + res*(0.02 + 0.06*ai);
          const spanA = lerp(0.7, 1.5, ai/arcs);
          const jitter = res*0.012;
          for(let s=0; s<perArc; s++){
            const th = lerp(-spanA, spanA, s/(perArc-1));
            const ex = Math.sin(th)*arcR + (sparkRng()-0.5)*jitter;
            const ey = y0 - Math.cos(th)*arcR*0.32 + (sparkRng()-0.5)*jitter;
            const sx = cx + ex, sy = Math.max(res*0.035, ey);
            if(sy<0||sy>fH) continue;
            const u = clamp(fract(0.15+0.2*ai+phase),0,0.999); lutRGB(LUT,u,col);
            const mag = 0.45+0.55*sparkRng();
            if(round){
              splatSoft(sx,sy, res*0.0035*mag, col[0]*0.4,col[1]*0.4,col[2]*0.4);
              splatSharp(sx,sy, 0.9,0.92,1.0, 0.55*mag);
            }else{
              const len=(2+4*mag)|0;
              splatStar(sx,sy,len, 0.95,0.97,1.0, 0.5*mag);
            }
          }
        }
        const tips=(18+30*look.sparkle)|0;
        for(let i=0;i<tips;i++){
          const t=sparkRng(); const theta=Math.PI*t;
          const reachPx=res*0.17*(0.92+0.12*form.reach);
          let px=Math.sin(theta)*reachPx, py=(-Math.cos(theta))*reachPx*0.62;
          const tilt=-0.7; const ct=Math.cos(tilt),st=Math.sin(tilt);
          const wx=px*ct-py*st, wy=res*0.48+px*st+py*ct;
          const sx=cx+wx, sy=wy;
          const mag=0.4+0.5*sparkRng();
          if(round){ splatSharp(sx,sy,0.9,0.93,1.0,0.5*mag); splatSharp(fW-1-sx,sy,0.9,0.93,1.0,0.5*mag); }
          else { splatStar(sx,sy,(2+3*mag)|0,0.95,0.97,1.0,0.45*mag); splatStar(fW-1-sx,sy,(2+3*mag)|0,0.95,0.97,1.0,0.45*mag); }
        }
      });
    }

    jobs.push(()=>{
      const topY=res*0.14;
      if(crown==="none") return;
      if(crown==="orb"){
        for(let ring=0;ring<40;ring++){ const rad=res*0.012*(1+ring*0.12); const a=Math.exp(-ring*0.16)*0.6;
          splatSoft(cx,topY,rad, a,a,a); }
      }else if(crown==="rings"){
        const rad0=res*0.032; const bands=26;
        for(let bi=0;bi<bands;bi++){ const u=bi/bands; lutRGB(LUT,clamp(u,0,0.999),col);
          const rr=rad0*(0.5+u*1.3); const steps=(rr*3)|0;
          for(let s=0;s<steps;s++){ const th=s/steps*TAU; const x=cx+Math.cos(th)*rr, y=topY+Math.sin(th)*rr;
            splatSoft(x,y,res*0.006, col[0]*0.5,col[1]*0.5,col[2]*0.5); } }
        splatSoft(cx,topY,res*0.02, 0.8,0.85,0.95);
      }else if(crown==="eclipse"){
        const rr=res*0.045; const steps=(rr*4)|0;
        for(let s=0;s<steps;s++){ const th=s/steps*TAU; const x=cx+Math.cos(th)*rr, y=topY+Math.sin(th)*rr;
          splatSoft(x,y,res*0.010, 0.7,0.82,1.0); splatSharp(x,y,0.9,0.95,1.0,0.5); }
      }
    });

    for (const job of jobs) job();

    boxBlur3(accR,fW,fH,1); boxBlur3(accG,fW,fH,1); boxBlur3(accB,fW,fH,1);
    this.cur = cur;
    this.look = look;
    this.fW = fW;
    this.fH = fH;
    this.accR = accR; this.accG = accG; this.accB = accB;
    this.shR = shR; this.shG = shG; this.shB = shB;
    this.glowW=fW>>2; this.glowH=fH>>2; this.glowSmall=new Float32Array(this.glowW*this.glowH);
    this.ready = true;
    this.plate = this._developPlate();
    this.plateData = capturePlateData(this.plate, this.fW, this.fH);
    this.order = buildPlateOrderFromRgb(
      this.accR, this.accG, this.accB, this.shR, this.shG, this.shB,
      this.fW, this.fH, 'axis'
    );
    this._plateScratch = null;
    return true;
  }

  _developPlate(){
    if(!this.accR || typeof document === 'undefined') return null;
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
    const accR=this.accR, accG=this.accG, accB=this.accB;
    const shR=this.shR, shG=this.shG, shB=this.shB;
    const glowSmall=this.glowSmall, glowW=this.glowW, glowH=this.glowH;
    const exp=look.exposure*1.35, gm=look.gamma;
    const baseR=new Float32Array(N), baseG=new Float32Array(N), baseB=new Float32Array(N);
    glowSmall.fill(0);
    for(let i=0;i<N;i++){
      let r=(accR[i]+shR[i]*1.3)*exp, g=(accG[i]+shG[i]*1.3)*exp, b=(accB[i]+shB[i]*1.3)*exp;
      r=r/(1+r); g=g/(1+g); b=b/(1+b);
      r=Math.pow(r,gm); g=Math.pow(g,gm); b=Math.pow(b,gm);
      baseR[i]=r; baseG[i]=g; baseB[i]=b;
      const lum=0.299*r+0.587*g+0.114*b;
      if(lum>0.5){ const gs=(lum-0.5)/0.5; const gx=(i%W)>>2, gy=((i/W)|0)>>2; glowSmall[gy*glowW+gx]+=gs*gs; }
    }

    if(look.bloom>0){
      boxBlur3(glowSmall,glowW,glowH,3); boxBlur3(glowSmall,glowW,glowH,3);
      let gmx=1e-6; for(let i=0;i<glowSmall.length;i++){ if(glowSmall[i]>gmx)gmx=glowSmall[i]; }
      const gi=1/gmx; for(let i=0;i<glowSmall.length;i++) glowSmall[i]*=gi;
    }

    const img=ctx.createImageData(W,H);
    const data=img.data;
    const cxp=W/2, cyp=H/2, maxR=Math.hypot(cxp,cyp);
    const ca=look.chroma, bloom=look.bloom, grain=look.grain;
    const gW=glowW,gH=glowH;
    const grnd=mulberry32(xmur3(this.cur.seed+"|grain")());
    const GT=4096, gtab=new Float32Array(GT); for(let i=0;i<GT;i++) gtab[i]=grnd()-0.5;

    function sampBloom(x,y){
      const gx=x/4, gy=y/4; let x0=gx|0,y0=gy|0; const fx=gx-x0,fy=gy-y0;
      let x1=x0+1<gW?x0+1:x0, y1=y0+1<gH?y0+1:y0; if(x0<0)x0=0; if(y0<0)y0=0;
      const a=glowSmall[y0*gW+x0],b=glowSmall[y0*gW+x1],c=glowSmall[y1*gW+x0],e=glowSmall[y1*gW+x1];
      return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+e*fx)*fy;
    }
    function samp(buf,x,y){ if(x<0)x=0;else if(x>=W)x=W-1; if(y<0)y=0;else if(y>=H)y=H-1; return buf[(y|0)*W+(x|0)]; }

    let gi=0;
    for(let y=0;y<H;y++){
      const dy=y-cyp;
      for(let x=0;x<W;x++){
        const i=y*W+x; const dx=x-cxp;
        const hyp=Math.hypot(dx,dy)||1; const rr=hyp/maxR;
        const off=ca*rr*rr; const ux=dx/hyp, uy=dy/hyp;
        let R= ca>0 ? samp(baseR, x+ux*off, y+uy*off) : baseR[i];
        let G= baseG[i];
        let B= ca>0 ? samp(baseB, x-ux*off, y-uy*off) : baseB[i];
        if(bloom>0){ const gl=sampBloom(x,y)*bloom;
          R=1-(1-R)*(1-gl); G=1-(1-G)*(1-gl*0.97); B=1-(1-B)*(1-gl*0.9); }
        const vig=1 - 0.42*rr*rr*rr;
        R*=vig; G*=vig; B*=vig;
        if(grain>0){ const n=gtab[(gi++)&(GT-1)]*grain; R+=n; G+=n; B+=n; }
        const o=i*4;
        data[o]=clamp(R,0,1)*255; data[o+1]=clamp(G,0,1)*255; data[o+2]=clamp(B,0,1)*255; data[o+3]=255;
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
        paperRgb: APPARITIO_VOID_RGB,
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
