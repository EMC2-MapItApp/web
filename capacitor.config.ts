import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.emc.mapitapp',
  appName: 'MapIt',
  webDir: 'dist/mapit-app/browser',
  server: {
    androidScheme: 'http',
  },
};

export default config;
