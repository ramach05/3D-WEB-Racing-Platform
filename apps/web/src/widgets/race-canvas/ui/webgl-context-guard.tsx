import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

/** Gives the browser a chance to restore WebGL after context lost (HMR, tab switch, GPU pressure). Without preventDefault the context is dead forever. */
export const WebGlContextGuard = () => {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    const canvas = gl.domElement;

    const onLost = (event: Event) => {
      event.preventDefault();
    };

    const onRestored = () => {
      const parent = canvas.parentElement;
      if (!parent) {
        return;
      }
      gl.setSize(parent.clientWidth, parent.clientHeight, false);
    };

    canvas.addEventListener('webglcontextlost', onLost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost, false);
      canvas.removeEventListener('webglcontextrestored', onRestored, false);
    };
  }, [gl]);

  return null;
};
