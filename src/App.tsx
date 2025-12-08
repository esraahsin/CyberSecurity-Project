import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, User, Lock, CreditCard, ArrowRight, Shield, Eye, EyeOff, RefreshCw } from 'lucide-react';

// Mock data and types
interface Account {
  id: string;
  accountNumber: string;
  accountType: 'checking' | 'savings';
  balance: number;
  currency: string;
}

interface Beneficiary {
  id: string;
  name: string;
  accountNumber: string;
  bankName: string;
}

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  mfaEnabled: boolean;
}

// Mock API Service
const mockAPI = {
  accounts: [
    { id: '1', accountNumber: 'FR7612345678901234567890', accountType: 'checking', balance: 5420.50, currency: 'EUR' },
    { id: '2', accountNumber: 'FR7698765432109876543210', accountType: 'savings', balance: 12380.00, currency: 'EUR' }
  ],
  beneficiaries: [
    { id: '1', name: 'Marie Dubois', accountNumber: 'FR7611111111111111111111', bankName: 'BNP Paribas' },
    { id: '2', name: 'Jean Martin', accountNumber: 'FR7622222222222222222222', bankName: 'Crédit Agricole' }
  ],
  userProfile: {
    id: 'user-123',
    email: 'pierre.dupont@email.com',
    firstName: 'Pierre',
    lastName: 'Dupont',
    phone: '+33 6 12 34 56 78',
    mfaEnabled: true
  }
};

const SecureBankApp = () => {
  const [activeTab, setActiveTab] = useState<'transfer' | 'profile'>('transfer');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-indigo-600 rounded-lg p-2">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">SecureBank</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Pierre Dupont</span>
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white rounded-lg shadow-sm p-1 inline-flex">
          <button
            onClick={() => setActiveTab('transfer')}
            className={`px-6 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'transfer'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              <ArrowRight className="w-4 h-4" />
              <span>Virement</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'profile'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span>Profil</span>
            </div>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'transfer' ? <TransferSection /> : <ProfileSection />}
      </main>
    </div>
  );
};

// Transfer Section Component
const TransferSection = () => {
  const [accounts] = useState<Account[]>(mockAPI.accounts);
  const [beneficiaries] = useState<Beneficiary[]>(mockAPI.beneficiaries);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [showMFA, setShowMFA] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const selectedAccountData = accounts.find(acc => acc.id === selectedAccount);
  const selectedBeneficiaryData = beneficiaries.find(ben => ben.id === selectedBeneficiary);

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const transferAmount = parseFloat(amount);

    // Validation
    if (!selectedAccount || !selectedBeneficiary || !amount) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (transferAmount <= 0) {
      setError('Le montant doit être supérieur à 0');
      return;
    }

    if (selectedAccountData && transferAmount > selectedAccountData.balance) {
      setError('Solde insuffisant');
      return;
    }

    // Check if MFA required (>500€)
    if (transferAmount > 500) {
      setShowMFA(true);
      return;
    }

    // Process transfer
    await processTransfer();
  };

  const processTransfer = async () => {
    setIsProcessing(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsProcessing(false);
      setSuccess(true);
      // Reset form
      setSelectedAccount('');
      setSelectedBeneficiary('');
      setAmount('');
      setDescription('');
      setMfaCode('');
      setShowMFA(false);
      
      // Hide success message after 3s
      setTimeout(() => setSuccess(false), 3000);
    }, 1500);
  };

  const handleMFASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaCode.length !== 6) {
      setError('Code de vérification invalide');
      return;
    }
    await processTransfer();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Transfer Form */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Effectuer un virement</h2>

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-green-900">Virement effectué avec succès</h3>
                <p className="text-sm text-green-700 mt-1">Votre transaction a été traitée</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-900">Erreur</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {!showMFA ? (
            <form onSubmit={handleTransferSubmit} className="space-y-6">
              {/* Account Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Compte débiteur *
                </label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                >
                  <option value="">Sélectionnez un compte</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.accountNumber} - {account.balance.toFixed(2)} {account.currency}
                    </option>
                  ))}
                </select>
              </div>

              {/* Beneficiary Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bénéficiaire *
                </label>
                <select
                  value={selectedBeneficiary}
                  onChange={(e) => setSelectedBeneficiary(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                >
                  <option value="">Sélectionnez un bénéficiaire</option>
                  {beneficiaries.map((beneficiary) => (
                    <option key={beneficiary.id} value={beneficiary.id}>
                      {beneficiary.name} - {beneficiary.bankName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Montant (EUR) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="0.00"
                    required
                  />
                  <span className="absolute right-4 top-3.5 text-gray-500">€</span>
                </div>
                {parseFloat(amount) > 500 && (
                  <p className="mt-2 text-sm text-amber-600 flex items-center space-x-1">
                    <Shield className="w-4 h-4" />
                    <span>Double authentification requise pour ce montant</span>
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optionnel)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Ex: Remboursement dîner..."
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Traitement en cours...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-5 h-5" />
                    <span>Valider le virement</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleMFASubmit} className="space-y-6">
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Authentification à double facteur
                </h3>
                <p className="text-sm text-gray-600">
                  Entrez le code de vérification depuis votre application d'authentification
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Code de vérification *
                </label>
                <input
                  type="text"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="000000"
                  maxLength={6}
                  required
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowMFA(false);
                    setMfaCode('');
                    setError('');
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || mfaCode.length !== 6}
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Vérification...' : 'Confirmer'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Transfer Summary */}
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Récapitulatif</h3>
          
          <div className="space-y-4">
            {selectedAccountData && (
              <div>
                <p className="text-sm text-gray-600 mb-1">De</p>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium text-gray-900">{selectedAccountData.accountNumber}</p>
                  <p className="text-sm text-gray-600">Solde: {selectedAccountData.balance.toFixed(2)} €</p>
                </div>
              </div>
            )}

            {selectedBeneficiaryData && (
              <div>
                <p className="text-sm text-gray-600 mb-1">À</p>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium text-gray-900">{selectedBeneficiaryData.name}</p>
                  <p className="text-sm text-gray-600">{selectedBeneficiaryData.accountNumber}</p>
                  <p className="text-sm text-gray-600">{selectedBeneficiaryData.bankName}</p>
                </div>
              </div>
            )}

            {amount && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Montant</p>
                <div className="bg-indigo-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-indigo-600">{parseFloat(amount).toFixed(2)} €</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-900 text-sm">Sécurité</h4>
              <p className="text-sm text-amber-700 mt-1">
                Les virements supérieurs à 500€ nécessitent une double authentification
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Profile Section Component
const ProfileSection = () => {
  const [profile, setProfile] = useState<UserProfile>(mockAPI.userProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<UserProfile>(profile);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeSection, setActiveSection] = useState<'info' | 'security'>('info');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleProfileUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!editedProfile.firstName || !editedProfile.lastName || !editedProfile.email) {
      setError('Tous les champs obligatoires doivent être remplis');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editedProfile.email)) {
      setError('Format d\'email invalide');
      return;
    }

    // Simulate API call
    setTimeout(() => {
      setProfile(editedProfile);
      setIsEditing(false);
      setSuccess('Profil mis à jour avec succès');
      setTimeout(() => setSuccess(''), 3000);
    }, 500);
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Tous les champs sont requis');
      return;
    }

    if (newPassword.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    // Simulate API call
    setTimeout(() => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Mot de passe modifié avec succès');
      setTimeout(() => setSuccess(''), 3000);
    }, 500);
  };

  const toggleMFA = () => {
    const newMFAStatus = !profile.mfaEnabled;
    setProfile({ ...profile, mfaEnabled: newMFAStatus });
    setEditedProfile({ ...editedProfile, mfaEnabled: newMFAStatus });
    setSuccess(
      newMFAStatus
        ? 'Double authentification activée'
        : 'Double authentification désactivée'
    );
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
          <div>
            <p className="text-sm text-green-700">{success}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Section Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveSection('info')}
              className={`flex-1 px-6 py-4 text-sm font-medium ${
                activeSection === 'info'
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Informations personnelles
            </button>
            <button
              onClick={() => setActiveSection('security')}
              className={`flex-1 px-6 py-4 text-sm font-medium ${
                activeSection === 'security'
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sécurité
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeSection === 'info' ? (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Informations personnelles</h2>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Modifier
                  </button>
                )}
              </div>

              {!isEditing ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Prénom</label>
                      <p className="text-gray-900 font-medium">{profile.firstName}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Nom</label>
                      <p className="text-gray-900 font-medium">{profile.lastName}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                    <p className="text-gray-900 font-medium">{profile.email}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Téléphone</label>
                    <p className="text-gray-900 font-medium">{profile.phone}</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleProfileUpdate} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Prénom *
                      </label>
                      <input
                        type="text"
                        value={editedProfile.firstName}
                        onChange={(e) =>
                          setEditedProfile({ ...editedProfile, firstName: e.target.value })
                        }
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nom *
                      </label>
                      <input
                        type="text"
                        value={editedProfile.lastName}
                        onChange={(e) =>
                          setEditedProfile({ ...editedProfile, lastName: e.target.value })
                        }
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={editedProfile.email}
                      onChange={(e) =>
                        setEditedProfile({ ...editedProfile, email: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      value={editedProfile.phone}
                      onChange={(e) =>
                        setEditedProfile({ ...editedProfile, phone: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setEditedProfile(profile);
                        setError('');
                      }}
                      className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                    >
                      Enregistrer
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {/* MFA Section */}
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-6">Double authentification</h2>
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="bg-indigo-100 rounded-lg p-3">
                        <Shield className="w-6 h-6 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-1">
                          Authentification à deux facteurs (2FA)
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">
                          Ajoutez une couche de sécurité supplémentaire à votre compte
                        </p>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                              profile.mfaEnabled
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            {profile.mfaEnabled ? 'Activé' : 'Désactivé'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={toggleMFA}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        profile.mfaEnabled
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                      }`}
                    >
                      {profile.mfaEnabled ? 'Désactiver' : 'Activer'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Password Change Section */}
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-6">Changer le mot de passe</h2>
                <form onSubmit={handlePasswordChange} className="space-y-6 max-w-xl">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mot de passe actuel *
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-3.5 text-gray-500 hover:text-gray-700"
                      >
                        {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nouveau mot de passe *
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-3.5 text-gray-500 hover:text-gray-700"
                      >
                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                      Le mot de passe doit contenir au moins 8 caractères
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirmer le nouveau mot de passe *
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-3.5 text-gray-500 hover:text-gray-700"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Lock className="w-5 h-5" />
                    <span>Modifier le mot de passe</span>
                  </button>
                </form>
              </div>

              {/* Security Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900 text-sm">Conseils de sécurité</h4>
                    <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                      <li>Utilisez un mot de passe unique et complexe</li>
                      <li>Activez la double authentification pour plus de sécurité</li>
                      <li>Ne partagez jamais vos identifiants</li>
                      <li>Vérifiez régulièrement l'activité de votre compte</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SecureBankApp;