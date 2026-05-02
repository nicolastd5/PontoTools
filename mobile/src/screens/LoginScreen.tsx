import React, { useEffect, useRef, useState } from 'react';
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
  const [focus, setFocus]       = useState<'email' | 'pwd' | null>(null);
  const mountedRef              = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Atenção', 'Preencha email e senha.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      if (mountedRef.current) {
        Alert.alert('Erro', err?.response?.data?.error || 'Erro ao fazer login.');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  function inputStyle(name: 'email' | 'pwd') {
    return {
      padding: 12,
      backgroundColor: theme.surface,
      borderWidth: 1.5,
      borderColor: focus === name ? theme.primary : theme.border,
      borderRadius: 10,
      fontSize: 14,
      color: theme.textPrimary,
    };
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Decorative gradients — simulated with semi-transparent overlays */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: `${theme.primary}14`,
        }}
      />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Card */}
        <View style={{
          backgroundColor: theme.surface,
          borderRadius: 20,
          padding: 32,
          borderWidth: 1,
          borderColor: theme.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 20 },
          shadowOpacity: 0.25,
          shadowRadius: 40,
          elevation: 12,
        }}>
          {/* Logo */}
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <View style={{
              width: 52, height: 52, borderRadius: 14,
              backgroundColor: theme.primary,
              justifyContent: 'center', alignItems: 'center', marginBottom: 14,
            }}>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -1 }}>P</Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: theme.textPrimary, letterSpacing: -0.5, marginBottom: 4 }}>
              Bem-vindo
            </Text>
            <Text style={{ fontSize: 13, color: theme.textSecondary }}>
              Gerenciador de Serviços
            </Text>
          </View>

          {/* Email */}
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Email
            </Text>
            <TextInput
              style={inputStyle('email')}
              placeholder="voce@empresa.com"
              placeholderTextColor={theme.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocus('email')}
              onBlur={() => setFocus(null)}
            />
          </View>

          {/* Senha */}
          <View style={{ marginBottom: 22 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Senha
              </Text>
              <TouchableOpacity onPress={onForgotPassword}>
                <Text style={{ fontSize: 12, fontWeight: '500', color: theme.primary }}>Esqueceu?</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={inputStyle('pwd')}
              placeholder="••••••••"
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocus('pwd')}
              onBlur={() => setFocus(null)}
              onSubmitEditing={handleLogin}
              returnKeyType="done"
            />
          </View>

          {/* Botão */}
          <TouchableOpacity
            style={{
              backgroundColor: theme.primary,
              borderRadius: 10,
              padding: 14,
              alignItems: 'center',
              opacity: loading ? 0.7 : 1,
            }}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Entrar →</Text>}
          </TouchableOpacity>

          {/* Hint */}
          <View style={{ marginTop: 16, padding: 10, backgroundColor: theme.elevated, borderRadius: 8 }}>
            <Text style={{ fontSize: 11, color: theme.textMuted, textAlign: 'center' }}>
              Use as credenciais fornecidas pelo administrador.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
