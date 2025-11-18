
import React from 'react';
import type { ChatMessage as ChatMessageType, BookingProposal } from '../types';
import { MessageSender } from '../types';
import { BotIcon, UserIcon } from './Icons';

interface ChatMessageProps {
    message: ChatMessageType;
    onConfirm: (proposal: BookingProposal) => void;
    onCancel: (proposal: BookingProposal) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onConfirm, onCancel }) => {
    const isBot = message.sender === MessageSender.BOT;
    const senderClass = isBot ? 'bot' : 'user';

    return (
        <>
            <style>{`
        .message-container {
            display: flex;
            align-items: flex-end;
            gap: 10px;
            max-width: 85%;
        }
        .message-container.bot {
            align-self: flex-start;
        }
        .message-container.user {
            align-self: flex-end;
            flex-direction: row-reverse;
        }
        .message-bubble {
            padding: 10px 15px;
            border-radius: 18px;
            white-space: pre-wrap;
            line-height: 1.5;
        }
        .message-bubble.bot {
            background-color: #e9e9eb;
            color: #333;
            border-bottom-left-radius: 4px;
        }
        .message-bubble.user {
            background-color: #522583; /* Clemson Purple */
            color: white;
            border-bottom-right-radius: 4px;
        }
        .message-icon {
            width: 40px;
            height: 40px;
            flex-shrink: 0;
        }
        .message-container.bot .message-icon { color: #522583; }
        .message-container.user .message-icon { color: #888; }
        
        .message-content-wrapper {
          display: flex;
          flex-direction: column;
        }

        .confirmation-buttons {
            margin-top: 8px;
            display: flex;
            gap: 8px;
        }
        .confirm-button, .cancel-button {
            flex: 1;
            padding: 8px 12px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            transition: background-color 0.3s;
            font-size: 0.9em;
        }
        .confirm-button {
            background-color: #28a745; /* Green */
            color: white;
        }
        .confirm-button:hover {
            background-color: #218838;
        }
        .cancel-button {
            background-color: #dc3545; /* Red */
            color: white;
        }
        .cancel-button:hover {
            background-color: #c82333;
        }
      `}</style>
            <div className={`message-container ${senderClass}`}>
                {isBot && <BotIcon className="message-icon" />}
                <div className="message-content-wrapper">
                    <div className={`message-bubble ${senderClass}`}>
                        <p>{message.text}</p>
                    </div>
                    {message.bookingProposal && (
                        <div className="confirmation-buttons">
                            <button
                                onClick={() => onConfirm(message.bookingProposal!)}
                                className="confirm-button"
                            >
                                Confirm Booking
                            </button>
                            <button
                                onClick={() => onCancel(message.bookingProposal!)}
                                className="cancel-button"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
                {!isBot && <UserIcon className="message-icon" />}
            </div>
        </>
    );
};
