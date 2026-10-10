import { IScene, SceneDirector } from '../core/SceneDirector.ts';
import { FishEntity, FishSpecies } from '../common/FishTypes.ts';
import { WaterEffects } from '../common/WaterEffects.ts';
import { SoundManager } from '../core/SoundManager.ts';
import { StorageManager, GameStats } from '../core/StorageManager.ts';

interface ScoopNet {
  x: number;
  y: number;
  radius: number;
  isDragging: boolean;
  angle: number;
  caughtFishes: FishEntity[];
}

interface AeratorBubble {
  x: number;
  y: number;
  radius: number;
  speed: number;
  drift: number;
  phase: number;
}

export class NetScoopScene implements IScene {
  public readonly id = 'net_scoop';
  private width: number = 800;
  private height: number = 600;

  private fishes: FishEntity[] = [];
  private waterEffects: WaterEffects;
  private soundManager: SoundManager;
  private stats: GameStats;

  // Aquarium Aerator Bubbles
  private aeratorBubbles: AeratorBubble[] = [];
  private animTimer: number = 0;
  private plantSway: number = 0;

  private net: ScoopNet = {
    x: 400,
    y: 300,
    radius: 44,
    isDragging: false,
    angle: 0.3,
    caughtFishes: []
  };

  private score: number = 0;
  private caughtCount: number = 0;
  private timeLeft: number = 60;
  private isPaused: boolean = false;
  private isGameOver: boolean = false;

  // UI Interactive Bounds
  private homeBtnBounds = { x: 12, y: 10, w: 36, h: 36 };
  private pauseBtnBounds = { x: 54, y: 10, w: 36, h: 36 };
  private retryBtnBounds = { x: 0, y: 0, w: 140, h: 42 };
  private lobbyBtnBounds = { x: 0, y: 0, w: 140, h: 42 };
  private resumeBtnBounds = { x: 0, y: 0, w: 220, h: 42 };
  private pauseLobbyBtnBounds = { x: 0, y: 0, w: 220, h: 42 };

  private isNarrowScreen: boolean = false;
  private hudHeight: number = 60;
  private gravelHeight: number = 48;

  constructor() {
    this.soundManager = SoundManager.getInstance();
    this.stats = StorageManager.load();
    this.waterEffects = new WaterEffects(20, 800, 600);
  }

  public init(width: number, height: number): void {
    this.resize(width, height);
    this.score = 0;
    this.caughtCount = 0;
    this.timeLeft = 60;
    this.isPaused = false;
    this.isGameOver = false;
    this.animTimer = 0;

    this.net.x = width / 2;
    this.net.y = height / 2;
    this.net.isDragging = false;
    this.net.caughtFishes = [];

    // Init continuous aerator bubbles column
    this.aeratorBubbles = [];
    const aeratorX = width - 42;
    for (let i = 0; i < 24; i++) {
      this.aeratorBubbles.push({
        x: aeratorX + (Math.random() - 0.5) * 14,
        y: this.hudHeight + Math.random() * (height - this.hudHeight - this.gravelHeight),
        radius: 1.5 + Math.random() * 3.5,
        speed: 40 + Math.random() * 60,
        drift: 0.8 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2
      });
    }

    // Spawn 14 ornamental fishes inside aquarium boundaries
    this.fishes = [];
    const speciesList: FishSpecies[] = ['clownfish', 'blue_tang', 'angelfish', 'golden_fish', 'pufferfish'];
    const fishMinY = this.hudHeight + 25;
    const fishMaxY = height - this.gravelHeight - 20;

    for (let i = 0; i < 14; i++) {
      const sp = speciesList[Math.floor(Math.random() * speciesList.length)];
      const fish = new FishEntity(i, sp);
      const facing = Math.random() > 0.5 ? 1 : -1;
      fish.reset(
        Math.random() * width,
        fishMinY + Math.random() * (fishMaxY - fishMinY),
        facing,
        0.75 + Math.random() * 0.35
      );
      this.fishes.push(fish);
    }
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.isNarrowScreen = width < 520;
    this.hudHeight = this.isNarrowScreen ? 92 : 54;
    this.gravelHeight = Math.min(55, Math.max(38, height * 0.08));

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
    this.plantSway += dt * 2.2;

    // Timer countdown
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.triggerGameOver();
    }

    // Water particles
    this.waterEffects.update(dt, this.width, this.height);

    // Update continuous aerator bubbles
    const aeratorX = this.width - 42;
    const topLimit = this.hudHeight + 8;
    const bottomLimit = this.height - this.gravelHeight;

    for (const b of this.aeratorBubbles) {
      b.y -= b.speed * dt;
      b.phase += b.drift * 3 * dt;
      b.x = aeratorX + Math.sin(b.phase) * 6;

      if (b.y < topLimit) {
        b.y = bottomLimit + Math.random() * 10;
        b.speed = 40 + Math.random() * 60;
      }
    }

    // Update fishes strictly inside aquarium
    const fishMinY = this.hudHeight + 25;
    const fishMaxY = this.height - this.gravelHeight - 20;

    for (const fish of this.fishes) {
      if (fish.state === 'swimming') {
        fish.update(dt, this.width, this.height, fishMinY, fishMaxY);

        const dist = Math.hypot(fish.x - this.net.x, fish.y - this.net.y);
        if (dist < this.net.radius + 10) {
          this.captureFish(fish);
        }
      } else if (fish.state === 'scooped') {
        fish.x = this.net.x + (Math.random() - 0.5) * 6;
        fish.y = this.net.y + (Math.random() - 0.5) * 6;
      }
    }
  }

  private captureFish(fish: FishEntity): void {
    fish.state = 'scooped';
    this.net.caughtFishes.push(fish);

    this.soundManager.playScoop();
    this.soundManager.playCatch();
    this.waterEffects.addSplash(this.net.x, this.net.y, 16, '#34d399');

    const bonus = fish.config.points;
    this.score += bonus;
    this.caughtCount++;

    this.waterEffects.addFloatingText(this.net.x, this.net.y - 30, `+${bonus} ${fish.config.name}!`, '#fef08a', 20);

    setTimeout(() => {
      const idx = this.net.caughtFishes.indexOf(fish);
      if (idx !== -1) {
        this.net.caughtFishes.splice(idx, 1);
      }

      const speciesList: FishSpecies[] = ['clownfish', 'blue_tang', 'angelfish', 'golden_fish', 'pufferfish'];
      const sp = speciesList[Math.floor(Math.random() * speciesList.length)];
      fish.species = sp;
      fish.config = { ...fish.config };
      const facing = Math.random() > 0.5 ? 1 : -1;
      const spawnX = facing === 1 ? -60 : this.width + 60;
      const fishMinY = this.hudHeight + 25;
      const fishMaxY = this.height - this.gravelHeight - 20;
      fish.reset(spawnX, fishMinY + Math.random() * (fishMaxY - fishMinY), facing, 0.75 + Math.random() * 0.35);
    }, 450);
  }

  public render(ctx: CanvasRenderingContext2D): void {
    // 1. AQUARIUM WATER BACKGROUND
    const waterGrad = ctx.createLinearGradient(0, 0, 0, this.height);
    waterGrad.addColorStop(0, '#0284c7');
    waterGrad.addColorStop(0.35, '#0891b2');
    waterGrad.addColorStop(0.75, '#0e7490');
    waterGrad.addColorStop(1, '#155e75');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // 2. AQUARIUM BACK WALL CAUSTICS
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse((this.width / 3) * i, this.height * 0.45, 140, 70, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 3. COLORFUL AQUARIUM GRAVEL / PEBBLES (Dasar Kerikil Akuarium)
    this.renderAquariumGravel(ctx);

    // 4. AQUARIUM AQUATIC PLANTS (Tanaman Hias Akuarium)
    this.renderAquariumPlants(ctx);

    // 5. MINI CASTLE / ROCK ORNAMENT (Ornamen Miniatur Akuarium)
    this.renderAquariumOrnament(ctx);

    // 6. AERATOR FILTER PIPE & BUBBLES STREAM (Pipa Aerator & Kolom Gelembung)
    this.renderAeratorColumn(ctx);

    // 7. ORNAMENTAL FISHES
    for (const fish of this.fishes) {
      fish.render(ctx);
    }

    // 8. SCOOP NET (Serokan Jaring Bundar)
    this.renderScoopNet(ctx);

    // 9. WATER PARTICLES & FLOATING TEXTS
    this.waterEffects.render(ctx);

    // 10. GLASS TANK REFLECTIONS & TANK FRAME (Bingkai & Pantulan Kaca Akuarium)
    this.renderGlassAquariumFrame(ctx);

    // 11. RESPONSIVE TOP HUD
    this.renderHUD(ctx);

    // 12. MODALS
    if (this.isPaused) {
      this.renderPauseModal(ctx);
    } else if (this.isGameOver) {
      this.renderGameOverModal(ctx);
    }
  }

  private renderAquariumGravel(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const gTop = this.height - this.gravelHeight;

    // Dark sandy base under gravel
    ctx.fillStyle = '#0f3c57';
    ctx.fillRect(0, gTop + 8, this.width, this.gravelHeight);

    // Colorful pebbles pattern in rows
    const colors = ['#38bdf8', '#34d399', '#f472b6', '#facc15', '#a78bfa', '#e2e8f0', '#2dd4bf'];
    const pebbleRadius = 7;
    const step = 14;

    for (let x = 4; x <= this.width + 10; x += step) {
      for (let y = gTop + 6; y <= this.height; y += step) {
        const colorIdx = Math.floor((Math.sin(x * 12 + y * 8) + 1) * 3.5) % colors.length;
        ctx.fillStyle = colors[colorIdx];
        ctx.beginPath();
        ctx.arc(x + (y % 2 ? 6 : 0), y, pebbleRadius, 0, Math.PI * 2);
        ctx.fill();

        // Pebble shine highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.beginPath();
        ctx.arc(x + (y % 2 ? 6 : 0) - 2, y - 2, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private renderAquariumPlants(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const baseY = this.height - this.gravelHeight + 8;

    // Left cluster of Cabomba/Fern plants
    this.drawPlantStem(ctx, this.width * 0.06, baseY, 130, '#059669', '#10b981', 1);
    this.drawPlantStem(ctx, this.width * 0.12, baseY, 160, '#047857', '#34d399', -1);

    // Right cluster of aquatic plants
    this.drawPlantStem(ctx, this.width * 0.84, baseY, 150, '#047857', '#34d399', 1);
    this.drawPlantStem(ctx, this.width * 0.90, baseY, 110, '#059669', '#10b981', -1);
    ctx.restore();
  }

  private drawPlantStem(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    h: number,
    stemColor: string,
    leafColor: string,
    dir: number
  ): void {
    ctx.save();
    const sway = Math.sin(this.plantSway + x * 0.05) * 18 * dir;

    // Main stem
    ctx.strokeStyle = stemColor;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + sway * 0.3, y - h * 0.4, x - sway * 0.3, y - h * 0.7, x + sway, y - h);
    ctx.stroke();

    // Leaves along stem
    ctx.fillStyle = leafColor;
    for (let i = 1; i <= 6; i++) {
      const frac = i / 7;
      const lx = x + sway * frac;
      const ly = y - h * frac;
      const lDir = (i % 2 === 0 ? 1 : -1) * dir;

      ctx.beginPath();
      ctx.ellipse(lx + lDir * 14, ly, 16, 6, (lDir * 0.4) + sway * 0.02, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderAquariumOrnament(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    // Miniature Castle / Rock Ornament on bottom left
    const ox = this.width * 0.22;
    const oy = this.height - this.gravelHeight;

    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.5;

    // Base rock
    ctx.beginPath();
    ctx.roundRect(ox - 24, oy - 20, 48, 24, 8);
    ctx.fill();
    ctx.stroke();

    // Center tower
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.roundRect(ox - 14, oy - 50, 28, 34, 4);
    ctx.fill();
    ctx.stroke();

    // Turret cones
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(ox - 16, oy - 50);
    ctx.lineTo(ox, oy - 68);
    ctx.lineTo(ox + 16, oy - 50);
    ctx.closePath();
    ctx.fill();

    // Arch window
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(ox, oy - 34, 6, Math.PI, 0);
    ctx.lineTo(ox + 6, oy - 22);
    ctx.lineTo(ox - 6, oy - 22);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private renderAeratorColumn(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const aeratorX = this.width - 42;
    const gTop = this.height - this.gravelHeight;

    // Acrylic Tube (Pipa Filter Aerator Bening)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(aeratorX - 6, this.hudHeight, 12, gTop - this.hudHeight, 4);
    ctx.fill();
    ctx.stroke();

    // Air Stone (Batu Aerator di dasar)
    ctx.fillStyle = '#94a3b8';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(aeratorX - 10, gTop - 12, 20, 14, 4);
    ctx.fill();
    ctx.stroke();

    // Streaming micro bubbles from aerator
    for (const b of this.aeratorBubbles) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();

      // Bubble outline
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.9)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderGlassAquariumFrame(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // 1. Top & Bottom Rim (Bingkai Kayu/Besi Akuarium Modern)
    const rimH = 12;
    const rimGrad = ctx.createLinearGradient(0, 0, this.width, 0);
    rimGrad.addColorStop(0, '#1e293b');
    rimGrad.addColorStop(0.5, '#334155');
    rimGrad.addColorStop(1, '#1e293b');

    ctx.fillStyle = rimGrad;
    ctx.fillRect(0, 0, this.width, rimH);
    ctx.fillRect(0, this.height - rimH, this.width, rimH);

    // Metallic gold border trim on rims
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, rimH, this.width, 2.5);
    ctx.fillRect(0, this.height - rimH - 2.5, this.width, 2.5);

    // 2. Thick Glass Borders on Left and Right sides (Kaca Akuarium Tebal)
    ctx.fillStyle = 'rgba(45, 212, 191, 0.15)';
    ctx.fillRect(0, rimH, 10, this.height - rimH * 2);
    ctx.fillRect(this.width - 10, rimH, 10, this.height - rimH * 2);

    // 3. Diagonal Glass Reflection Sheen (Pantulan Silau Kaca Akuarium)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.beginPath();
    ctx.moveTo(this.width * 0.15, rimH);
    ctx.lineTo(this.width * 0.32, rimH);
    ctx.lineTo(this.width * 0.12, this.height - rimH);
    ctx.lineTo(this.width * -0.05, this.height - rimH);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(this.width * 0.38, rimH);
    ctx.lineTo(this.width * 0.44, rimH);
    ctx.lineTo(this.width * 0.24, this.height - rimH);
    ctx.lineTo(this.width * 0.18, this.height - rimH);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private renderScoopNet(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.net.x, this.net.y);

    const r = this.net.radius;

    // Handle (Gagang bambu / kayu halus serokan)
    ctx.save();
    ctx.rotate(-Math.PI / 4);
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.lineTo(0, r + 85);
    ctx.stroke();

    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(0, r + 20);
    ctx.lineTo(0, r + 80);
    ctx.stroke();
    ctx.restore();

    // Translucent Net Mesh
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Grid mesh
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.2;
    for (let i = -r + 10; i < r; i += 12) {
      ctx.beginPath();
      ctx.moveTo(i, -Math.sqrt(r * r - i * i));
      ctx.lineTo(i, Math.sqrt(r * r - i * i));
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-Math.sqrt(r * r - i * i), i);
      ctx.lineTo(Math.sqrt(r * r - i * i), i);
      ctx.stroke();
    }

    // Outer Net Ring (Bingkai Serokan Ikan)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    // Catch Indicator Aura when dragged
    if (this.net.isDragging) {
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.65)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
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
        isUrgent ? '#ef4444' : '#34d399',
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
        '#059669',
        `🕸️ ${this.caughtCount} Ekor`,
        '#6ee7b7'
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
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#059669';
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

      ctx.fillStyle = '#34d399';
      ctx.fillText(`🕸️ Terserok: ${this.caughtCount}`, this.width * 0.44, topSafe + barH / 2);

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
    ctx.strokeStyle = '#059669';
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
    ctx.strokeStyle = '#34d399';
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
    ctx.fillStyle = '#059669';
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
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 20);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#fef08a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WAKTU HABIS! 🕸️', this.width / 2, boxY + 36);

    ctx.font = '14px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Ikan Terserok: ${this.caughtCount} ekor`, this.width / 2, boxY + 70);

    ctx.font = '900 30px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#34d399';
    ctx.fillText(`Skor: ${this.score}`, this.width / 2, boxY + 110);

    const isNewRecord = this.score > this.stats.netHighScore;
    if (isNewRecord) {
      ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#22c55e';
      ctx.fillText('🎉 REKOR SKOR BARU! 🎉', this.width / 2, boxY + 148);
    } else {
      ctx.font = '13px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`Rekor Terbaik: ${this.stats.netHighScore}`, this.width / 2, boxY + 148);
    }

    const rb = this.retryBtnBounds;
    ctx.fillStyle = '#059669';
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

    if (this.score > this.stats.netHighScore) {
      StorageManager.save({ netHighScore: this.score });
      this.stats.netHighScore = this.score;
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

    // Prevent dragging net when tapping on HUD area
    if (y < this.hudHeight) {
      return;
    }

    this.net.isDragging = true;
    this.net.x = Math.max(this.net.radius + 10, Math.min(this.width - this.net.radius - 10, x));
    this.net.y = Math.max(this.hudHeight + this.net.radius, Math.min(this.height - this.gravelHeight - 5, y));
  }

  public handlePointerMove(x: number, y: number): void {
    if (this.isPaused || this.isGameOver) return;
    if (this.net.isDragging) {
      this.net.x = Math.max(this.net.radius + 10, Math.min(this.width - this.net.radius - 10, x));
      this.net.y = Math.max(this.hudHeight + this.net.radius, Math.min(this.height - this.gravelHeight - 5, y));

      if (Math.random() < 0.25) {
        this.waterEffects.addSplash(this.net.x, this.net.y, 3, '#6ee7b7');
      }
    }
  }

  public handlePointerUp(): void {
    this.net.isDragging = false;
  }

  public destroy(): void {
    this.fishes = [];
    this.net.caughtFishes = [];
    this.aeratorBubbles = [];
  }
}
