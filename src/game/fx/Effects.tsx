import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'

/** Bloom makes every emissive (toneMapped=false, intensity > 1) surface glow. */
export function Effects() {
  return (
    <EffectComposer multisampling={4} enableNormalPass={false}>
      <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.75} radius={0.6} />
      <Vignette eskil={false} offset={0.2} darkness={0.55} />
    </EffectComposer>
  )
}
