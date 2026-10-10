export interface GameStats {
  fishingHighScore: number;
  netHighScore: number;
  slashHighScore: number;
  soundEnabled: boolean;
  totalFishCaught: number;
}

const STORAGE_KEY = 'arcade_game_ikan_save_v1';

export class StorageManager {
  private static defaultStats: GameStats = {
    fishingHighScore: 0,
    netHighScore: 0,
    slashHighScore: 0,
    soundEnabled: true,
    totalFishCaught: 0
  };

  public static load(): GameStats {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return { ...this.defaultStats };
      const parsed = JSON.parse(data);
      return {
        fishingHighScore: typeof parsed.fishingHighScore === 'number' ? parsed.fishingHighScore : 0,
        netHighScore: typeof parsed.netHighScore === 'number' ? parsed.netHighScore : 0,
        slashHighScore: typeof parsed.slashHighScore === 'number' ? parsed.slashHighScore : 0,
        soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
        totalFishCaught: typeof parsed.totalFishCaught === 'number' ? parsed.totalFishCaught : 0
      };
    } catch {
      return { ...this.defaultStats };
    }
  }

  public static save(stats: Partial<GameStats>): void {
    try {
      const current = this.load();
      const updated = { ...current, ...stats };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Gagal menyimpan ke localStorage:', e);
    }
  }
}
