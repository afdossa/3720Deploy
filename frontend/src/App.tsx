import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { Chat } from '@google/genai';
import type { ChatMessage as ChatMessageType, BookingProposal, Event } from './types';
import { useNavigate, useLocation } from 'react-router-dom';

// Import services and components
import { initChat, sendMessage, confirmBooking, cancelBooking } from './services/geminiService';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { MessageSender } from './types';

const API_BASE_URL = 'https://three720deploy.onrender.com/api';
const GEMINI_API_KEY = typeof __api_key !== 'undefined' ? __api_key : 'AIzaSyBv69e52kItIMFiYqyneoPD_urYiaTggWo';

type ActiveTab = 'events' | 'chat';

// --- AUTHENTICATION STATE & LOGIC (From AuthContext) ---

interface User {
    id: number;
    email: string;
}

/**
 * Custom hook to encapsulate the authentication state and logic.
 * This effectively replaces the AuthProvider and useAuth hook.
 */
const useSingleFileAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const isAuthenticated = !!user;

    const handleAuthRequest = async (endpoint: string, email: string, password: string): Promise<User | null> => {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // CRITICAL for JWT cookie handling
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            return data.user as User;
        } catch (error) {
            return null;
        }
    };

    const login = useCallback(async (email: string, password: string): Promise<boolean> => {
        const userData = await handleAuthRequest('/login', email, password);
        if (userData) {
            setUser(userData);
            return true;
        }
        return false;
    }, []);

    const register = useCallback(async (email: string, password: string): Promise<boolean> => {
        const userData = await handleAuthRequest('/register', email, password);
        return !!userData;
    }, []);

    const logout = useCallback(async () => {
        try {
            await fetch(`${API_BASE_URL}/logout`, {
                method: 'POST',
                credentials: 'include',
            });
        } catch (error) {
            // Ignore error, reset state anyway
        } finally {
            setUser(null);
        }
    }, []);

    // Session check on initial load (uses the protected /profile route)
    useEffect(() => {
        const verifyAuth = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/profile`, {
                    method: 'GET',
                    credentials: 'include',
                });

                if (response.ok) {
                    const data = await response.json();
                    setUser(data.user);
                } else if (response.status === 401) {
                    setUser(null);
                }
            } catch (error) {
                setUser(null);
            }
        };

        verifyAuth();
    }, []);

    return { user, isAuthenticated, login, register, logout };
};

// --- AUTHENTICATION COMPONENTS (From login.tsx and register.tsx) ---

function LoginScreen({ login, navigateToRegister }) {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const success = await login(email, password);
        if (success) {
            navigate('/');
        } else {
            setError('Invalid credentials.');
        }
    };

    return (
        <div className="auth-container">
            <h2>Login</h2>
            <form onSubmit={handleSubmit}>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                {error && <p className="auth-error">{error}</p>}
                <button type="submit">Login</button>
            </form>
            <p className="auth-link" onClick={navigateToRegister}>
                Need an account? Register here.
            </p>
        </div>
    );
}

function RegisterScreen({ register, navigateToLogin }) {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const success = await register(email, password);
        if (success) {
            // On successful registration, redirect to login
            navigate('/login');
        } else {
            setError('Registration failed. User may already exist.');
        }
    };

    return (
        <div className="auth-container">
            <h2>Register</h2>
            <form onSubmit={handleSubmit}>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                {error && <p className="auth-error">{error}</p>}
                <button type="submit">Create Account</button>
            </form>
            <p className="auth-link" onClick={navigateToLogin}>
                Already have an account? Login here.
            </p>
        </div>
    );
}

// --- MAIN APPLICATION COMPONENT (App.tsx) ---

export default function App() {
    const { user, isAuthenticated, login, register, logout } = useSingleFileAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // --- State for Event Listing ---
    const [events, setEvents] = useState<Event[]>([]);
    const [isLoadingEvents, setIsLoadingEvents] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [purchasingEventId, setPurchasingEventId] = useState<number | null>(null);


    // --- State for the Chat ---
    const [chat, setChat] = useState<Chat | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessageType[]>([]);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [chatInputText, setChatInputText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const initRan = useRef(false);


    // --- State for UI ---
    const [activeTab, setActiveTab] = useState<ActiveTab>('events');
    const [isDropTarget, setIsDropTarget] = useState(false);


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
        } catch (err: any) {
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

    // Initialize Chat on component mount
    useEffect(() => {
        if (initRan.current === false) {
            const initializeChat = async () => {
                try {
                    const chatSession = await initChat(GEMINI_API_KEY);                    setChat(chatSession);
                    addMessage(
                        MessageSender.BOT,
                        "Hello! I'm the TigerTix Assistant. How can I help you find or book tickets for campus events today?"
                    );
                } catch (e) {
                    console.error("Failed to initialize Gemini chat:", e);
                    addMessage(
                        MessageSender.BOT,
                        "Sorry, I couldn't connect to the AI assistant. Please check your API key configuration."
                    );
                }
            };
            initializeChat();
            initRan.current = true;
        }
    }, []);


    // A silent purchase function that doesn't interact with chat state directly.
    const purchaseSingleTicket = async (id: number): Promise<{ success: boolean; message?: string }> => {
        const endpoint = `${API_BASE_URL}/events/${id}/purchase`;
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                credentials: 'include', // CRITICAL for protected routes
            });
            if (!response.ok) {
                if (response.status === 401) {
                    navigate('/login');
                    return { success: false, message: 'Session expired or not logged in. Please log in.' };
                }
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

    // New handler for direct purchase from the events list
    const handleDirectPurchase = async (eventId: number) => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        if (purchasingEventId) return; // Prevent multiple clicks while one is in progress

        setPurchasingEventId(eventId);
        try {
            const result = await purchaseSingleTicket(eventId);

            if (result.success) {
                await fetchEvents(); // Refresh the list
            } else {
                alert(`Purchase failed: ${result.message}`);
            }
        } catch (err) {
            console.error('Error during direct purchase flow:', err);
            alert('An unexpected error occurred while purchasing. Please try again.');
        } finally {
            setPurchasingEventId(null);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    // --- Drag and Drop Handlers ---
    const handleDragStart = (e: React.DragEvent<HTMLLIElement>, event: Event) => {
        e.dataTransfer.setData('application/json', JSON.stringify(event));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent<HTMLButtonElement>) => {
        e.preventDefault(); // Necessary to allow dropping
        setIsDropTarget(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLButtonElement>) => {
        e.preventDefault();
        setIsDropTarget(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
        e.preventDefault();
        setIsDropTarget(false);
        try {
            const eventDataString = e.dataTransfer.getData('application/json');
            if (!eventDataString) return;

            const event = JSON.parse(eventDataString) as Event;
            setActiveTab('chat');
            setChatInputText(`I'm interested in the "${event.name}" event.`);
        } catch (error) {
            console.error('Failed to parse dropped event data:', error);
        }
    };


    const renderEventsContent = () => {
        if (isLoadingEvents) return <p>Loading events...</p>;
        if (error) return <p className="error-message">{error}</p>;
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
                                {isSoldOut ? 'Sold Out' : 'Buy Ticket'}
                            </button>
                        </li>
                    );
                })}
            </ul>
        );
    };

    const addMessage = (sender: MessageSender, text: string, bookingProposal?: BookingProposal) => {
        setChatMessages(prev => [
            ...prev,
            { id: Date.now().toString() + Math.random(), sender, text, bookingProposal }
        ]);
    };

    const handleSendMessage = async (messageText: string) => {
        if (isChatLoading || !chat || !messageText.trim()) return;

        addMessage(MessageSender.USER, messageText);
        setChatInputText(''); // Clear input after sending
        setIsChatLoading(true);

        try {
            const response = await sendMessage(chat, messageText, events);
            addMessage(MessageSender.BOT, response.text, response.type === 'proposal' ? response.proposal : undefined);
        } catch (err) {
            console.error("Error sending message:", err);
            addMessage(MessageSender.BOT, "Sorry, I encountered an error. Please try again.");
        } finally {
            setIsChatLoading(false);
        }
    };

    const handleConfirm = async (proposal: BookingProposal) => {
        const eventToBook = events.find(e => e.name.toLowerCase() === proposal.eventName.toLowerCase());

        if (!eventToBook) {
            addMessage(MessageSender.BOT, `Sorry, I couldn't find an event named "${proposal.eventName}".`);
            return;
        }

        if (eventToBook.tickets_available < proposal.ticketCount) {
            addMessage(MessageSender.BOT, `Sorry, there are not enough tickets available for "${proposal.eventName}". Only ${eventToBook.tickets_available} left.`);
            return;
        }

        setChatMessages(prev => prev.map(msg => msg.bookingProposal ? { ...msg, bookingProposal: undefined } : msg));

        let ticketsPurchased = 0;
        let purchaseFailed = false;
        let failureMessage = '';

        if (!isAuthenticated) {
            navigate('/login');
            addMessage(MessageSender.BOT, `Please log in to complete your booking.`);
            return;
        }

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
            addMessage(MessageSender.BOT, `I was only able to purchase ${ticketsPurchased} ticket(s) for "${proposal.eventName}". The booking failed: ${failureMessage}`);
            return;
        }

        if (ticketsPurchased > 0 && chat) {
            const confirmationText = await confirmBooking(chat, proposal);
            addMessage(MessageSender.BOT, confirmationText);
        }
    };

    const handleCancel = async (proposal: BookingProposal) => {
        setChatMessages(prev => prev.map(msg => msg.bookingProposal ? { ...msg, bookingProposal: undefined } : msg));

        if (chat) {
            const cancellationText = await cancelBooking(chat, proposal);
            addMessage(MessageSender.BOT, cancellationText);
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    // Conditional rendering based on the current URL path (manual routing)
    const renderContent = () => {
        if (location.pathname === '/login') {
            return <LoginScreen
                login={login}
                navigateToRegister={() => navigate('/register')}
            />;
        }
        if (location.pathname === '/register') {
            return <RegisterScreen
                register={register}
                navigateToLogin={() => navigate('/login')}
            />;
        }

        // Default (main) application view
        return (
            <>
                <div className="header-row">
                    <h1>Clemson Campus Events</h1>
                    <div className="auth-status">
                        {isAuthenticated ? (
                            <>
                                <span className="user-info">Logged in as {user?.email}</span>
                                <button onClick={handleLogout} className="auth-button">
                                    Logout
                                </button>
                            </>
                        ) : (
                            <button onClick={() => navigate('/login')} className="auth-button">
                                Login
                            </button>
                        )}
                    </div>
                </div>

                <div className="tab-navigation">
                    <button
                        className={`tab-button ${activeTab === 'events' ? 'active' : ''}`}
                        onClick={() => setActiveTab('events')}
                        aria-pressed={activeTab === 'events'}
                    >
                        Events
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'chat' ? 'active' : ''} ${isDropTarget ? 'drop-target' : ''}`}
                        onClick={() => setActiveTab('chat')}
                        aria-pressed={activeTab === 'chat'}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        TigerTix Assistant
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
                                isChatReady={!!chat}
                                value={chatInputText}
                                onChange={setChatInputText}
                            />
                        </div>
                    )}
                </div>
            </>
        );
    };

    return (
        <div className="App">
            <style>{`
                /* --- Main App and General Styles --- */
                .App {
                    font-family: 'Arial', sans-serif;
                    max-width: 600px;
                    margin: 40px auto;
                    padding: 20px;
                    border: 1px solid #ddd;
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                    background-color: #ffffff;
                    display: flex;
                    flex-direction: column;
                }
                .header-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    border-bottom: 2px solid #f66733; 
                    padding-bottom: 10px;
                }
                h1 {
                    color: #522583; /* Clemson Purple */
                    margin: 0;
                }
                .auth-status {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .user-info {
                    font-size: 0.9em;
                    color: #522583;
                    font-weight: bold;
                }
                .auth-button {
                    padding: 5px 10px;
                    border: 1px solid #f66733;
                    border-radius: 4px;
                    background-color: transparent;
                    color: #f66733;
                    cursor: pointer;
                    font-size: 0.9em;
                    transition: all 0.2s;
                }
                .auth-button:hover {
                    background-color: #f66733;
                    color: white;
                }
                .error-message {
                    color: red;
                    text-align: center;
                    padding: 15px;
                    background-color: #fee;
                    border-radius: 8px;
                }

                /* Auth Specific Styles */
                .auth-container {
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                .auth-container input {
                    padding: 10px;
                    margin-bottom: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }
                .auth-container button {
                    padding: 12px;
                    background-color: #522583;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                }
                .auth-error {
                    color: red;
                    text-align: center;
                    margin-top: 5px;
                }
                .auth-link {
                    color: #f66733;
                    cursor: pointer;
                    text-align: center;
                    font-size: 0.9em;
                }
                
                /* --- Tab Navigation --- */
                .tab-navigation {
                    display: flex;
                    margin-bottom: 20px;
                    border-bottom: 1px solid #ddd;
                }
                .tab-button {
                    flex: 1;
                    padding: 12px 15px;
                    font-size: 1rem;
                    font-weight: bold;
                    border: none;
                    background-color: transparent;
                    cursor: pointer;
                    color: #888;
                    transition: all 0.3s;
                    border-bottom: 3px solid transparent;
                }
                .tab-button:hover {
                    color: #522583;
                }
                .tab-button.active {
                    color: #522583;
                    border-bottom: 3px solid #f66733;
                }
                .tab-button.drop-target {
                    background-color: #e8e0f1; /* Light Clemson Purple */
                    border-bottom-color: #522583;
                    transform: scale(1.02);
                }


                /* --- Tab Content --- */
                .tab-content {
                    min-height: 500px; /* Give a consistent height */
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
                    padding: 15px; margin-bottom: 10px; border: 1px solid #eee;
                    border-radius: 8px; background-color: #f9f9f9;
                    cursor: grab;
                }
                .event-item:active {
                    cursor: grabbing;
                    background-color: #f0eaf8;
                }
                .event-info { 
                    display: flex; 
                    flex-direction: column; 
                    gap: 5px; 
                    color: #000000;
                }
                .ticket-count { font-size: 0.9em; color: #f66733; font-weight: bold; }
                .buy-button {
                    padding: 8px 15px; border: none; border-radius: 6px; cursor: pointer;
                    font-weight: bold; transition: background-color 0.3s, opacity 0.3s;
                    background-color: #522583; color: white;
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
                    flex-grow: 1; /* Allow chat to fill the tab content area */
                    display: flex; flex-direction: column; gap: 15px;
                }
                .chat-box {
                    flex-grow: 1; /* Make chat box take available space */
                    overflow-y: auto;
                    border: 1px solid #eee;
                    padding: 15px;
                    border-radius: 8px;
                    background-color: #f9f9f9;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                
                @media (max-width: 650px) {
                    .App { margin: 20px; padding: 15px; }
                    .event-item { flex-direction: column; align-items: flex-start; gap: 10px; }
                    .buy-button { width: 100%; }
                }
            `}</style>

            {renderContent()}

        </div>
    );
}