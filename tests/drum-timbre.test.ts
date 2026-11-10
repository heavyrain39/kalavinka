import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderDrum,DRUM_KITS} from '../src/drum-bank';

// v0.41.0: the snare is a struck head under rattling wires and the hats are noise ringing
// through inharmonic resonances. These tests hold the properties that were measured when the
// sounds were rebuilt; the numbers of the old sounds are in docs/DRUM_TIMBRE_V041.md.
const RATE=48000,MODES=['house','dnb'] as const;

function power(data:Float32Array,from:number,size:number) {
 const re=new Float64Array(size),im=new Float64Array(size);
 for(let i=0;i<size;i++)re[i]=(data[from+i]??0)*(.5-.5*Math.cos(2*Math.PI*i/size));
 for(let i=1,j=0;i<size;i++){let bit=size>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){const t=re[i];re[i]=re[j];re[j]=t;}}
 for(let len=2;len<=size;len<<=1){const angle=-2*Math.PI/len;for(let i=0;i<size;i+=len)for(let k=0;k<len/2;k++){
  const c=Math.cos(angle*k),s=Math.sin(angle*k),a=i+k,b=a+len/2,xr=re[b]*c-im[b]*s,xi=re[b]*s+im[b]*c;re[b]=re[a]-xr;im[b]=im[a]-xi;re[a]+=xr;im[a]+=xi;}}
 const out=new Float64Array(size/2);for(let i=0;i<size/2;i++)out[i]=re[i]*re[i]+im[i]*im[i];return out;
}
const band=(p:Float64Array,low:number,high:number)=>{const size=p.length*2;let sum=0;for(let i=Math.ceil(low*size/RATE);i<high*size/RATE;i++)sum+=p[i];return sum;};
const centroid=(p:Float64Array)=>{let a=0,b=0;for(let i=1;i<p.length;i++){a+=p[i]*i*RATE/(p.length*2);b+=p[i];}return a/b;};
/** Share of the energy between low and high that sits in the strongest three bins. */
const line=(p:Float64Array,low:number,high:number)=>{const size=p.length*2;let best=0;for(let i=Math.ceil(low*size/RATE);i<high*size/RATE;i++)best=Math.max(best,p[i-1]+p[i]+p[i+1]);return best/band(p,low,high);};
const rms=(data:Float32Array)=>Math.sqrt(data.reduce((a,x)=>a+x*x,0)/data.length);

test('the snare is a head under wires: neither a steady tone nor a bare noise burst',()=>{
 for(const kit of DRUM_KITS)for(const mode of MODES) {
  const p=power(renderDrum(RATE,kit,mode,'snare',1,0),0,16384),wires=band(p,1500,9000)/band(p,120,320);
  // Until v0.40 the head's sine held 53–80% of the energy and the wires sat 3–13 dB under it.
  assert.ok(line(p,120,300)*band(p,120,300)/band(p,20,20000)<.45,`${kit}/${mode}: one line holds the snare`);
  assert.ok(wires>.7&&wires<8,`${kit}/${mode}: wires against head ${wires}`);
 }
});

test('a soft snare stroke is darker than a hard one',()=>{
 for(const kit of DRUM_KITS)for(const mode of MODES) {
  const hard=centroid(power(renderDrum(RATE,kit,mode,'snare',1,0),0,16384)),soft=centroid(power(renderDrum(RATE,kit,mode,'snare',.3,0),0,16384));
  assert.ok(soft<hard*.9,`${kit}/${mode}: ${soft} against ${hard}`);
 }
});

test('the four kits have four snares',()=>{
 for(const mode of MODES) {
  const tone=(kit:(typeof DRUM_KITS)[number])=>centroid(power(renderDrum(RATE,kit,mode,'snare',1,0),0,16384));
  const length=(kit:(typeof DRUM_KITS)[number])=>{const data=renderDrum(RATE,kit,mode,'snare',1,0);let peak=0,last=0;
   for(let i=0;i<data.length;i++)peak=Math.max(peak,Math.abs(data[i]));for(let i=0;i<data.length;i++)if(Math.abs(data[i])>peak*.1)last=i;return last/RATE;};
  assert.ok(tone('r-click')>tone('r-electro')*1.3,'the minimal snare is the bright, dry one');
  assert.ok(length('r-click')<length('r-electro')*.8,'the minimal snare is shorter than the electro snare');
  assert.ok(length('r-brush')>length('r-click'),'the brush snare outlasts the minimal one');
 }
});

test('open and half-open hats hiss: no partial rings through the decay',()=>{
 for(const kit of DRUM_KITS)for(const mode of MODES)for(const velocity of [.3,1])for(const variant of [0,1]) {
  // Until v0.40 the tape, electro and minimal open hats held 4.5–9% of their tail in one sine.
  const open=line(power(renderDrum(RATE,kit,mode,'open',velocity,variant),RATE*.02,8192),3000,16000);
  assert.ok(open<.042,`${kit}/${mode}/open ${velocity}/${variant}: ${open}`);
  const half=line(power(renderDrum(RATE,kit,mode,'half',velocity,variant),RATE*.02,4096),3000,16000);
  assert.ok(half<.07,`${kit}/${mode}/half ${velocity}/${variant}: ${half}`);
 }
});

test('hats keep their place under the snare and a soft hat is darker',()=>{
 for(const kit of DRUM_KITS)for(const mode of MODES) {
  const snare=rms(renderDrum(RATE,kit,mode,'snare',1,0));
  for(const sound of ['closed','half','open'] as const) {
   const hard=renderDrum(RATE,kit,mode,sound,1,0),soft=renderDrum(RATE,kit,mode,sound,.3,0),level=rms(hard)/snare;
   assert.ok(level>.12&&level<.5,`${kit}/${mode}/${sound}: ${level} of the snare`);
   assert.ok(centroid(power(soft,0,8192))<centroid(power(hard,0,8192))*.95,`${kit}/${mode}/${sound}: the soft stroke is not darker`);
   assert.ok(centroid(power(hard,0,8192))>5000,`${kit}/${mode}/${sound}: a hat lives above 5 kHz`);
  }
  assert.ok(centroid(power(renderDrum(RATE,'r-click',mode,'closed',1,0),0,8192))>centroid(power(renderDrum(RATE,'r-brush',mode,'closed',1,0),0,8192))*1.2,'kits differ in brightness');
 }
});
