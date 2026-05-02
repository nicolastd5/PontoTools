import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  const mountedRef = useRef(true);

  useEffect(() => {
    AsyncStorage.getItem('user')
      .then(async (stored) => {
        if (!stored) return;
        try {
          if (mountedRef.current) setUser(JSON.parse(stored));
        } catch {
          await AsyncStorage.multiRemove(['accessToken', 'refreshToken', AUTH_TOKENS_UPDATED_AT_KEY, 'user']);
        }
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });

    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function login(email: string, password: string) {
    let tokensSaved = false;

    try {
      const { data } = await api.post('/auth/login', { email, password });

      await saveAuthTokens(data.accessToken, data.refreshToken ?? '');
      tokensSaved = true;

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
      if (mountedRef.current) setUser(fullUser);
    } catch (error) {
      if (tokensSaved) {
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', AUTH_TOKENS_UPDATED_AT_KEY, 'user']);
      }
      throw error;
    }
  }

  async function logout() {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      await api.post('/auth/logout', { refreshToken });
    } catch {}
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', AUTH_TOKENS_UPDATED_AT_KEY, 'user']);
    if (mountedRef.current) setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
