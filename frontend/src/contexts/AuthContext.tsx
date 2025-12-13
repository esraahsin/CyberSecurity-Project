// frontend/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';
import authService from '../services/auth.service';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: any) => Promise<void>;
  updateUser: (user: User) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Charger l'utilisateur au démarrage
  useEffect(() => {
    const loadUser = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          setUser(null);
          return;
        }

        const response = await authService.getProfile();
        if (response.success && response.data) {
          setUser(response.data.user);
        } else {
          // Token invalide, nettoyer
          clearAuthData();
        }
      } catch (error) {
        console.error('Failed to load user:', error);
        clearAuthData();
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const clearAuthData = () => {
    setUser(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  };

  const login = async (email: string, password: string, rememberMe = false) => {
    try {
      const response = await authService.login({ email, password, rememberMe });
      
      if (response.success && response.data) {
        setUser(response.data.user);
        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      } else {
        throw new Error(response.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Appeler l'API pour invalider le token côté serveur
      await authService.logout();
    } catch (error) {
      console.error('Logout API error:', error);
      // Continuer même si l'API échoue
    } finally {
      // Toujours nettoyer les données locales
      clearAuthData();
      
      // Rediriger vers la page de login
      window.location.href = '/login';
    }
  };

  const register = async (data: any) => {
    try {
      const response = await authService.register(data);
      if (!response.success) {
        throw new Error(response.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        register,
        updateUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};