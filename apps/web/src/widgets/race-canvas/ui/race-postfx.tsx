import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';

type TRacePostFxProps = {
  enabled: boolean;
};

/** Bloom + vignette для ночной трассы (кинематографичный neon look) */
export const RacePostFx = ({ enabled }: TRacePostFxProps) => {
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
