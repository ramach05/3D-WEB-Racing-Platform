import { useFrame } from '@react-three/fiber';
import { tickFrame } from '@/features/race-perf';

/** Считает FPS/CPU в render loop, не трогая React на каждый кадр */
export const FramePerfTracker = () => {
  // Замеряет CPU кадра через onAfterRender, без React-setState.
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
