import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    initChat,
    sendMessage,
    confirmBooking,
    cancelBooking,
} from "../../services/geminiService.ts";
import { MOCK_EVENTS } from "../../constants.ts";

vi.mock("@google/genai", () => {
    return {
        GoogleGenAI: class {
            constructor() {}
            chats = {
                create: vi.fn().mockReturnValue({
                    sendMessage: vi.fn(),
                }),
            };
        },

        Type: {
            OBJECT: "object",
            STRING: "string",
            INTEGER: "integer",
        },
    };
});

describe("geminiService (simple stubbed tests)", () => {
    let fakeChat: any;
    let fakeSend: any;

    beforeEach(() => {
        fakeSend = vi.fn();
        fakeChat = { sendMessage: fakeSend };
    });

    it("initChat initializes without throwing", async () => {
        await expect(initChat()).resolves.not.toThrow();
    });

    it("sendMessage returns text response", async () => {
        fakeSend.mockResolvedValue({ text: "Hello!" });

        const result = await sendMessage(fakeChat, "hi", MOCK_EVENTS);

        expect(result).toEqual({ type: "text", text: "Hello!" });
    });

    it("sendMessage handles propose_booking", async () => {
        fakeSend.mockResolvedValue({
            functionCalls: [
                { name: "propose_booking", args: { eventName: "Jazz", ticketCount: 2 } },
            ],
        });

        const result = await sendMessage(fakeChat, "book jazz", MOCK_EVENTS);

        expect(result.type).toBe("proposal");
        expect(result.proposal).toEqual({ eventName: "Jazz", ticketCount: 2 });
    });

    it("confirmBooking sends correct structure", async () => {
        fakeSend.mockResolvedValue({ text: "OK!" });

        const result = await confirmBooking(fakeChat, {
            eventName: "Test",
            ticketCount: 1,
        });

        expect(result).toBe("OK!");
    });

    it("cancelBooking sends correct structure", async () => {
        fakeSend.mockResolvedValue({ text: "Cancelled!" });

        const result = await cancelBooking(fakeChat, {
            eventName: "Test",
            ticketCount: 1,
        });

        expect(result).toBe("Cancelled!");
    });
});
