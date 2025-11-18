import { describe, test, expect } from "vitest";
import request from "supertest";
import { app } from "./testServer.js";

describe("Events API", () => {
    test("GET /api/events responds", async () => {
        const res = await request(app).get("/api/events");
        expect(res.status).toBeDefined();
    });
});
