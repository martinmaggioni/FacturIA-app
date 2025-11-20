import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Cargar variables de entorno nivel root (como VITE_API_KEY)
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    // Esto permite que el código 'process.env.API_KEY' funcione en el navegador
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY),
    },
    server: {
      host: true, 
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:3001',
          changeOrigin: true,
        }
      }
    }
  };
});