import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { bookingsApi, paymentsApi } from '../../api/services';
import { StatusBadge } from '../../components/skeletons';
import { Button } from '../../components/common/Button';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import type { TenantStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<TenantStackParamList, 'BookingDetail'>;
type Route = RouteProp<TenantStackParamList, 'BookingDetail'>;

export default function BookingDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { bookingId } = route.params;
  const [booking, setBooking] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [bookingId]);

  async function load() {
    setLoading(true);
    try {
      const [bRes, pRes] = await Promise.all([
        bookingsApi.getById(bookingId),
        paymentsApi.getBookingPayments(bookingId),
      ]);
      setBooking(bRes.data.data);
      setPayments(pRes.data.data);
    } finally { setLoading(false); }
  }

  function handleCancel() {
    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this booking?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive',
        onPress: async () => {
          try {
            await bookingsApi.cancel(bookingId, 'Cancelled by tenant');
            load();
          } catch {
            Alert.alert('Error', 'Failed to cancel booking');
          }
        },
      },
    ]);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  if (!booking) return null;

  const canCancel = ['PENDING', 'CONFIRMED'].includes(booking.current_booking_lifecycle_state);
  const canFileTicket = booking.current_booking_lifecycle_state === 'CONFIRMED';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.statusRow}>
          <StatusBadge status={booking.current_booking_lifecycle_state} />
          <Text style={styles.bookingId}>#{booking.id.slice(0, 8).toUpperCase()}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Stay Information</Text>
          {[
            ['Check-in Date', new Date(booking.scheduled_check_in_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })],
            ['Monthly Rent', `₹${parseFloat(booking.monthly_rent_amount).toLocaleString('en-IN')}`],
            ['Security Deposit', `₹${parseFloat(booking.security_deposit_amount ?? '0').toLocaleString('en-IN')}`],
            ['Token Paid', `₹${parseFloat(booking.token_fee_amount_paid ?? '0').toLocaleString('en-IN')}`],
          ].map(([label, value]) => (
            <View key={label} style={styles.row}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.value}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment History</Text>
          {payments.length === 0 ? (
            <Text style={styles.emptyText}>No payments recorded yet</Text>
          ) : (
            payments.map((p) => (
              <View key={p.id} style={styles.row}>
                <View>
                  <Text style={styles.value}>{p.financial_payment_purpose.replace(/_/g, ' ')}</Text>
                  <Text style={styles.caption}>{new Date(p.transaction_timestamp).toLocaleDateString('en-IN')}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.value}>₹{parseFloat(p.exact_financial_amount).toLocaleString('en-IN')}</Text>
                  <StatusBadge status={p.transaction_clearance_status} />
                </View>
              </View>
            ))
          )}
        </View>

        {canFileTicket && (
          <Button
            title="🔧  Report a Maintenance Issue"
            variant="outline"
            onPress={() => navigation.navigate('MaintenanceCreate', { bookingId })}
            style={{ marginBottom: Spacing.sm }}
          />
        )}
        {canCancel && (
          <Button title="Cancel Booking" variant="danger" onPress={handleCancel} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.secondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: Spacing.screen, paddingBottom: Spacing.base,
    backgroundColor: Colors.surface.card,
  },
  backIcon: { fontSize: 22, color: Colors.text.primary },
  headerTitle: { ...Typography.h3 },
  scroll: { padding: Spacing.screen },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.base },
  bookingId: { ...Typography.caption, color: Colors.text.tertiary },
  card: { backgroundColor: Colors.surface.card, borderRadius: Radius.xl, padding: Spacing.base, marginBottom: Spacing.base, ...Shadows.sm },
  sectionTitle: { ...Typography.h3, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  label: { ...Typography.bodySmall },
  value: { ...Typography.bodySmall, fontWeight: '600', color: Colors.text.primary },
  caption: { ...Typography.caption, marginTop: 2 },
  emptyText: { ...Typography.bodySmall, color: Colors.text.tertiary, paddingVertical: Spacing.base, textAlign: 'center' },
});
