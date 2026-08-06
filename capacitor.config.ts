import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.emc.mapitapp',
  appName: 'MapIt',
  webDir: 'dist/mapit-app/browser',
  // 'http' en vez del 'https' por defecto: evita que el WebView bloquee por Mixed Content las
  // llamadas HTTP al backend de dev (10.0.2.2). No afecta a producción — una página http
  // pidiendo un recurso https (Cloud Run) no se considera contenido mixto, solo lo es al revés.
  server: {
    androidScheme: 'http',
  },
};

export default config;
