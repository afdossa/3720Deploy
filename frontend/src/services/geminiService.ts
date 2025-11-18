

import { GoogleGenAI, Chat, FunctionDeclaration, Type } from '@google/genai';
import { Event, BookingProposal, BotResponse } from '../types';

let ai: GoogleGenAI;

function getGoogleAI() {
  if (!ai) {
    // FIX: The API key must be obtained from process.env.API_KEY.
    ai = new GoogleGenAI({ apiKey: "AIzaSyBv69e52kItIMFiYqyneoPD_urYiaTggWo" });
  }
  return ai;
}

const tools: FunctionDeclaration[] = [
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
        eventName: {
          type: Type.STRING,
          description: 'The name of the event to book tickets for.',
        },
        ticketCount: {
          type: Type.INTEGER,
          description: 'The number of tickets the user wants to book.',
        },
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

export const initChat = async (): Promise<Chat> => {
  const ai = getGoogleAI();
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: systemInstruction,
      tools: [{ functionDeclarations: tools }],
    },
  });
};

export const sendMessage = async (
    chat: Chat,
    message: string,
    events: Event[]
): Promise<BotResponse> => {
  let response = await chat.sendMessage({ message });

  const functionCall = response?.functionCalls?.[0];

  if (functionCall) {
    if (functionCall.name === 'propose_booking') {
      const eventName = functionCall.args.eventName as string;
      const ticketCount = functionCall.args.ticketCount as number;
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

      response = await chat.sendMessage({ message: [functionResponsePart] });
    }
  }

  return { type: 'text', text: response.text };
};

export const confirmBooking = async (
    chat: Chat,
    proposal: BookingProposal
): Promise<string> => {
  const response = await chat.sendMessage({
    message: [
      {
        functionResponse: {
          name: 'propose_booking',
          response: {
            result: `Booking confirmed by user for ${proposal.ticketCount} tickets to ${proposal.eventName}.`,
          },
        },
      },
    ],
  });
  return response.text;
}

export const cancelBooking = async (
    chat: Chat,
    proposal: BookingProposal
): Promise<string> => {
  const response = await chat.sendMessage({
    message: [
      {
        functionResponse: {
          name: 'propose_booking',
          response: {
            result: `Booking cancelled by user for ${proposal.ticketCount} tickets to ${proposal.eventName}.`,
          },
        },
      },
    ],
  });
  return response.text;
}
