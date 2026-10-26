import React from 'react';
import { NODEMERE_LOGO_URL } from '../constants/brand';

export const SPLASH_LOGO_HOLD_MS = 2900;

export default function SplashLogo() {
  return <img
    src={NODEMERE_LOGO_URL}
    alt="Nodemere logo"
    style={{ width: 'clamp(119.5px, 12.77vw, 159px)', aspectRatio: '1', objectFit: 'contain', display: 'block' }}
  />;
}
