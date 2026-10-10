import {defineConfig} from 'vite';
import motionCanvasPlugin from '@motion-canvas/vite-plugin';

const motionCanvas = typeof (motionCanvasPlugin as any).default === 'function'
  ? (motionCanvasPlugin as any).default
  : motionCanvasPlugin;

export default defineConfig({
  plugins: [
    motionCanvas({
      project: [
        './src/project.ts',
      ],
    }),
  ],
});

