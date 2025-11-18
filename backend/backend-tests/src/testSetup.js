import { vi } from "vitest";

vi.mock("../../client-service/server.js", async () => {
    const express = (await import("express")).default;
    const app = express();
    app.use(express.json());
    return { app };
});
