import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  site: 'https://ibericosrodriguezgonzalez.victoriafp.online',
  trailingSlash: 'never',
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  integrations: [
    sitemap({
      filter: (page) => {
        // Excluir páginas que no deben indexarse
        const excluir = [
          '/admin/', '/api/', '/debug',
          '/sin-acceso', '/checkout/',
          '/login', '/registro',
          '/mi-perfil', '/mis-pedidos',
          '/carrito', '/pedidos',
          '/auth/callback',
          '/categoria/categoria',  // ruta errónea
        ];
        return !excluir.some(ruta => page.includes(ruta));
      },
      customPages: [
        'https://ibericosrodriguezgonzalez.victoriafp.online/',
        'https://ibericosrodriguezgonzalez.victoriafp.online/ofertas',
        'https://ibericosrodriguezgonzalez.victoriafp.online/contacto',
        'https://ibericosrodriguezgonzalez.victoriafp.online/sobre-nosotros',
        'https://ibericosrodriguezgonzalez.victoriafp.online/productos',
        'https://ibericosrodriguezgonzalez.victoriafp.online/seguimiento',
        'https://ibericosrodriguezgonzalez.victoriafp.online/terminos',
        'https://ibericosrodriguezgonzalez.victoriafp.online/privacidad',
        'https://ibericosrodriguezgonzalez.victoriafp.online/cookies',
        'https://ibericosrodriguezgonzalez.victoriafp.online/devoluciones',
      ],
    }),
  ],
  vite: {
    ssr: {
      external: ['node:fs', 'node:path', 'node:util', 'nodemailer', 'pdfkit']
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    }
  }
});
