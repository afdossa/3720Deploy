import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Send, Loader2, ShoppingCart, MessageSquare, Bot, User, CheckCircle, XCircle } from 'lucide-react';

// --- Global API Key and Configuration ---
const API_KEY = typeof __api_key !== 'undefined' ? __api_key : 'AIzaSyBv69e52kItIMFiYqyneoPD_urYiaTggWo'; // Canvas API Key
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const MAX_RETRIES = 3;

// --- Shared Data Types ---
const MessageSender = {
    USER: 'user',
    BOT: 'bot',
};

// --- Mock Data (Local Storage) ---
const initialMockEvents = [
    { id: 1, name: 'Jazz Night', date: '2025-11-20', tickets_available: 5 },
    { id: 2, name: 'Senior Art Showcase', date: '2025-11-25', tickets_available: 12 },
    { id: 3, name: 'Basketball Game', date: '2025-12-01', tickets_available: 0 }, // Sold out example
    { id: 4, name: 'Campus Choir Concert', date: '2025-12-05', tickets_available: 20 }
];

// --- Type Definitions for Chat State ---
/** @typedef {object} BookingProposal */
/** @property {string} eventName */
/** @property {number} ticketCount */

/** @typedef {object} ChatMessage */
/** @property {string} id */
/** @property {string} sender */
/** @property {string} text */
/** @property {BookingProposal | undefined} bookingProposal */

// --- Utility Functions ---

/** Sleeps for a given duration. */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Executes the fetch request with exponential backoff for 429 errors.
 * @param {object} payload - The Gemini API request body.
 * @returns {Promise<object>} The parsed JSON response data.
 */
const fetchWithRetry = async (payload) => {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(`${API_URL}?key=${API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.status === 429) {
                // Too Many Requests, calculate delay and retry
                const retryAfter = Math.pow(2, attempt) * 1000 + (Math.random() * 1000); // 1s, 2s, 4s + jitter
                console.warn(`Quota exceeded (429). Retrying in ${Math.round(retryAfter / 1000)}s... (Attempt ${attempt + 1}/${MAX_RETRIES})`);
                if (attempt === MAX_RETRIES - 1) throw new Error("API Quota exceeded after all retries.");
                await delay(retryAfter);
                continue;
            }

            if (!response.ok) {
                // Handle other non-retryable errors
                const errorBody = await response.text();
                throw new Error(`API call failed with status ${response.status}: ${errorBody.substring(0, 100)}...`);
            }

            const result = await response.json();

            // Extract and clean the JSON text from the response
            const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!jsonText) {
                throw new Error("AI returned an empty or invalid response.");
            }

            // Remove markdown wrappers if present
            const cleanedJsonText = jsonText.replace(/```json\n?|```/g, '').trim();

            return JSON.parse(cleanedJsonText);

        } catch (error) {
            if (attempt === MAX_RETRIES - 1) throw error;
            // For network errors or parsing errors, we also retry with backoff
            const retryAfter = Math.pow(2, attempt) * 1000 + (Math.random() * 1000);
            console.warn(`Error on attempt ${attempt + 1}: ${error.message}. Retrying in ${Math.round(retryAfter / 1000)}s...`);
            await delay(retryAfter);
        }
    }
    throw new Error("Failed to get response from Gemini API after all retries.");
};


// --- Component Definitions ---

const ChatInput = ({ onSendMessage, isLoading, isChatReady, value, onChange }) => {
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !isLoading && isChatReady) {
            e.preventDefault(); // Prevent new line
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
                placeholder={isChatReady ? "Ask about events or drag an event here..." : "Initializing AI assistant..."}
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

    return (
        <div className={`chat-message ${isBot ? 'bot-message' : 'user-message'}`}>
            {isBot && <Bot size={24} className="message-icon" />}

            <div className="message-content">
                <div className="message-bubble">
                    {message.text}
                    {message.bookingProposal && (
                        <div className="proposal-card">
                            <p className="proposal-text">Booking Proposal:</p>
                            <p>Event: **{message.bookingProposal.eventName}**</p>
                            <p>Tickets: **{message.bookingProposal.ticketCount}**</p>

                            <div className="proposal-actions">
                                <button className="confirm-button" onClick={() => onConfirm(message.bookingProposal)}>
                                    <CheckCircle size={18} /> Confirm
                                </button>
                                <button className="cancel-button" onClick={() => onCancel(message.bookingProposal)}>
                                    <XCircle size={18} /> Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {!isBot && <User size={24} className="message-icon" />}
        </div>
    );
};

// --- Main Application Component ---

export default function App() {
    // --- State for Event Listing ---
    const [events, setEvents] = useState(initialMockEvents); // Use mock data directly
    const [apiKeyError, setApiKeyError] = useState(null); // Error for API Key or initial setup
    const [purchasingEventId, setPurchasingEventId] = useState(null);

    // --- State for the Chat ---
    const [chatMessages, setChatMessages] = useState([]);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [chatInputText, setChatInputText] = useState('');
    const messagesEndRef = useRef(null);
    const [isChatReady, setIsChatReady] = useState(false);
    const [geminiError, setGeminiError] = useState(null); // Error for Gemini API calls

    // --- State for UI ---
    const [activeTab, setActiveTab] = useState('events');
    const [isDropTarget, setIsDropTarget] = useState(false);

    // --- API Key Check ---
    useEffect(() => {
        if (!API_KEY) {
            setApiKeyError("Error: Gemini API Key is missing. Please ensure it is provided in the environment.");
            setIsChatReady(false);
            return;
        }
        setIsChatReady(true);
        addMessage(
            MessageSender.BOT,
            "Hello! I'm the TigerTix Assistant. How can I help you find or book tickets for campus events today? Try dragging an event to the chat tab!"
        );
    }, []);

    // Helper to add messages
    const addMessage = (sender, text, bookingProposal) => {
        setChatMessages(prev => [
            ...prev,
            { id: Date.now().toString() + Math.random(), sender, text, bookingProposal }
        ]);
    };

    // --- Core Data Logic (Mocked) ---

    // Function to simulate a purchase and update local state
    const purchaseSingleTicket = (eventId) => {
        const eventIndex = events.findIndex(e => e.id === eventId);

        if (eventIndex === -1) {
            return { success: false, message: 'Event not found.' };
        }

        const event = events[eventIndex];

        if (event.tickets_available <= 0) {
            return { success: false, message: 'This event is sold out.' };
        }

        // Update local state (simulate database change)
        const updatedEvents = [...events];
        updatedEvents[eventIndex].tickets_available -= 1;
        setEvents(updatedEvents);

        return { success: true, eventName: event.name };
    };

    // --- AI Communication (Direct Fetch with Retry) ---
    const getGeminiResponse = async (prompt, currentEvents) => {
        setGeminiError(null); // Clear previous errors

        const eventContext = currentEvents.map(e =>
            `Name: ${e.name}, Available Tickets: ${e.tickets_available}`
        ).join('; ');

        const systemInstruction = `You are the TigerTix Assistant. Your goal is to help users find and book tickets for available events.
            
            CURRENT AVAILABLE EVENTS: ${eventContext}
            
            Instructions:
            1. Always respond with a concise, helpful text message in the 'response' field.
            2. If the user expresses clear intent to book tickets for a specific event AND ticket count, populate the 'proposal' object. Only propose bookings for events listed in CURRENT AVAILABLE EVENTS and do not exceed the available ticket count.
            3. If no booking intent is found, the 'proposal' field must be null or omitted.
            4. DO NOT output any text outside of the JSON block.
            5. If the user asks for a list of events, list them out in the 'response' field using the CURRENT AVAILABLE EVENTS data.`;

        // Structured JSON Response Schema
        const responseSchema = {
            type: 'OBJECT',
            properties: {
                response: {
                    type: 'STRING',
                    description: "The main text message response to the user's query."
                },
                proposal: {
                    type: 'OBJECT',
                    description: "An optional object containing a booking proposal if the user asked to book tickets.",
                    properties: {
                        eventName: { type: 'STRING', description: 'The name of the event to book.' },
                        ticketCount: { type: 'NUMBER', description: 'The number of tickets to book.' },
                    },
                    required: ['eventName', 'ticketCount']
                }
            },
            required: ['response']
        };

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
            systemInstruction: { parts: [{ text: systemInstruction }] }
        };

        return await fetchWithRetry(payload);
    };


    const handleSendMessage = async (messageText) => {
        if (isChatLoading || !isChatReady || !messageText.trim()) return;

        addMessage(MessageSender.USER, messageText);
        setChatInputText('');
        setIsChatLoading(true);

        try {
            // Get simplified event context for the AI
            const eventContext = events.map(e => ({
                name: e.name,
                tickets_available: e.tickets_available
            }));

            // Call the direct Gemini API function
            const data = await getGeminiResponse(messageText, eventContext);

            // The AI provides the text response and optionally the proposal
            addMessage(MessageSender.BOT, data.response, data.proposal);

        } catch (err) {
            console.error("Error communicating with Gemini API:", err);
            setGeminiError(`Error: ${err.message}. Please try refreshing or checking your API quota.`);
            addMessage(MessageSender.BOT, "Sorry, I encountered an error communicating with the assistant. Please try again in a few moments.");
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
        let lastSuccessfulEventName = '';

        for (let i = 0; i < proposal.ticketCount; i++) {
            // Use local purchase function
            const result = purchaseSingleTicket(eventToBook.id);
            if (result.success) {
                ticketsPurchased++;
                lastSuccessfulEventName = result.eventName;
            } else {
                purchaseFailed = true;
                failureMessage = result.message || 'An unknown error occurred.';
                break;
            }
        }

        if (purchaseFailed) {
            addMessage(MessageSender.BOT, `I was only able to purchase ${ticketsPurchased} ticket(s) for "${proposal.eventName}". Booking failed: ${failureMessage}`);
            return;
        }

        if (ticketsPurchased > 0) {
            // Send a confirmation message to the AI for a cheerful final response
            const confirmationMessage = `I have successfully purchased ${ticketsPurchased} ticket(s) for ${lastSuccessfulEventName}. Please provide a brief, cheerful confirmation message.`;
            await handleSendMessage(confirmationMessage);
        }
    };

    const handleCancel = async (proposal) => {
        // Remove proposal buttons from UI messages
        setChatMessages(prev => prev.map(msg => msg.bookingProposal && msg.bookingProposal.eventName === proposal.eventName ? { ...msg, bookingProposal: undefined } : msg));

        // Send a cancellation message to the AI for a polite cancellation message.
        const cancellationMessage = `Cancel the booking proposal for ${proposal.ticketCount} ticket(s) for ${proposal.eventName}. Please provide a brief, polite cancellation message.`;
        await handleSendMessage(cancellationMessage);
    };

    // --- UI Logic ---

    const handleDirectPurchase = (eventId) => {
        if (purchasingEventId) return;

        setPurchasingEventId(eventId);
        try {
            const result = purchaseSingleTicket(eventId);

            if (!result.success) {
                // Use custom message box instead of alert
                addMessage(MessageSender.BOT, `Direct purchase failed: ${result.message}`);
            } else {
                addMessage(MessageSender.BOT, `One ticket purchased for ${result.eventName}. Enjoy the event!`);
            }
        } catch (err) {
            console.error('Purchase error:', err);
            addMessage(MessageSender.BOT, 'An unexpected error occurred while purchasing. Please try again.');
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
        if (apiKeyError) return <p className="error-message">{apiKeyError}</p>;
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
                
                /* Chat Messages */
                .chat-message {
                    display: flex;
                    gap: 10px;
                    align-items: flex-start;
                    max-width: 85%;
                    margin-left: auto;
                }
                .bot-message {
                    margin-left: 0;
                    margin-right: auto;
                }
                .message-icon {
                    flex-shrink: 0;
                    padding: 4px;
                    border-radius: 50%;
                    background-color: #522583; /* Clemson Purple */
                    color: white;
                }
                .bot-message .message-icon {
                    background-color: #f66733; /* Clemson Orange */
                }
                .message-bubble {
                    padding: 12px 15px;
                    border-radius: 18px;
                    line-height: 1.5;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                .user-message .message-bubble {
                    background-color: #522583;
                    color: white;
                    border-bottom-right-radius: 4px;
                }
                .bot-message .message-bubble {
                    background-color: #e6e6e6;
                    color: #333;
                    border-bottom-left-radius: 4px;
                }
                .proposal-card {
                    margin-top: 10px;
                    padding: 12px;
                    border: 1px dashed #f66733;
                    border-radius: 8px;
                    background-color: #fffaf7;
                }
                .proposal-text {
                    font-weight: bold;
                    margin-bottom: 8px;
                    color: #522583;
                }
                .proposal-actions {
                    display: flex;
                    gap: 10px;
                    margin-top: 10px;
                }
                .confirm-button, .cancel-button {
                    padding: 8px 12px;
                    border: none;
                    border-radius: 6px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .confirm-button {
                    background-color: #4CAF50;
                    color: white;
                }
                .confirm-button:hover {
                    background-color: #45a049;
                }
                .cancel-button {
                    background-color: #f44336;
                    color: white;
                }
                .cancel-button:hover {
                    background-color: #da190b;
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
            {geminiError && <p className="error-message">{geminiError}</p>}

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
                        {apiKeyError && isChatReady === false && (
                            <p className="error-message">{apiKeyError}</p>
                        )}
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