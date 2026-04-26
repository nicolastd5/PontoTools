import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useAuth }  from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface Props { onForgotPassword: () => void; }

export default function LoginScreen({ onForgotPassword }: Props) {
  const { login }               = useAuth();
  const { theme }               = useTheme();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Atenção', 'Preencha email e senha.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      Alert.alert('Erro', err?.response?.data?.error || 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#4f46e5' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Card */}
        <View style={{
          backgroundColor: '#ffffff',
          borderRadius: 20,
          padding: 32,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 20 },
          shadowOpacity: 0.25,
          shadowRadius: 40,
          elevation: 12,
        }}>
          {/* Logo */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View style={{
              width: 52, height: 52, borderRadius: 14,
              backgroundColor: '#4f46e5',
              justifyContent: 'center', alignItems: 'center', marginBottom: 14,
            }}>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -1 }}>P</Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#09090b', letterSpacing: -0.5, marginBottom: 4 }}>
              Bem-vindo
            </Text>
            <Text style={{ fontSize: 13, color: '#71717a' }}>
              Entre na sua conta PontoTools
            </Text>
          </View>

          {/* Email */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Email
            </Text>
            <TextInput
              style={{
                padding: 12, backgroundColor: '#fafafa',
                borderWidth: 1.5, borderColor: '#e4e4e7', borderRadius: 8,
                fontSize: 14, color: '#09090b',
              }}
              placeholder="funcionario@empresa.com"
              placeholderTextColor="#a1a1aa"
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
              value={email} onChangeText={setEmail}
            />
          </View>

          {/* Senha */}
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Senha
              </Text>
              <TouchableOpacity onPress={onForgotPassword}>
                <Text style={{ fontSize: 12, fontWeight: '500', color: '#4f46e5' }}>Esqueceu?</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={{
                padding: 12, backgroundColor: '#fafafa',
                borderWidth: 1.5, borderColor: '#e4e4e7', borderRadius: 8,
                fontSize: 14, color: '#09090b',
              }}
              placeholder="••••••••"
              placeholderTextColor="#a1a1aa"
              secureTextEntry
              value={password} onChangeText={setPassword}
              onSubmitEditing={handleLogin} returnKeyType="done"
            />
          </View>

          {/* Botão */}
          <TouchableOpacity
            style={{
              backgroundColor: '#09090b', borderRadius: 8,
              padding: 14, alignItems: 'center',
              opacity: loading ? 0.7 : 1,
            }}
            onPress={handleLogin} disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Entrar →</Text>}
          </TouchableOpacity>

          {/* Hint */}
          <View style={{ marginTop: 16, padding: 10, backgroundColor: '#f4f4f5', borderRadius: 8 }}>
            <Text style={{ fontSize: 11, color: '#a1a1aa', textAlign: 'center' }}>
              Use as credenciais fornecidas pelo administrador.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
