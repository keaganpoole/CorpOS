import React from 'react';
import AccountSettings from '../components/dashboard/AccountSettings';
import { useOutletContext } from 'react-router-dom';

const SettingsPage = ({ onShowTutorial: propOnShowTutorial }) => {
  const { setShowTutorialModal: contextSetShowTutorialModal } = useOutletContext() || {};

  const onShowTutorial = propOnShowTutorial || (() => contextSetShowTutorialModal(true));

  return <AccountSettings onShowTutorial={onShowTutorial} />;
};

export default SettingsPage;
