// Copyright (C) 2026 Yakshawan. All rights reserved. See LICENSE.
// Mastermind-derived portions retain MIT terms; see public/licenses/Mastermind-MIT.txt.
// Mastermind VisualizerCard geometry, adapted to a compact canvas and elapsed time.
import { random } from './seed';
interface Star { x: number; y: number; z: number; inner: boolean; frequency: number }
interface Flake { phase: number; speed: number; angle: number; radius: number }

// Rotate and scale in world space BEFORE perspective: displacement must change depth too.
export function projectPoint(x: number, y: number, z: number, yaw: number, pitch: number) {
  const rx = x * Math.cos(yaw) - z * Math.sin(yaw);
  const rz = x * Math.sin(yaw) + z * Math.cos(yaw);
  const ry = y * Math.cos(pitch) - rz * Math.sin(pitch);
  const depth = y * Math.sin(pitch) + rz * Math.cos(pitch);
  if (1000 - depth < 100) return null;
  const scale = 1000 / (1000 - depth);
  return { x: rx * scale, y: ry * scale, depth, scale };
}
export class Starfield {
  private context: CanvasRenderingContext2D;
  private points: Star[] = [];
  private flakes: Flake[] = [];
  private spectrum = new Uint8Array(1024);
  private detail = new Float32Array(50);
  private bands = [0, 0, 0];
  private last = 0;
  private angle = 0;
  private elapsed = 0;
  private frames = 0;
  private visible = 0;
  private visibleSnow = 0;
  private expansion = 1;
  private maxSize = 0;
  private sprite = document.createElement('canvas');
  constructor(private canvas: HTMLCanvasElement) {
    this.context = canvas.getContext('2d')!;
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    for (const [count, inner] of [[100, true], [300, false]] as const) {
      for (let i = 0; i < count; i++) {
        const z = 1 - 2 * (i + .5) / count, radius = Math.sqrt(1 - z * z);
        const theta = 2 * Math.PI * i / goldenRatio;
        this.points.push({ x: Math.cos(theta) * radius, y: Math.sin(theta) * radius, z, inner,
          frequency: Math.floor(Math.abs(z) * 49) });
      }
    }
    for (let i = 0; i < 80; i++) this.flakes.push({
      phase: random('SNOW', `p${i}`) * Math.PI * 2,
      speed: .002 + random('SNOW', `v${i}`) * .005,
      angle: random('SNOW', `a${i}`) * Math.PI * 2,
      radius: 1 + random('SNOW', `r${i}`) * 2,
    });
    this.sprite.width = this.sprite.height = 64;
    const ctx = this.sprite.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 3.2, 32, 32, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,.9)');
    gradient.addColorStop(.5, 'rgba(255,255,255,.2)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
  }
  draw(time: number, analyser: AnalyserNode | null, reducedMotion: boolean) {
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight;
    if (!width || !height) { this.last = time; return; }
    const dt = this.last ? Math.min(.1, Math.max(0, (time - this.last) / 1000)) : 0;
    this.last = time;
    this.bands.fill(0); this.detail.fill(0);
    if (analyser && !reducedMotion) {
      if (this.spectrum.length !== analyser.frequencyBinCount) this.spectrum = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(this.spectrum);
      const mean = (from: number, to: number) => {
        let sum = 0; for (let i = from; i < to; i++) sum += this.spectrum[i];
        return sum / (to - from) / 255 * 1.5;
      };
      this.bands = [mean(0, 10), mean(10, 100), mean(100, this.spectrum.length)];
      for (let i = 0; i < 50; i++) this.detail[i] = this.spectrum[Math.floor(i / 50 * this.spectrum.length * .7)] / 255 * 1.5;
    }
    // Keep measured bands separate from the original's decorative idle breathing.
    // Muting playback leaves zero spectral response; stopping restores the idle sky.
    if (!reducedMotion) this.elapsed += dt;
    const idle = !analyser && !reducedMotion;
    const bass = idle ? (Math.sin(this.elapsed * 2) * .5 + .5) * .3 : this.bands[0];
    if (idle) for (let i = 0; i < 50; i++) this.detail[i] = .15 + Math.sin(this.elapsed * 1.5 + i * .2) * .1;
    if (!reducedMotion) this.angle += dt * 30 * (.002 + bass * .01) * 2.5;
    const tilt = Math.sin(this.elapsed * .25) * .25;
    const dpr = Math.min(devicePixelRatio, 2);
    if (this.canvas.width !== Math.round(width * dpr) || this.canvas.height !== Math.round(height * dpr)) {
      this.canvas.width = Math.round(width * dpr); this.canvas.height = Math.round(height * dpr);
    }
    const ctx = this.context;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';
    // A fixed 320-unit scene keeps the original depth on short cards. Crop into it
    // rather than flattening z or scattering the sphere's radii at random.
    const base = 256, framing = height / 320 * 1.6;
    this.expansion = 1 + bass * .35; this.visible = 0; this.visibleSnow = 0; this.maxSize = 0;
    const dot = (p: NonNullable<ReturnType<typeof projectPoint>>, size: number, alpha: number, snow = false) => {
      const x = width / 2 + p.x * framing, y = height / 2 + p.y * framing;
      const pixels = size * p.scale * framing * .8;
      if (x < -pixels || x > width + pixels || y < -pixels || y > height + pixels) return;
      this.visible++; if (snow) this.visibleSnow++;
      this.maxSize = Math.max(this.maxSize, pixels);
      ctx.globalAlpha = alpha;
      ctx.drawImage(this.sprite, x - pixels / 2, y - pixels / 2, pixels, pixels);
    };
    for (const star of this.points) {
      const r = base * (star.inner ? .45 : 1) * (this.expansion + this.detail[star.frequency] * (star.inner ? 1.2 : .8));
      const p = projectPoint(star.x * r, star.y * r, star.z * r, this.angle, tilt);
      if (!p) continue;
      const alpha = Math.max(.1, Math.min(1, (p.depth / base + 1.2) * .45));
      dot(p, (star.inner ? 14 : 18) * (.8 + bass * .3) * .35, alpha * (star.inner ? .7 : 1));
    }
    for (const flake of this.flakes) {
      if (!reducedMotion) flake.angle += dt * 30 * flake.speed * 1.5;
      const orbit = base * 1.5 * flake.radius;
      const p = projectPoint(Math.cos(flake.angle) * orbit, Math.sin(this.elapsed * .5 + flake.phase) * base,
        Math.sin(flake.angle) * orbit, this.angle * .5, tilt * .5);
      if (p) dot(p, 16 * .35, Math.max(0, Math.min(.8, p.scale - .2)) * .7, true);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; this.frames++;
  }
  diagnostics() { return { bands: [...this.bands], frames: this.frames, points: this.points.length, snow: this.flakes.length,
    visiblePoints: this.visible, visibleSnow: this.visibleSnow, expansion: this.expansion, maxParticleSize: this.maxSize,
    projection: 'mastermind-3d', rotation: this.angle }; }
}
