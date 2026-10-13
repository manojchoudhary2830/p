import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { paymentsApi, bookingsApi } from '../../api/services';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import type { TenantStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<TenantStackParamList, 'Checkout'>;
type Route = RouteProp<TenantStackParamList, 'Checkout'>;

const LOCK_DURATION_SECONDS = 600; // 10 minutes

export default function CheckoutScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const user = useSelector((s: RootState) => s.auth.user);
  const { bookingInitiation } = route.params;

  const [secondsLeft, setSecondsLeft] = useState(() => {
    const expiresAt = new Date(bookingInitiation.lockExpirationTimestamp).getTime();
    return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  });
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [expired, setExpired] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) { setExpired(true); return; }
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) { clearInterval(timer); setExpired(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const timerColor = secondsLeft <= 60 ? Colors.error : secondsLeft <= 180 ? Colors.warning : Colors.success;

  const handlePayment = useCallback(async () => {
    if (expired) { Alert.alert('Reservation Expired', 'Please restart your booking.'); return; }
    setPaymentLoading(true);
    try {
      // 1. Create Razorpay order
      const orderRes = await paymentsApi.createOrder(bookingInitiation.bookingId, 'TOKEN_DEPOSIT');
      const { order_id, amount, currency, key } = orderRes.data.data;

      // 2. Open Razorpay checkout
      const paymentData = await RazorpayCheckout.open({
        key,
        amount,
        currency,
        order_id,
        name: 'PG Booking',
        description: `Token deposit for ${bookingInitiation.propertyName}`,
        prefill: { contact: user?.phone_number ?? '', name: user?.legal_full_name ?? '' },
        theme: { color: Colors.primary },
      });

      // 3. Verify with backend
      await paymentsApi.verifyPayment({
        razorpay_order_id: paymentData.razorpay_order_id,
        razorpay_payment_id: paymentData.razorpay_payment_id,
        razorpay_signature: paymentData.razorpay_signature,
        booking_id: bookingInitiation.bookingId,
      });

      navigation.replace('BookingSuccess', { bookingId: bookingInitiation.bookingId });
    } catch (e: unknown) {
      const razorpayError = e as { code?: number; description?: string };
      if (razorpayError.code === 0) return; // user dismissed
      const apiMsg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      Alert.alert('Payment Failed', apiMsg ?? razorpayError.description ?? 'Payment could not be processed. Please try again.');
    } finally {
      setPaymentLoading(false);
    }
  }, [expired, bookingInitiation, user]);

  async function handleCancel() {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this reservation? The bed will be released.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Booking', style: 'destructive',
          onPress: async () => {
            try {
              await bookingsApi.cancel(bookingInitiation.bookingId, 'Cancelled by user on checkout');
            } catch {}
            navigation.goBack();
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Complete Booking</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Reservation Timer */}
        <View style={[styles.timerCard, { borderColor: timerColor }]}>
          <Text style={styles.timerLabel}>Reservation holds for</Text>
          <Text style={[styles.timerValue, { color: timerColor }]}>
            {expired ? 'EXPIRED' : formatTime(secondsLeft)}
          </Text>
          {expired ? (
            <Text style={styles.timerExpiredMsg}>
              Your reservation has expired. The bed has been released.
            </Text>
          ) : (
            <Text style={styles.timerSubtext}>Pay before time runs out to confirm your bed</Text>
          )}
        </View>

        {/* Booking Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Booking Summary</Text>
          {[
            { label: 'Property', value: bookingInitiation.propertyName },
            { label: 'Room', value: `Room ${bookingInitiation.roomCode}` },
            { label: 'Bed', value: `Bed ${bookingInitiation.bedCode}` },
            { label: 'Monthly Rent', value: `₹${bookingInitiation.monthlyRent.toLocaleString('en-IN')}` },
            { label: 'Security Deposit', value: `₹${bookingInitiation.securityDeposit.toLocaleString('en-IN')}` },
          ].map(({ label, value }) => (
            <View key={label} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{label}</Text>
              <Text style={styles.summaryValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Payment Breakdown */}
        <View style={styles.paymentCard}>
          <Text style={styles.sectionTitle}>Pay Now</Text>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Token Deposit (20% of security)</Text>
            <Text style={styles.paymentAmount}>₹{bookingInitiation.requiredTokenAmount.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.paymentRow}>
            <Text style={[styles.paymentLabel, { fontWeight: '700' }]}>Total Due Now</Text>
            <Text style={styles.totalAmount}>₹{bookingInitiation.requiredTokenAmount.toLocaleString('en-IN')}</Text>
          </View>
          <Text style={styles.paymentNote}>
            Remaining security deposit and monthly rent are due at check-in.
          </Text>
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={styles.cta}>
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.payBtn, (paymentLoading || expired) && styles.payBtnDisabled]}
          onPress={handlePayment}
          disabled={paymentLoading || expired}
          activeOpacity={0.85}
        >
          {paymentLoading ? (
            <ActivityIndicator color={Colors.text.inverse} />
          ) : (
            <Text style={styles.payBtnText}>
              Pay ₹{bookingInitiation.requiredTokenAmount.toLocaleString('en-IN')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.secondary },
  header: {
    paddingTop: 56, paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.base, backgroundColor: Colors.primary,
  },
  headerTitle: { ...Typography.h1, color: Colors.text.inverse },
  scroll: { padding: Spacing.screen },
  timerCard: {
    backgroundColor: Colors.surface.card, borderRadius: Radius.xl,
    padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.base,
    borderWidth: 2, ...Shadows.md,
  },
  timerLabel: { ...Typography.bodySmall, color: Colors.text.secondary, marginBottom: Spacing.xs },
  timerValue: { fontSize: 48, fontWeight: '800', letterSpacing: 2, fontVariant: ['tabular-nums'] },
  timerSubtext: { ...Typography.caption, color: Colors.text.secondary, marginTop: Spacing.xs, textAlign: 'center' },
  timerExpiredMsg: { ...Typography.bodySmall, color: Colors.error, marginTop: Spacing.xs, textAlign: 'center' },
  summaryCard: {
    backgroundColor: Colors.surface.card, borderRadius: Radius.xl,
    padding: Spacing.base, marginBottom: Spacing.base, ...Shadows.sm,
  },
  sectionTitle: { ...Typography.h2, marginBottom: Spacing.sm, color: Colors.text.primary },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border.light,
  },
  summaryLabel: { ...Typography.bodySmall, color: Colors.text.secondary },
  summaryValue: { ...Typography.bodySmall, color: Colors.text.primary, fontWeight: '600' },
  paymentCard: {
    backgroundColor: Colors.surface.card, borderRadius: Radius.xl,
    padding: Spacing.base, marginBottom: Spacing.base, ...Shadows.sm,
  },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  paymentLabel: { ...Typography.body, color: Colors.text.secondary },
  paymentAmount: { ...Typography.body, color: Colors.text.primary },
  totalAmount: { ...Typography.price },
  divider: { height: 1, backgroundColor: Colors.border.light },
  paymentNote: { ...Typography.caption, color: Colors.text.tertiary, marginTop: Spacing.sm },
  cta: {
    flexDirection: 'row', gap: Spacing.sm,
    padding: Spacing.base, paddingBottom: Spacing.xl,
    backgroundColor: Colors.surface.card, ...Shadows.lg,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
  },
  cancelBtn: {
    flex: 1, height: 56, borderRadius: Radius.lg, borderWidth: 1.5,
    borderColor: Colors.border.default, alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { ...Typography.button, color: Colors.text.secondary },
  payBtn: {
    flex: 2, height: 56, backgroundColor: Colors.secondary,
    borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center',
  },
  payBtnDisabled: { opacity: 0.5 },
  payBtnText: { ...Typography.button, color: Colors.text.inverse },
});
