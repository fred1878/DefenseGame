/** Canvas luminance gates for translucent HUD bands (must exceed play-area ground). */
export const HUD_BAND_MIN_LUMINANCE_LIFT = 22;
export const HUD_BAND_MIN_LUMINANCE = 58;

export type HudBandPixelSamples = {
  topBand: { r: number; g: number; b: number; luminance: number };
  bottomBand: { r: number; g: number; b: number; luminance: number };
  playArea: { r: number; g: number; b: number; luminance: number };
};

export function hudBandPixelProbesPass(samples: HudBandPixelSamples): boolean {
  const play = samples.playArea.luminance;
  return (
    samples.topBand.luminance > play + HUD_BAND_MIN_LUMINANCE_LIFT &&
    samples.bottomBand.luminance > play + HUD_BAND_MIN_LUMINANCE_LIFT &&
    samples.topBand.luminance >= HUD_BAND_MIN_LUMINANCE &&
    samples.bottomBand.luminance >= HUD_BAND_MIN_LUMINANCE &&
    samples.topBand.r > 52 &&
    samples.bottomBand.r > 52
  );
}
