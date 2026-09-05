import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';

type RacePostFxProps = {
  enabled: boolean;
};

/** Bloom + vignette для ночной трассы (кинематографичный neon look) */
export const RacePostFx = ({ enabled }: RacePostFxProps) => {
  if (!enabled) {
    return null;
  }

  return (
    <EffectComposer multisampling={0}>
      <Bloom luminanceThreshold={0.62} intensity={0.65} mipmapBlur levels={5} />
      <Vignette offset={0.28} darkness={0.5} />
    </EffectComposer>
  );
};
