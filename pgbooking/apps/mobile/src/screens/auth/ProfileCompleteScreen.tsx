import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { setUser } from '../../store';
import { authApi } from '../../api/services';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import type { AuthStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'ProfileComplete'>;

export default function ProfileCompleteScreen() {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const user = useSelector((s: RootState) => s.auth.user);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'TENANT' | 'OWNER'>('TENANT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValid = name.trim().length >= 2;

  async function handleSubmit() {
    if (!isValid) { setError('Please enter your full name'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await authApi.completeProfile({
        legal_full_name: name.trim(),
        email_address: email.trim() || undefined,
      });
      dispatch(setUser({ ...user!, ...res.data.data }));
      // RootNavigator automatically switches to the right stack based on role
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(msg ?? 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Complete your profile</Text>
        <Text style={styles.subtitle}>Just a few details to get started</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Full Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your full name"
            placeholderTextColor={Colors.text.tertiary}
            value={name}
            onChangeText={(t) => { setName(t); setError(''); }}
            autoFocus
          />

          <Text style={styles.label}>Email Address (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={Colors.text.tertiary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>I am a</Text>
          <View style={styles.roleRow}>
            {(['TENANT', 'OWNER'] as const).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.roleCard, role === r && styles.roleCardActive]}
                onPress={() => setRole(r)}
              >
                <Text style={styles.roleIcon}>{r === 'TENANT' ? '🎒' : '🏢'}</Text>
                <Text style={[styles.roleLabel, role === r && styles.roleLabelActive]}>
                  {r === 'TENANT' ? 'Tenant' : 'Property Owner'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, (!isValid || loading) && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!isValid || loading}
          >
            {loading ? <ActivityIndicator color={Colors.text.inverse} /> : <Text style={styles.buttonText}>Continue</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.primary },
  scroll: { padding: Spacing.screen, paddingTop: 64 },
  title: { ...Typography.h1, marginBottom: Spacing.xs },
  subtitle: { ...Typography.body, marginBottom: Spacing.xl },
  form: {},
  label: { ...Typography.label, marginBottom: Spacing.sm, marginTop: Spacing.base },
  input: {
    height: 52, borderWidth: 1.5, borderColor: Colors.border.default,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.base,
    backgroundColor: Colors.surface.input, ...Typography.body, color: Colors.text.primary,
  },
  roleRow: { flexDirection: 'row', gap: Spacing.sm },
  roleCard: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.border.default, borderRadius: Radius.lg,
    padding: Spacing.base, alignItems: 'center', backgroundColor: Colors.surface.input,
  },
  roleCardActive: { borderColor: Colors.primary, backgroundColor: 'rgba(30,58,138,0.06)' },
  roleIcon: { fontSize: 28, marginBottom: Spacing.xs },
  roleLabel: { ...Typography.label, color: Colors.text.secondary },
  roleLabelActive: { color: Colors.primary },
  errorText: { ...Typography.bodySmall, color: Colors.error, marginTop: Spacing.base },
  button: {
    height: 56, backgroundColor: Colors.primary, borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { ...Typography.button, color: Colors.text.inverse },
});
