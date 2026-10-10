import { SceneDirector } from './core/SceneDirector.ts';
import { LobbyScene } from './scenes/LobbyScene.ts';
import { FishingScene } from './scenes/FishingScene.ts';
import { NetScoopScene } from './scenes/NetScoopScene.ts';
import { FishSlashScene } from './scenes/FishSlashScene.ts';

class GameApp {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private director: SceneDirector;
  private lastTime: number = 0;
  private dpr: number = 1;

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    const context = this.canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Gagal menginisialisasi 2D Canvas context!');
    }
    this.ctx = context;
    this.director = SceneDirector.getInstance();

    this.registerScenes();
    this.setupViewport();
    this.bindEvents();

    // Start with Lobby
    this.director.switchScene('lobby');

    // Start loop
    this.lastTime = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private registerScenes(): void {
    this.director.registerScene('lobby', () => new LobbyScene());
    this.director.registerScene('fishing', () => new FishingScene());
    this.director.registerScene('net_scoop', () => new NetScoopScene());
    this.director.registerScene('fish_slash', () => new FishSlashScene());
  }

  private setupViewport(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Clamp DPR to max 2.0 for battery & performance balance on Android
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;

    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.director.resize(width, height);
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => {
      this.setupViewport();
    });

    // Pause on tab/window blur or minimize
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.director.currentScene) {
        // Automatically pause game scenes when leaving app
        if (this.director.currentScene.id === 'fishing') {
          (this.director.currentScene as unknown as { isPaused: boolean }).isPaused = true;
        } else if (this.director.currentScene.id === 'net_scoop') {
          (this.director.currentScene as unknown as { isPaused: boolean }).isPaused = true;
        } else if (this.director.currentScene.id === 'fish_slash') {
          (this.director.currentScene as unknown as { isPaused: boolean }).isPaused = true;
        }
      }
    });

    // Pointer events (Works smoothly for both Touch on Android and Mouse on Desktop)
    const getCoords = (e: PointerEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    this.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      const coords = getCoords(e);
      if (this.director.currentScene) {
        this.director.currentScene.handlePointerDown(coords.x, coords.y, e.pointerId);
      }
    });

    this.canvas.addEventListener('pointermove', (e: PointerEvent) => {
      e.preventDefault();
      const coords = getCoords(e);
      if (this.director.currentScene) {
        this.director.currentScene.handlePointerMove(coords.x, coords.y, e.pointerId);
      }
    });

    this.canvas.addEventListener('pointerup', (e: PointerEvent) => {
      e.preventDefault();
      const coords = getCoords(e);
      if (this.director.currentScene) {
        this.director.currentScene.handlePointerUp(coords.x, coords.y, e.pointerId);
      }
    });

    this.canvas.addEventListener('pointercancel', (e: PointerEvent) => {
      e.preventDefault();
      const coords = getCoords(e);
      if (this.director.currentScene) {
        this.director.currentScene.handlePointerUp(coords.x, coords.y, e.pointerId);
      }
    });
  }

  private gameLoop(time: number): void {
    const dt = Math.min((time - this.lastTime) / 1000, 0.1); // clamp dt to max 100ms
    this.lastTime = time;

    this.director.update(dt);
    this.director.render(this.ctx);

    requestAnimationFrame(this.gameLoop.bind(this));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
