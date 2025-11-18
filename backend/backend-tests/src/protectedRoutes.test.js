import { describe, test, expect } from "vitest";
import request from "supertest";
import { app } from "./testServer.js";

describe("Purchase API", () => {
    test("POST /api/events/1/purchase responds", async () => {
        const res = await request(app).post("/api/events/1/purchase");
        expect(res.status).toBeDefined();
    });
});
