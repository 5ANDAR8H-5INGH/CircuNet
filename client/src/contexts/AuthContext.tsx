import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../utils/api';

export interface User {
  id: number | null;
  name: string;
  email: string;
  role: 'company' | 'transporter' | 'admin';
  avatar: string;
}

export interface UserInfo {
  id: number | null;
  name: string;
  email: string;
  role: 'company' | 'transporter' | 'admin';
  avatar: string;
  token: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  isAuthInitialized: boolean;
  userInfo: UserInfo;
  user: User | null;
  login: (userData: UserInfo) => void;
  logout: () => void;
  updateUserInfo: (userData: Partial<UserInfo>) => void;
}

const defaultUserInfo: UserInfo = {
  id: null,
  name: '',
  email: '',
  role: 'company',
  avatar: '',
  token: ''
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isAuthInitialized, setIsAuthInitialized] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo>(defaultUserInfo);
  const [user, setUser] = useState<User | null>(null);

  // Restore and validate the saved account before protected routes decide whether to redirect.
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUserInfo = localStorage.getItem('userInfo');
    if (!token || !storedUserInfo) {
      localStorage.removeItem('token');
      localStorage.removeItem('userInfo');
      setIsAuthInitialized(true);
      return;
    }

    let cachedUser: User;
    try {
      const parsed = JSON.parse(storedUserInfo) as User;
      if (!parsed.id || !parsed.email || !parsed.role) throw new Error('Saved account details are incomplete.');
      cachedUser = { ...parsed, id: Number(parsed.id) };
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('userInfo');
      setIsAuthInitialized(true);
      return;
    }

    setUserInfo({ ...cachedUser, token });
    setUser(cachedUser);
    setIsLoggedIn(true);
    let active = true;
    api.get('/api/auth/me').then(({ data }) => {
      if (!active || !data.user) return;
      const restoredUser: UserInfo = { ...data.user, avatar: data.user.avatar || '', token };
      login(restoredUser);
    }).catch((error) => {
      if (!active) return;
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');
        setUserInfo(defaultUserInfo);
        setUser(null);
        setIsLoggedIn(false);
      }
      // Keep the cached identity during a temporary network outage; protected API calls can retry.
    }).finally(() => {
      if (active) setIsAuthInitialized(true);
    });

    return () => { active = false; };
  }, []);

  const login = (userData: UserInfo) => {
    // Save token and user info to localStorage
    localStorage.setItem('token', userData.token);
    
    const userForStorage: User = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      avatar: userData.avatar
    };
    
    localStorage.setItem('userInfo', JSON.stringify(userForStorage));
    
    setUserInfo(userData);
    setUser(userForStorage);
    setIsLoggedIn(true);
    setIsAuthInitialized(true);
  };

  const logout = () => {
    // Remove token and user info from localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    
    setUserInfo(defaultUserInfo);
    setUser(null);
    setIsLoggedIn(false);
    setIsAuthInitialized(true);
  };

  const updateUserInfo = (userData: Partial<UserInfo>) => {
    const updatedUserInfo = { ...userInfo, ...userData };
    setUserInfo(updatedUserInfo);
    
    const userForStorage: User = {
      id: updatedUserInfo.id,
      name: updatedUserInfo.name,
      email: updatedUserInfo.email,
      role: updatedUserInfo.role,
      avatar: updatedUserInfo.avatar
    };
    
    setUser(userForStorage);
    
    // Update localStorage
    localStorage.setItem('userInfo', JSON.stringify(userForStorage));
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, isAuthInitialized, userInfo, user, login, logout, updateUserInfo }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
