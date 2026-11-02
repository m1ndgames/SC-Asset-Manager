import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// CF_PAGES=1 is set by the Cloudflare deploy workflow → uses adapter-cloudflare.
// All other builds (Docker, local dev) fall back to adapter-static.
const adapter = process.env.CF_PAGES
  ? (await import('@sveltejs/adapter-cloudflare')).default()
  : (await import('@sveltejs/adapter-static')).default({ fallback: 'index.html' });

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      adapter,
      prerender: {
        handleHttpError: ({ path, message }) => {
          // Ignore missing favicon — no favicon file in this project
          if (path === '/favicon.png') return;
          throw new Error(message);
        }
      }
    })
  ]
});
