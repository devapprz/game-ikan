import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.iseng.gameikan',
  appName: 'Game Ikan',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {}
};

export default config;
