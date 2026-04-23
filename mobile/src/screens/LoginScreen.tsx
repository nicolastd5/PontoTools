import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
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
      style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center', padding: 24 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: theme.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>GS</Text>
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: theme.textPrimary, marginBottom: 4 }}>Gerenciador de Serviços</Text>
        <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 32 }}>Entre com sua conta</Text>

        <TextInput
          style={{ width: '100%', padding: 13, backgroundColor: theme.elevated, borderWidth: 1, borderColor: theme.border, borderRadius: 10, fontSize: 14, color: theme.textPrimary, marginBottom: 12 }}
          placeholder="funcionario@empresa.com"
          placeholderTextColor={theme.textMuted}
          keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
          value={email} onChangeText={setEmail}
        />
        <TextInput
          style={{ width: '100%', padding: 13, backgroundColor: theme.elevated, borderWidth: 1, borderColor: theme.border, borderRadius: 10, fontSize: 14, color: theme.textPrimary, marginBottom: 12 }}
          placeholder="••••••••"
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          value={password} onChangeText={setPassword}
          onSubmitEditing={handleLogin} returnKeyType="done"
        />

        <TouchableOpacity
          style={{ width: '100%', backgroundColor: theme.accent, borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 4, opacity: loading ? 0.7 : 1 }}
          onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Entrar →</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={{ marginTop: 20 }} onPress={onForgotPassword}>
          <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '500' }}>Esqueceu a senha?</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
