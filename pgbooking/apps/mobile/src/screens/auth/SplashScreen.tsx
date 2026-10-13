import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { TokenStorage } from '../../api/interceptors/axios.interceptor';
import { authApi } from '../../api/services';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { setUser, logout } from '../../store';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import type { AuthStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Splash'>;

export default function SplashScreen() {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    checkAuthState();
  }, []);

  async function checkAuthState() {
    const accessToken = TokenStorage.getAccessToken();

    if (!accessToken) {
      setTimeout(() => navigation.replace('Onboarding'), 800);
      return;
    }

    try {
      const res = await authApi.getMe();
      dispatch(setUser(res.data.data));
      // RootNavigator will auto-switch to Tenant/Owner stack based on auth state
    } catch {
      TokenStorage.clearTokens();
      dispatch(logout());
      navigation.replace('Onboarding');
    }
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>PG</Text>
        </View>
        <Text style={styles.appName}>PG Booking</Text>
        <Text style={styles.tagline}>Your home away from home</Text>
      </Animated.View>
      <ActivityIndicator color={Colors.text.inverse} style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center' },
  logoBox: {
    width: 88, height: 88, borderRadius: Radius.xxl,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  logoText: { ...Typography.h1, color: '#fff', fontSize: 36 },
  appName: { ...Typography.h1, color: '#fff', fontSize: 28, marginBottom: Spacing.xs },
  tagline: { ...Typography.body, color: 'rgba(255,255,255,0.8)' },
  loader: { position: 'absolute', bottom: 80 },
});
