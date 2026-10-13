import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography, Spacing } from '../../theme';
import type { TenantStackParamList } from '../../navigation';

/**
 * This screen is shown briefly while Razorpay's native SDK overlay is opening.
 * In practice, CheckoutScreen calls RazorpayCheckout.open() directly and this
 * screen serves as a fallback/transition state if navigation occurs before
 * the SDK overlay is ready, or while verifying payment with the backend.
 */

type Nav = NativeStackNavigationProp<TenantStackParamList, 'PaymentProcessing'>;
type Route = RouteProp<TenantStackParamList, 'PaymentProcessing'>;

const STAGES = [
  'Connecting to payment gateway…',
  'Verifying transaction…',
  'Confirming your booking…',
];

export default function PaymentProcessingScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { bookingId } = route.params;
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, STAGES.length - 1));
    }, 1800);

    // Safety timeout: if verification takes too long, return to booking detail
    const timeout = setTimeout(() => {
      navigation.replace('BookingDetail', { bookingId });
    }, 20000);

    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: Spacing.xl }} />
      <Text style={styles.stage}>{STAGES[stageIndex]}</Text>
      <Text style={styles.subtext}>Please don't close the app</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.primary, alignItems: 'center', justifyContent: 'center', padding: Spacing.screen },
  stage: { ...Typography.h3, textAlign: 'center', marginBottom: Spacing.xs },
  subtext: { ...Typography.bodySmall, textAlign: 'center' },
});
