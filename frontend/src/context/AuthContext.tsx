import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { authApi } from '../api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string, captchaToken: string, captchaCode: string) => Promise<void>;
  loginWithGoogle: (credential: string, options?: { shop_name?: string; password?: string; phone?: string; gstin?: string } | string) => Promise<void>;
  register: (payload: any) => Promise<any>;
  activateSubscription: (payload: any) => Promise<any>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      // Clean up legacy tokens and user cache from localStorage to prevent exposure or poisoning
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      try {
        const res: any = await authApi.me();
        const userData: User = {
          id: res.id || 1,
          username: res.username,
          full_name: res.name || (res.username === 'admin' ? 'Shop Owner' : 'Billing Operator'),
          role: (res.role === 'OWNER' ? 'owner' : 'operator') as UserRole,
          subscription_status: res.subscription_status || (res.username === 'admin' ? 'ACTIVE' : 'PENDING'),
          is_active: res.is_active ?? true,
        };
        setUser(userData);
      } catch {
        // Session expired or unauthenticated
        localStorage.removeItem('shop_settings');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    void initAuth();
  }, []);

  const login = async (username: string, password: string, captchaToken: string, captchaCode: string) => {
    localStorage.removeItem('shop_settings');
    const data = await authApi.login({
      username,
      password,
      captcha_token: captchaToken,
      captcha_code: captchaCode,
    });
    // Remove token from localStorage: browser automatically stores and sends HttpOnly cookie
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);

    const userInfo: User = {
      id: data.user_id || 1,
      username: data.username,
      full_name: data.name || (data.username === 'admin' ? 'Shop Owner' : 'Billing Operator'),
      role: (data.role === 'OWNER' ? 'owner' : 'operator') as UserRole,
      subscription_status: data.subscription_status || (data.username === 'admin' ? 'ACTIVE' : 'PENDING'),
      is_active: true
    };
    setUser(userInfo);
  };

  const loginWithGoogle = async (
    credential: string, 
    options?: { shop_name?: string; password?: string; phone?: string; gstin?: string } | string
  ) => {
    localStorage.removeItem('shop_settings');
    const data = await authApi.loginWithGoogle(credential, options);
    // Remove token from localStorage: browser automatically stores and sends HttpOnly cookie
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);

    const userInfo: User = {
      id: data.user_id || 1,
      username: data.username,
      full_name: data.name || data.username,
      role: (data.role === 'OWNER' ? 'owner' : 'operator') as UserRole,
      subscription_status: data.subscription_status || 'ACTIVE',
      is_active: true
    };
    setUser(userInfo);
  };

  const register = async (payload: any) => {
    localStorage.removeItem('shop_settings');
    const data = await authApi.register(payload);
    // Remove token from localStorage: browser automatically stores and sends HttpOnly cookie
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);

    const userInfo: User = {
      id: data.user_id,
      username: data.username,
      full_name: data.name,
      role: 'owner',
      subscription_status: data.subscription_status || 'PENDING',
      is_active: true
    };
    setUser(userInfo);
    return data;
  };

  const activateSubscription = async (payload: any) => {
    const res = await authApi.activateSubscription(payload);
    if (user) {
      const updatedUser: User = {
        ...user,
        subscription_status: 'ACTIVE'
      };
      setUser(updatedUser);
    }
    return res;
  };

  const logout = () => {
    void authApi.logout().catch(() => {});
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('shop_settings');
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!user, isLoading, login, loginWithGoogle, register, activateSubscription, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
