// src/services/auth.service.ts

import api from './api.service';
import { ApiResponse, User, Session } from '../types';

interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}
interface EnableMFAResponse {
  secret: string;
  instructions: string;
}

interface DisableMFARequest {
  password: string;
  code: string;
}


interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  dateOfBirth?: string;
}

interface LoginResponse {
  email: any;
  user: User;
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  expiresAt: string;
  requiresMfa?: boolean;
}

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

class AuthService {
  // Inscription
  async register(data: RegisterRequest): Promise<ApiResponse<User>> {
    return api.post('/auth/register', data);
  }

  // Connexion
  async login(data: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    const response = await api.post<ApiResponse<LoginResponse>>('/auth/login', data);
    
    if (response.success && response.data) {
      // Stocker les tokens
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }

    return response;
  }

  // Déconnexion
  async logout(): Promise<ApiResponse<void>> {
    const response = await api.post<ApiResponse<void>>('/auth/logout');
    
    // Nettoyer le storage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    return response;
  }

  // Refresh token
  async refreshToken(refreshToken: string): Promise<ApiResponse<{ accessToken: string; refreshToken: string }>> {
    return api.post('/auth/refresh', { refreshToken });
  }

  // Récupérer le profil
  async getProfile(): Promise<ApiResponse<{ user: User; stats: any }>> {
    return api.get('/auth/me');
  }

  // Mettre à jour le profil
  async updateProfile(updates: Partial<User>): Promise<ApiResponse<User>> {
    return api.put('/auth/profile', updates);
  }

  // Changer le mot de passe
  async changePassword(data: ChangePasswordRequest): Promise<ApiResponse<void>> {
    return api.post('/auth/change-password', data);
  }
/**
 * Verify MFA code during login
 */
async verifyMFALogin(sessionId: string, code: string): Promise<ApiResponse<LoginResponse>> {
  return api.post('/auth/verify-mfa', { sessionId, code });
}

/**
 * Resend MFA code
 */
async resendMFACode(sessionId: string): Promise<ApiResponse<{ message: string }>> {
  return api.post('/auth/resend-mfa', { sessionId });
}
  // Récupérer les sessions actives
  async getSessions(): Promise<ApiResponse<{ sessions: Session[] }>> {
    return api.get('/auth/sessions');
  }

  // Terminer une session
  async terminateSession(sessionId: string): Promise<ApiResponse<void>> {
    return api.delete(`/auth/sessions/${sessionId}`);
  }

  // Terminer toutes les sessions
  async terminateAllSessions(): Promise<ApiResponse<void>> {
    return api.delete('/auth/sessions');
  }
// Enable MFA
  async enableMFA(): Promise<ApiResponse<EnableMFAResponse>> {
    return api.post('/auth/mfa/enable');
  }

  // Verify MFA setup code
  async verifyMFACode(code: string): Promise<ApiResponse<void>> {
    return api.post('/auth/mfa/verify-setup', { code });
  }

  // Disable MFA
  async disableMFA(data: DisableMFARequest): Promise<ApiResponse<void>> {
    return api.post('/auth/mfa/disable', data);
  }

  // Get MFA Status
  async getMFAStatus(): Promise<ApiResponse<{ mfaEnabled: boolean; setupPending: boolean }>> {
    return api.get('/auth/mfa/status');
  }
  // Vérifier si l'utilisateur est connecté
  isAuthenticated(): boolean {
    const token = localStorage.getItem('accessToken');
    return !!token;
  }

  // Récupérer l'utilisateur du storage
  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
}

const authService = new AuthService();
export default authService;