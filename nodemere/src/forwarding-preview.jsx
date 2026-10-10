import React from 'react';
import ReactDOM from 'react-dom/client';
import ForwardNumberModal from './sonar/components/ForwardNumberModal';
import './index.css';

if (import.meta.env.DEV) {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <ForwardNumberModal preview onClose={() => {}} />,
  );
}
