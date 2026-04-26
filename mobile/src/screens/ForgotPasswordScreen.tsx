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
          <Text style={styles.logoLetter}>P</Text>
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
  root:        { flex: 1, backgroundColor: '#4f46e5', justifyContent: 'center', padding: 20 },
  card:        { backgroundColor: '#fff', borderRadius: 20, padding: 32, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.25, shadowRadius: 40 },
  logoBox:     { width: 52, height: 52, borderRadius: 14, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 14 },
  logoLetter:  { color: '#fff', fontSize: 22, fontWeight: '800' },
  title:       { fontSize: 22, fontWeight: '700', color: '#09090b', textAlign: 'center', letterSpacing: -0.5 },
  subtitle:    { fontSize: 13, color: '#71717a', textAlign: 'center', marginBottom: 24, marginTop: 4, lineHeight: 18 },
  input:       { borderWidth: 1.5, borderColor: '#e4e4e7', borderRadius: 8, padding: 12, fontSize: 14, color: '#09090b', backgroundColor: '#fafafa', marginBottom: 16 },
  btn:         { backgroundColor: '#09090b', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#fff', fontWeight: '700', fontSize: 15 },
  backBtn:     { marginTop: 16, alignItems: 'center' },
  backText:    { color: '#4f46e5', fontSize: 13, fontWeight: '500' },
  successBox:  { alignItems: 'center' },
  successIcon: { fontSize: 36, color: '#10b981', marginBottom: 12 },
  successText: { fontSize: 14, color: '#374151', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
});
