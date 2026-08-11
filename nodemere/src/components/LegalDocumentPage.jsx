import React from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft } from 'lucide-react';
import { LEGAL_DOCUMENTS } from '../legal/legalDocuments';
import LegalFooter from './LegalFooter';
import '../styles/LegalPages.css';

const LegalDocumentPage = ({ documentKey }) => {
  const document = LEGAL_DOCUMENTS[documentKey];

  if (!document) return null;

  return (
    <div className="legal-page-shell">
      <header className="legal-page-header">
        <Link to="/" className="legal-brand" aria-label="Nodemere home">Nodemere</Link>
        <Link to="/" className="legal-back-link"><ArrowLeft size={15} /> Back to website</Link>
      </header>
      <main className="legal-document-wrap">
        <article className="legal-document-content">
          <ReactMarkdown>{document.content}</ReactMarkdown>
        </article>
      </main>
      <LegalFooter className="legal-page-footer" />
    </div>
  );
};

export default LegalDocumentPage;
