import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Animated,
} from 'react-native';
import { OtpInput } from 'react-native-otp-entry';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { setUser, setNewUser } from '../../store';
import { authApi } from '../../api/services';
import { TokenStorage } from '../../api/interceptors/axios.interceptor';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import type { AuthStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'OtpVerify'>;
type Route = RouteProp<AuthStackParamList, 'OtpVerify'>;

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function OtpVerifyScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const dispatch = useAppDispatch();
  const { phoneNumber } = route.params;

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [resending, setResending] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    startCooldown();
    return () => clearInterval(timerRef.current);
  }, []);

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  async function handleVerify(code: string) {
    if (code.length < OTP_LENGTH) return;
    setLoading(true);
    setError('');
    try {
      const res = await authApi.verifyOtp(phoneNumber, code, {
        platform: 'android',
        app_version: '1.0.0',
      });
      const { data } = res.data;
      TokenStorage.setTokens(data.access_token, data.refresh_token);
      dispatch(setUser(data.user));
      dispatch(setNewUser(data.is_new_user));

      if (data.is_new_user) {
        navigation.replace('ProfileComplete', { isNewUser: true });
      }
      // Navigation to main app is handled by RootNavigator reacting to auth state
    } catch (e: unknown) {
      shake();
      const status = (e as { response?: { status?: number; data?: { message?: string } } }).response?.status;
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      if (status === 429) {
        setError(msg ?? 'Too many attempts. Please wait before trying again.');
      } else {
        setError(msg ?? 'Incorrect OTP. Please try again.');
      }
      setOtp('');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      await authApi.sendOtp(phoneNumber);
      startCooldown();
    } catch (e: unknown) {
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setResending(false);
    }
  }

  const maskedPhone = phoneNumber.slice(0, 3) + '****' + phoneNumber.slice(-4);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Verify your number</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit OTP sent to{'\n'}
          <Text style={styles.phone}>{maskedPhone}</Text>
        </Text>

        <Animated.View style={{ transform: [{ translateX: shakeAnim }], marginVertical: Spacing.xl }}>
          <OtpInput
            numberOfDigits={OTP_LENGTH}
            onFilled={handleVerify}
            onTextChange={(text) => { setOtp(text); if (error) setError(''); }}
            focusColor={Colors.primary}
            theme={{
              containerStyle: styles.otpContainer,
              inputsContainerStyle: styles.otpInputsContainer,
              pinCodeContainerStyle: [styles.otpBox, error ? styles.otpBoxError : null],
              pinCodeTextStyle: styles.otpText,
              focusedPinCodeContainerStyle: styles.otpBoxFocused,
            }}
          />
        </Animated.View>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={Colors.primary} size="small" />
            <Text style={styles.loadingText}>Verifying OTP…</Text>
          </View>
        )}

        <View style={styles.resendRow}>
          {cooldown > 0 ? (
            <Text style={styles.cooldownText}>Resend OTP in {cooldown}s</Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={resending}>
              {resending ? (
                <ActivityIndicator color={Colors.secondary} size="small" />
              ) : (
                <Text style={styles.resendText}>Resend OTP</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.primary },
  back: { paddingTop: 56, paddingHorizontal: Spacing.screen },
  backText: { ...Typography.body, color: Colors.primary },
  content: { flex: 1, paddingHorizontal: Spacing.screen, paddingTop: Spacing.xl },
  title: { ...Typography.h1, marginBottom: Spacing.sm },
  subtitle: { ...Typography.body, lineHeight: 24 },
  phone: { color: Colors.primary, fontWeight: '600' },
  otpContainer: { alignItems: 'center' },
  otpInputsContainer: { gap: Spacing.sm },
  otpBox: {
    width: 48, height: 56, borderWidth: 1.5,
    borderColor: Colors.border.default, borderRadius: Radius.md,
    backgroundColor: Colors.surface.input,
  },
  otpBoxFocused: { borderColor: Colors.primary, backgroundColor: Colors.background.primary },
  otpBoxError: { borderColor: Colors.error },
  otpText: { ...Typography.h3, color: Colors.text.primary },
  errorBox: {
    backgroundColor: Colors.errorLight, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.base,
  },
  errorText: { ...Typography.bodySmall, color: Colors.error, textAlign: 'center' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  loadingText: { ...Typography.bodySmall, color: Colors.text.secondary },
  resendRow: { alignItems: 'center', marginTop: Spacing.xl },
  cooldownText: { ...Typography.bodySmall, color: Colors.text.tertiary },
  resendText: { ...Typography.body, color: Colors.secondary, fontWeight: '600' },
});
