'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface AuthUser {
  id: string;
  phone: string;
  role: 'CUSTOMER' | 'TECHNICIAN' | 'ADMIN' | 'DISPATCHER';
  fullName: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  updateUser: (data: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Rehydrate session from localStorage on mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('sn_token');
      const storedUser = localStorage.getItem('sn_user');
      if (storedToken && storedUser) {
        const parsedUser: AuthUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
      }
    } catch {
      localStorage.removeItem('sn_token');
      localStorage.removeItem('sn_user');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback((authUser: AuthUser, accessToken: string, refreshToken: string) => {
    localStorage.setItem('sn_token', accessToken);
    localStorage.setItem('sn_refresh_token', refreshToken);
    localStorage.setItem('sn_user', JSON.stringify(authUser));
    localStorage.setItem('sn_user_id', authUser.id);
    localStorage.setItem('sn_user_role', authUser.role);
    setUser(authUser);
    setToken(accessToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('sn_token');
    localStorage.removeItem('sn_refresh_token');
    localStorage.removeItem('sn_user');
    localStorage.removeItem('sn_user_id');
    localStorage.removeItem('sn_user_role');
    setUser(null);
    setToken(null);
    router.push('/auth/login');
  }, [router]);

  const updateUser = useCallback((data: Partial<AuthUser>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...data };
      localStorage.setItem('sn_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
