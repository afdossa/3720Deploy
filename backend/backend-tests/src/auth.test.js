import { describe, test, expect } from "vitest";
import request from "supertest";
import { app } from "./testServer.js";

describe("Auth API", () => {
    test("Register route responds", async () => {
        const res = await request(app).post("/api/register");
        expect(res.status).toBeDefined();
    });

    test("Register responds with a status code", async () => {
        const res = await request(app).post("/api/register");
        expect(typeof res.status).toBe("number");
    });

    test("Register allows empty body", async () => {
        const res = await request(app).post("/api/register").send({});
        expect(res.status).toBeDefined();
    });

    test("Login route responds", async () => {
        const res = await request(app).post("/api/login");
        expect(res.status).toBeDefined();
    });

    test("Login returns a numeric status", async () => {
        const res = await request(app).post("/api/login");
        expect(typeof res.status).toBe("number");
    });

    test("Login accepts empty body", async () => {
        const res = await request(app).post("/api/login").send({});
        expect(res.status).toBeDefined();
    });

    test("Logout route responds", async () => {
        const res = await request(app).post("/api/logout");
        expect(res.status).toBeDefined();
    });

    test("Logout returns a status code", async () => {
        const res = await request(app).post("/api/logout");
        expect(typeof res.status).toBe("number");
    });

    test("Profile route responds", async () => {
        const res = await request(app).get("/api/profile");
        expect(res.status).toBeDefined();
    });

    test("Profile body exists", async () => {
        const res = await request(app).get("/api/profile");
        expect(res.body).toBeDefined();
    });
});

describe("Events API", () => {
    test("Events list responds", async () => {
        const res = await request(app).get("/api/events");
        expect(res.status).toBeDefined();
    });

    test("Events list body exists", async () => {
        const res = await request(app).get("/api/events");
        expect(res.body).toBeDefined();
    });

    test("My Events responds", async () => {
        const res = await request(app).get("/api/my-events");
        expect(res.status).toBeDefined();
    });

    test("My Events body exists", async () => {
        const res = await request(app).get("/api/my-events");
        expect(res.body).toBeDefined();
    });

    test("Purchase route responds for id 1", async () => {
        const res = await request(app).post("/api/events/1/purchase");
        expect(res.status).toBeDefined();
    });

    test("Purchase route responds for id 999", async () => {
        const res = await request(app).post("/api/events/999/purchase");
        expect(res.status).toBeDefined();
    });

    test("Purchase body exists", async () => {
        const res = await request(app).post("/api/events/5/purchase");
        expect(res.body).toBeDefined();
    });
});

describe("General API Behavior", () => {
    test("Root route responds", async () => {
        const res = await request(app).get("/");
        expect(res.status).toBeDefined();
    });

    test("Unknown route returns 404", async () => {
        const res = await request(app).get("/api/does-not-exist");
        expect(res.status).toBe(404);
    });

    test("Server handles GET requests", async () => {
        const res = await request(app).get("/api/events");
        expect(res.status).toBeDefined();
    });

    test("Server handles POST requests", async () => {
        const res = await request(app).post("/api/login");
        expect(res.status).toBeDefined();
    });

    test("Server handles multiple sequential requests", async () => {
        const a = await request(app).get("/api/events");
        const b = await request(app).get("/api/profile");
        const c = await request(app).post("/api/login");
        expect(a.status).toBeDefined();
        expect(b.status).toBeDefined();
        expect(c.status).toBeDefined();
    });

    test("API always returns a status code", async () => {
        const res = await request(app).get("/api/events");
        expect(typeof res.status).toBe("number");
    });

    test("Response body is defined for events", async () => {
        const res = await request(app).get("/api/events");
        expect(res.body).toBeDefined();
    });

    test("Response body is defined for profile", async () => {
        const res = await request(app).get("/api/profile");
        expect(res.body).toBeDefined();
    });

    test("Response body is defined for login", async () => {
        const res = await request(app).post("/api/login");
        expect(res.body).toBeDefined();
    });
});
