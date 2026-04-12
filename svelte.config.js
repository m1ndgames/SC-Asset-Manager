// CF_PAGES=1 is set by the Cloudflare deploy workflow → uses adapter-cloudflare.
// All other builds (Docker, local dev) fall back to adapter-static.
const isCF = !!process.env.CF_PAGES;

const { default: adapter } = isCF
  ? await import('@sveltejs/adapter-cloudflare')
  : await import('@sveltejs/adapter-static');

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: isCF ? adapter() : adapter({ fallback: 'index.html' }),
    prerender: {
      handleHttpError: ({ path, message }) => {
        // Ignore missing favicon — no favicon file in this project
        if (path === '/favicon.png') return;
        throw new Error(message);
      }
    }
  }
};

export default config;
