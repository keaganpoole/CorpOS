// src/pages/PrivacyPolicyPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown'; // Import ReactMarkdown
import '../styles/PrivacyPolicyPage.css'; // Assuming you'll create this CSS file

const PrivacyPolicyPage = () => {
  const [policyContent, setPolicyContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        // Assuming privacypolicy.txt is in the public directory or accessible via a direct path
        const response = await axios.get('/privacypolicy.txt');
        setPolicyContent(response.data);
      } catch (err) {
        console.error("Failed to fetch privacy policy:", err);
        setError("Failed to load privacy policy. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPolicy();
  }, []);

  if (isLoading) {
    return (
      <div className="privacy-policy-container loading">
        <p>Loading Privacy Policy...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="privacy-policy-container error">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <motion.div
      className="privacy-policy-container"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="privacy-policy-content">
        <ReactMarkdown>{policyContent}</ReactMarkdown>
      </div>
    </motion.div>
  );
};

export default PrivacyPolicyPage;
