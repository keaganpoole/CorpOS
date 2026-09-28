import React from 'react';
import CirclePreloader from '../../sonar/components/CirclePreloader';
export default function LoaderPreview() {
  return <main style={{ minHeight: '100svh', background: '#070b13', color: '#eef4ff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, fontFamily: 'sans-serif' }}>
    <CirclePreloader />
    <div style={{ textAlign: 'center' }}><h1 style={{ fontSize: 20 }}>Circle loader · current version</h1><p style={{ fontSize: 13, color: '#9aa9be' }}>Live preview at its default loading size</p></div>
  </main>;
}
