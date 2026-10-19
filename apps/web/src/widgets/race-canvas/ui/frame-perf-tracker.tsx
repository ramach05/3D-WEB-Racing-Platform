import { useFrame } from '@react-three/fiber';
import { tickFrame } from '@/features/race-perf';

/** Tracks FPS/CPU in the render loop without touching React every frame */
export const FramePerfTracker = () => {
  // Measures frame CPU via onAfterRender, without React-setState.
  useFrame((state) => {
    const start = performance.now();
    const { scene } = state;
    const prev = scene.onAfterRender;
    scene.onAfterRender = (...args) => {
      scene.onAfterRender = prev;
      prev?.(...args);
      tickFrame(performance.now() - start);
    };
  });
  return null;
};
