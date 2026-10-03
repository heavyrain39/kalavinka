// Copyright (C) 2026 Yakshawan. SPDX-License-Identifier: AGPL-3.0-or-later
// Mastermind's golden-angle point sphere, adapted to WORKSONG's existing output analyser.
import { random } from './seed';
interface Star { x: number; y: number; z: number; inner: boolean; band: number }
export class Starfield {
  private context: CanvasRenderingContext2D;
  private points: Star[] = [];
  private spectrum = new Float32Array(1024);
  private bands = [0, 0, 0];
  private last = 0;
  private angle = 0;
  private frames = 0;
  private sprite = document.createElement('canvas');
  constructor(private canvas: HTMLCanvasElement) {
    this.context = canvas.getContext('2d')!;
    for (const [count, inner] of [[220, false], [60, true]] as const) {
      for (let i = 0; i < count; i++) {
        const z = 1 - 2 * (i + .5) / count, radius = Math.sqrt(1 - z*z);
        const theta = i * Math.PI * (3 - Math.sqrt(5));
        this.points.push({x: Math.cos(theta)*radius, y: Math.sin(theta)*radius, z, inner, band: i%3});
      }
    }
    this.sprite.width = this.sprite.height = 24;
    const ctx = this.sprite.getContext('2d')!, gradient = ctx.createRadialGradient(12,12,0,12,12,12);
    const color = getComputedStyle(document.documentElement).getPropertyValue('--star-rgb').trim();
    gradient.addColorStop(0,`rgba(${color},1)`); gradient.addColorStop(.2,`rgba(${color},.65)`); gradient.addColorStop(1,`rgba(${color},0)`);
    ctx.fillStyle=gradient; ctx.fillRect(0,0,24,24);
  }
  draw(time: number, analyser: AnalyserNode | null, reducedMotion: boolean) {
    const width=this.canvas.clientWidth, height=this.canvas.clientHeight;
    if(!width||!height) { this.last=time; return; }
    const dt=Math.min(.1, Math.max(0,(time-this.last)/1000)); this.last=time;
    const targets=[0,0,0];
    if(analyser&&!reducedMotion) {
      analyser.getFloatFrequencyData(this.spectrum);
      const binHz=analyser.context.sampleRate/analyser.fftSize;
      const limits=[[30,220],[220,2200],[2200,12000]];
      limits.forEach(([lo,hi],band)=>{
        const begin=Math.max(1,Math.ceil(lo/binHz)), end=Math.min(this.spectrum.length,Math.floor(hi/binHz));
        let power=0;
        for(let i=begin;i<end;i++)power+=10**(this.spectrum[i]/10);
        targets[band]=Math.min(1,Math.sqrt(power/Math.max(1,end-begin))*[18,30,60][band]);
      });
    }
    for(let i=0;i<3;i++)this.bands[i]+=(targets[i]-this.bands[i])*(1-Math.exp(-dt/(targets[i]>this.bands[i]?.06:.32)));
    if(reducedMotion)this.bands.fill(0);
    if(!reducedMotion)this.angle+=dt*(.065+this.bands[0]*.055);
    const dpr=Math.min(devicePixelRatio,2);
    if(this.canvas.width!==Math.round(width*dpr)||this.canvas.height!==Math.round(height*dpr)){
      this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);
    }
    const ctx=this.context;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    const color=getComputedStyle(document.documentElement).getPropertyValue('--star-rgb').trim();
    ctx.fillStyle=`rgb(${color})`;
    // A sparse distant field adds depth; its drift is independent of the audio response.
    for(let i=0;i<36;i++){
      const x=(random('STARFIELD',`x${i}`)*width+(reducedMotion?0:this.angle*9))%width;
      const y=random('STARFIELD',`y${i}`)*height;
      ctx.globalAlpha=.15+random('STARFIELD',`a${i}`)*.24;
      ctx.fillRect(x,y,i%7===0?1.2:.7,i%7===0?1.2:.7);
    }
    const radius=Math.min(width*.43,height*.39), tilt=.22;
    const cos=Math.cos(this.angle),sin=Math.sin(this.angle), cx=width/2,cy=height/2;
    const projected=this.points.map(p=>{
      const x=p.x*cos-p.z*sin,z=p.x*sin+p.z*cos;
      const y=p.y*Math.cos(tilt)-z*Math.sin(tilt),depth=p.y*Math.sin(tilt)+z*Math.cos(tilt);
      const response=this.bands[p.band], r=radius*(p.inner?.60:1)*(1+response*.18);
      const perspective=3.4/(3.4-depth);
      return{x:cx+x*r*perspective,y:cy+y*r*perspective,depth,response,inner:p.inner,perspective};
    }).sort((a,b)=>a.depth-b.depth);
    for(const p of projected){
      ctx.globalAlpha=Math.min(.95,(.24+(p.depth+1)*.24+p.response*.25)*(p.inner?.65:1));
      const size=(p.inner?2.2:3.1)*p.perspective*(1+p.response*.45);
      ctx.drawImage(this.sprite,p.x-size/2,p.y-size/2,size,size);
    }
    ctx.globalAlpha=1;this.frames++;
  }
  diagnostics(){ return {bands:[...this.bands],frames:this.frames,points:this.points.length}; }
}
