// Future API integration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export const api = {
  async transfer(data: any) {
    // Will connect to backend later
    return fetch(`${API_BASE_URL}/transactions/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },
  
  async updateProfile(data: any) {
    return fetch(`${API_BASE_URL}/users/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }
};