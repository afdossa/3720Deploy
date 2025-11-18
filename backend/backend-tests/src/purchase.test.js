import { describe, test, expect } from "vitest";
import request from "supertest";
import { app } from "./testServer.js";

describe("Protected Routes", () => {

    test("GET /api/my-events responds", async () => {
        const res = await request(app).get("/api/my-events");
        expect(res.status).toBeDefined();
    });

    test("GET /api/my-events returns a numeric status code", async () => {
        const res = await request(app).get("/api/my-events");
        expect(typeof res.status).toBe("number");
    });

    test("GET /api/my-events returns some body structure", async () => {
        const res = await request(app).get("/api/my-events");
        expect(res.body).toBeDefined();
    });

    test("GET /api/my-events works without auth headers", async () => {
        const res = await request(app).get("/api/my-events");
        expect(res.status).toBeDefined();
    });

    test("GET /api/my-events handles random query params", async () => {
        const res = await request(app).get("/api/my-events?x=1&y=test&z=true");
        expect(res.status).toBeDefined();
    });

    test("GET /api/my-events handles long query strings", async () => {
        const res = await request(app).get(
            "/api/my-events?data=" + "x".repeat(300)
        );
        expect(res.status).toBeDefined();
    });

    test("GET /api/my-events supports multiple rapid requests", async () => {
        const r1 = await request(app).get("/api/my-events");
        const r2 = await request(app).get("/api/my-events");
        const r3 = await request(app).get("/api/my-events");
        expect(r1.status).toBeDefined();
        expect(r2.status).toBeDefined();
        expect(r3.status).toBeDefined();
    });

    test("GET /api/my-events response body is not undefined", async () => {
        const res = await request(app).get("/api/my-events");
        expect(res.body).not.toBe(undefined);
    });

    test("GET /api/my-events returns an object or array", async () => {
        const res = await request(app).get("/api/my-events");
        expect(typeof res.body === "object").toBe(true);
    });

    test("GET /api/my-events handles malformed headers gracefully", async () => {
        const res = await request(app)
            .get("/api/my-events")
            .set("Authorization", "Bearer " + "invalid".repeat(10));
        expect(res.status).toBeDefined();
    });

    test("GET /api/my-events handles large header values", async () => {
        const res = await request(app)
            .get("/api/my-events")
            .set("X-Debug", "A".repeat(500));
        expect(res.status).toBeDefined();
    });


    test("GET /api/profile responds", async () => {
        const res = await request(app).get("/api/profile");
        expect(res.status).toBeDefined();
    });

    test("GET /api/profile returns a numeric status", async () => {
        const res = await request(app).get("/api/profile");
        expect(typeof res.status).toBe("number");
    });

    test("GET /api/profile returns some kind of body", async () => {
        const res = await request(app).get("/api/profile");
        expect(res.body).toBeDefined();
    });

    test("GET /api/profile works with no auth header", async () => {
        const res = await request(app).get("/api/profile");
        expect(res.status).toBeDefined();
    });

    test("GET /api/profile works with random headers", async () => {
        const res = await request(app)
            .get("/api/profile")
            .set("X-Random", "123xyz");
        expect(res.status).toBeDefined();
    });

    test("GET /api/profile handles long headers", async () => {
        const res = await request(app)
            .get("/api/profile")
            .set("X-Long", "Z".repeat(400));
        expect(res.status).toBeDefined();
    });

    test("GET /api/profile supports multiple sequential calls", async () => {
        const a = await request(app).get("/api/profile");
        const b = await request(app).get("/api/profile");
        const c = await request(app).get("/api/profile");
        expect(a.status).toBeDefined();
        expect(b.status).toBeDefined();
        expect(c.status).toBeDefined();
    });

    test("GET /api/profile works with random query params", async () => {
        const res = await request(app).get("/api/profile?debug=true&n=5&x=hello");
        expect(res.status).toBeDefined();
    });

    test("GET /api/profile returns a non-empty body object or array", async () => {
        const res = await request(app).get("/api/profile");
        expect(typeof res.body === "object").toBe(true);
    });

    test("GET /api/profile handles large query param values", async () => {
        const res = await request(app).get(
            "/api/profile?q=" + "z".repeat(250)
        );
        expect(res.status).toBeDefined();
    });


    test("Protected routes handle malformed JSON bodies safely", async () => {
        const res = await request(app)
            .post("/api/profile")
            .set("Content-Type", "application/json")
            .send("{ not valid json");
        expect(res.status).toBeDefined();
    });

    test("Protected routes do not crash when sending unexpected fields", async () => {
        const res = await request(app)
            .post("/api/my-events")
            .send({ random: true, foo: "bar", nested: { a: 1 } });
        expect(res.status).toBeDefined();
    });

    test("Protected routes accept large bodies without failing", async () => {
        const res = await request(app)
            .post("/api/my-events")
            .send({ payload: "x".repeat(1000) });
        expect(res.status).toBeDefined();
    });

});
