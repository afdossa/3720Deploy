const express = require('express');
const cors = require('cors');
// Import the Google Gen AI library for the secure backend
const { GoogleGenAI, FunctionDeclaration, Type } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Mock Data and Event Logic (Keep this) ---
let events = [
    { id: 1, name: 'Jazz Night', date: '2025-11-20', tickets_available: 5 },
    { id: 2, name: 'Senior Art Showcase', date: '2025-11-25', tickets_available: 12 },
    { id: 3, name: 'Basketball Game', date: '2025-12-01', tickets_available: 0 },
    { id: 4, name: 'Campus Choir Concert', date: '2025-12-05', tickets_available: 20 }
];

// --- Server Setup ---
// Use the appropriate CORS settings for your frontend deployment
app.use(cors());
app.use(express.json());


// --- 1. Event Listing Route (GET /api/events) ---
app.get('/api/events', (req, res) => {
    res.json(events);
});

// --- 2. Event Purchase Route (POST /api/events/:id/purchase) ---
app.post('/api/events/:id/purchase', (req, res) => {
    const eventId = parseInt(req.params.id);
    const event = events.find(e => e.id === eventId);

    if (!event) {
        return res.status(404).json({ message: 'Event not found.' });
    }

    if (event.tickets_available <= 0) {
        return res.status(400).json({ message: 'This event is sold out.' });
    }

    // Process the purchase
    event.tickets_available -= 1;
    res.status(200).json({ message: 'Ticket purchased successfully!', event });
});


// --- 3. CHAT ROUTE (POST /api/chat) ---
// THIS IS THE ROUTE THAT FIXES THE 404 ERROR!
app.post('/api/chat', async (req, res) => {
    const { message, events: currentEvents } = req.body;

    if (!message) {
        return res.status(400).json({ message: 'Message field is required.' });
    }

    try {
        // Since the chat history isn't maintained in this simple backend structure,
        // we'll re-initialize the chat on every request.
        // In a production app, you would store and pass chat history.
        const chat = await initChat();

        // Use the events list passed from the frontend for context
        const response = await sendMessage(chat, message, currentEvents);

        // Send the AI's response back to the frontend
        res.json(response);

    } catch (error) {
        console.error("Error processing chat request:", error.message);
        // Ensure the error response is formatted as JSON
        res.status(500).json({ message: 'Error processing chat request: ' + error.message });
    }
});


// --- AI CORE LOGIC (INTEGRATED) ---

let ai;
function getGoogleAI() {
    if (!ai) {
        // CRITICAL: Get the API key from Render's environment variable!
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            throw new Error("API_KEY environment variable is not set.");
        }
        ai = new GoogleGenAI({ apiKey });
    }
    return ai;
}

const tools = [
    {
        name: 'list_events',
        description: 'Lists all available events with their names and number of tickets available.',
        parameters: { type: Type.OBJECT, properties: {} },
    },
    {
        name: 'propose_booking',
        description: 'Proposes a ticket booking to the user and asks for their confirmation. This must be called when the user expresses clear intent to book tickets for a specific event.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                eventName: { type: Type.STRING, description: 'The name of the event to book tickets for.' },
                ticketCount: { type: Type.INTEGER, description: 'The number of tickets the user wants to book.' },
            },
            required: ['eventName', 'ticketCount'],
        },
    },
];

const systemInstruction = `You are TigerTix Bot, a friendly and helpful assistant for booking event tickets.
Your goal is to help users find and book tickets for events.
Follow these steps strictly:
1. Greet the user and offer to help.
2. If the user asks to see events, you MUST use the 'list_events' function. Do not make up event information.
3. When a user expresses clear intent to book tickets (e.g., "I want 2 tickets for Jazz Night"), you MUST use the 'propose_booking' function with the extracted event name and ticket count.
4. After calling 'propose_booking', wait for the system to provide the result of the user's confirmation. The user will confirm via a button in the UI.
5. If the booking is confirmed by the system, congratulate the user. If it's cancelled, ask what they would like to do next.
6. If the user asks for an event that doesn't exist, inform them and suggest listing available events.
7. Do not perform any other tasks. If the user asks about something other than events or booking, politely state that you can only assist with event ticket bookings.`;

const initChat = async () => {
    const aiInstance = getGoogleAI();
    return aiInstance.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: systemInstruction,
            tools: [{ functionDeclarations: tools }],
        },
    });
};

const sendMessage = async (
    chat,
    message,
    events
) => {
    let response = await chat.sendMessage({ message });

    const functionCall = response?.functionCalls?.[0];

    if (functionCall) {
        if (functionCall.name === 'propose_booking') {
            const eventName = functionCall.args.eventName;
            const ticketCount = functionCall.args.ticketCount;
            // Return to the frontend to trigger the confirmation UI
            return {
                type: 'proposal',
                text: `Great! I'm ready to book ${ticketCount} ticket(s) for "${eventName}". Please confirm to proceed.`,
                proposal: { eventName, ticketCount }
            };
        }

        if (functionCall.name === 'list_events') {
            const { name } = functionCall;
            const eventList = events.map(e => `- ${e.name} on ${e.date} (${e.tickets_available} tickets available)`).join('\n');

            const functionResponsePart = {
                functionResponse: {
                    name,
                    response: {
                        result: `Here are the available events:\n${eventList}`
                    }
                }
            };

            // Send the function result back to the AI for a final text response
            response = await chat.sendMessage({ message: [functionResponsePart] });
        }
    }

    return { type: 'text', text: response.text };
};

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});