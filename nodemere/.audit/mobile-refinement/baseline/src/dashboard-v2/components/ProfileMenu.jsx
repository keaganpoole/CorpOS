
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './ProfileMenu.css';

const ProfileMenu = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="profile-menu">
      <motion.button
        className="profile-menu-button"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <img src="https://i.pravatar.cc/40" alt="profile" />
      </motion.button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="profile-menu-dropdown"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <a href="#" className="profile-menu-dropdown-item">Profile</a>
            <a href="#" className="profile-menu-dropdown-item">Settings</a>
            <a href="#" className="profile-menu-dropdown-item">Logout</a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfileMenu;
