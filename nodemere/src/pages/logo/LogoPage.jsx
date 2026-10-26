import React, { useEffect } from 'react';
import { Download } from 'lucide-react';
import { NODEMERE_LOGO_URL } from '../../constants/brand';
import './logo.css';

export default function LogoPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Nodemere — Logo';
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <div className="nodemere-logo-page">
      <div className="ambient" aria-hidden="true" />
      <header>
        <a className="brand" href="/logo" aria-label="Nodemere logo page"><img src={NODEMERE_LOGO_URL} alt="" width="30" height="30" /><span>nodemere</span></a>
        <span className="page-label">NODEMERE IDENTITY <span className="edition">01 / LOGO</span></span>
        <a className="download" href={NODEMERE_LOGO_URL} download="nodemere-logo.png">Download logo <Download size={16} strokeWidth={1.6} aria-hidden="true" /></a>
      </header>
      <main>
        <div className="logo-exhibit">
        <div className="stage" id="stage" style={{ cursor: 'default' }}>
          <span className="corner tl" aria-hidden="true" /><span className="corner tr" aria-hidden="true" /><span className="corner bl" aria-hidden="true" /><span className="corner br" aria-hidden="true" />
          <img src={NODEMERE_LOGO_URL} alt="Nodemere logo" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
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
