import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';

function firebaseSwPlugin() {
  let rootDir = process.cwd();
  let mode = 'production';

  return {
    name: 'firebase-sw',
    apply: 'build',
    configResolved(config) {
      rootDir = config.root;
      mode = config.mode;
    },
    closeBundle() {
      const outPath = path.resolve(rootDir, 'dist/firebase-messaging-sw.js');
      if (!fs.existsSync(outPath)) return;

      const env = loadEnv(mode, rootDir, '');
      const replacements = {
        '__VITE_FIREBASE_API_KEY__': env.VITE_FIREBASE_API_KEY || '',
        '__VITE_FIREBASE_AUTH_DOMAIN__': env.VITE_FIREBASE_AUTH_DOMAIN || '',
        '__VITE_FIREBASE_PROJECT_ID__': env.VITE_FIREBASE_PROJECT_ID || '',
        '__VITE_FIREBASE_STORAGE_BUCKET__': env.VITE_FIREBASE_STORAGE_BUCKET || '',
        '__VITE_FIREBASE_MESSAGING_SENDER_ID__': env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
        '__VITE_FIREBASE_APP_ID__': env.VITE_FIREBASE_APP_ID || '',
      };

      let content = fs.readFileSync(outPath, 'utf-8');
      for (const [token, value] of Object.entries(replacements)) {
        const serialized = JSON.stringify(value);
        content = content.replaceAll(`'${token}'`, serialized);
        content = content.replaceAll(`"${token}"`, serialized);
        content = content.replaceAll(token, value);
      }

      fs.writeFileSync(outPath, content, 'utf-8');
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Gerenciador de Serviços',
        short_name: 'GS',
        description: 'Gerenciador de ordens de serviço',
        theme_color: '#1d4ed8',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
          },
        ],
        importScripts: ['/sw-push.js'],
      },
    }),
    firebaseSwPlugin(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
