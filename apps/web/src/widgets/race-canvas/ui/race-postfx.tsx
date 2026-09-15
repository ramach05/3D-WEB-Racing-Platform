import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';

type TRacePostFxProps = {
  /** Включить Bloom/Vignette (ночь) */
  enabled: boolean;
};

/** Bloom + vignette для ночной трассы (кинематографичный neon look) */
export const RacePostFx = ({ enabled }: TRacePostFxProps) => {
  if (!enabled) {
    return null;
  }

  return (
    <EffectComposer multisampling={0}>
      <Bloom luminanceThreshold={0.7} intensity={0.5} mipmapBlur levels={2} />
      <Vignette offset={0.28} darkness={0.5} />
    </EffectComposer>
  );
};
