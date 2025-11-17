import React, { createContext, useState, useEffect, useContext } from 'react';

interface User {
    email: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (email: string, password: string) => Promise<boolean>;
    register: (email: string, password: string) => Promise<boolean>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const API_BASE_URL = 'https://three720deploy.onrender.com/api';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        const savedToken = localStorage.getItem('authToken');
        const savedEmail = localStorage.getItem('authEmail');
        if (savedToken && savedEmail) {
            setToken(savedToken);
            setUser({ email: savedEmail });
        }
    }, []);

    const login = async (email: string, password: string): Promise<boolean> => {
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) return false;

            const data = await response.json();
            setToken(data.token);
            setUser({ email });
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('authEmail', email);
            return true;
        } catch {
            return false;
        }
    };

    const register = async (email: string, password: string): Promise<boolean> => {
        try {
            const response = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            return response.ok;
        } catch {
            return false;
        }
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('authToken');
        localStorage.removeItem('authEmail');
    };

    return (
        <AuthContext.Provider value={{ user, token, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
    return ctx;
}
