// frontend/src/components/frontend-tests/src/LoginRegister.test.tsx

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import LoginPage from '../../../services/login';
import RegisterPage from '../../../services/register';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { AuthContext } from '../../../services/AuthContext';
import { MemoryRouter } from 'react-router-dom';

const mockLogin = jest.fn();
const mockCheckAuthStatus = jest.fn();
const mockLogout = jest.fn();
const mockNavigate = jest.fn();

// Mock AuthContext to isolate the component being tested
const MockAuthProvider = ({ children }) => (
    <AuthContext.Provider value={{ isAuthenticated: false, user: null, login: mockLogin, logout: mockLogout, checkAuthStatus: mockCheckAuthStatus }}>
        {children}
    </AuthContext.Provider>
);

// Mock the react-router-dom useNavigate hook
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
    Link: ({ children, to }) => <a href={to}>{children}</a>,
}));

// Mock API endpoints
const handlers = [
    rest.post('http://localhost:5000/api/login', (req, res, ctx) => {
        const { email, password } = req.body as any;
        if (email === 'success@user.com' && password === 'valid') {
            return res(ctx.status(200), ctx.json({ token: 'mock-token', user: { id: 1, email: 'success@user.com' } }));
        }
        return res(ctx.status(401), ctx.json({ message: 'Invalid credentials' }));
    }),
    rest.post('http://localhost:5000/api/register', (req, res, ctx) => {
        const { email } = req.body as any;
        if (email === 'exists@user.com') {
            return res(ctx.status(409), ctx.json({ message: 'User already exists' }));
        }
        return res(ctx.status(201), ctx.json({ message: 'Registration successful' }));
    }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => {
    server.resetHandlers();
    jest.clearAllMocks();
});
afterAll(() => server.close());

const renderWithProviders = (Component) => {
    return render(
        <MemoryRouter>
            <MockAuthProvider>
                <Component />
            </MockAuthProvider>
        </MemoryRouter>
    );
};


describe('LoginPage Component Tests (Sprint 3)', () => {
    const emailInput = () => screen.getByPlaceholderText(/Email/i);
    const passwordInput = () => screen.getByPlaceholderText(/Password/i);
    const submitButton = () => screen.getByRole('button', { name: /Login/i });

    it('should render the login form and link to register', () => {
        renderWithProviders(LoginPage);

        expect(emailInput()).toBeInTheDocument();
        expect(passwordInput()).toBeInTheDocument();
        expect(submitButton()).toBeInTheDocument();
        expect(screen.getByText(/Create an account/i)).toHaveAttribute('href', '/register');
    });

    it('should enable the button only when both fields are populated', async () => {
        renderWithProviders(LoginPage);

        expect(submitButton()).toBeDisabled();

        await userEvent.type(emailInput(), 'a@a.com');
        expect(submitButton()).toBeDisabled();

        await userEvent.type(passwordInput(), 'pass');
        expect(submitButton()).not.toBeDisabled();
    });

    it('should handle successful login submission', async () => {
        renderWithProviders(LoginPage);

        await userEvent.type(emailInput(), 'success@user.com');
        await userEvent.type(passwordInput(), 'valid');
        await userEvent.click(submitButton());

        await waitFor(() => {
            expect(mockLogin).toHaveBeenCalledTimes(1);
        });

        expect(mockLogin).toHaveBeenCalledWith({ id: 1, email: 'success@user.com' });
        expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('should display an error message on failed login submission', async () => {
        renderWithProviders(LoginPage);

        await userEvent.type(emailInput(), 'fail@user.com');
        await userEvent.type(passwordInput(), 'wrong');
        await userEvent.click(submitButton());

        await waitFor(() => {
            expect(screen.getByText(/Invalid credentials/i)).toBeInTheDocument();
        });
        expect(mockLogin).not.toHaveBeenCalled();
    });
});

describe('RegisterPage Component Tests (Sprint 3)', () => {
    const emailInput = () => screen.getByPlaceholderText(/Email/i);
    const passwordInput = () => screen.getByPlaceholderText(/Password/i);
    const submitButton = () => screen.getByRole('button', { name: /Register/i });

    it('should render the register form and link to login', () => {
        renderWithProviders(RegisterPage);

        expect(emailInput()).toBeInTheDocument();
        expect(passwordInput()).toBeInTheDocument();
        expect(submitButton()).toBeInTheDocument();
        expect(screen.getByText(/Already have an account/i)).toHaveAttribute('href', '/login');
    });

    it('should handle successful registration and redirect', async () => {
        renderWithProviders(RegisterPage);

        await userEvent.type(emailInput(), 'new@user.com');
        await userEvent.type(passwordInput(), 'securepass');
        await userEvent.click(submitButton());

        await waitFor(() => {
            expect(screen.getByText(/Registration successful/i)).toBeInTheDocument();
        });

        expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    it('should display an error message if user already exists', async () => {
        renderWithProviders(RegisterPage);

        await userEvent.type(emailInput(), 'exists@user.com');
        await userEvent.type(passwordInput(), 'securepass');
        await userEvent.click(submitButton());

        await waitFor(() => {
            expect(screen.getByText(/User already exists/i)).toBeInTheDocument();
        });

        expect(mockNavigate).not.toHaveBeenCalled();
    });
});