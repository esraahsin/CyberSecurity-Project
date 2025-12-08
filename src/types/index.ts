export interface Account {
  id: string;
  accountNumber: string;
  accountType: 'checking' | 'savings';
  balance: number;
  currency: string;
}

export interface Beneficiary {
  id: string;
  name: string;
  accountNumber: string;
  bankName: string;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  mfaEnabled: boolean;
}