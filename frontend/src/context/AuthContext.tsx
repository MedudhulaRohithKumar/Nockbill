import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { authApi, GoogleAuthOptions } from '../api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string, captchaToken: string, captchaCode: string, shopAccountId?: string) => Promise<void>;
  loginWithGoogle: (credential: string, options?: GoogleAuthOptions | string) => Promise<any>;
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

      const hasSessionHint =
        typeof document !== 'undefined' &&
        document.cookie.split(';').some((c) => c.trim().startsWith('nb_auth_hint=1'));
      const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
      const isPublicAuthOptionalRoute =
        pathname === '/' || pathname === '/login' || pathname === '/register';

      if (isPublicAuthOptionalRoute && !hasSessionHint) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      try {
        const sessionRes = await authApi.session();
        if (sessionRes?.authenticated && sessionRes.user) {
          const res = sessionRes.user;
          const role: UserRole = res.role === 'OWNER' ? 'owner' : 'operator';
          const userData: User = {
            id: res.id,
            username: res.username,
            full_name: res.name || (role === 'owner' ? 'Shop Owner' : 'Billing Operator'),
            role,
            subscription_status: res.subscription_status || 'PENDING',
            is_active: res.is_active ?? true,
          };
          setUser(userData);
        } else {
          localStorage.removeItem('shop_settings');
          setUser(null);
        }
      } catch {
        // Fallback or unauthenticated session
        localStorage.removeItem('shop_settings');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    void initAuth();
  }, []);

  const login = async (
    username: string,
    password: string,
    captchaToken: string,
    captchaCode: string,
    shopAccountId?: string,
  ) => {
    localStorage.removeItem('shop_settings');
    const data = await authApi.login({
      username,
      password,
      captcha_token: captchaToken,
      captcha_code: captchaCode,
      shop_account_id: shopAccountId?.trim() || undefined,
    });
    // Remove token from localStorage: browser automatically stores and sends HttpOnly cookie
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);

    const role: UserRole = data.role === 'OWNER' ? 'owner' : 'operator';
    const userInfo: User = {
      id: data.user_id || 0,
      username: data.username,
      full_name: data.name || (role === 'owner' ? 'Shop Owner' : 'Billing Operator'),
      role,
      subscription_status: data.subscription_status || 'PENDING',
      is_active: true
    };
    setUser(userInfo);
  };

  const loginWithGoogle = async (
    credential: string, 
    options?: GoogleAuthOptions | string
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
    return data;
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
