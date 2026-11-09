import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em dev o Vite serve a UI e repassa /api para o servidor Node; em producao o
// proprio server.js serve o dist/ e nao ha proxy nenhum no caminho.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://127.0.0.1:7788' },
  },
});
