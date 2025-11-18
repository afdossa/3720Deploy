import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../../AuthContext'
import React from 'react'

global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ token: "mock-token" })
})

const TestComponent = () => {
    const { user, login, logout } = useAuth()
    return (
        <div>
            <span data-testid="auth-status">{user ? 'Authenticated' : 'Not Authenticated'}</span>
            <span data-testid="user-email">{user ? user.email : 'Guest'}</span>
            <button onClick={() => login('mock@user.com', 'password')}>Mock Login</button>
            <button onClick={logout}>Mock Logout</button>
        </div>
    )
}

describe('AuthContext', () => {
    it('should initialize as not authenticated', () => {
        render(<AuthProvider><TestComponent /></AuthProvider>)
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated')
        expect(screen.getByTestId('user-email')).toHaveTextContent('Guest')
    })

    it('should set isAuthenticated and user on successful login', async () => {
        render(<AuthProvider><TestComponent /></AuthProvider>)
        fireEvent.click(screen.getByRole('button', { name: /Mock Login/i }))

        await waitFor(() => {
            expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated')
            expect(screen.getByTestId('user-email')).toHaveTextContent('mock@user.com')
        })
    })

    it('should clear isAuthenticated and user on logout', async () => {
        render(<AuthProvider><TestComponent /></AuthProvider>)

        fireEvent.click(screen.getByRole('button', { name: /Mock Login/i }))
        await waitFor(() => {
            expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated')
        })

        fireEvent.click(screen.getByRole('button', { name: /Mock Logout/i }))

        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated')
        expect(screen.getByTestId('user-email')).toHaveTextContent('Guest')
    })
})
