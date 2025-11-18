import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import App from '../../../services/App';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { AuthProvider } from '../../../services/AuthContext';
import { MemoryRouter } from 'react-router-dom';


// Mock API endpoints for a consistent testing environment
const handlers = [
    // 1. Initial Auth Check: Return 401 to ensure redirect to /login
    rest.get('http://localhost:5000/api/profile', (req, res, ctx) => {
        return res(ctx.status(401));
    }),
    // 2. Login Endpoint
    rest.post('http://localhost:5000/api/login', (req, res, ctx) => {
        return res(ctx.status(200), ctx.json({ message: 'Login successful', user: { id: 1, email: 'test@clemson.edu' } }));
    }),
    // 3. Events Endpoint
    rest.get('http://localhost:5000/api/events', (req, res, ctx) => {
        return res(ctx.status(200), ctx.json([
            { id: 101, name: 'Clemson Football Game', date: '2025-09-01', tickets_available: 5 },
            { id: 102, name: 'Campus Concert', date: '2025-09-10', tickets_available: 0 },
        ]));
    }),
    // 4. Logout Endpoint
    rest.post('http://localhost:5000/api/logout', (req, res, ctx) => {
        return res(ctx.status(200));
    }),
    // 5. My Events Endpoint (default mock)
    rest.get('http://localhost:5000/api/my-events', (req, res, ctx) => {
        return res(ctx.status(200), ctx.json([
            { ticket_id: 501, id: 101, name: 'Clemson Football Game', date: '2025-09-01' },
        ]));
    }),
    // 6. Purchase Endpoint (default mock)
    rest.post('http://localhost:5000/api/events/:id/purchase', (req, res, ctx) => {
        return res(ctx.status(200), ctx.json({ message: 'Event purchased successfully. Remaining: 4' }));
    }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Wrapper to provide AuthProvider context
const renderApp = (initialRoute = '/') => {
    // We use MemoryRouter to control the starting path
    return render(
        <MemoryRouter initialEntries={[initialRoute]}>
            <App />
        </MemoryRouter>
    );
};

describe('App Component: Full E2E Workflow', () => {
    it('should redirect to login, handle successful login, and display events', async () => {
        renderApp('/');

        // 1. Verify redirect to Login Page (Protected Route check - Sprint 3)
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Login/i })).toBeInTheDocument();
        });

        // 2. Perform Login
        await userEvent.type(screen.getByPlaceholderText(/Email/i), 'test@clemson.edu');
        await userEvent.type(screen.getByPlaceholderText(/Password/i), 'password');
        await userEvent.click(screen.getByRole('button', { name: /Login/i }));

        // 3. Verify Events are displayed (Sprint 4)
        await waitFor(() => {
            expect(screen.getByText(/Logged in as test@clemson.edu/i)).toBeInTheDocument(); // Sprint 3
            expect(screen.getByText(/Clemson Campus Events/i)).toBeInTheDocument();
            expect(screen.getByText(/Clemson Football Game/i)).toBeInTheDocument();
            expect(screen.getByText(/Campus Concert/i)).toBeInTheDocument();
        });

        // 4. Verify Buy Ticket button for available event
        expect(screen.getAllByRole('button', { name: /Buy Ticket/i }).length).toBe(1);
    });

    it('should handle event purchase and update event list', async () => {
        // Set up mock profile to start authenticated
        server.use(
            rest.get('http://localhost:5000/api/profile', (req, res, ctx) => {
                return res(ctx.status(200), ctx.json({ message: 'Session verified', user: { id: 1, email: 'test@clemson.edu' } }));
            })
        );
        renderApp('/');

        await waitFor(() => expect(screen.getByText(/Clemson Football Game/i)).toBeInTheDocument());

        // 1. Click purchase button
        await userEvent.click(screen.getByRole('button', { name: /Buy Ticket/i }));

        // 2. Verify purchase message
        await waitFor(() => {
            expect(screen.getByText(/Event purchased successfully. Remaining: 4/i)).toBeInTheDocument();
        });

        // 3. Verify ticket count is updated (integration with fetchEvents)
        await waitFor(() => {
            expect(screen.getByText(/left: 4/i)).toBeInTheDocument();
        });
    });

    it('should navigate to My Events and display purchased tickets', async () => {
        // Start authenticated
        server.use(
            rest.get('http://localhost:5000/api/profile', (req, res, ctx) => {
                return res(ctx.status(200), ctx.json({ message: 'Session verified', user: { id: 1, email: 'test@clemson.edu' } }));
            })
        );
        renderApp('/');

        // 1. Navigate to My Events tab
        const myEventsButton = screen.getByRole('button', { name: /My Events/i });
        await userEvent.click(myEventsButton);

        // 2. Verify tickets are displayed
        await waitFor(() => {
            expect(screen.getByText(/Loading Tickets.../i)).not.toBeInTheDocument();
            expect(screen.getByText(/Purchased Ticket #501/i)).toBeInTheDocument();
            expect(screen.getByText(/Clemson Football Game/i)).toBeInTheDocument();
        });
    });

    it('should handle logout and redirect to login page (Sprint 3)', async () => {
        // Start authenticated
        server.use(
            rest.get('http://localhost:5000/api/profile', (req, res, ctx) => {
                return res(ctx.status(200), ctx.json({ message: 'Session verified', user: { id: 1, email: 'test@clemson.edu' } }));
            })
        );
        renderApp('/');

        await waitFor(() => expect(screen.getByText(/Logged in as test@clemson.edu/i)).toBeInTheDocument());

        // 1. Click Logout
        await userEvent.click(screen.getByRole('button', { name: /Logout/i }));

        // 2. Verify redirect to login
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Login/i })).toBeInTheDocument();
        });
    });
});