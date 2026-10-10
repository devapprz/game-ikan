import { IScene, SceneDirector } from '../core/SceneDirector.ts';
import { FishSpecies, FISH_CONFIGS } from '../common/FishTypes.ts';
import { SoundManager } from '../core/SoundManager.ts';
import { StorageManager, GameStats } from '../core/StorageManager.ts';

interface BladePoint {
  x: number;
  y: number;
  time: number;
}

interface SlicedHalf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  rotSpeed: number;
  species: FishSpecies;
  scale: number;
  halfSide: 'left' | 'right';
}

interface FlyingItem {
  id: number;
  isBomb: boolean;
  species: FishSpecies;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  angle: number;
  rotSpeed: number;
  scaleZ: number;
  radius: number;
  sliced: boolean;
}

interface SlashSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

interface JuiceSplat {
  x: number;
  y: number;
  radius: number;
  color: string;
  alpha: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  life: number;
}

export class FishSlashScene implements IScene {
  public readonly id = 'fish_slash';
  private width: number = 800;
  private height: number = 600;

  private soundManager: SoundManager;
  private stats: GameStats;

  // Game state
  private score: number = 0;
  private timeLeft: number = 60;
  private isPaused: boolean = false;
  private isGameOver: boolean = false;
  private slicedCount: number = 0;

  // Blade trail
  private bladePoints: BladePoint[] = [];
  private isSlashing: boolean = false;
  private lastWhooshTime: number = 0;
  private currentSwipeCuts: number = 0;

  // Flying entities
  private items: FlyingItem[] = [];
  private slicedHalves: SlicedHalf[] = [];
  private sparks: SlashSpark[] = [];
  private splats: JuiceSplat[] = [];
  private floatingTexts: FloatingText[] = [];

  // Spawner & Physics
  private spawnTimer: number = 0;
  private itemCounter: number = 0;
  private screenShake: number = 0;

  // UI Interactive Bounds
  private homeBtnBounds = { x: 12, y: 10, w: 36, h: 36 };
  private pauseBtnBounds = { x: 54, y: 10, w: 36, h: 36 };
  private retryBtnBounds = { x: 0, y: 0, w: 140, h: 42 };
  private lobbyBtnBounds = { x: 0, y: 0, w: 140, h: 42 };
  private resumeBtnBounds = { x: 0, y: 0, w: 220, h: 42 };
  private pauseLobbyBtnBounds = { x: 0, y: 0, w: 220, h: 42 };

  private isNarrowScreen: boolean = false;
  private hudHeight: number = 60;

  constructor() {
    this.soundManager = SoundManager.getInstance();
    this.stats = StorageManager.load();
  }

  public init(width: number, height: number): void {
    this.resize(width, height);
    this.score = 0;
    this.slicedCount = 0;
    this.timeLeft = 60;
    this.isPaused = false;
    this.isGameOver = false;

    this.items = [];
    this.slicedHalves = [];
    this.sparks = [];
    this.splats = [];
    this.floatingTexts = [];
    this.bladePoints = [];
    this.spawnTimer = 0.5;
    this.screenShake = 0;
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.isNarrowScreen = width < 520;
    this.hudHeight = this.isNarrowScreen ? 92 : 54;

    const btnSize = 36;
    const topSafe = Math.max(10, height * 0.02);
    this.homeBtnBounds = { x: 12, y: topSafe, w: btnSize, h: btnSize };
    this.pauseBtnBounds = { x: 54, y: topSafe, w: btnSize, h: btnSize };

    // Modals bounds calculation
    const modalBoxW = Math.min(360, width * 0.9);

    const pauseBoxH = 190;
    const pauseBoxY = (height - pauseBoxH) / 2;
    const pauseBtnW = modalBoxW - 48;
    const pauseBtnX = (width - pauseBtnW) / 2;
    this.resumeBtnBounds = { x: pauseBtnX, y: pauseBoxY + 74, w: pauseBtnW, h: 42 };
    this.pauseLobbyBtnBounds = { x: pauseBtnX, y: pauseBoxY + 124, w: pauseBtnW, h: 42 };

    const goBoxH = 270;
    const goBoxY = (height - goBoxH) / 2;
    const goBtnW = (modalBoxW - 48) / 2;
    const goBtn1X = (width - modalBoxW) / 2 + 18;
    const goBtn2X = goBtn1X + goBtnW + 12;
    const goBtnY = goBoxY + goBoxH - 58;
    this.retryBtnBounds = { x: goBtn1X, y: goBtnY, w: goBtnW, h: 42 };
    this.lobbyBtnBounds = { x: goBtn2X, y: goBtnY, w: goBtnW, h: 42 };
  }

  public update(dt: number): void {
    if (this.isPaused || this.isGameOver) return;

    // 1. Timer countdown
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.triggerGameOver();
    }

    // 2. Screen shake decay
    if (this.screenShake > 0) {
      this.screenShake -= dt * 3;
      if (this.screenShake < 0) this.screenShake = 0;
    }

    // 3. Spawner logic (Waves of 1 to 3 items)
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnWave();
      this.spawnTimer = 1.2 + Math.random() * 0.8;
    }

    // 4. Update Flying Items (Parabolic Trajectory & 3D Pseudo-spin)
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.vy += it.gravity * dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.angle += it.rotSpeed * dt;

      // 3D Depth Scale: larger when near apex (y is smaller)
      const normalizedHeight = Math.max(0, 1 - (it.y / this.height));
      it.scaleZ = 0.85 + normalizedHeight * 0.45;

      // Despawn when fallen below bottom screen
      if (it.y > this.height + 120 && it.vy > 0) {
        this.items.splice(i, 1);
      }
    }

    // 5. Update Sliced Halves
    for (let i = this.slicedHalves.length - 1; i >= 0; i--) {
      const h = this.slicedHalves[i];
      h.vy += 620 * dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.angle += h.rotSpeed * dt;

      if (h.y > this.height + 150) {
        this.slicedHalves.splice(i, 1);
      }
    }

    // 6. Update Sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.life -= dt;
      if (sp.life <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.vy += 200 * dt;
    }

    // 7. Update Splats (fade slowly)
    for (let i = this.splats.length - 1; i >= 0; i--) {
      const splat = this.splats[i];
      splat.alpha -= dt * 0.08;
      if (splat.alpha <= 0) {
        this.splats.splice(i, 1);
      }
    }

    // 8. Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y -= 45 * dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // 9. Prune old blade trail points
    const now = performance.now();
    this.bladePoints = this.bladePoints.filter(p => now - p.time < 160);
  }

  private spawnWave(): void {
    const isPortrait = this.height > this.width;
    const waveCount = Math.floor(Math.random() * (isPortrait ? 2 : 3)) + 1;
    const speciesList: FishSpecies[] = ['clownfish', 'blue_tang', 'angelfish', 'golden_fish', 'pufferfish'];

    for (let i = 0; i < waveCount; i++) {
      // 18% chance of spawning a Hazard Puffer Bomb
      const isBomb = Math.random() < 0.18;
      const sp = speciesList[Math.floor(Math.random() * speciesList.length)];

      const spawnX = this.width * 0.15 + Math.random() * (this.width * 0.7);
      const spawnY = this.height + 30;

      // Parabolic velocity towards center
      const targetApexX = this.width * 0.2 + Math.random() * (this.width * 0.6);
      const targetApexY = this.height * 0.2 + Math.random() * (this.height * 0.35);

      const gravity = 550;
      const vy = -Math.sqrt(2 * gravity * (spawnY - targetApexY));
      const timeToApex = -vy / gravity;
      const vx = (targetApexX - spawnX) / timeToApex;

      this.items.push({
        id: ++this.itemCounter,
        isBomb,
        species: sp,
        x: spawnX,
        y: spawnY,
        vx,
        vy,
        gravity,
        angle: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 6,
        scaleZ: 0.9,
        radius: isBomb ? 32 : 36,
        sliced: false
      });
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // 0. Screen shake translation if active
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake * 16;
      const sy = (Math.random() - 0.5) * this.screenShake * 16;
      ctx.translate(sx, sy);
    }

    // 1. 3D Arcade Dojo / Wooden Sushi Board Floor (Perspektif Papan Kayu Gelap)
    this.renderArcadeBackground(ctx);

    // 2. Juice Splats on Background
    for (const splat of this.splats) {
      ctx.save();
      ctx.globalAlpha = splat.alpha;
      ctx.fillStyle = splat.color;
      ctx.beginPath();
      ctx.arc(splat.x, splat.y, splat.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Sliced Fish Halves (Falling apart)
    for (const h of this.slicedHalves) {
      this.renderSlicedHalf(ctx, h);
    }

    // 4. Flying Items (Fish & Hazard Bombs)
    for (const item of this.items) {
      if (!item.sliced) {
        this.renderFlyingItem(ctx, item);
      }
    }

    // 5. Sparks
    for (const sp of this.sparks) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, sp.life / sp.maxLife);
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 6. Glowing Blade Ribbon Trail (Jejak Pedang Neon)
    this.renderBladeTrail(ctx);

    // 7. Floating Texts (Combo & Points)
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.font = `900 ${ft.fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = ft.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#000000aa';
      ctx.shadowBlur = 8;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore();

    // 8. Responsive Top HUD (Zero collision)
    this.renderHUD(ctx);

    // 9. Modals
    if (this.isPaused) {
      this.renderPauseModal(ctx);
    } else if (this.isGameOver) {
      this.renderGameOverModal(ctx);
    }
  }

  private renderArcadeBackground(ctx: CanvasRenderingContext2D): void {
    // Deep crimson/navy bamboo dojo background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, this.height);
    bgGrad.addColorStop(0, '#180d24');
    bgGrad.addColorStop(0.5, '#1e1133');
    bgGrad.addColorStop(1, '#0f081c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // 3D Perspective Grid / Wooden Planks
    ctx.save();
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.08)';
    ctx.lineWidth = 1.5;

    // Vanishing perspective rays
    const vanishX = this.width / 2;
    const vanishY = this.height * 0.35;
    for (let x = -this.width * 0.5; x <= this.width * 1.5; x += 90) {
      ctx.beginPath();
      ctx.moveTo(vanishX, vanishY);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }

    // Horizontal floor grid lines
    for (let y = vanishY + 30; y < this.height; y += 45) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderFlyingItem(ctx: CanvasRenderingContext2D, item: FlyingItem): void {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.scale(item.scaleZ, item.scaleZ);
    ctx.rotate(item.angle);

    if (item.isBomb) {
      // HAZARD PUFFER BOMB (Bom Ikan Buntal Berduri)
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;

      // Spikes
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(22, -6);
        ctx.lineTo(36, 0);
        ctx.lineTo(22, 6);
        ctx.closePath();
        ctx.fillStyle = '#dc2626';
        ctx.fill();
        ctx.restore();
      }

      // Bomb round body
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Glowing pulsating skull / hazard sign
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💣', 0, 0);

      // Fuse with spark
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.quadraticCurveTo(8, -34, 14, -38);
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(14, -38, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 3D POPPING FISH (Ikan 3D dengan Shading & Fin)
      const cfg = FISH_CONFIGS[item.species];
      const w = cfg.baseWidth * 0.9;
      const h = cfg.baseHeight * 0.9;

      // Drop shadow for 3D depth
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 6;

      // Fish Body with gradient shading
      const bodyGrad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
      bodyGrad.addColorStop(0, cfg.primaryColor);
      bodyGrad.addColorStop(1, cfg.secondaryColor);

      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tail
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = cfg.finColor;
      ctx.beginPath();
      ctx.moveTo(-w * 0.45, 0);
      ctx.lineTo(-w * 0.8, -h * 0.4);
      ctx.lineTo(-w * 0.8, h * 0.4);
      ctx.closePath();
      ctx.fill();

      // Eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(w * 0.28, -h * 0.15, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(w * 0.30, -h * 0.15, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Decorative stripes
      if (cfg.stripeColor) {
        ctx.strokeStyle = cfg.stripeColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -h * 0.45);
        ctx.lineTo(0, h * 0.45);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private renderSlicedHalf(ctx: CanvasRenderingContext2D, h: SlicedHalf): void {
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.scale(h.scale, h.scale);
    ctx.rotate(h.angle);

    const cfg = FISH_CONFIGS[h.species];
    const w = cfg.baseWidth * 0.9;
    const ht = cfg.baseHeight * 0.9;

    ctx.fillStyle = cfg.primaryColor;
    ctx.beginPath();

    if (h.halfSide === 'left') {
      // Left/Top Half Slice
      ctx.ellipse(0, 0, w / 2, ht / 2, 0, Math.PI * 0.5, Math.PI * 1.5);
      ctx.closePath();
      ctx.fill();

      // Red slice flesh cross-section
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -ht / 2);
      ctx.lineTo(0, ht / 2);
      ctx.stroke();
    } else {
      // Right/Bottom Half Slice
      ctx.ellipse(0, 0, w / 2, ht / 2, 0, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -ht / 2);
      ctx.lineTo(0, ht / 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderBladeTrail(ctx: CanvasRenderingContext2D): void {
    if (this.bladePoints.length < 2) return;

    ctx.save();
    const now = performance.now();

    for (let i = 1; i < this.bladePoints.length; i++) {
      const p1 = this.bladePoints[i - 1];
      const p2 = this.bladePoints[i];
      const age = now - p2.time;
      const alpha = Math.max(0, 1 - age / 160);

      // Outer Neon Violet/Cyan glow
      ctx.strokeStyle = `rgba(236, 72, 153, ${alpha * 0.6})`;
      ctx.lineWidth = (i / this.bladePoints.length) * 12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Razor sharp white core
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
      ctx.lineWidth = (i / this.bladePoints.length) * 4;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const topSafe = this.homeBtnBounds.y;

    if (this.isNarrowScreen) {
      // Mobile Narrow Mode: Clean 2-Row Layout
      this.renderIconButton(ctx, this.homeBtnBounds, '🏠');
      this.renderIconButton(ctx, this.pauseBtnBounds, this.isPaused ? '▶' : '⏸');

      // Timer Capsule (Top Right)
      const isUrgent = this.timeLeft <= 10;
      const timerW = 96;
      const timerX = this.width - timerW - 12;
      const timerY = topSafe;
      this.renderCapsule(
        ctx,
        timerX,
        timerY,
        timerW,
        36,
        isUrgent ? 'rgba(239, 68, 68, 0.4)' : 'rgba(15, 23, 42, 0.85)',
        isUrgent ? '#ef4444' : '#ec4899',
        `⏱ ${Math.ceil(this.timeLeft)}s`,
        isUrgent ? '#fca5a5' : '#fbcfe8'
      );

      // Row 2: Fish count & Score capsules
      const row2Y = topSafe + 42;
      const colW = (this.width - 32) / 2;

      this.renderCapsule(
        ctx,
        12,
        row2Y,
        colW,
        32,
        'rgba(15, 23, 42, 0.85)',
        '#ec4899',
        `⚔️ ${this.slicedCount} Ditebas`,
        '#f472b6'
      );

      this.renderCapsule(
        ctx,
        12 + colW + 8,
        row2Y,
        colW,
        32,
        'rgba(15, 23, 42, 0.85)',
        '#eab308',
        `🏆 ${this.score}`,
        '#fef08a'
      );
    } else {
      // Wide / Landscape Mode: Sleek Single Bar
      const barH = 46;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(12, topSafe, this.width - 24, barH, 14);
      ctx.fill();
      ctx.stroke();

      this.renderIconButton(ctx, { x: 20, y: topSafe + 5, w: 36, h: 36 }, '🏠');
      this.renderIconButton(ctx, { x: 62, y: topSafe + 5, w: 36, h: 36 }, this.isPaused ? '▶' : '⏸');

      const isUrgent = this.timeLeft <= 10;
      ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = isUrgent ? '#ef4444' : '#fbcfe8';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`⏱ Sisa: ${Math.ceil(this.timeLeft)}s`, 116, topSafe + barH / 2);

      ctx.fillStyle = '#f472b6';
      ctx.fillText(`⚔️ Ditebas: ${this.slicedCount}`, this.width * 0.44, topSafe + barH / 2);

      ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'right';
      ctx.fillText(`🏆 Skor: ${this.score}`, this.width - 24, topSafe + barH / 2);
    }

    ctx.restore();
  }

  private renderIconButton(ctx: CanvasRenderingContext2D, b: { x: number; y: number; w: number; h: number }, icon: string): void {
    ctx.save();
    ctx.fillStyle = 'rgba(30, 41, 59, 0.90)';
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 10);
    ctx.fill();
    ctx.stroke();

    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, b.x + b.w / 2, b.y + b.h / 2);
    ctx.restore();
  }

  private renderCapsule(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    bg: string,
    border: string,
    text: string,
    textColor: string
  ): void {
    ctx.save();
    ctx.fillStyle = bg;
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);
    ctx.restore();
  }

  private renderPauseModal(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 15, 30, 0.80)';
    ctx.fillRect(0, 0, this.width, this.height);

    const boxW = Math.min(340, this.width * 0.88);
    const boxH = 190;
    const boxX = (this.width - boxW) / 2;
    const boxY = (this.height - boxH) / 2;

    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 18);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PERMAINAN DIJEDA', this.width / 2, boxY + 40);

    const rb = this.resumeBtnBounds;
    ctx.fillStyle = '#db2777';
    ctx.beginPath();
    ctx.roundRect(rb.x, rb.y, rb.w, rb.h, 10);
    ctx.fill();

    ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Lanjutkan Permainan ▶', rb.x + rb.w / 2, rb.y + rb.h / 2);

    const lb = this.pauseLobbyBtnBounds;
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(lb.x, lb.y, lb.w, lb.h, 10);
    ctx.fill();

    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Kembali ke Menu Utama 🏠', lb.x + lb.w / 2, lb.y + lb.h / 2);

    ctx.restore();
  }

  private renderGameOverModal(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 15, 30, 0.85)';
    ctx.fillRect(0, 0, this.width, this.height);

    const boxW = Math.min(360, this.width * 0.9);
    const boxH = 270;
    const boxX = (this.width - boxW) / 2;
    const boxY = (this.height - boxH) / 2;

    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 20);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#fef08a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WAKTU HABIS! ⚔️', this.width / 2, boxY + 36);

    ctx.font = '14px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Total Ikan Ditebas: ${this.slicedCount} ekor`, this.width / 2, boxY + 70);

    ctx.font = '900 30px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#f472b6';
    ctx.fillText(`Skor: ${this.score}`, this.width / 2, boxY + 110);

    const isNewRecord = this.score > this.stats.slashHighScore;
    if (isNewRecord) {
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#22c55e';
      ctx.fillText('🎉 REKOR SKOR BARU! 🎉', this.width / 2, boxY + 148);
    } else {
      ctx.font = '13px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`Rekor Terbaik: ${this.stats.slashHighScore}`, this.width / 2, boxY + 148);
    }

    const rb = this.retryBtnBounds;
    ctx.fillStyle = '#db2777';
    ctx.beginPath();
    ctx.roundRect(rb.x, rb.y, rb.w, rb.h, 10);
    ctx.fill();

    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Main Lagi 🔄', rb.x + rb.w / 2, rb.y + rb.h / 2);

    const lb = this.lobbyBtnBounds;
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(lb.x, lb.y, lb.w, lb.h, 10);
    ctx.fill();

    ctx.fillText('Menu Utama 🏠', lb.x + lb.w / 2, lb.y + lb.h / 2);

    ctx.restore();
  }

  private triggerGameOver(): void {
    this.isGameOver = true;
    this.soundManager.playGameOver();

    if (this.score > this.stats.slashHighScore) {
      StorageManager.save({ slashHighScore: this.score });
      this.stats.slashHighScore = this.score;
    }
  }

  public handlePointerDown(x: number, y: number): void {
    if (this.isGameOver) {
      const rb = this.retryBtnBounds;
      if (x >= rb.x && x <= rb.x + rb.w && y >= rb.y && y <= rb.y + rb.h) {
        this.soundManager.playTap();
        this.init(this.width, this.height);
        return;
      }
      const lb = this.lobbyBtnBounds;
      if (x >= lb.x && x <= lb.x + lb.w && y >= lb.y && y <= lb.y + lb.h) {
        this.soundManager.playTap();
        SceneDirector.getInstance().switchScene('lobby');
        return;
      }
      return;
    }

    if (this.isPaused) {
      const rb = this.resumeBtnBounds;
      if (x >= rb.x && x <= rb.x + rb.w && y >= rb.y && y <= rb.y + rb.h) {
        this.soundManager.playTap();
        this.isPaused = false;
        return;
      }
      const pb = this.pauseLobbyBtnBounds;
      if (x >= pb.x && x <= pb.x + pb.w && y >= pb.y && y <= pb.y + pb.h) {
        this.soundManager.playTap();
        SceneDirector.getInstance().switchScene('lobby');
        return;
      }
      return;
    }

    const hb = this.homeBtnBounds;
    if (x >= hb.x && x <= hb.x + hb.w && y >= hb.y && y <= hb.y + hb.h) {
      this.soundManager.playTap();
      SceneDirector.getInstance().switchScene('lobby');
      return;
    }

    const pb = this.pauseBtnBounds;
    if (x >= pb.x && x <= pb.x + pb.w && y >= pb.y && y <= pb.y + pb.h) {
      this.soundManager.playTap();
      this.isPaused = !this.isPaused;
      return;
    }

    if (y < this.hudHeight) return;

    this.isSlashing = true;
    this.currentSwipeCuts = 0;
    this.bladePoints = [{ x, y, time: performance.now() }];
  }

  public handlePointerMove(x: number, y: number): void {
    if (this.isPaused || this.isGameOver || !this.isSlashing) return;

    const now = performance.now();
    const lastP = this.bladePoints[this.bladePoints.length - 1];

    if (lastP) {
      const dist = Math.hypot(x - lastP.x, y - lastP.y);
      if (dist > 8) {
        // Blade swipe sound throttle
        if (dist > 25 && now - this.lastWhooshTime > 220) {
          this.soundManager.playBladeWhoosh();
          this.lastWhooshTime = now;
        }

        // Add blade sparks
        this.sparks.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 120,
          vy: (Math.random() - 0.5) * 120,
          color: Math.random() > 0.5 ? '#f472b6' : '#ffffff',
          size: 2 + Math.random() * 3,
          life: 0.25,
          maxLife: 0.25
        });

        // Check Slicing Collision with Line Segment (lastP -> current)
        this.checkBladeSlicing(lastP.x, lastP.y, x, y);
      }
    }

    this.bladePoints.push({ x, y, time: now });
  }

  public handlePointerUp(): void {
    // Check if player achieved a multi-cut combo
    if (this.currentSwipeCuts >= 3) {
      const bonus = this.currentSwipeCuts * 15;
      this.score += bonus;
      this.soundManager.playComboFanfare();

      const lastP = this.bladePoints[this.bladePoints.length - 1] || { x: this.width / 2, y: this.height / 2 };
      this.floatingTexts.push({
        x: lastP.x,
        y: lastP.y - 40,
        text: `🔥 COMBO x${this.currentSwipeCuts}! +${bonus}`,
        color: '#fef08a',
        fontSize: 26,
        life: 1.2
      });
    }

    this.isSlashing = false;
    this.currentSwipeCuts = 0;
  }

  private checkBladeSlicing(x1: number, y1: number, x2: number, y2: number): void {
    for (const item of this.items) {
      if (item.sliced) continue;

      // Distance from point (item.x, item.y) to segment (x1,y1)-(x2,y2)
      const dist = this.distToSegment(item.x, item.y, x1, y1, x2, y2);
      if (dist < item.radius * item.scaleZ) {
        item.sliced = true;

        if (item.isBomb) {
          // BOMB DETONATION!
          this.soundManager.playBombExplode();
          this.screenShake = 1.0;
          this.score = Math.max(0, this.score - 40);

          this.floatingTexts.push({
            x: item.x,
            y: item.y - 20,
            text: '💥 BOM MELEDAK! -40',
            color: '#ef4444',
            fontSize: 24,
            life: 1.0
          });

          // Add heavy fire sparks
          for (let s = 0; s < 30; s++) {
            this.sparks.push({
              x: item.x,
              y: item.y,
              vx: (Math.random() - 0.5) * 350,
              vy: (Math.random() - 0.5) * 350,
              color: Math.random() > 0.4 ? '#ef4444' : '#f59e0b',
              size: 3 + Math.random() * 5,
              life: 0.45,
              maxLife: 0.45
            });
          }
        } else {
          // FISH SLICE!
          this.soundManager.playSliceImpact();
          this.slicedCount++;
          this.currentSwipeCuts++;

          const pts = FISH_CONFIGS[item.species].points;
          this.score += pts;

          this.floatingTexts.push({
            x: item.x,
            y: item.y - 20,
            text: `+${pts}`,
            color: '#fef08a',
            fontSize: 22,
            life: 0.8
          });

          // Create 2 sliced halves flying apart
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const perpX = Math.cos(angle + Math.PI / 2);
          const perpY = Math.sin(angle + Math.PI / 2);

          this.slicedHalves.push({
            x: item.x - perpX * 12,
            y: item.y - perpY * 12,
            vx: item.vx - perpX * 150,
            vy: item.vy - perpY * 150 - 50,
            angle: item.angle,
            rotSpeed: -5,
            species: item.species,
            scale: item.scaleZ,
            halfSide: 'left'
          });

          this.slicedHalves.push({
            x: item.x + perpX * 12,
            y: item.y + perpY * 12,
            vx: item.vx + perpX * 150,
            vy: item.vy + perpY * 150 - 50,
            angle: item.angle,
            rotSpeed: 5,
            species: item.species,
            scale: item.scaleZ,
            halfSide: 'right'
          });

          // Background juice splat
          this.splats.push({
            x: item.x,
            y: item.y,
            radius: 25 + Math.random() * 15,
            color: FISH_CONFIGS[item.species].primaryColor,
            alpha: 0.5
          });

          // Splash droplets
          for (let s = 0; s < 14; s++) {
            this.sparks.push({
              x: item.x,
              y: item.y,
              vx: (Math.random() - 0.5) * 220,
              vy: (Math.random() - 0.5) * 220,
              color: FISH_CONFIGS[item.species].primaryColor,
              size: 2.5 + Math.random() * 3,
              life: 0.35,
              maxLife: 0.35
            });
          }
        }
      }
    }
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  public destroy(): void {
    this.items = [];
    this.slicedHalves = [];
    this.bladePoints = [];
    this.sparks = [];
    this.splats = [];
  }
}
