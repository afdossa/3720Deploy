import { describe, test, expect } from "vitest";
import request from "supertest";
import { app } from "./testServer.js";

describe("Auth API", () => {
    test("Register route responds", async () => {
        const res = await request(app).post("/api/register");
        expect(res.status).toBeDefined();
    });

    test("Login route responds", async () => {
        const res = await request(app).post("/api/login");
        expect(res.status).toBeDefined();
    });
});
