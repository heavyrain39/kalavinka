// Copyright (C) 2026 Yakshawan. SPDX-License-Identifier: AGPL-3.0-or-later
// Mastermind's expanded spectral point cloud and drifting snow, on the existing output analyser.
import { random } from './seed';
interface Star { x: number; y: number; z: number; inner: boolean; frequency: number; spread: number }
interface Flake { x: number; y: number; depth: number; phase: number; speed: number }
export class Starfield {
  private context: CanvasRenderingContext2D;
  private points: Star[] = [];
  private flakes: Flake[] = [];
  private spectrum = new Uint8Array(1024);
  private detail = new Float32Array(50);
  private bands = [0, 0, 0];
  private last = 0;
  private angle = 0;
  private drift = 0;
  private frames = 0;
  private visible = 0;
  private expansion = 1;
  private radius = 0;
  private sprite = document.createElement('canvas');
  constructor(private canvas: HTMLCanvasElement) {
    this.context = canvas.getContext('2d')!;
    for (const [count, inner] of [[300, false], [100, true]] as const) {
      for (let i = 0; i < count; i++) {
        const z = 1 - 2 * (i + .5) / count, radius = Math.sqrt(1 - z*z);
        const theta = i * Math.PI * (3 - Math.sqrt(5));
        this.points.push({x: Math.cos(theta)*radius, y: Math.sin(theta)*radius, z, inner,
          frequency: Math.floor(Math.abs(z)*49), spread: .52 + random('STARFIELD',`${inner}:${i}`)*.64});
      }
    }
    for(let i=0;i<80;i++)this.flakes.push({x:random('SNOW',`x${i}`),y:random('SNOW',`y${i}`),
      depth:random('SNOW',`z${i}`),phase:random('SNOW',`p${i}`)*Math.PI*2,speed:.012+random('SNOW',`v${i}`)*.023});
    this.sprite.width = this.sprite.height = 24;
    const ctx = this.sprite.getContext('2d')!, gradient = ctx.createRadialGradient(12,12,0,12,12,12);
    const color = getComputedStyle(document.documentElement).getPropertyValue('--star-rgb').trim();
    gradient.addColorStop(0,`rgba(${color},1)`); gradient.addColorStop(.22,`rgba(${color},.85)`); gradient.addColorStop(1,`rgba(${color},0)`);
    ctx.fillStyle=gradient; ctx.fillRect(0,0,24,24);
  }
  draw(time: number, analyser: AnalyserNode | null, reducedMotion: boolean) {
    const width=this.canvas.clientWidth, height=this.canvas.clientHeight;
    if(!width||!height) { this.last=time; return; }
    const dt=Math.min(.1, Math.max(0,(time-this.last)/1000)); this.last=time;
    const targets=[0,0,0], detailed=new Float32Array(50);
    if(analyser&&!reducedMotion) {
      // Like Mastermind: use dB-scaled FFT magnitudes, so normal listening volume
      // still drives the cloud. Actual silence produces zero, never a simulated beat.
      analyser.getByteFrequencyData(this.spectrum);
      const binHz=analyser.context.sampleRate/analyser.fftSize;
      const mean=(lo:number,hi:number)=>{
        const begin=Math.max(1,Math.floor(lo/binHz)),end=Math.min(this.spectrum.length,Math.max(begin+1,Math.ceil(hi/binHz)));
        let sum=0;for(let i=begin;i<end;i++)sum+=this.spectrum[i];
        return sum/(Math.max(1,end-begin)*255);
      };
      [[30,220],[220,2200],[2200,12000]].forEach(([lo,hi],i)=>{targets[i]=mean(lo,hi)*1.5;});
      for(let i=0;i<50;i++)detailed[i]=mean(30*400**(i/50),30*400**((i+1)/50))*1.5;
    }
    const smooth=(current:number,target:number)=>current+(target-current)*(1-Math.exp(-dt/(target>current?.035:.20)));
    for(let i=0;i<3;i++)this.bands[i]=reducedMotion?0:smooth(this.bands[i],targets[i]);
    for(let i=0;i<50;i++)this.detail[i]=reducedMotion?0:smooth(this.detail[i],detailed[i]);
    if(!reducedMotion){this.angle+=dt*(.15+this.bands[0]*.65);this.drift+=dt;}
    const dpr=Math.min(devicePixelRatio,2);
    if(this.canvas.width!==Math.round(width*dpr)||this.canvas.height!==Math.round(height*dpr)){
      this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);
    }
    const ctx=this.context;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    const color=getComputedStyle(document.documentElement).getPropertyValue('--star-rgb').trim();
    ctx.fillStyle=`rgb(${color})`;
    // The camera sits inside a much larger, radially dispersed cloud. Its outline
    // extends beyond the card even at rest, instead of presenting a complete ball.
    const radius=Math.max(width*.66,height*.95), tilt=Math.sin(this.drift*.25)*.25;
    this.radius=radius;this.expansion=1+this.bands[0]*.35;this.visible=0;
    const cos=Math.cos(this.angle),sin=Math.sin(this.angle),cx=width/2,cy=height/2;
    const projected=this.points.map(p=>{
      const x=p.x*cos-p.z*sin,z=p.x*sin+p.z*cos;
      const y=p.y*Math.cos(tilt)-z*Math.sin(tilt),depth=p.y*Math.sin(tilt)+z*Math.cos(tilt);
      const response=this.detail[p.frequency];
      const r=radius*p.spread*(p.inner?.65:1)*(this.expansion+response*(p.inner?1.2:.8));
      const perspective=3.4/(3.4-depth);
      return{x:cx+x*r*perspective,y:cy+y*r*perspective,depth,response,inner:p.inner,perspective};
    }).sort((a,b)=>a.depth-b.depth);
    const dot=(x:number,y:number,size:number,alpha:number)=>{
      if(x<0||x>width||y<0||y>height)return;
      this.visible++;ctx.globalAlpha=alpha;ctx.drawImage(this.sprite,x-size/2,y-size/2,size,size);
      // A crisp subpixel core keeps the smaller snow grains legible.
      ctx.beginPath();ctx.arc(x,y,size*.17,0,Math.PI*2);ctx.fill();
    };
    for(const p of projected){
      const alpha=Math.min(.95,.25+(p.depth+1)*.24+p.response*.16);
      const size=Math.min(2.2,(p.inner?1.15:1.65)*p.perspective);
      dot(p.x,p.y,size,alpha);
    }
    // Mastermind's independent snow layer, spread across the whole viewport.
    // Audio changes travel distance and speed, not the size of individual grains.
    for(const f of this.flakes){
      const sway=Math.sin(this.angle*.5+f.phase)*(.04+this.bands[1]*.12);
      const x=((f.x+sway+2)%1)*width;
      const y=((f.y+this.drift*f.speed+Math.sin(this.angle+f.phase)*this.bands[0]*.09+2)%1)*height;
      dot(x,y,1+f.depth*.9,.34+f.depth*.48);
    }
    ctx.globalAlpha=1;this.frames++;
  }
  diagnostics(){return {bands:[...this.bands],frames:this.frames,points:this.points.length,snow:this.flakes.length,
    visiblePoints:this.visible,baseRadius:this.radius,expansion:this.expansion,maxParticleSize:2.2};}
}
