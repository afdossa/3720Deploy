// frontend/src/services/AuthContext.test.tsx
// (or frontend/src/components/frontend-tests/src/AuthContext.test.tsx if placed there)

import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './App.test.tsx';
import '@testing-library/jest-dom';

// A simple component to consume the AuthContext for testing
const TestComponent = () => {
    const { isAuthenticated, user, login, logout } = useAuth();
    return (
        <div>
            <span data-testid="auth-status">{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</span>
            <span data-testid="user-email">{user ? user.email : 'Guest'}</span>
            <button onClick={() => login({ id: 1, email: 'mock@user.com' })}>Mock Login</button>
            <button onClick={logout}>Mock Logout</button>
        </div>
    );
};

describe('AuthContext', () => {
    it('should initialize as not authenticated', () => {
        render(<AuthProvider><TestComponent /></AuthProvider>);
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
        expect(screen.getByTestId('user-email')).toHaveTextContent('Guest');
    });

    it('should set isAuthenticated and user on successful login', () => {
        render(<AuthProvider><TestComponent /></AuthProvider>);

        fireEvent.click(screen.getByRole('button', { name: /Mock Login/i }));

        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
        expect(screen.getByTestId('user-email')).toHaveTextContent('mock@user.com');
    });

    it('should clear isAuthenticated and user on logout', () => {
        render(<AuthProvider><TestComponent /></AuthProvider>);

        // 1. Login
        fireEvent.click(screen.getByRole('button', { name: /Mock Login/i }));
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');

        // 2. Logout
        fireEvent.click(screen.getByRole('button', { name: /Mock Logout/i }));

        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
        expect(screen.getByTestId('user-email')).toHaveTextContent('Guest');
    });
});