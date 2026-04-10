import adapter from '@sveltejs/adapter-static';

// BASE_PATH is set at build time for GitHub Pages (e.g. /SC-Asset-Manager).
// Leave empty for Docker / local dev.
const base = process.env.BASE_PATH ?? '';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      fallback: 'index.html'
    }),
    paths: { base }
  }
};

export default config;
