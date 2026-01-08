/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'navy': '#001a33',
        'charcoal': '#2d2d2d',
        'off-white': '#f8f7f4',
        'cream': '#efefeb',
        'gold-matte': '#a89968',
        'leather-brown': '#5c4a3d',
      },
      fontFamily: {
        'serif-brand': ['Playfair Display', 'Georgia', 'serif'],
        'sans-brand': ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
};
