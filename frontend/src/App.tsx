import React, { useEffect, useState, useCallback, useRef } from 'react';
// We no longer need to import 'Chat' from @google/genai since the SDK is only on the backend

// Using lucide-react for icons
import { Send, Loader2, RefreshCw, ShoppingCart, MessageSquare } from 'lucide-react';

// --- Type Definitions (Mocked for single file) ---

const MessageSender = {
    USER: 'user',
    BOT: 'bot',
};

// Define Event structure based on usage in the component
/** @typedef {object} Event */
/** @property {number} id */
/** @property {string} name */
/** @property {string} date */
/** @property {number} tickets_available */

/** @typedef {object} BookingProposal */
/** @property {string} eventName */
/** @property {number} ticketCount */

/** @typedef {object} ChatMessage */
/** @property {string} id */
/** @property {string} sender */
/** @property {string} text */
/** @property {BookingProposal | undefined} bookingProposal */

// --- Component Definitions (Mocked for single file) ---

const ChatInput = ({ onSendMessage, isLoading, isChatReady, value, onChange }) => {
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !isLoading && isChatReady) {
            onSendMessage(value);
        }
    };

    return (
        <div className="chat-input-container">
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isChatReady ? "Ask about events or drag an event here..." : "Connecting to assistant..."}
                disabled={isLoading || !isChatReady}
                className="chat-input"
            />
            <button
                onClick={() => onSendMessage(value)}
                disabled={isLoading || !isChatReady || !value.trim()}
                className="send-button"
            >
                {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
            </button>
        </div>
    );
};

const ChatMessage = ({ message, onConfirm, onCancel }) => {
    const isBot = message.sender === MessageSender.BOT;
    const isProposal = message.bookingProposal;

    return (
        <div className={`chat-message ${isBot ? 'bot-message' : 'user-message'}`}>
            <div className="message-bubble">
                {message.text}
                {isProposal && (
                    <div className="proposal-actions">
                        <p className="proposal-prompt">Confirm booking {message.bookingProposal.ticketCount} ticket(s) for {message.bookingProposal.eventName}?</p>
                        <button className="confirm-button" onClick={() => onConfirm(message.bookingProposal)}>Confirm</button>
                        <button className="cancel-button" onClick={() => onCancel(message.bookingProposal)}>Cancel</button>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Main Application Component ---

const API_BASE_URL = 'https://three720deploy.onrender.com/api'; // The secure backend URL

export default function App() {
    // --- State for Event Listing ---
    const [events, setEvents] = useState([]);
    const [isLoadingEvents, setIsLoadingEvents] = useState(true);
    const [error, setError] = useState(null);
    const [purchasingEventId, setPurchasingEventId] = useState(null);

    // --- State for the Chat ---
    const [chatMessages, setChatMessages] = useState([]);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [chatInputText, setChatInputText] = useState('');
    const messagesEndRef = useRef(null);
    const [isChatReady, setIsChatReady] = useState(false); // New state to replace 'chat' object

    // --- State for UI ---
    const [activeTab, setActiveTab] = useState('events');
    const [isDropTarget, setIsDropTarget] = useState(false);

    // Helper to add messages
    const addMessage = (sender, text, bookingProposal) => {
        setChatMessages(prev => [
            ...prev,
            { id: Date.now().toString() + Math.random(), sender, text, bookingProposal }
        ]);
    };

    // --- Core Data Fetching ---

    const fetchEvents = useCallback(async () => {
        setIsLoadingEvents(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/events`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setEvents(data);
            return data;
        } catch (err) {
            console.error('Error fetching events:', err);
            setError('Failed to load events.');
            return [];
        } finally {
            setIsLoadingEvents(false);
        }
    }, []);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);


    // --- New Chat Initialization (Replaces initChat from local service) ---
    useEffect(() => {
        // We now just simulate initialization and check API status
        const checkApiStatus = () => {
            // Note: In a real app, you might ping a health check endpoint.
            // For simplicity, we assume the backend is up if we can fetch events.
            setIsChatReady(true);
            addMessage(
                MessageSender.BOT,
                "Hello! I'm the TigerTix Assistant. How can I help you find or book tickets for campus events today?"
            );
        };
        // Run check after initial event load
        if (!isLoadingEvents) {
            checkApiStatus();
        }
    }, [isLoadingEvents]);


    // --- Refactored Chat Handlers (No local SDK calls) ---

    // Function previously in local services/geminiService
    const purchaseSingleTicket = async (id) => {
        const endpoint = `${API_BASE_URL}/events/${id}/purchase`;
        try {
            const response = await fetch(endpoint, { method: 'POST' });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                const errorMessage = data.message || 'Unable to purchase ticket. It might be sold out.';
                return { success: false, message: errorMessage };
            }
            return { success: true };
        } catch (err) {
            console.error('Error purchasing single ticket:', err);
            return { success: false, message: 'An unexpected network error occurred during purchase.' };
        }
    };

    /**
     * @REFECTOR: Replaces sendMessage from geminiService.
     * Securely sends message to the backend API route.
     */
    const handleSendMessage = async (messageText) => {
        if (isChatLoading || !isChatReady || !messageText.trim()) return;

        addMessage(MessageSender.USER, messageText);
        setChatInputText('');
        setIsChatLoading(true);

        // 1. Send data to the SECURE backend API (key is safe on server)
        try {
            const response = await fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: messageText,
                    // Optionally send current event data to the backend for function calling context
                    events: events.map(e => ({ name: e.name, availableTickets: e.tickets_available }))
                }),
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();

            // The backend should return the final message, potentially with a proposal object
            addMessage(MessageSender.BOT, data.response, data.proposal);

        } catch (err) {
            console.error("Error sending message to backend:", err);
            addMessage(MessageSender.BOT, "Sorry, I encountered a communication error. Please try again.");
        } finally {
            setIsChatLoading(false);
        }
    };

    // --- Booking Handlers ---

    const handleConfirm = async (proposal) => {
        const eventToBook = events.find(e => e.name.toLowerCase() === proposal.eventName.toLowerCase());

        if (!eventToBook) {
            addMessage(MessageSender.BOT, `Sorry, I couldn't find an event named "${proposal.eventName}".`);
            return;
        }

        // Remove proposal buttons from UI messages
        setChatMessages(prev => prev.map(msg => msg.bookingProposal && msg.bookingProposal.eventName === proposal.eventName ? { ...msg, bookingProposal: undefined } : msg));


        let ticketsPurchased = 0;
        let purchaseFailed = false;
        let failureMessage = '';

        for (let i = 0; i < proposal.ticketCount; i++) {
            const result = await purchaseSingleTicket(eventToBook.id);
            if (result.success) {
                ticketsPurchased++;
            } else {
                purchaseFailed = true;
                failureMessage = result.message || 'An unknown error occurred.';
                break;
            }
        }

        await fetchEvents();

        if (purchaseFailed) {
            addMessage(MessageSender.BOT, `I was only able to purchase ${ticketsPurchased} ticket(s) for "${proposal.eventName}". Booking failed: ${failureMessage}`);
            return;
        }

        if (ticketsPurchased > 0) {
            // @REFACTOR: Instead of calling confirmBooking (which used the SDK), we now just send a confirmation message to the backend chat route.
            const confirmationMessage = `I have successfully purchased ${ticketsPurchased} ticket(s) for ${proposal.eventName}. Please provide a brief, cheerful confirmation message.`;
            await handleSendMessage(confirmationMessage);
            // The handleSendMessage call above will handle updating the UI with the final confirmation text from the AI.
        }
    };

    const handleCancel = async (proposal) => {
        // Remove proposal buttons from UI messages
        setChatMessages(prev => prev.map(msg => msg.bookingProposal && msg.bookingProposal.eventName === proposal.eventName ? { ...msg, bookingProposal: undefined } : msg));

        // @REFACTOR: Instead of calling cancelBooking (which used the SDK), we send a cancellation message to the backend chat route.
        const cancellationMessage = `Cancel the booking proposal for ${proposal.ticketCount} ticket(s) for ${proposal.eventName}. Please provide a brief, polite cancellation message.`;
        await handleSendMessage(cancellationMessage);
    };

    // --- UI Logic ---

    const handleDirectPurchase = async (eventId) => {
        if (purchasingEventId) return;

        setPurchasingEventId(eventId);
        try {
            const result = await purchaseSingleTicket(eventId);

            if (result.success) {
                await fetchEvents();
            } else {
                // Use a non-blocking UI alert instead of native alert()
                alert(`Purchase failed: ${result.message}`);
            }
        } catch (err) {
            alert('An unexpected error occurred while purchasing. Please try again.');
        } finally {
            setPurchasingEventId(null);
        }
    };

    const handleDragStart = (e, event) => {
        e.dataTransfer.setData('application/json', JSON.stringify(event));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDropTarget(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDropTarget(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDropTarget(false);
        try {
            const eventDataString = e.dataTransfer.getData('application/json');
            if (!eventDataString) return;

            const event = JSON.parse(eventDataString);
            setActiveTab('chat');
            setChatInputText(`I'm interested in the "${event.name}" event.`);
        } catch (error) {
            console.error('Failed to parse dropped event data:', error);
        }
    };

    const renderEventsContent = () => {
        if (isLoadingEvents) return <p className="loading-state"><Loader2 className="animate-spin mr-2"/> Loading events...</p>;
        if (error) return <p className="error-message">{error} <button onClick={fetchEvents} className="retry-button"><RefreshCw className="h-4 w-4" /> Retry</button></p>;
        if (events.length === 0) return <p>No events available at this time.</p>;

        return (
            <ul className="event-list">
                {events.map((event) => {
                    const isSoldOut = event.tickets_available === 0;
                    const isPurchasing = purchasingEventId === event.id;
                    return (
                        <li
                            key={event.id}
                            className="event-item"
                            draggable="true"
                            onDragStart={(e) => handleDragStart(e, event)}
                        >
                            <div className="event-info">
                                <strong>{event.name}</strong> - {event.date}
                                <span className="ticket-count">{event.tickets_available} left</span>
                            </div>
                            <button
                                className={`buy-button ${isSoldOut ? 'sold-out' : ''}`}
                                disabled={isSoldOut || isPurchasing}
                                onClick={() => handleDirectPurchase(event.id)}
                            >
                                {isPurchasing ? <Loader2 className="animate-spin h-5 w-5 mx-auto" /> : (isSoldOut ? 'Sold Out' : 'Buy Ticket')}
                            </button>
                        </li>
                    );
                })}
            </ul>
        );
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    return (
        <div className="App">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
                /* --- Main App and General Styles --- */
                .App {
                    font-family: 'Inter', sans-serif;
                    max-width: 600px;
                    margin: 40px auto;
                    padding: 20px;
                    border: 1px solid #ddd;
                    border-radius: 12px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
                    background-color: #f7f9fb;
                    display: flex;
                    flex-direction: column;
                }
                h1 {
                    color: #522583; 
                    text-align: center;
                    margin-bottom: 20px;
                    border-bottom: 2px solid #f66733; 
                    padding-bottom: 10px;
                    font-weight: 700;
                }
                .loading-state, .error-message {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 15px;
                    border-radius: 8px;
                    font-weight: 600;
                }
                .error-message {
                    color: #d32f2f;
                    background-color: #ffebee;
                }
                .retry-button {
                    display: flex; align-items: center; margin-left: 10px; padding: 5px 10px;
                    background: #522583; color: white; border: none; border-radius: 6px; cursor: pointer;
                }
                
                /* --- Tab Navigation --- */
                .tab-navigation {
                    display: flex;
                    margin-bottom: 20px;
                    border-bottom: 1px solid #ddd;
                    border-radius: 8px 8px 0 0;
                    overflow: hidden;
                }
                .tab-button {
                    flex: 1; padding: 12px 15px; font-size: 1rem; font-weight: bold;
                    border: none; background-color: #f0f2f5; cursor: pointer;
                    color: #666; transition: all 0.3s; border-bottom: 3px solid transparent;
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                }
                .tab-button:hover {
                    background-color: #e0e2e5;
                }
                .tab-button.active {
                    color: #522583;
                    border-bottom: 3px solid #f66733;
                    background-color: white;
                }
                .tab-button.drop-target {
                    background-color: #e8e0f1; 
                    border-bottom-color: #522583;
                    transform: scale(1.02);
                }

                /* --- Tab Content --- */
                .tab-content {
                    min-height: 500px;
                    display: flex;
                    flex-direction: column;
                }
                .events-container {
                    padding-top: 10px;
                }
                
                /* --- Event List Styles --- */
                .event-list { list-style: none; padding: 0; }
                .event-item {
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 15px; margin-bottom: 10px; border: 1px solid #e0e0e0;
                    border-radius: 8px; background-color: #ffffff;
                    cursor: grab; transition: transform 0.2s, box-shadow 0.2s;
                }
                .event-item:hover {
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
                }
                .event-info { 
                    display: flex; flex-direction: column; gap: 5px; color: #000000;
                    font-weight: 600;
                }
                .ticket-count { font-size: 0.9em; color: #f66733; font-weight: bold; }
                .buy-button {
                    padding: 8px 15px; border: none; border-radius: 6px; cursor: pointer;
                    font-weight: bold; transition: background-color 0.3s, opacity 0.3s;
                    background-color: #522583; color: white;
                    min-width: 100px;
                    display: flex; align-items: center; justify-content: center;
                }
                .buy-button:hover:not(:disabled) { background-color: #6a3e9c; }
                .buy-button:disabled {
                    background-color: #cccccc; color: #666666; cursor: not-allowed; opacity: 0.7;
                }
                 .buy-button.sold-out {
                    background-color: #f0f0f0; color: #999999; border: 1px solid #ccc;
                }

                /* --- Chat Styles --- */
                .chat-area-container {
                    flex-grow: 1; display: flex; flex-direction: column; gap: 15px;
                }
                .chat-box {
                    flex-grow: 1; height: 350px; overflow-y: auto;
                    border: 1px solid #e0e0e0; padding: 15px;
                    border-radius: 8px; background-color: white;
                    display: flex; flex-direction: column; gap: 12px;
                }
                .chat-message {
                    display: flex;
                    max-width: 85%;
                }
                .user-message {
                    justify-content: flex-end;
                    margin-left: auto;
                }
                .bot-message {
                    justify-content: flex-start;
                    margin-right: auto;
                }
                .message-bubble {
                    padding: 10px 15px;
                    border-radius: 18px;
                    line-height: 1.5;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                    white-space: pre-wrap;
                }
                .user-message .message-bubble {
                    background-color: #522583;
                    color: white;
                    border-bottom-right-radius: 2px;
                }
                .bot-message .message-bubble {
                    background-color: #e6e6e6;
                    color: #333;
                    border-bottom-left-radius: 2px;
                }
                .proposal-actions {
                    margin-top: 10px;
                    padding-top: 10px;
                    border-top: 1px solid #d0d0d0;
                }
                .proposal-prompt {
                    font-weight: 600;
                    margin-bottom: 8px;
                    color: #333;
                }
                .confirm-button, .cancel-button {
                    padding: 6px 10px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                    margin-right: 8px;
                    transition: background-color 0.2s;
                }
                .confirm-button {
                    background-color: #28a745;
                    color: white;
                }
                .confirm-button:hover {
                    background-color: #218838;
                }
                .cancel-button {
                    background-color: #dc3545;
                    color: white;
                }
                .cancel-button:hover {
                    background-color: #c82333;
                }

                /* --- Chat Input --- */
                .chat-input-container {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }
                .chat-input {
                    flex-grow: 1;
                    padding: 12px 15px;
                    border: 1px solid #ccc;
                    border-radius: 8px;
                    font-size: 1rem;
                    transition: border-color 0.2s;
                }
                .chat-input:focus {
                    border-color: #f66733;
                    outline: none;
                    box-shadow: 0 0 0 2px rgba(246, 103, 51, 0.2);
                }
                .send-button {
                    background-color: #f66733;
                    color: white;
                    padding: 10px;
                    border-radius: 8px;
                    border: none;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 44px;
                }
                .send-button:hover:not(:disabled) {
                    background-color: #d15125;
                }
                .send-button:disabled {
                    background-color: #cccccc;
                    cursor: not-allowed;
                }
                
                @media (max-width: 650px) {
                    .App { margin: 20px 10px; padding: 15px; }
                    .event-item { flex-direction: column; align-items: flex-start; gap: 10px; }
                    .buy-button { width: 100%; }
                    .chat-box { height: 300px; }
                }
            `}</style>
            <h1>Clemson Campus Events</h1>

            <div className="tab-navigation">
                <button
                    className={`tab-button ${activeTab === 'events' ? 'active' : ''}`}
                    onClick={() => setActiveTab('events')}
                    aria-pressed={activeTab === 'events'}
                >
                    <ShoppingCart className="h-5 w-5" /> Events
                </button>
                <button
                    className={`tab-button ${activeTab === 'chat' ? 'active' : ''} ${isDropTarget ? 'drop-target' : ''}`}
                    onClick={() => setActiveTab('chat')}
                    aria-pressed={activeTab === 'chat'}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <MessageSquare className="h-5 w-5" /> TigerTix Assistant
                </button>
            </div>

            <div className="tab-content">
                {activeTab === 'events' && (
                    <div className="events-container">
                        {renderEventsContent()}
                    </div>
                )}
                {activeTab === 'chat' && (
                    <div className="chat-area-container">
                        <div className="chat-box">
                            {chatMessages.map((msg) => (
                                <ChatMessage
                                    key={msg.id}
                                    message={msg}
                                    onConfirm={handleConfirm}
                                    onCancel={handleCancel}
                                />
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                        <ChatInput
                            onSendMessage={handleSendMessage}
                            isLoading={isChatLoading}
                            isChatReady={isChatReady}
                            value={chatInputText}
                            onChange={setChatInputText}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}