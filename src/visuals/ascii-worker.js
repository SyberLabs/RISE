import { compileSampledRaster } from './ascii-engine.js';

self.onmessage = event => {
  const { id, sampled, columns, rows, options } = event.data || {};
  try {
    const frame = compileSampledRaster(
      new Uint8ClampedArray(sampled),
      columns,
      rows,
      options || {}
    );
    self.postMessage({ id, frame }, [frame.colorIndices.buffer]);
  } catch (error) {
    self.postMessage({ id, error: error?.message || String(error) });
  }
};
