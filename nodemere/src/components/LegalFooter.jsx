import React from 'react';
import { Link } from 'react-router-dom';
import { LEGAL_NAVIGATION } from '../legal/legalDocuments';

const LegalFooter = ({ className = '' }) => (
  <footer className={`legal-footer ${className}`.trim()}>
    <div className="legal-footer-inner">
      <p>&copy; {new Date().getFullYear()} Nodemere LLC. U.S. business service.</p>
      <nav aria-label="Legal">
        {LEGAL_NAVIGATION.map((item) => <Link key={item.to} to={item.to}>{item.label}</Link>)}
      </nav>
      <p>Questions or privacy requests: <a href="mailto:support@nodemere.ai">support@nodemere.ai</a></p>
    </div>
  </footer>
);

export default LegalFooter;
