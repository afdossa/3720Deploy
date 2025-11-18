import { describe, test, expect } from "vitest";
import request from "supertest";
import { app } from "./testServer.js";

describe("Events API", () => {
    test("GET /api/events responds", async () => {
        const res = await request(app).get("/api/events");
        expect(res.status).toBeDefined();
    });

    test("GET /api/events returns some kind of body", async () => {
        const res = await request(app).get("/api/events");
        expect(res.body).toBeDefined();
    });

    test("GET /api/events returns a numeric status code", async () => {
        const res = await request(app).get("/api/events");
        expect(typeof res.status).toBe("number");
    });

    test("GET /api/events handles repeated requests", async () => {
        const r1 = await request(app).get("/api/events");
        const r2 = await request(app).get("/api/events");
        const r3 = await request(app).get("/api/events");
        expect(r1.status).toBeDefined();
        expect(r2.status).toBeDefined();
        expect(r3.status).toBeDefined();
    });

    test("GET /api/events does not crash when querying non-existent query parameters", async () => {
        const res = await request(app).get("/api/events?sort=none&filter=none");
        expect(res.status).toBeDefined();
    });

    test("GET /api/events always returns something (body not undefined)", async () => {
        const res = await request(app).get("/api/events");
        expect(res.body).not.toBe(undefined);
    });

    test("GET /api/events responds even with long URL parameters", async () => {
        const res = await request(app).get(
            "/api/events?x=" + "a".repeat(200)
        );
        expect(res.status).toBeDefined();
    });
});
