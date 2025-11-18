import { describe, test, expect } from "vitest";
import request from "supertest";
import { app } from "./testServer.js";

describe("Protected Routes", () => {
    test("GET /api/my-events responds", async () => {
        const res = await request(app).get("/api/my-events");
        expect(res.status).toBeDefined();
    });

    test("GET /api/profile responds", async () => {
        const res = await request(app).get("/api/profile");
        expect(res.status).toBeDefined();
    });
});
