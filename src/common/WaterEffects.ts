export interface Bubble {
  x: number;
  y: number;
  radius: number;
  speed: number;
  wobbleSpeed: number;
  wobbleAmount: number;
  phase: number;
  opacity: number;
}

export interface WaterSplashParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  life: number;
  maxLife: number;
  vy: number;
}

export class WaterEffects {
  public bubbles: Bubble[] = [];
  public splashes: WaterSplashParticle[] = [];
  public floatingTexts: FloatingText[] = [];

  constructor(numBubbles: number = 25, width: number = 800, height: number = 600) {
    for (let i = 0; i < numBubbles; i++) {
      this.bubbles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 3 + Math.random() * 8,
        speed: 30 + Math.random() * 50,
        wobbleSpeed: 2 + Math.random() * 3,
        wobbleAmount: 15 + Math.random() * 20,
        phase: Math.random() * Math.PI * 2,
        opacity: 0.3 + Math.random() * 0.4
      });
    }
  }

  public addSplash(x: number, y: number, count: number = 16, color: string = '#7dd3fc'): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 60 + Math.random() * 140;
      this.splashes.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        radius: 2 + Math.random() * 4,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        color
      });
    }
  }

  public addFloatingText(x: number, y: number, text: string, color: string = '#fef08a', fontSize: number = 22): void {
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      fontSize,
      life: 0.9,
      maxLife: 0.9,
      vy: -55
    });
  }

  public update(dt: number, width: number, height: number): void {
    // 1. Update bubbles
    for (const b of this.bubbles) {
      b.phase += b.wobbleSpeed * dt;
      b.y -= b.speed * dt;
      b.x += Math.sin(b.phase) * b.wobbleAmount * dt;

      if (b.y < -20) {
        b.y = height + 10;
        b.x = Math.random() * width;
      }
    }

    // 2. Update splashes
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const p = this.splashes[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.splashes.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt; // gravity
    }

    // 3. Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ft.y += ft.vy * dt;
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    // 1. Draw bubbles
    ctx.save();
    for (const b of this.bubbles) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${b.opacity})`;
      ctx.fillStyle = `rgba(186, 230, 253, ${b.opacity * 0.3})`;
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Bubble highlight shine
      ctx.fillStyle = `rgba(255, 255, 255, ${b.opacity * 0.9})`;
      ctx.beginPath();
      ctx.arc(b.x - b.radius * 0.35, b.y - b.radius * 0.35, b.radius * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. Draw splashes
    ctx.save();
    for (const p of this.splashes) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 3. Draw floating texts
    ctx.save();
    for (const ft of this.floatingTexts) {
      const alpha = Math.max(0, ft.life / ft.maxLife);
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${ft.fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Outline
      ctx.strokeStyle = '#000000bb';
      ctx.lineWidth = 4;
      ctx.strokeText(ft.text, ft.x, ft.y);

      // Fill
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }
}
