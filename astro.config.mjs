import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'hybrid',
  routes: [
    {
      pattern: '/productos/[id]',
      prerender: false
    }
  ]
});
