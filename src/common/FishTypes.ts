export type FishSpecies = 'clownfish' | 'blue_tang' | 'angelfish' | 'golden_fish' | 'pufferfish';

export interface FishConfig {
  species: FishSpecies;
  name: string;
  points: number;
  baseWidth: number;
  baseHeight: number;
  baseSpeed: number;
  primaryColor: string;
  secondaryColor: string;
  finColor: string;
  stripeColor?: string;
}

export const FISH_CONFIGS: Record<FishSpecies, FishConfig> = {
  clownfish: {
    species: 'clownfish',
    name: 'Ikan Badut',
    points: 15,
    baseWidth: 50,
    baseHeight: 32,
    baseSpeed: 90,
    primaryColor: '#ff6b35',
    secondaryColor: '#f7931e',
    finColor: '#e05326',
    stripeColor: '#ffffff'
  },
  blue_tang: {
    species: 'blue_tang',
    name: 'Ikan Dory Biru',
    points: 25,
    baseWidth: 55,
    baseHeight: 34,
    baseSpeed: 110,
    primaryColor: '#1d63ff',
    secondaryColor: '#0a389c',
    finColor: '#ffe600',
    stripeColor: '#0a235c'
  },
  angelfish: {
    species: 'angelfish',
    name: 'Ikan Manfish',
    points: 35,
    baseWidth: 52,
    baseHeight: 46,
    baseSpeed: 85,
    primaryColor: '#ffeb3b',
    secondaryColor: '#fbc02d',
    finColor: '#37474f',
    stripeColor: '#263238'
  },
  golden_fish: {
    species: 'golden_fish',
    name: 'Ikan Emas Langka',
    points: 100,
    baseWidth: 46,
    baseHeight: 28,
    baseSpeed: 160,
    primaryColor: '#ffd700',
    secondaryColor: '#ffaa00',
    finColor: '#ffea70',
    stripeColor: '#fff9c4'
  },
  pufferfish: {
    species: 'pufferfish',
    name: 'Ikan Buntal',
    points: 20,
    baseWidth: 48,
    baseHeight: 40,
    baseSpeed: 70,
    primaryColor: '#8bc34a',
    secondaryColor: '#689f38',
    finColor: '#aed581',
    stripeColor: '#dce775'
  }
};

export class FishEntity {
  public id: number;
  public species: FishSpecies;
  public config: FishConfig;
  public x: number = 0;
  public y: number = 0;
  public width: number = 50;
  public height: number = 30;
  public vx: number = 100;
  public vy: number = 0;
  public facing: number = 1; // 1 = right, -1 = left
  public state: 'swimming' | 'hooked' | 'scooped' | 'inactive' = 'swimming';
  public tailPhase: number = 0;
  public tailSpeed: number = 8;
  public scale: number = 1;

  constructor(id: number, species: FishSpecies) {
    this.id = id;
    this.species = species;
    this.config = FISH_CONFIGS[species];
    this.tailPhase = Math.random() * Math.PI * 2;
  }

  public reset(x: number, y: number, facing: number, scale: number = 1): void {
    this.x = x;
    this.y = y;
    this.facing = facing;
    this.scale = scale;
    this.width = this.config.baseWidth * scale;
    this.height = this.config.baseHeight * scale;
    this.vx = this.config.baseSpeed * (0.8 + Math.random() * 0.4) * facing;
    this.vy = (Math.random() - 0.5) * 30;
    this.state = 'swimming';
    this.tailPhase = Math.random() * Math.PI * 2;
  }

  public update(dt: number, boundsWidth: number, boundsHeight: number, customMinY?: number, customMaxY?: number): void {
    if (this.state !== 'swimming') return;

    this.tailPhase += this.tailSpeed * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Small natural vertical bobbing
    this.vy += (Math.random() - 0.5) * 40 * dt;
    this.vy = Math.max(-40, Math.min(40, this.vy));

    // Keep within reasonable water vertical limits
    const minY = customMinY ?? boundsHeight * 0.15;
    const maxY = customMaxY ?? boundsHeight * 0.9;
    if (this.y < minY) {
      this.y = minY;
      this.vy = Math.abs(this.vy);
    } else if (this.y > maxY) {
      this.y = maxY;
      this.vy = -Math.abs(this.vy);
    }

    // Wrap / respawn when leaving screen horizontally
    const margin = 100;
    if (this.facing === 1 && this.x > boundsWidth + margin) {
      this.x = -margin;
      this.y = minY + Math.random() * (maxY - minY);
    } else if (this.facing === -1 && this.x < -margin) {
      this.x = boundsWidth + margin;
      this.y = minY + Math.random() * (maxY - minY);
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (this.state === 'inactive') return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.facing * this.scale, this.scale);

    const w = this.config.baseWidth;
    const h = this.config.baseHeight;
    const tailWiggle = Math.sin(this.tailPhase) * 6;

    // 1. Tail fin
    ctx.fillStyle = this.config.finColor;
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, 0);
    ctx.lineTo(-w * 0.65, -h * 0.45 + tailWiggle);
    ctx.quadraticCurveTo(-w * 0.5, tailWiggle * 0.5, -w * 0.65, h * 0.45 + tailWiggle);
    ctx.closePath();
    ctx.fill();

    // 2. Main fish body
    ctx.fillStyle = this.config.primaryColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.45, h * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Body Belly Accent
    ctx.fillStyle = this.config.secondaryColor;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.1, w * 0.38, h * 0.28, 0, 0, Math.PI);
    ctx.fill();

    // 4. Species specific patterns
    if (this.config.stripeColor) {
      ctx.fillStyle = this.config.stripeColor;
      if (this.species === 'clownfish') {
        // Vertical stripes
        [-w * 0.15, w * 0.1].forEach((stripeX) => {
          ctx.beginPath();
          ctx.ellipse(stripeX, 0, 5, h * 0.38, 0, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (this.species === 'angelfish') {
        // Angled stripes
        ctx.beginPath();
        ctx.moveTo(-w * 0.1, -h * 0.4);
        ctx.lineTo(-w * 0.05, h * 0.4);
        ctx.lineTo(w * 0.05, h * 0.4);
        ctx.lineTo(0, -h * 0.4);
        ctx.fill();
      } else if (this.species === 'pufferfish') {
        // Cute spines/dots
        ctx.fillStyle = '#ffffff88';
        [-8, 0, 8].forEach((dotX) => {
          [-8, 0, 8].forEach((dotY) => {
            ctx.beginPath();
            ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
            ctx.fill();
          });
        });
      } else if (this.species === 'golden_fish') {
        // Shiny shimmer
        ctx.fillStyle = '#ffffff66';
        ctx.beginPath();
        ctx.ellipse(w * 0.1, -h * 0.15, 8, 4, -0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 5. Pectoral Fin (side fin with flapping)
    const finFlap = Math.sin(this.tailPhase * 1.5) * 4;
    ctx.fillStyle = this.config.finColor;
    ctx.beginPath();
    ctx.ellipse(-w * 0.05, h * 0.05, 10, 6, 0.4 + finFlap * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // 6. Eye (Sclera + Pupil + Highlight)
    const eyeX = w * 0.22;
    const eyeY = -h * 0.12;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(eyeX + 1.5, eyeY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeX + 2.5, eyeY - 1.5, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // 7. Cute mouth
    ctx.strokeStyle = '#22222288';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w * 0.42, 2, 3, 0.2, Math.PI * 0.8);
    ctx.stroke();

    ctx.restore();
  }

  public containsPoint(px: number, py: number): boolean {
    if (this.state !== 'swimming') return false;
    // Bounding ellipse / circle check
    const dx = px - this.x;
    const dy = py - this.y;
    const rx = (this.width / 2) * 1.3;
    const ry = (this.height / 2) * 1.3;
    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
  }
}
