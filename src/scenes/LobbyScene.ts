import { IScene, SceneDirector } from '../core/SceneDirector.ts';
import { FishEntity, FishSpecies } from '../common/FishTypes.ts';
import { WaterEffects } from '../common/WaterEffects.ts';
import { SoundManager } from '../core/SoundManager.ts';
import { StorageManager, GameStats } from '../core/StorageManager.ts';

export class LobbyScene implements IScene {
  public readonly id = 'lobby';
  private width: number = 800;
  private height: number = 600;

  private bgFishes: FishEntity[] = [];
  private waterEffects: WaterEffects;
  private soundManager: SoundManager;
  private stats: GameStats;

  private card1Bounds = { x: 0, y: 0, w: 0, h: 0 };
  private card2Bounds = { x: 0, y: 0, w: 0, h: 0 };
  private card3Bounds = { x: 0, y: 0, w: 0, h: 0 };
  private soundBtnBounds = { x: 0, y: 0, w: 42, h: 42 };

  private seaweedPhase: number = 0;
  private animTimer: number = 0;

  constructor() {
    this.soundManager = SoundManager.getInstance();
    this.stats = StorageManager.load();
    this.waterEffects = new WaterEffects(20, 800, 600);
  }

  public init(width: number, height: number): void {
    this.resize(width, height);
    this.stats = StorageManager.load();

    // Spawn 8 decorative background fishes
    const speciesList: FishSpecies[] = ['clownfish', 'blue_tang', 'angelfish', 'golden_fish', 'pufferfish'];
    this.bgFishes = [];
    for (let i = 0; i < 8; i++) {
      const species = speciesList[i % speciesList.length];
      const fish = new FishEntity(i, species);
      const facing = Math.random() > 0.5 ? 1 : -1;
      fish.reset(Math.random() * width, height * 0.2 + Math.random() * (height * 0.6), facing, 0.75 + Math.random() * 0.35);
      this.bgFishes.push(fish);
    }
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    const isPortrait = height > width;
    const topSafe = Math.max(16, height * 0.03);

    this.soundBtnBounds = {
      x: width - 54,
      y: topSafe,
      w: 40,
      h: 40
    };

    if (isPortrait) {
      const headerAreaH = Math.min(85, height * 0.14);
      const startY = topSafe + headerAreaH;
      const bottomMargin = Math.max(14, height * 0.03);
      const availableH = height - startY - bottomMargin;

      const cardW = Math.min(width - 28, 380);
      const gap = Math.min(10, Math.max(6, availableH * 0.02));
      const cardH = Math.min(160, Math.max(118, (availableH - gap * 2) / 3));

      this.card1Bounds = {
        x: (width - cardW) / 2,
        y: startY,
        w: cardW,
        h: cardH
      };
      this.card2Bounds = {
        x: (width - cardW) / 2,
        y: startY + cardH + gap,
        w: cardW,
        h: cardH
      };
      this.card3Bounds = {
        x: (width - cardW) / 2,
        y: startY + (cardH + gap) * 2,
        w: cardW,
        h: cardH
      };
    } else {
      // Landscape: 3 Balanced Columns Side-by-Side
      const gap = 16;
      const cardW = Math.min((width - 56) / 3, 260);
      const cardH = Math.min(height - 105, 230);
      const totalW = cardW * 3 + gap * 2;
      const startX = (width - totalW) / 2;
      const centerY = (height - cardH) / 2 + 25;

      this.card1Bounds = {
        x: startX,
        y: centerY,
        w: cardW,
        h: cardH
      };
      this.card2Bounds = {
        x: startX + cardW + gap,
        y: centerY,
        w: cardW,
        h: cardH
      };
      this.card3Bounds = {
        x: startX + (cardW + gap) * 2,
        y: centerY,
        w: cardW,
        h: cardH
      };
    }
  }

  public update(dt: number): void {
    this.seaweedPhase += dt * 2;
    this.animTimer += dt;
    this.waterEffects.update(dt, this.width, this.height);

    for (const fish of this.bgFishes) {
      fish.update(dt, this.width, this.height);
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    // 1. Deep Ocean Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, this.height);
    bgGrad.addColorStop(0, '#0284c7');
    bgGrad.addColorStop(0.35, '#0369a1');
    bgGrad.addColorStop(0.75, '#075985');
    bgGrad.addColorStop(1, '#0c4a6e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // 2. Sunlight God Rays from top
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) {
      const xOffset = (this.width / 4) * i + Math.sin(this.animTimer * 0.8 + i) * 30;
      ctx.beginPath();
      ctx.moveTo(xOffset, 0);
      ctx.lineTo(xOffset + 80, 0);
      ctx.lineTo(xOffset + 240, this.height);
      ctx.lineTo(xOffset + 120, this.height);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 3. Sandy bottom with waving seaweeds
    ctx.fillStyle = '#0f3c57';
    ctx.beginPath();
    ctx.ellipse(this.width * 0.5, this.height + 20, this.width * 0.6, 90, 0, 0, Math.PI * 2);
    ctx.fill();

    // Seaweeds
    this.drawSeaweed(ctx, this.width * 0.08, this.height, 90, '#065f46');
    this.drawSeaweed(ctx, this.width * 0.12, this.height, 120, '#047857');
    this.drawSeaweed(ctx, this.width * 0.88, this.height, 110, '#065f46');
    this.drawSeaweed(ctx, this.width * 0.92, this.height, 80, '#047857');

    // 4. Background fishes
    for (const fish of this.bgFishes) {
      fish.render(ctx);
    }

    // 5. Bubbles
    this.waterEffects.render(ctx);

    // 6. Header Title & Subtitle (Auto-scaled)
    this.renderHeader(ctx);

    // 7. Interactive Game Cards
    // Card 1: Pancing Ikan
    this.renderGameCard(
      ctx,
      this.card1Bounds,
      '🎣 PANCING IKAN',
      'Tap ikan untuk meluncurkan kail!',
      'Kail Cepat',
      this.stats.fishingHighScore,
      '#0284c7',
      '#38bdf8'
    );

    // Card 2: Serok Ikan
    this.renderGameCard(
      ctx,
      this.card2Bounds,
      '🕸️ SEROK IKAN',
      'Drag saringan di dalam akuarium!',
      'Akuarium',
      this.stats.netHighScore,
      '#059669',
      '#34d399'
    );

    // Card 3: Tebas Ikan 3D (Fruit Ninja style)
    this.renderGameCard(
      ctx,
      this.card3Bounds,
      '⚔️ TEBAS IKAN 3D',
      'Swipe jari tebas ikan melambung!',
      'Fruit Ninja 3D',
      this.stats.slashHighScore,
      '#be185d',
      '#ec4899'
    );

    // 8. Sound Toggle Button
    this.renderSoundButton(ctx);
  }

  private drawSeaweed(ctx: CanvasRenderingContext2D, x: number, y: number, height: number, color: string): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);

    const sway = Math.sin(this.seaweedPhase + x * 0.05) * 25;
    ctx.bezierCurveTo(x + sway * 0.3, y - height * 0.4, x - sway * 0.5, y - height * 0.7, x + sway, y - height);
    ctx.stroke();
    ctx.restore();
  }

  private renderHeader(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = 'center';

    const topSafe = Math.max(14, this.height * 0.025);
    const titleFontSize = Math.max(18, Math.min(26, this.width * 0.06));
    const subFontSize = Math.max(11, Math.min(13, this.width * 0.03));

    const titleY = topSafe + titleFontSize + 4;
    const subY = titleY + subFontSize + 6;

    // Title with soft glow
    ctx.font = `900 ${titleFontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#000000aa';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.fillText('🌊 ARCADE GAME IKAN 🌊', this.width / 2, titleY);

    // Subtitle
    ctx.font = `600 ${subFontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = '#e0f2fe';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillText('Pilih permainan dan kumpulkan skor tertinggi!', this.width / 2, subY);

    ctx.restore();
  }

  private renderGameCard(
    ctx: CanvasRenderingContext2D,
    bounds: { x: number; y: number; w: number; h: number },
    title: string,
    desc: string,
    tag: string,
    highScore: number,
    baseColor: string,
    accentColor: string
  ): void {
    if (bounds.w <= 0 || bounds.h <= 0) return;
    ctx.save();

    // Card Glow / Shadow
    ctx.shadowColor = '#00000077';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 5;

    // Card Background Box
    const radius = 14;
    ctx.beginPath();
    ctx.roundRect(bounds.x, bounds.y, bounds.w, bounds.h, radius);
    const grad = ctx.createLinearGradient(bounds.x, bounds.y, bounds.x, bounds.y + bounds.h);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.90)');
    grad.addColorStop(1, 'rgba(30, 41, 59, 0.94)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Card Border
    ctx.shadowColor = accentColor + '44';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = accentColor;
    ctx.stroke();
    ctx.shadowColor = 'transparent';

    const padX = 14;
    const padY = 10;

    // 1. Tag Pill
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
    const tagWidth = ctx.measureText(tag.toUpperCase()).width + 14;
    const pillH = 20;
    const pillX = bounds.x + padX;
    const pillY = bounds.y + padY;

    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, tagWidth, pillH, 10);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tag.toUpperCase(), pillX + 7, pillY + pillH / 2);

    // 2. Highscore Mini Badge on top right
    const scoreBadgeX = bounds.x + bounds.w - padX;
    ctx.textAlign = 'right';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#fef08a';
    ctx.fillText(`⭐ ${highScore} pts`, scoreBadgeX, pillY + pillH / 2);

    // 3. Title
    const titleY = pillY + pillH + 16;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '900 16px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, bounds.x + padX, titleY);

    // 4. Description (compact)
    const descY = titleY + 16;
    ctx.font = '500 11px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(desc, bounds.x + padX, descY);

    // 5. Action Button
    const btnH = Math.min(34, Math.max(28, bounds.h * 0.22));
    const btnW = bounds.w - padX * 2;
    const btnX = bounds.x + padX;
    const btnY = bounds.y + bounds.h - btnH - padY;

    const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY);
    btnGrad.addColorStop(0, baseColor);
    btnGrad.addColorStop(1, accentColor);

    ctx.shadowColor = accentColor + '66';
    ctx.shadowBlur = 6;
    ctx.fillStyle = btnGrad;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, btnH / 2);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MAIN SEKARANG ▶', btnX + btnW / 2, btnY + btnH / 2);

    ctx.restore();
  }

  private renderSoundButton(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const b = this.soundBtnBounds;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = this.soundManager.enabled ? '#38bdf8' : '#64748b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, b.w / 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.soundManager.enabled ? '🔊' : '🔇', b.x + b.w / 2, b.y + b.h / 2);

    ctx.restore();
  }

  public handlePointerDown(x: number, y: number): void {
    // Check Sound toggle button
    const sb = this.soundBtnBounds;
    if (x >= sb.x && x <= sb.x + sb.w && y >= sb.y && y <= sb.y + sb.h) {
      this.soundManager.enabled = !this.soundManager.enabled;
      StorageManager.save({ soundEnabled: this.soundManager.enabled });
      this.soundManager.playTap();
      return;
    }

    // Check Card 1 (Fishing Game)
    const c1 = this.card1Bounds;
    if (x >= c1.x && x <= c1.x + c1.w && y >= c1.y && y <= c1.y + c1.h) {
      this.soundManager.playTap();
      this.soundManager.playSplash();
      SceneDirector.getInstance().switchScene('fishing');
      return;
    }

    // Check Card 2 (Net Scoop Game)
    const c2 = this.card2Bounds;
    if (x >= c2.x && x <= c2.x + c2.w && y >= c2.y && y <= c2.y + c2.h) {
      this.soundManager.playTap();
      this.soundManager.playScoop();
      SceneDirector.getInstance().switchScene('net_scoop');
      return;
    }

    // Check Card 3 (Fish Slash Game 3D)
    const c3 = this.card3Bounds;
    if (x >= c3.x && x <= c3.x + c3.w && y >= c3.y && y <= c3.y + c3.h) {
      this.soundManager.playTap();
      this.soundManager.playBladeWhoosh();
      SceneDirector.getInstance().switchScene('fish_slash');
      return;
    }
  }

  public handlePointerMove(): void {}
  public handlePointerUp(): void {}

  public destroy(): void {
    this.bgFishes = [];
  }
}
