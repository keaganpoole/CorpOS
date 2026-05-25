import React from 'react';
import { Link } from 'react-router-dom';
import Breakroom from '../components/Breakroom';

const BreakroomPage = () => {
  return (
    <>
      <div className="absolute top-0 left-0 right-0 pt-4">
        <div className="text-center">
          <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            &larr; back to dashboard
          </Link>
        </div>
      </div>
      <Breakroom />
    </>
  );
};

export default BreakroomPage;