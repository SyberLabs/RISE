import { build, preview } from 'vite';
import { buildContentPlane } from './lib/content-plane.mjs';

/**
 * Build and serve the exact candidate inside Playwright's owning process.
 * Returning teardown keeps server lifetime transactional on Windows, where a
 * shell -> npm -> npx preview chain can outlive the runner and retain port 4317.
 */
export default async function prepareCandidate() {
  process.env.VITE_RISE_ARCHIVE_REVIEW = '1';
  // The data plane is a build product, not a source file, and this setup
  // calls Vite's API rather than `npm run build` — so it has to be asked
  // for. Without it `dist` ships a shell with no corpus behind it and every
  // reading refuses, correctly and uselessly.
  await buildContentPlane();
  await build();
  const server = await preview({
    preview: {
      host: '127.0.0.1',
      port: 4317,
      strictPort: true
    }
  });
  return async () => {
    server.httpServer.closeAllConnections?.();
    await new Promise(resolve => server.httpServer.close(resolve));
  };
}
