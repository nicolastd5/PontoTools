import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { AUTH_TOKENS_UPDATED_AT_KEY, saveAuthTokens } from '../services/authTokenStorage';

interface Unit {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  unitId: number;
  unitName: string;
  unitCode: string;
  contractId: number | null;
  unit: Unit | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('user').then((stored) => {
      if (stored) setUser(JSON.parse(stored));
      setLoading(false);
    });
  }, []);

  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password });

    await saveAuthTokens(data.accessToken, data.refreshToken ?? '');
    await AsyncStorage.setItem('user', JSON.stringify(data.user));

    const unitRes = await api.get(`/units/${data.user.unitId}`);
    const unit = unitRes.data;

    const fullUser: User = {
      ...data.user,
      unit: {
        id:           unit.id,
        name:         unit.name,
        latitude:     parseFloat(unit.latitude),
        longitude:    parseFloat(unit.longitude),
        radiusMeters: unit.radius_meters,
      },
    };

    await AsyncStorage.setItem('user', JSON.stringify(fullUser));
    setUser(fullUser);
  }

  async function logout() {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      await api.post('/auth/logout', { refreshToken });
    } catch {}
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', AUTH_TOKENS_UPDATED_AT_KEY, 'user']);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
