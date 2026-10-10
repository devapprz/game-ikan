import { IScene, SceneDirector } from '../core/SceneDirector.ts';
import { FishEntity, FishSpecies } from '../common/FishTypes.ts';
import { WaterEffects } from '../common/WaterEffects.ts';
import { SoundManager } from '../core/SoundManager.ts';
import { StorageManager, GameStats } from '../core/StorageManager.ts';

interface FishingHook {
  id: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  currentX: number;
  currentY: number;
  state: 'descending' | 'hooked' | 'ascending' | 'done';
  speed: number;
  hookedFish: FishEntity | null;
}

export class FishingScene implements IScene {
  public readonly id = 'fishing';
  private width: number = 800;
  private height: number = 600;

  private fishes: FishEntity[] = [];
  private hooks: FishingHook[] = [];
  private hookCounter: number = 0;
  private waterEffects: WaterEffects;
  private soundManager: SoundManager;
  private stats: GameStats;

  // Game rules & state
  private score: number = 0;
  private timeLeft: number = 60;
  private isPaused: boolean = false;
  private isGameOver: boolean = false;
  private caughtCount: number = 0;

  // Environment & Animation
  private waterY: number = 140;
  private animTimer: number = 0;
  private rodTipX: number = 280;
  private rodTipY: number = 110;

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
    this.waterEffects = new WaterEffects(25, 800, 600);
  }

  public init(width: number, height: number): void {
    this.resize(width, height);
    this.score = 0;
    this.caughtCount = 0;
    this.timeLeft = 60;
    this.isPaused = false;
    this.isGameOver = false;
    this.hooks = [];
    this.animTimer = 0;

    // Spawn 12 fishes inside underwater zone (strictly below water surface)
    this.fishes = [];
    const speciesList: FishSpecies[] = ['clownfish', 'blue_tang', 'angelfish', 'golden_fish', 'pufferfish'];
    const fishMinY = this.waterY + 30;
    const fishMaxY = height - 40;

    for (let i = 0; i < 12; i++) {
      const sp = speciesList[Math.floor(Math.random() * speciesList.length)];
      const fish = new FishEntity(i, sp);
      const facing = Math.random() > 0.5 ? 1 : -1;
      fish.reset(
        Math.random() * width,
        fishMinY + Math.random() * (fishMaxY - fishMinY),
        facing,
        0.8 + Math.random() * 0.4
      );
      this.fishes.push(fish);
    }
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    const isPortrait = height > width;
    this.isNarrowScreen = width < 520;
    this.hudHeight = this.isNarrowScreen ? 92 : 54;

    // Responsive water surface level
    this.waterY = isPortrait
      ? Math.max(this.hudHeight + 50, height * 0.22)
      : Math.max(this.hudHeight + 35, height * 0.26);

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

    this.animTimer += dt;

    // 1. Timer countdown
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.triggerGameOver();
    }

    // 2. Water particles & bubbles (underwater only)
    this.waterEffects.update(dt, this.width, this.height);

    // 3. Update fish movement strictly below water surface
    const fishMinY = this.waterY + 25;
    const fishMaxY = this.height - 40;
    for (const fish of this.fishes) {
      fish.update(dt, this.width, this.height, fishMinY, fishMaxY);
    }

    // 4. Update fishing hooks & line animation
    for (let i = this.hooks.length - 1; i >= 0; i--) {
      const hook = this.hooks[i];

      if (hook.state === 'descending') {
        const dy = hook.targetY - hook.currentY;
        const dx = hook.targetX - hook.currentX;
        const dist = Math.hypot(dx, dy);

        if (dist <= hook.speed * dt || hook.currentY >= hook.targetY) {
          hook.currentX = hook.targetX;
          hook.currentY = hook.targetY;

          // Check if hook reached fish
          if (hook.hookedFish && hook.hookedFish.state === 'swimming') {
            hook.hookedFish.state = 'hooked';
            hook.state = 'hooked';
            this.soundManager.playCatch();
            this.waterEffects.addSplash(hook.currentX, hook.currentY, 18, '#38bdf8');
            this.waterEffects.addFloatingText(hook.currentX, hook.currentY - 20, `+${hook.hookedFish.config.points}`, '#fef08a', 24);
            this.score += hook.hookedFish.config.points;
            this.caughtCount++;

            setTimeout(() => {
              if (hook.state === 'hooked') {
                hook.state = 'ascending';
              }
            }, 100);
          } else {
            this.waterEffects.addSplash(hook.currentX, hook.currentY, 8, '#bae6fd');
            hook.state = 'ascending';
          }
        } else {
          hook.currentX += (dx / dist) * hook.speed * dt;
          hook.currentY += (dy / dist) * hook.speed * dt;
        }
      } else if (hook.state === 'hooked' || hook.state === 'ascending') {
        // Reel hook and fish back up towards the fisherman boat
        const targetAscendX = this.rodTipX;
        const targetAscendY = this.waterY;
        const dx = targetAscendX - hook.currentX;
        const dy = targetAscendY - hook.currentY;
        const dist = Math.hypot(dx, dy);

        hook.currentY -= hook.speed * 1.3 * dt;
        hook.currentX += (dx / (dist || 1)) * (hook.speed * 0.4) * dt;

        if (hook.hookedFish) {
          hook.hookedFish.x = hook.currentX;
          hook.hookedFish.y = hook.currentY + 14;
        }

        // Reached water surface -> collected into boat
        if (hook.currentY <= this.waterY) {
          hook.state = 'done';
          this.waterEffects.addSplash(hook.currentX, this.waterY + 4, 14, '#ffffff');

          if (hook.hookedFish) {
            const speciesList: FishSpecies[] = ['clownfish', 'blue_tang', 'angelfish', 'golden_fish', 'pufferfish'];
            const sp = speciesList[Math.floor(Math.random() * speciesList.length)];
            hook.hookedFish.config = { ...hook.hookedFish.config };
            hook.hookedFish.species = sp;
            const facing = Math.random() > 0.5 ? 1 : -1;
            const spawnX = facing === 1 ? -60 : this.width + 60;
            hook.hookedFish.reset(spawnX, fishMinY + Math.random() * (fishMaxY - fishMinY), facing, 0.8 + Math.random() * 0.4);
          }
        }
      }

      if (hook.state === 'done') {
        this.hooks.splice(i, 1);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    // 1. SKY ABOVE WATER
    this.renderSky(ctx);

    // 2. UNDERWATER OCEAN
    this.renderUnderwater(ctx);

    // 3. UNDERWATER FISHES
    for (const fish of this.fishes) {
      fish.render(ctx);
    }

    // 4. WATER SURFACE & WAVES
    this.renderWaterSurface(ctx);

    // 5. BOAT & FISHERMAN (Floating on water)
    const rodCoords = this.renderBoatAndFisherman(ctx);
    this.rodTipX = rodCoords.tipX;
    this.rodTipY = rodCoords.tipY;

    // 6. FISHING LINE & HOOK (Extends from fisherman rod to underwater hook)
    for (const hook of this.hooks) {
      this.renderHookAndLine(ctx, hook);
    }

    // 7. WATER PARTICLES & SPLASHES
    this.waterEffects.render(ctx);

    // 8. RESPONSIVE TOP HUD
    this.renderHUD(ctx);

    // 9. MODALS
    if (this.isPaused) {
      this.renderPauseModal(ctx);
    } else if (this.isGameOver) {
      this.renderGameOverModal(ctx);
    }
  }

  private renderSky(ctx: CanvasRenderingContext2D): void {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.waterY);
    skyGrad.addColorStop(0, '#38bdf8');
    skyGrad.addColorStop(0.65, '#7dd3fc');
    skyGrad.addColorStop(1, '#bae6fd');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.width, this.waterY);

    // Sun in the sky
    const sunX = this.width * 0.82;
    const sunY = this.waterY * 0.42;
    ctx.save();
    ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 32, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 18, 0, Math.PI * 2);
    ctx.fill();

    // Fluffy clouds drifting
    this.drawCloud(ctx, (this.width * 0.15 + this.animTimer * 6) % (this.width + 120) - 60, this.waterY * 0.35, 34);
    this.drawCloud(ctx, (this.width * 0.6 + this.animTimer * 4) % (this.width + 120) - 60, this.waterY * 0.25, 26);
    ctx.restore();
  }

  private drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.arc(x + r * 0.7, y - r * 0.2, r * 0.8, 0, Math.PI * 2);
    ctx.arc(x + r * 1.4, y, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private renderUnderwater(ctx: CanvasRenderingContext2D): void {
    const underH = this.height - this.waterY;
    const seaGrad = ctx.createLinearGradient(0, this.waterY, 0, this.height);
    seaGrad.addColorStop(0, '#0284c7');
    seaGrad.addColorStop(0.3, '#0369a1');
    seaGrad.addColorStop(0.7, '#075985');
    seaGrad.addColorStop(1, '#082f49');
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, this.waterY, this.width, underH);

    // Sunlight god rays penetrating into ocean
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      const rx = (this.width / 4) * i + Math.sin(this.animTimer * 0.7 + i) * 20;
      ctx.beginPath();
      ctx.moveTo(rx, this.waterY);
      ctx.lineTo(rx + 60, this.waterY);
      ctx.lineTo(rx + 200, this.height);
      ctx.lineTo(rx + 110, this.height);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Ocean bottom sand dune
    ctx.save();
    ctx.fillStyle = '#0f3c57';
    ctx.beginPath();
    ctx.ellipse(this.width * 0.5, this.height + 15, this.width * 0.65, 60, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private renderWaterSurface(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.moveTo(0, this.waterY);
    for (let x = 0; x <= this.width; x += 20) {
      const wave = Math.sin(this.animTimer * 3 + x * 0.03) * 4;
      ctx.lineTo(x, this.waterY + wave);
    }
    ctx.lineTo(this.width, this.waterY + 12);
    ctx.lineTo(0, this.waterY + 12);
    ctx.closePath();
    ctx.fill();

    // Surface glimmer line
    ctx.beginPath();
    ctx.moveTo(0, this.waterY);
    for (let x = 0; x <= this.width; x += 15) {
      const wave = Math.sin(this.animTimer * 3 + x * 0.03) * 4;
      ctx.lineTo(x, this.waterY + wave);
    }
    ctx.stroke();
    ctx.restore();
  }

  private renderBoatAndFisherman(ctx: CanvasRenderingContext2D): { tipX: number; tipY: number } {
    ctx.save();

    // Boat placement: float along water line
    const boatW = Math.min(130, this.width * 0.32);
    const boatH = 34;
    const isPortrait = this.height > this.width;
    const boatX = isPortrait ? this.width * 0.28 : this.width * 0.35;

    // Bobbing & rocking physics
    const bob = Math.sin(this.animTimer * 2.8) * 3.5;
    const tilt = Math.sin(this.animTimer * 2.8) * 0.04;
    const boatY = this.waterY + bob - 10;

    ctx.translate(boatX, boatY);
    ctx.rotate(tilt);

    // 1. Boat Wooden Hull (Perahu Kayu)
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-boatW / 2, 0);
    ctx.quadraticCurveTo(-boatW * 0.3, boatH, 0, boatH);
    ctx.quadraticCurveTo(boatW * 0.35, boatH, boatW / 2 + 10, -4);
    ctx.lineTo(boatW / 2 - 10, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Hull accent stripe (Kuning keemasan)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-boatW * 0.45, 6);
    ctx.quadraticCurveTo(0, boatH * 0.6, boatW * 0.45, 3);
    ctx.stroke();

    // 2. Fisherman Character (Nelayan Lucu)
    const manX = 4;
    const manY = -8;

    // Body (Baju nelayan biru)
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.roundRect(manX - 10, manY - 14, 20, 18, 6);
    ctx.fill();

    // Head
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(manX, manY - 24, 9, 0, Math.PI * 2);
    ctx.fill();

    // Fisherman Straw Hat / Caping (Topi Caping Kerucut)
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.moveTo(manX - 18, manY - 24);
    ctx.lineTo(manX, manY - 40);
    ctx.lineTo(manX + 18, manY - 24);
    ctx.closePath();
    ctx.fill();

    // Hat brim highlight
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3. Fishing Rod (Joran Pancing)
    const rodBaseX = manX + 8;
    const rodBaseY = manY - 10;
    const rodLen = 75;
    const rodAngle = -0.55 + Math.sin(this.animTimer * 2.8) * 0.03; // points diagonally forward

    const rodTipLocalX = rodBaseX + Math.cos(rodAngle) * rodLen;
    const rodTipLocalY = rodBaseY + Math.sin(rodAngle) * rodLen;

    // Carbon / bamboo rod line
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(rodBaseX, rodBaseY);
    ctx.lineTo(rodTipLocalX, rodTipLocalY);
    ctx.stroke();

    // Reel (Gulungan senar)
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(rodBaseX + 8, rodBaseY - 4, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Convert local rod tip coords to global canvas space
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    const globalTipX = boatX + (rodTipLocalX * cosT - rodTipLocalY * sinT);
    const globalTipY = boatY + (rodTipLocalX * sinT + rodTipLocalY * cosT);

    return { tipX: globalTipX, tipY: globalTipY };
  }

  private renderHookAndLine(ctx: CanvasRenderingContext2D, hook: FishingHook): void {
    ctx.save();

    // 1. Fishing Line (Senar Pancing): Stretches seamlessly from fisherman's rod tip to hook
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 2]);
    ctx.beginPath();
    ctx.moveTo(this.rodTipX, this.rodTipY);
    ctx.lineTo(hook.currentX, hook.currentY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Shiny Metal Fishing Hook
    ctx.translate(hook.currentX, hook.currentY);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(0, 4);
    ctx.arc(-5, 4, 5, 0, Math.PI);
    ctx.lineTo(-10, 0);
    ctx.stroke();

    // Hook Eyelet & Sinker
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(0, -12, 3, 0, Math.PI * 2);
    ctx.fill();

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
        isUrgent ? 'rgba(239, 68, 68, 0.4)' : 'rgba(15, 23, 42, 0.82)',
        isUrgent ? '#ef4444' : '#38bdf8',
        `⏱ ${Math.ceil(this.timeLeft)}s`,
        isUrgent ? '#fca5a5' : '#e0f2fe'
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
        'rgba(15, 23, 42, 0.82)',
        '#0284c7',
        `🐟 ${this.caughtCount} Ekor`,
        '#7dd3fc'
      );

      this.renderCapsule(
        ctx,
        12 + colW + 8,
        row2Y,
        colW,
        32,
        'rgba(15, 23, 42, 0.82)',
        '#eab308',
        `🏆 ${this.score}`,
        '#fef08a'
      );
    } else {
      // Wide / Landscape Mode: Sleek Single Bar
      const barH = 46;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(12, topSafe, this.width - 24, barH, 14);
      ctx.fill();
      ctx.stroke();

      this.renderIconButton(ctx, { x: 20, y: topSafe + 5, w: 36, h: 36 }, '🏠');
      this.renderIconButton(ctx, { x: 62, y: topSafe + 5, w: 36, h: 36 }, this.isPaused ? '▶' : '⏸');

      const isUrgent = this.timeLeft <= 10;
      ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = isUrgent ? '#ef4444' : '#e0f2fe';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`⏱ Sisa: ${Math.ceil(this.timeLeft)}s`, 116, topSafe + barH / 2);

      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`🐟 Terpancing: ${this.caughtCount}`, this.width * 0.44, topSafe + barH / 2);

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
    ctx.strokeStyle = '#0284c7';
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
    ctx.strokeStyle = '#38bdf8';
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
    ctx.fillStyle = '#0284c7';
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
    ctx.fillText('WAKTU HABIS! 🎣', this.width / 2, boxY + 36);

    ctx.font = '14px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Ikan Terpancing: ${this.caughtCount} ekor`, this.width / 2, boxY + 70);

    ctx.font = '900 30px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`Skor: ${this.score}`, this.width / 2, boxY + 110);

    const isNewRecord = this.score > this.stats.fishingHighScore;
    if (isNewRecord) {
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#22c55e';
      ctx.fillText('🎉 REKOR SKOR BARU! 🎉', this.width / 2, boxY + 148);
    } else {
      ctx.font = '13px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`Rekor Terbaik: ${this.stats.fishingHighScore}`, this.width / 2, boxY + 148);
    }

    const rb = this.retryBtnBounds;
    ctx.fillStyle = '#0284c7';
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

    if (this.score > this.stats.fishingHighScore) {
      StorageManager.save({ fishingHighScore: this.score });
      this.stats.fishingHighScore = this.score;
    }
  }

  public handlePointerDown(x: number, y: number): void {
    // If Game Over
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

    // If Paused
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

    // Check Home button
    const hb = this.homeBtnBounds;
    if (x >= hb.x && x <= hb.x + hb.w && y >= hb.y && y <= hb.y + hb.h) {
      this.soundManager.playTap();
      SceneDirector.getInstance().switchScene('lobby');
      return;
    }

    // Check Pause button
    const pb = this.pauseBtnBounds;
    if (x >= pb.x && x <= pb.x + pb.w && y >= pb.y && y <= pb.y + pb.h) {
      this.soundManager.playTap();
      this.isPaused = !this.isPaused;
      return;
    }

    // Guard: Prevent hook launch if tapping on HUD or above water surface
    if (y < this.waterY + 15) {
      return;
    }

    // Gameplay Tap: Launch Fishing Hook from Fisherman Rod Tip towards tapped fish
    let tappedFish: FishEntity | null = null;
    for (const fish of this.fishes) {
      if (fish.state === 'swimming' && fish.containsPoint(x, y)) {
        tappedFish = fish;
        break;
      }
    }

    if (this.hooks.length < 2) {
      this.soundManager.playHookDrop();
      this.hooks.push({
        id: ++this.hookCounter,
        startX: this.rodTipX,
        startY: this.rodTipY,
        targetX: x,
        targetY: y,
        currentX: this.rodTipX,
        currentY: this.rodTipY,
        state: 'descending',
        speed: 700,
        hookedFish: tappedFish
      });
    }
  }

  public handlePointerMove(): void {}
  public handlePointerUp(): void {}

  public destroy(): void {
    this.fishes = [];
    this.hooks = [];
  }
}
