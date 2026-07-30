// src/contexts/ModalContext.jsx

import React, { createContext, useContext, useState } from 'react';

const ModalContext = createContext(null);

export const ModalProvider = ({ children }) => {
  const [isAnyModalOpen, setIsAnyModalOpen] = useState(false);
  const [isAnyMasterPasswordModalOpen, setIsAnyMasterPasswordModalOpen] = useState(false);

  const value = {
    isAnyModalOpen,
    setIsAnyModalOpen,
    isAnyMasterPasswordModalOpen,
    setIsAnyMasterPasswordModalOpen,
  };

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
};

export const useModal = () => useContext(ModalContext);
