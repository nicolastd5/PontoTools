import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

interface Props { onForgotPassword: () => void; }

export default function LoginScreen({ onForgotPassword }: Props) {
  const { login }               = useAuth();
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
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.inner}>
        <View style={s.logo}><Text style={s.logoText}>P</Text></View>
        <Text style={s.title}>Gerenciador de Serviços</Text>
        <Text style={s.subtitle}>Entre com sua conta</Text>

        <TextInput
          style={s.input} placeholder="funcionario@empresa.com"
          placeholderTextColor="#4a5068" keyboardType="email-address"
          autoCapitalize="none" autoCorrect={false}
          value={email} onChangeText={setEmail}
        />
        <TextInput
          style={s.input} placeholder="••••••••"
          placeholderTextColor="#4a5068" secureTextEntry
          value={password} onChangeText={setPassword}
          onSubmitEditing={handleLogin} returnKeyType="done"
        />

        <TouchableOpacity
          style={[s.btn, loading && { opacity: 0.7 }]}
          onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#0d0f1a" />
            : <Text style={s.btnText}>Entrar →</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.forgot} onPress={onForgotPassword}>
          <Text style={s.forgotText}>Esqueceu a senha?</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#0d0f1a', justifyContent: 'center', padding: 24 },
  inner:      { alignItems: 'center' },
  logo:       { width: 56, height: 56, borderRadius: 14, backgroundColor: '#6c5ce7', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  logoText:   { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  title:      { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  subtitle:   { fontSize: 13, color: '#8b92a9', marginBottom: 32 },
  input:      { width: '100%', padding: 13, backgroundColor: '#1e2235', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 14, color: '#fff', marginBottom: 12 },
  btn:        { width: '100%', backgroundColor: '#fff', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 4 },
  btnText:    { color: '#0d0f1a', fontWeight: '700', fontSize: 16 },
  forgot:     { marginTop: 20 },
  forgotText: { color: '#6c5ce7', fontSize: 13, fontWeight: '500' },
});
