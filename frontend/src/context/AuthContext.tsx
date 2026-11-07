import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { authApi } from '../api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string, options?: { shop_name?: string; password?: string; phone?: string; gstin?: string } | string) => Promise<void>;
  register: (payload: any) => Promise<any>;
  activateSubscription: (payload: any) => Promise<any>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedToken = localStorage.getItem('token');
    if (!savedToken || savedToken === 'demo-token') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return null;
    }
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    const savedToken = localStorage.getItem('token');
    if (!savedToken || savedToken === 'demo-token') {
      localStorage.removeItem('token');
      return null;
    }
    return savedToken;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('token');
      if (savedToken && savedToken !== 'demo-token') {
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
          localStorage.setItem('user', JSON.stringify(userData));
        } catch (err: any) {
          // Token expired or invalid signature - clear local session
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('shop_settings');
          setToken(null);
          setUser(null);
        }
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    localStorage.removeItem('shop_settings');
    const data = await authApi.login({ username, password });
    localStorage.setItem('token', data.access_token);
    setToken(data.access_token);

    const userInfo: User = {
      id: data.user_id || 1,
      username: data.username,
      full_name: data.name || (data.username === 'admin' ? 'Shop Owner' : 'Billing Operator'),
      role: (data.role === 'OWNER' ? 'owner' : 'operator') as UserRole,
      subscription_status: data.subscription_status || (data.username === 'admin' ? 'ACTIVE' : 'PENDING'),
      is_active: true
    };
    setUser(userInfo);
    localStorage.setItem('user', JSON.stringify(userInfo));
  };

  const loginWithGoogle = async (
    credential: string, 
    options?: { shop_name?: string; password?: string; phone?: string; gstin?: string } | string
  ) => {
    localStorage.removeItem('shop_settings');
    const data = await authApi.loginWithGoogle(credential, options);
    localStorage.setItem('token', data.access_token);
    setToken(data.access_token);

    const userInfo: User = {
      id: data.user_id || 1,
      username: data.username,
      full_name: data.name || data.username,
      role: (data.role === 'OWNER' ? 'owner' : 'operator') as UserRole,
      subscription_status: data.subscription_status || 'ACTIVE',
      is_active: true
    };
    setUser(userInfo);
    localStorage.setItem('user', JSON.stringify(userInfo));
  };

  const register = async (payload: any) => {
    localStorage.removeItem('shop_settings');
    const data = await authApi.register(payload);
    localStorage.setItem('token', data.access_token);
    setToken(data.access_token);

    const userInfo: User = {
      id: data.user_id,
      username: data.username,
      full_name: data.name,
      role: 'owner',
      subscription_status: data.subscription_status || 'PENDING',
      is_active: true
    };
    setUser(userInfo);
    localStorage.setItem('user', JSON.stringify(userInfo));
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
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
    return res;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('shop_settings');
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, isLoading, login, loginWithGoogle, register, activateSubscription, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
