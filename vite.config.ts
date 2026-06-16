import { defineConfig } from 'vite';

// Static, framework-free Vite setup. Entry is index.html, which loads
// /app/main.ts as an ES module. `npm run build` emits a deployable dist/.
export default defineConfig({
  root: '.',
  // Wrangler injects the Cloudflare Vite plugin here during deploy; the array
  // must exist for its auto-configuration to find an insertion point.
  plugins: [],
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: true,
    // The PDF vendor chunk (jspdf + html2canvas) is inherently large.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split the heavy third-party libs into their own cacheable chunks.
        manualChunks: {
          chart: ['chart.js'],
          pdf: ['jspdf', 'html2canvas'],
        },
      },
    },
  },
});
