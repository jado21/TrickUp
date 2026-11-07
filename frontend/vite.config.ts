import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    watch: { ignored: ['**/.tmp/**', '**/.npm-cache/**', '**/reference/**'] },
  },
});
