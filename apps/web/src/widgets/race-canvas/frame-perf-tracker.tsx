import { useFrame } from '@react-three/fiber';
import { tickFrame } from '@/features/race-perf';

/** Считает FPS в render loop, не трогая React на каждый кадр */
export const FramePerfTracker = () => {
  useFrame((_, dt) => {
    tickFrame(dt * 1000);
  });
  return null;
};
