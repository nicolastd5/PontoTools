import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import api from '../services/api';

interface Props {
  onBack: () => void;
}

export default function ForgotPasswordScreen({ onBack }: Props) {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  async function handleSubmit() {
    if (!email.trim()) {
      Alert.alert('Atenção', 'Informe seu email.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err: any) {
      Alert.alert('Erro', err?.response?.data?.error || 'Erro ao enviar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <View style={styles.logoBox}>
          <Text style={styles.logoLetter}>GS</Text>
        </View>
        <Text style={styles.title}>Recuperar senha</Text>
        <Text style={styles.subtitle}>
          {sent
            ? 'Verifique seu email'
            : 'Informe seu email para receber o link de recuperação'}
        </Text>

        {sent ? (
          <View style={styles.successBox}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successText}>
              Se o email <Text style={{ fontWeight: 'bold' }}>{email}</Text> estiver cadastrado,
              você receberá as instruções em breve. Verifique também o spam.
            </Text>
            <TouchableOpacity style={styles.btn} onPress={onBack}>
              <Text style={styles.btnText}>Voltar ao login</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="seu.email@empresa.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={handleSubmit}
              returnKeyType="send"
            />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Enviar link</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.backBtn} onPress={onBack}>
              <Text style={styles.backText}>← Voltar ao login</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#f1f5f9', justifyContent: 'center', padding: 24 },
  card:        { backgroundColor: '#fff', borderRadius: 16, padding: 28, elevation: 4 },
  logoBox:     { width: 56, height: 56, borderRadius: 14, backgroundColor: '#1d4ed8', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16 },
  logoLetter:  { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  title:       { fontSize: 22, fontWeight: 'bold', color: '#0f172a', textAlign: 'center' },
  subtitle:    { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 24, marginTop: 4, lineHeight: 18 },
  input:       { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 14, fontSize: 15, color: '#0f172a', marginBottom: 16 },
  btn:         { backgroundColor: '#1d4ed8', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  backBtn:     { marginTop: 16, alignItems: 'center' },
  backText:    { color: '#1d4ed8', fontSize: 14, fontWeight: '500' },
  successBox:  { alignItems: 'center' },
  successIcon: { fontSize: 36, color: '#16a34a', marginBottom: 12 },
  successText: { fontSize: 14, color: '#374151', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
});
