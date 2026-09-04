// src/components/dashboard/QueueItem.jsx
import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes, faPen, faSave } from '@fortawesome/free-solid-svg-icons';
import '../../styles/QueueItem.css';

const QueueItem = ({ messageId, leadName, campaignName, messageContent, timestamp, onApprove }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedMessage, setEditedMessage] = useState(messageContent);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing, editedMessage]);

  const handleApprove = () => {
    onApprove(messageId, editedMessage);
  };

  const handleReject = () => {
    console.debug("QueueItem.jsx:event_24");
    // API call to reject
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    setIsEditing(false);
    // Potentially save the draft to the server
    console.debug("QueueItem.jsx:event_35");
  };

  const handleCancelEdit = () => {
    setEditedMessage(messageContent);
    setIsEditing(false);
  };

  const handleTextChange = (e) => {
    setEditedMessage(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${e.target.scrollHeight}px`;
    }
  };

  return (
    <div className="queue-item-wrapper">
      <div className="queue-item">
        <div className="item-header">
          <div className="lead-info">
            
            <div className="lead-text-info">
              <span className="lead-name">{leadName}</span>
              {campaignName && <span className="campaign-name">{campaignName}</span>}
              
            </div>
          </div>
          <span className="timestamp">{timestamp}</span>
        </div>
        <div className="item-body">
          {isEditing ? (
            <textarea
              ref={textareaRef}
              className="message-textarea"
              value={editedMessage}
              onChange={handleTextChange}
              onBlur={handleSave} // Auto-save on blur
            />
          ) : (
            <p className="message-text" onClick={handleEdit}>
              {editedMessage}
            </p>
          )}
        </div>
        <div className="item-actions">
          <div className="main-actions">
            <button className="action-btn approve-btn" onClick={handleApprove}>
              <FontAwesomeIcon icon={faCheck} />
              <span>Approve</span>
            </button>
            <button className="action-btn reject-btn" onClick={handleReject}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          <div className="secondary-actions">
            {isEditing ? (
              <>
                <button className="action-btn save-btn" onClick={handleSave}>
                  <FontAwesomeIcon icon={faSave} />
                </button>
                <button className="action-btn" onClick={handleCancelEdit}>
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </>
            ) : (
              <button className="action-btn edit-btn" onClick={handleEdit}>
                <FontAwesomeIcon icon={faPen} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueueItem;
