import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';

type TRacePostFxProps = {
  /** Enable Bloom/Vignette (night) */
  enabled: boolean;
};

/** Bloom + vignette for the night track (cinematic neon look) */
export const RacePostFx = ({ enabled }: TRacePostFxProps) => {
  if (!enabled) {
    return null;
  }

  return (
    <EffectComposer multisampling={0}>
      {/* Half-res: bloom is low-frequency (mipmapBlur), indistinguishable at 0.5 but the blur pyramid is 4x cheaper */}
      <Bloom luminanceThreshold={0.7} intensity={0.5} mipmapBlur levels={2} resolutionScale={0.5} />
      <Vignette offset={0.22} darkness={0.28} />
    </EffectComposer>
  );
};
