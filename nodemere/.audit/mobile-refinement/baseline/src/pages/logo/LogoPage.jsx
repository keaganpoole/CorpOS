import React, { useEffect, useRef } from 'react';
import { Download } from 'lucide-react';
import { initializeLogo } from './logoAnimation';
import './logo.css';

export default function LogoPage() {
  const page = useRef(null);
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Nodemere — Logo';
    const dispose = initializeLogo(page.current);
    return () => { dispose(); document.title = previousTitle; };
  }, []);

  return (
    <div className="nodemere-logo-page" ref={page}>
      <div className="ambient" aria-hidden="true" />
      <header>
        <a className="brand" href="/logo" aria-label="Nodemere logo page"><img src="/logo/nodemere.svg" alt="" width="30" height="30" /><span>nodemere</span></a>
        <span className="page-label">NODEMERE IDENTITY <span className="edition">01 / LOGO</span></span>
        <a className="download" href="/logo/nodemere.svg" download="nodemere.svg">Download SVG <Download size={16} strokeWidth={1.6} aria-hidden="true" /></a>
      </header>
      <main>
        <div className="logo-exhibit">
        <div className="stage" id="stage" style={{ cursor: 'default' }}>
          <span className="corner tl" aria-hidden="true" /><span className="corner tr" aria-hidden="true" /><span className="corner bl" aria-hidden="true" /><span className="corner br" aria-hidden="true" />
          <svg id="mark" viewBox="0 0 520 520" role="img" aria-labelledby="logo-title">
            <title id="logo-title">Nodemere logo</title>
            <defs><filter id="glow" x="-35%" y="-35%" width="170%" height="170%"><feGaussianBlur stdDeviation="6" /></filter></defs>
            <g id="bloom" filter="url(#glow)" opacity=".45" /><g id="lines" />
          </svg>
        </div>
        <div className="caption"><h1>Nodemere</h1></div>
        </div>
      </main>
      <footer>
        <div className="signature"><span className="line-sample" aria-hidden="true" />Nodemere</div>
        <span className="footnote">VECTOR / NO. 001</span>
      </footer>
    </div>
  );
}
