import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../App'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'

const API = 'https://three720deploy.onrender.com'

const handlers = [
    http.get(`${API}/api/profile`, () => {
        return new HttpResponse(null, { status: 401 })
    }),

    http.post(`${API}/api/login`, async () => {
        return HttpResponse.json(
            { message: 'Login successful', user: { id: 1, email: 'test@clemson.edu' } },
            { status: 200 }
        )
    }),

    http.get(`${API}/api/events`, () => {
        return HttpResponse.json([
            { id: 101, name: 'Clemson Football Game', date: '2025-09-01', tickets_available: 5 },
            { id: 102, name: 'Campus Concert', date: '2025-09-10', tickets_available: 0 }
        ])
    }),

    http.post(`${API}/api/logout`, () => {
        return new HttpResponse(null, { status: 200 })
    }),

    http.get(`${API}/api/my-events`, () => {
        return HttpResponse.json([
            { ticket_id: 501, id: 101, name: 'Clemson Football Game', date: '2025-09-01' }
        ])
    }),

    http.post(`${API}/api/events/:id/purchase`, () => {
        return HttpResponse.json(
            { message: 'Event purchased successfully. Remaining: 4' },
            { status: 200 }
        )
    })
]

const server = setupServer(...handlers)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const renderApp = (route = '/') =>
    render(
        <MemoryRouter initialEntries={[route]}>
            <App />
        </MemoryRouter>
    )

describe('App Component: Full E2E Workflow', () => {

    it('loads events publicly, logs in, and shows logged-in UI', async () => {
        renderApp('/')

        await waitFor(() =>
            expect(screen.getByText(/Clemson Football Game/i)).toBeInTheDocument()
        )

        await userEvent.click(screen.getByRole('button', { name: /Login/i }))

        await userEvent.type(screen.getByPlaceholderText(/email/i), 'test@clemson.edu')
        await userEvent.type(screen.getByPlaceholderText(/password/i), 'password')
        await userEvent.click(screen.getByRole('button', { name: /Login/i }))

        await waitFor(() =>
            expect(screen.getByText(/Logged in as test@clemson.edu/i)).toBeInTheDocument()
        )
    })

    it('handles ticket purchase and updates ticket count', async () => {
        server.use(
            http.get(`${API}/api/profile`, () =>
                HttpResponse.json({ user: { id: 1, email: 'test@clemson.edu' } })
            ),

            http.post(`${API}/api/events/:id/purchase`, () =>
                HttpResponse.json({ message: 'Event purchased successfully. Remaining: 4' })
            ),

            http.get(`${API}/api/events`, () =>
                HttpResponse.json([
                    { id: 101, name: 'Clemson Football Game', date: '2025-09-01', tickets_available: 4 },
                    { id: 102, name: 'Campus Concert', date: '2025-09-10', tickets_available: 0 }
                ])
            )
        )

        renderApp('/')

        await waitFor(() =>
            expect(screen.getByText(/Clemson Football Game/i)).toBeInTheDocument()
        )

        await userEvent.click(screen.getAllByRole('button', { name: /Buy Ticket/i })[0])

        await waitFor(() =>
            expect(screen.getByText(/4\s*left/i)).toBeInTheDocument()
        )
    })

    it('navigates to My Events and shows purchased tickets', async () => {
        server.use(
            http.get(`${API}/api/profile`, () =>
                HttpResponse.json({ user: { id: 1, email: 'test@clemson.edu' } })
            )
        )

        renderApp('/')

        await userEvent.click(screen.getByRole('button', { name: /My Events/i }))

        await waitFor(() =>
            expect(screen.getByText(/Ticket ID:\s*501/i)).toBeInTheDocument()
        )
    })

    it('logs out and returns to login button', async () => {
        server.use(
            http.get(`${API}/api/profile`, () =>
                HttpResponse.json({ user: { id: 1, email: 'test@clemson.edu' } })
            )
        )

        renderApp('/')

        await waitFor(() =>
            expect(screen.getByText(/Logged in as test@clemson.edu/i)).toBeInTheDocument()
        )

        await userEvent.click(screen.getByRole('button', { name: /Logout/i }))

        await waitFor(() =>
            expect(screen.getByRole('button', { name: /Login/i })).toBeInTheDocument()
        )
    })

    it('renders the page title', async () => {
        renderApp('/')

        await waitFor(() =>
            expect(screen.getByRole('heading', { name: /Clemson Campus Events/i })).toBeInTheDocument()
        )
    })
})
