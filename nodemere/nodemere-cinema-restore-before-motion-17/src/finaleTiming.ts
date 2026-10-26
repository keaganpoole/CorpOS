// Integer timeline boundaries. The fully opaque, still logo occupies [144, 294).
export const ENCRYPTION_SECONDS = 16;
export const LOGO_TIMING = {
  blackPause: 12,
  fadeEnd: 144,
  holdEnd: 294,
  signatureEnd: 496,
  fadeOutEnd: 550,
  end: 586,
} as const;
export const LOGO_SECONDS = LOGO_TIMING.end / 60;
