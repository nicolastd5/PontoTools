import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useAuth }  from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface Props { onForgotPassword: () => void; }

export default function LoginScreen({ onForgotPassword }: Props) {
  const { login }                       = useAuth();
  const { theme, isDark, toggleTheme }  = useTheme();
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [loading, setLoading]           = useState(false);
  const [focus, setFocus]               = useState<'email' | 'pwd' | null>(null);
  const mountedRef                      = useRef(true);

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
      paddingVertical: 12,
      paddingHorizontal: 14,
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
      style={{ flex: 1, backgroundColor: theme.night }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Gradientes radiais simulados (overlays semi-transparentes) */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -120, left: -120,
          width: 360, height: 360, borderRadius: 180,
          backgroundColor: theme.primary,
          opacity: 0.18,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: -140, right: -140,
          width: 380, height: 380, borderRadius: 190,
          backgroundColor: theme.violet,
          opacity: 0.14,
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
          paddingVertical: 36,
          paddingHorizontal: 28,
          borderWidth: 1,
          borderColor: theme.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 20 },
          shadowOpacity: 0.35,
          shadowRadius: 40,
          elevation: 14,
          maxWidth: 400,
          alignSelf: 'center',
          width: '100%',
        }}>
          {/* Logo */}
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <View style={{
              width: 52, height: 52, borderRadius: 14,
              backgroundColor: theme.primary,
              justifyContent: 'center', alignItems: 'center', marginBottom: 16,
              shadowColor: theme.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.6,
              shadowRadius: 8,
              elevation: 6,
            }}>
              <Text style={{
                color: '#fff',
                fontSize: 28,
                fontWeight: '800',
                letterSpacing: -1.5,
                lineHeight: 32,
              }}>G</Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: theme.textPrimary, letterSpacing: -0.5, marginBottom: 4 }}>
              Bem-vindo
            </Text>
            <Text style={{ fontSize: 14, color: theme.textSecondary }}>
              Gerenciador de Serviços
            </Text>
          </View>

          {/* Email */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: '500', color: theme.textSecondary, marginBottom: 6, letterSpacing: -0.1 }}>
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
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: '500', color: theme.textSecondary, letterSpacing: -0.1 }}>
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
              paddingVertical: 12,
              alignItems: 'center',
              opacity: loading ? 0.7 : 1,
              marginTop: 4,
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : (
                <>
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Entrar</Text>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>→</Text>
                </>
              )}
          </TouchableOpacity>

          {/* Toggle de tema */}
          <TouchableOpacity
            onPress={toggleTheme}
            style={{
              marginTop: 16,
              paddingVertical: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 12, color: theme.textSecondary }}>
              {isDark ? '☀️ Mudar para modo claro' : '🌙 Mudar para modo escuro'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
