// src/components/dashboard/QueueRoom.jsx
import React, { useEffect, useState, useCallback } from 'react';
import QueueItem from './QueueItem';
import { getQueue, updateMessageStatus } from '../../services/apiService';
import '../../styles/QueueRoom.css';

const QueueRoom = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getQueue();
      setMessages(response.data);
    } catch (err) {
      setError(err);
      console.error("Failed to fetch queue messages:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleApprove = async (messageId, currentMessage) => {
    try {
      await updateMessageStatus(messageId, { message: currentMessage });
      // After approval, refetch messages to update the queue
      fetchMessages();
    } catch (err) {
      setError(err);
      console.error("Failed to approve message:", err);
      alert("Failed to approve message. Please try again.");
    }
  };

  if (loading) {
    return <div className="queue-room"><p>Loading messages...</p></div>;
  }

  if (error) {
    return <div className="queue-room"><p>Error loading messages: {error.message}</p></div>;
  }

  return (
    <div className="queue-room">
      <div className="queue-header">
        <h2 className="text-2xl font-bold">Message Queue</h2>
        <p className="text-gray-400">Approve or reject messages before they're sent.</p>
      </div>

      <div className="queue-list">
        {messages.length > 0 ? (
          messages.map((message) => (
            <QueueItem
              key={message.id}
              messageId={message.id}
              leadName={message.lead_details.fullName}
              leadCompany={message.lead_details.company}
              leadImage={message.lead_details.image}
              campaignName={message.campaign_name}
              messageContent={message.message}
              timestamp={message.age}
              onApprove={handleApprove}
            />
          ))
        ) : (
          <div className="empty-queue">
            <p>The queue is empty. Well done!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QueueRoom;
