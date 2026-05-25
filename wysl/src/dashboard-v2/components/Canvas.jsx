import React from 'react';
import ProfileMenu from './ProfileMenu';
import SubMenu from './SubMenu';

const Canvas = ({ children }) => {
  return (
    <div className="canvas">
      <ProfileMenu />
      {children}
      <SubMenu />
    </div>
  );
};

export default Canvas;
