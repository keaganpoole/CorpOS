import React from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTh, faList } from '@fortawesome/free-solid-svg-icons';
import '../../styles/ViewToggle.css';

const ViewToggle = ({ view, setView }) => {
  const isGrid = view === 'grid';

  return (
    <div className="view-toggle">
      <motion.div
        className="toggle-handle"
        initial={false}
        animate={{ x: isGrid ? '0%' : '100%' }}
        transition={{ type: 'spring', stiffness: 500, damping: 40, mass: 1.2 }}
      />
      <button className="toggle-option" onClick={() => setView('grid')}>
        <FontAwesomeIcon icon={faTh} className={isGrid ? 'active' : ''} />
        <span className={isGrid ? 'active' : ''}>Grid</span>
      </button>
      <button className="toggle-option" onClick={() => setView('card')}>
        <FontAwesomeIcon icon={faList} className={!isGrid ? 'active' : ''} />
        <span className={!isGrid ? 'active' : ''}>Cards</span>
      </button>
    </div>
  );
};

export default ViewToggle;