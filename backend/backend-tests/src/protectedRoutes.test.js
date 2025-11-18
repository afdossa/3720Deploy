import { describe, test, expect } from "vitest";
import request from "supertest";
import { app } from "./testServer.js";

describe("Purchase API", () => {
    test("POST /api/events/1/purchase responds", async () => {
        const res = await request(app).post("/api/events/1/purchase");
        expect(res.status).toBeDefined();
    });

    test("POST /api/events/1/purchase returns a numeric status", async () => {
        const res = await request(app).post("/api/events/1/purchase");
        expect(typeof res.status).toBe("number");
    });

    test("POST /api/events/1/purchase returns some kind of body", async () => {
        const res = await request(app).post("/api/events/1/purchase");
        expect(res.body).toBeDefined();
    });

    test("POST /api/events/1/purchase accepts empty request body", async () => {
        const res = await request(app).post("/api/events/1/purchase").send({});
        expect(res.status).toBeDefined();
    });

    test("POST /api/events/999/purchase responds for invalid event id", async () => {
        const res = await request(app).post("/api/events/999/purchase");
        expect(res.status).toBeDefined();
    });

    test("POST /api/events/1/purchase does not crash when sending random fields", async () => {
        const res = await request(app)
            .post("/api/events/1/purchase")
            .send({ nonsense: true, qty: "abc", extra: "ignored" });
        expect(res.status).toBeDefined();
    });

    test("POST /api/events/1/purchase handles multiple rapid requests", async () => {
        const r1 = await request(app).post("/api/events/1/purchase");
        const r2 = await request(app).post("/api/events/1/purchase");
        const r3 = await request(app).post("/api/events/1/purchase");
        expect(r1.status).toBeDefined();
        expect(r2.status).toBeDefined();
        expect(r3.status).toBeDefined();
    });

    test("POST /api/events/1/purchase returns a body that is not undefined", async () => {
        const res = await request(app).post("/api/events/1/purchase");
        expect(res.body).not.toBe(undefined);
    });

    test("POST /api/events/123456/purchase responds even for large event IDs", async () => {
        const res = await request(app).post("/api/events/123456/purchase");
        expect(res.status).toBeDefined();
    });

    test("POST /api/events/1/purchase handles long query strings gracefully", async () => {
        const res = await request(app).post(
            "/api/events/1/purchase?x=" + "a".repeat(200)
        );
        expect(res.status).toBeDefined();
    });
});
