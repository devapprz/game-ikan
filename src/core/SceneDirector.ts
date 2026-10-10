export interface IScene {
  readonly id: string;
  init(width: number, height: number): void;
  resize(width: number, height: number): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  handlePointerDown(x: number, y: number, id: number): void;
  handlePointerMove(x: number, y: number, id: number): void;
  handlePointerUp(x: number, y: number, id: number): void;
  destroy(): void;
}

export type SceneType = 'lobby' | 'fishing' | 'net_scoop' | 'fish_slash';

export class SceneDirector {
  private static instance: SceneDirector;
  public currentScene: IScene | null = null;
  public width: number = 800;
  public height: number = 600;

  private sceneFactory: Map<SceneType, () => IScene> = new Map();

  private constructor() {}

  public static getInstance(): SceneDirector {
    if (!SceneDirector.instance) {
      SceneDirector.instance = new SceneDirector();
    }
    return SceneDirector.instance;
  }

  public registerScene(type: SceneType, factory: () => IScene): void {
    this.sceneFactory.set(type, factory);
  }

  public switchScene(type: SceneType): void {
    if (this.currentScene) {
      this.currentScene.destroy();
      this.currentScene = null;
    }

    const factory = this.sceneFactory.get(type);
    if (!factory) {
      console.error(`Scene ${type} belum terdaftar di SceneDirector!`);
      return;
    }

    this.currentScene = factory();
    this.currentScene.init(this.width, this.height);
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (this.currentScene) {
      this.currentScene.resize(width, height);
    }
  }

  public update(dt: number): void {
    if (this.currentScene) {
      this.currentScene.update(dt);
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (this.currentScene) {
      this.currentScene.render(ctx);
    }
  }
}
