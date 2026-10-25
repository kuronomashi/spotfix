import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import spotfix from 'spotfix/vite';

export default defineConfig({
  plugins: [spotfix(), react()],
});
