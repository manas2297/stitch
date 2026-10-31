import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'url';
import fs from 'fs';
import path from 'path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Serve the StitchDraw editor's hand-drawn fonts (from the Excalidraw engine) from /fonts so the whiteboard works offline in the desktop app.
// Xiaolai (CJK, ~12 MB) is skipped; Excalidraw falls back to its CDN for it when online.
const excalidrawFonts = fileURLToPath(new URL('../node_modules/@excalidraw/excalidraw/dist/prod/fonts', import.meta.url));
const skipFont = (p) => p.split(path.sep).includes('Xiaolai');

function excalidrawFontsPlugin() {
  let outDir;
  return {
    name: 'excalidraw-fonts',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    configureServer(server) {
      server.middlewares.use('/fonts', (req, res, next) => {
        const file = path.join(excalidrawFonts, decodeURIComponent(req.url.split('?')[0]));
        if (!file.startsWith(excalidrawFonts) || skipFont(file) || !fs.existsSync(file)) return next();
        res.setHeader('Content-Type', 'font/woff2');
        fs.createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      fs.cpSync(excalidrawFonts, path.join(outDir, 'fonts'), { recursive: true, filter: (src) => !skipFont(src) });
      // MIT notice for the editor engine, required alongside the rebranded StitchDraw UI.
      fs.cpSync(path.join(__dirname, 'licenses'), path.join(outDir, 'licenses'), { recursive: true });
    },
  };
}

// Under `wails dev`, Wails asks Vite for every GET first and only falls back to the Go
// handlers on a 404, so /api must 404 here rather than get Vite's index.html fallback.
function apiPassthroughPlugin() {
  return {
    name: 'api-passthrough',
    configureServer(server) {
      server.middlewares.use('/api', (_req, res) => {
        res.statusCode = 404;
        res.end();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), excalidrawFontsPlugin(), apiPassthroughPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  root: __dirname,
  build: {
    outDir: fileURLToPath(new URL('../backend/dist', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },

});

