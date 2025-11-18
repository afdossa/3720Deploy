import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import Login from "../../login";
import Register from "../../register";

vi.mock("../../AuthContext", () => ({
    useAuth: () => ({
        user: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
    }),
}));

function renderWithRouter(ui) {
    return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("Login Page", () => {
    it("renders login fields", () => {
        renderWithRouter(<Login />);
        expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    });

    it("lets you type", async () => {
        renderWithRouter(<Login />);
        const email = screen.getByPlaceholderText(/email/i);
        const pass = screen.getByPlaceholderText(/password/i);
        await userEvent.type(email, "test@clemson.edu");
        await userEvent.type(pass, "password1");
        expect(email).toHaveValue("test@clemson.edu");
        expect(pass).toHaveValue("password1");
    });
});

describe("Register Page", () => {
    it("renders register fields", () => {
        renderWithRouter(<Register />);
        expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    });

    it("lets you type", async () => {
        renderWithRouter(<Register />);
        const email = screen.getByPlaceholderText(/email/i);
        const pass = screen.getByPlaceholderText(/password/i);
        await userEvent.type(email, "new@clemson.edu");
        await userEvent.type(pass, "securepass");
        expect(email).toHaveValue("new@clemson.edu");
        expect(pass).toHaveValue("securepass");
    });
});
