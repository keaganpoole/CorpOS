// src/pages/PhoneHelperPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faBars, faTimes, faPlus } from '@fortawesome/free-solid-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/PhoneHelperPage.css';
import DeviceInfoModal from '../components/modals/DeviceInfoModal';
import LimitReachedModal from '../components/modals/LimitReachedModal';
import BreezyIntroModal from '../components/modals/BreezyIntroModal';
import TypingIndicator from '../components/TypingIndicator';
import { useAuth } from '../contexts/AuthContext';
import { initiateThread, sendMessage, getThreads, getMessagesForThread } from '../services/apiService';
import breezyChatIcon from '../assets/breezy-chat-icon.png';
import breezyIntroImage from '/breezy-intro.png';
import { fetchUserBreezyIntroStatusAndFirstName, updateTableRecord, supabase } from '../supabaseClient';

const Message = ({ text, sender }) => {
  const isAI = sender === 'ai';
  return (
    <motion.div
      className={`message ${isAI ? 'ai-message' : 'user-message'}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {isAI && <img src={breezyChatIcon} alt="Breezy Avatar" className="breezy-avatar" />}
      {isAI ? (
        <div>
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-black">{text}</p>
      )}
    </motion.div>
  );
};

const PhoneHelperPage = () => {
  const { profile, updateProfile } = useAuth();
  
  // CHANGED: Abstracted the initial message to a constant for reusability.
  const initialMessage = { sender: 'ai', text: `Breezy here. How can I help you? 😊` };

  const [messages, setMessages] = useState([initialMessage]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showDeviceInfoModal, setShowDeviceInfoModal] = useState(false);
  const [isChatboxOpen, setIsChatboxOpen] = useState(false);
  const [isThreadsPanelOpen, setIsThreadsPanelOpen] = useState(false);
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const chatWindowRef = useRef(null);
  const threadsPanelRef = useRef(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitModalContent, setLimitModalContent] = useState({ title: '', message: '' });
  const [limitReached, 
    setLimitReached] = useState(false);
  const [showBreezyIntroPopup, setShowBreezyIntroPopup] = useState(false);
  const [userFirstName, setUserFirstName] = useState('');
  const [hasUserSentMessage, setHasUserSentMessage] = useState(false);

  // Click outside to close threads panel
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (threadsPanelRef.current && !threadsPanelRef.current.contains(event.target)) {
        if (!event.target.closest('.view-messages-btn')) {
          setIsThreadsPanelOpen(false);
        }
      }
    };

    if (isThreadsPanelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isThreadsPanelOpen]);

  const fetchThreads = async () => {
    try {
      const response = await getThreads();
      setThreads(response.data);
    } catch (error) {
      console.error("PhoneHelperPage.jsx:event_89");
    }
  };

  useEffect(() => {
    fetchThreads();
  }, []);

  useEffect(() => {
    const checkBreezyIntroPopup = async () => {
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error("PhoneHelperPage.jsx:event_101");
        return;
      }

      const { data, error } = await fetchUserBreezyIntroStatusAndFirstName();

      if (error) {
        console.error("PhoneHelperPage.jsx:event_108");
        return;
      }

      if (data) {
        setUserFirstName(data.first_name || '');
        if (data.breezy_intro_popup === false || data.breezy_intro_popup === null) {
          setShowBreezyIntroPopup(true);
        }
      }
    };

    checkBreezyIntroPopup();
  }, [profile]);

  useEffect(() => {
    if (profile) {
      const hasDeviceData = profile.device && Object.keys(profile.device).length > 0;
      if (hasDeviceData) {
        setShowDeviceInfoModal(false);
        setIsChatboxOpen(true);
      } else {
        setShowDeviceInfoModal(true);
        setIsChatboxOpen(false);
      }
    }
  }, [profile]);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (inputValue.trim() === '' || limitReached) return;

    const messageToSend = inputValue;
    setInputValue('');

    let currentThreadId = activeThread;
    let newMessages = [...messages, { sender: 'user', text: messageToSend }];

    if (!currentThreadId) {
      try {
        const response = await initiateThread();
        currentThreadId = response.data.thread_id;
        setActiveThread(currentThreadId);
        // REMOVED: This line was incorrectly overwriting the message history.
        // newMessages = [{ sender: 'user', text: messageToSend }];
      } catch (error) {
        console.error("PhoneHelperPage.jsx:event_159");
        setInputValue(messageToSend);
        return;
      }
    }

    setMessages(newMessages);
    setHasUserSentMessage(true);
    setTimeout(() => setIsTyping(true), 1000);

    try {
      const messagePayload = { thread_id: currentThreadId, message: messageToSend };
      const response = await sendMessage(messagePayload);
      const aiMessage = response.data.message;
      
      setIsTyping(false);
      setMessages(prevMessages => [...prevMessages, { sender: 'ai', text: aiMessage }]);
      fetchThreads();
    } catch (error) {
      console.error("PhoneHelperPage.jsx:event_178");
      setIsTyping(false);
      if (error.response && error.response.status === 429) {
        setLimitModalContent({
          title: 'Message Limit Reached',
          message: error.response.data.detail || 'You have reached your message limit.'
        });
        setShowLimitModal(true);
        setLimitReached(true);
      }
    }
  };

  const handleNewConversation = async () => {
    if (limitReached) {
      setShowLimitModal(true);
    } else {
      try {
        const response = await initiateThread();
        const newThreadId = response.data.thread_id;
        setActiveThread(newThreadId);
        // CHANGED: Reset messages to the initial state instead of an empty array.
        setMessages([initialMessage]);
        setLimitReached(false);
      } catch (error) {
        console.error("PhoneHelperPage.jsx:event_203");
      }
    }
  };

  const handleProfileUpdate = (updatedProfile) => {
    updateProfile(updatedProfile);
    setShowDeviceInfoModal(false);
    setIsChatboxOpen(true);
  };

  const handleThreadSelect = async (threadId) => {
    setActiveThread(threadId);
    setLimitReached(false);
    setIsThreadsPanelOpen(false);
    try {
      const response = await getMessagesForThread(threadId);
      const formattedMessages = response.data.map(msg => ({
        sender: msg.direction === 'inbound' ? 'ai' : 'user',
        text: msg.message,
      }));
      setMessages(formattedMessages);
    } catch (error) {
      console.error("PhoneHelperPage.jsx:event_226");
    }
  };

  const handleCloseBreezyIntroPopup = async () => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("PhoneHelperPage.jsx:event_233");
      setShowBreezyIntroPopup(false);
      return;
    }

    const { error } = await updateTableRecord('users', user.id, { breezy_intro_popup: true });

    if (error) {
      console.error("PhoneHelperPage.jsx:event_241");
    }
    setShowBreezyIntroPopup(false);
  };

  return (
    <div className="phone-helper-page">
      <LimitReachedModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        title={limitModalContent.title}
        message={limitModalContent.message}
        pageTheme="passwords"
      />
      {showDeviceInfoModal && profile && (
        <DeviceInfoModal
          user={profile}
          onUpdate={handleProfileUpdate}
          onClose={() => setShowDeviceInfoModal(false)}
        />
      )}
      <BreezyIntroModal
        isOpen={showBreezyIntroPopup}
        onClose={handleCloseBreezyIntroPopup}
        firstName={userFirstName}
        breezyIntroImage={breezyIntroImage}
        deviceModel={profile?.device?.model || profile?.device?.name || profile?.device?.brand || 'your amazing device'}
      />

      <div ref={threadsPanelRef} className={`threads-panel ${isThreadsPanelOpen ? 'open' : ''}`}>
        <div className="threads-panel-header">
          <button className="new-question-btn" onClick={handleNewConversation}>
            New Conversation
          </button>
          <button className="close-panel-btn" onClick={() => setIsThreadsPanelOpen(false)}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        <div className="threads-list">
          {threads.map(thread => (
            <div key={thread.id} className="thread-item" onClick={() => handleThreadSelect(thread.id)}>
              <p>{thread.title}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="chat-container-wrapper mx-auto w-full">
        {isChatboxOpen ? (
          <>
            <div className="chat-container">
              <div className="chat-header">
                <button className="view-messages-btn" onClick={() => setIsThreadsPanelOpen(!isThreadsPanelOpen)}>
                  <FontAwesomeIcon icon={isThreadsPanelOpen ? faTimes : faBars} />
                </button>
                <div className="chat-header-title-container">
                  <h1>Ask Breezy</h1>
                  <p>Your personal device and login assistant</p>
                </div>

              </div>
              <div className="chat-window" ref={chatWindowRef}>
                <AnimatePresence>
                  {messages.map((msg, index) => (
                    <Message key={index} sender={msg.sender} text={msg.text} />
                  ))}
                </AnimatePresence>
                {isTyping && !limitReached && <TypingIndicator />}
              </div>
            </div>
            <div className="chat-input-container">
              <input
                type="text"
                className="chat-input"
                placeholder={limitReached ? "You have reached your message limit." : " Send a message"}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                disabled={limitReached}
              />
              <button className="send-button" onClick={handleSendMessage} disabled={limitReached}>
                <FontAwesomeIcon icon={faPaperPlane} />
              </button>
            </div>
          </>
        ) : (
          !showDeviceInfoModal && (
            <div className="chat-closed-warning">
              <p>We need your device info to provide tailored help.</p>
              <button onClick={() => setShowDeviceInfoModal(true)} className="device-info-btn">Enter Device Info</button>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default PhoneHelperPage;
