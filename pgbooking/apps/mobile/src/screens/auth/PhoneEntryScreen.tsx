import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { authApi } from '../../api/services';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import type { AuthStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'PhoneEntry'>;

export default function PhoneEntryScreen() {
  const navigation = useNavigation<Nav>();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValid = /^[6-9]\d{9}$/.test(phone.replace(/\s/g, ''));

  async function handleSendOtp() {
    if (!isValid) { setError('Enter a valid 10-digit Indian mobile number'); return; }
    setLoading(true);
    setError('');
    try {
      const normalized = `+91${phone.replace(/\s/g, '')}`;
      await authApi.sendOtp(normalized);
      navigation.navigate('OtpVerify', { phoneNumber: normalized });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to send OTP. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        {/* Logo / Brand */}
        <View style={styles.brand}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>PG</Text>
          </View>
          <Text style={styles.appName}>PG Booking</Text>
          <Text style={styles.tagline}>Find your perfect paying guest accommodation</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>Mobile Number</Text>
          <View style={[styles.inputRow, error ? styles.inputError : null]}>
            <Text style={styles.countryCode}>+91</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter 10-digit number"
              placeholderTextColor={Colors.text.tertiary}
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={(t) => { setPhone(t.replace(/\D/g, '')); setError(''); }}
              autoFocus
            />
          </View>
          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, (!isValid || loading) && styles.buttonDisabled]}
            onPress={handleSendOtp}
            disabled={!isValid || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={Colors.text.inverse} />
            ) : (
              <Text style={styles.buttonText}>Send OTP</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
            We'll send a 6-digit OTP to verify your number.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.primary },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.screen, paddingBottom: 40 },
  brand: { alignItems: 'center', marginBottom: Spacing.xxxl },
  logoBox: {
    width: 72, height: 72, borderRadius: Radius.xl,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  logoText: { ...Typography.h1, color: Colors.text.inverse, fontSize: 28 },
  appName: { ...Typography.h1, color: Colors.text.primary, marginBottom: Spacing.xs },
  tagline: { ...Typography.body, textAlign: 'center', color: Colors.text.secondary },
  form: { width: '100%' },
  label: { ...Typography.label, marginBottom: Spacing.sm, color: Colors.text.primary },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border.default,
    borderRadius: Radius.lg, backgroundColor: Colors.surface.input,
    paddingHorizontal: Spacing.base, height: 56, marginBottom: Spacing.xs,
  },
  inputError: { borderColor: Colors.error },
  countryCode: { ...Typography.body, color: Colors.text.primary, fontWeight: '600', marginRight: Spacing.sm },
  input: { flex: 1, ...Typography.body, color: Colors.text.primary, fontSize: 16 },
  errorText: { ...Typography.bodySmall, color: Colors.error, marginBottom: Spacing.sm },
  button: {
    height: 56, backgroundColor: Colors.primary, borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { ...Typography.button, color: Colors.text.inverse },
  disclaimer: { ...Typography.caption, textAlign: 'center', marginTop: Spacing.xl, paddingHorizontal: Spacing.sm },
});
