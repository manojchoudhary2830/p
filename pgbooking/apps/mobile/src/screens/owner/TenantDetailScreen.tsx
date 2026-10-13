import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Linking, Alert,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { bookingsApi, paymentsApi } from '../../api/services';
import { StatusBadge } from '../../components/skeletons';
import { Button } from '../../components/common/Button';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import type { OwnerStackParamList } from '../../navigation';

type TenantNav = NativeStackNavigationProp<OwnerStackParamList, 'TenantDetail'>;
type TenantRoute = RouteProp<OwnerStackParamList, 'TenantDetail'>;

// ─────────────────────────────────────────────
// Tenant Detail Screen
// ─────────────────────────────────────────────

export function TenantDetailScreen() {
  const navigation = useNavigation<TenantNav>();
  const route = useRoute<TenantRoute>();
  const { bookingId } = route.params;

  const [booking, setBooking] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      bookingsApi.getById(bookingId),
      paymentsApi.getBookingPayments(bookingId),
    ]).then(([bRes, pRes]) => {
      setBooking(bRes.data.data);
      setPayments(pRes.data.data);
    }).finally(() => setLoading(false));
  }, [bookingId]);

  function handleCheckout() {
    Alert.alert('Checkout Tenant', 'Mark this tenant as checked out? This will release the bed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Checkout', style: 'destructive',
        onPress: async () => {
          setCheckoutLoading(true);
          try {
            await bookingsApi.checkout(bookingId, {
              actual_check_out_date: new Date().toISOString().split('T')[0],
            });
            navigation.goBack();
          } catch {
            Alert.alert('Error', 'Failed to checkout tenant');
          } finally {
            setCheckoutLoading(false);
          }
        },
      },
    ]);
  }

  if (loading || !booking) return <View style={styles.center}><ActivityIndicator color={Colors.secondary} size="large" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Tenant Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <StatusBadge status={booking.current_booking_lifecycle_state} />
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${booking.tenant_phone ?? ''}`)}>
              <Text style={styles.callLink}>📞 Call Tenant</Text>
            </TouchableOpacity>
          </View>
          {[
            ['Check-in Date', new Date(booking.scheduled_check_in_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })],
            ['Monthly Rent', `₹${parseFloat(booking.monthly_rent_amount).toLocaleString('en-IN')}`],
            ['Security Deposit', `₹${parseFloat(booking.security_deposit_amount ?? '0').toLocaleString('en-IN')}`],
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
            <Text style={styles.emptyText}>No payments yet</Text>
          ) : (
            payments.map((p) => (
              <View key={p.id} style={styles.row}>
                <Text style={styles.label}>{p.financial_payment_purpose.replace(/_/g, ' ')}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.value}>₹{parseFloat(p.exact_financial_amount).toLocaleString('en-IN')}</Text>
                  <StatusBadge status={p.transaction_clearance_status} />
                </View>
              </View>
            ))
          )}
        </View>

        {booking.current_booking_lifecycle_state === 'CONFIRMED' && (
          <Button title="Checkout Tenant" variant="danger" onPress={handleCheckout} loading={checkoutLoading} />
        )}
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────
// Maintenance Manage Screen (owner ticket resolution)
// ─────────────────────────────────────────────

type MaintNav = NativeStackNavigationProp<OwnerStackParamList, 'MaintenanceManage'>;
type MaintRoute = RouteProp<OwnerStackParamList, 'MaintenanceManage'>;

const STATUS_FLOW = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export function MaintenanceManageScreen() {
  const navigation = useNavigation<MaintNav>();
  const route = useRoute<MaintRoute>();
  const { ticketId } = route.params;

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => { load(); }, [ticketId]);

  async function load() {
    const { maintenanceApi } = await import('../../api/services');
    const res = await maintenanceApi.getTicket(ticketId);
    setTicket(res.data.data);
    setLoading(false);
  }

  async function updateStatus(status: string) {
    setUpdating(true);
    try {
      const { maintenanceApi } = await import('../../api/services');
      await maintenanceApi.updateStatus(ticketId, status);
      await load();
    } finally {
      setUpdating(false);
    }
  }

  if (loading || !ticket) return <View style={styles.center}><ActivityIndicator color={Colors.secondary} size="large" /></View>;

  const currentIdx = STATUS_FLOW.indexOf(ticket.current_status);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{ticket.title}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <StatusBadge status={ticket.current_status} />
            <Text style={styles.reporterText}>by {ticket.reporter_name}</Text>
          </View>
          <Text style={styles.description}>{ticket.description}</Text>
        </View>

        <Text style={styles.sectionTitle}>Update Status</Text>
        <View style={styles.statusButtons}>
          {STATUS_FLOW.map((s, i) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.statusBtn,
                i === currentIdx && styles.statusBtnCurrent,
                i < currentIdx && styles.statusBtnDone,
              ]}
              onPress={() => updateStatus(s)}
              disabled={updating || i === currentIdx}
            >
              <Text style={[styles.statusBtnText, i <= currentIdx && styles.statusBtnTextActive]}>
                {s.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.secondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: Spacing.screen, paddingBottom: Spacing.base, backgroundColor: Colors.surface.card },
  backIcon: { fontSize: 22 },
  headerTitle: { ...Typography.h4, flex: 1, textAlign: 'center', marginHorizontal: Spacing.sm },
  scroll: { padding: Spacing.screen },
  card: { backgroundColor: Colors.surface.card, borderRadius: Radius.xl, padding: Spacing.base, marginBottom: Spacing.base, ...Shadows.sm },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.base },
  callLink: { ...Typography.bodySmall, color: Colors.secondary, fontWeight: '700' },
  reporterText: { ...Typography.caption },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  label: { ...Typography.bodySmall },
  value: { ...Typography.bodySmall, fontWeight: '600', color: Colors.text.primary },
  sectionTitle: { ...Typography.h3, marginBottom: Spacing.sm },
  description: { ...Typography.body, lineHeight: 22 },
  emptyText: { ...Typography.bodySmall, color: Colors.text.tertiary, textAlign: 'center', paddingVertical: Spacing.base },
  statusButtons: { gap: Spacing.sm },
  statusBtn: { borderWidth: 1.5, borderColor: Colors.border.default, borderRadius: Radius.lg, padding: Spacing.base, alignItems: 'center', backgroundColor: Colors.surface.card },
  statusBtnCurrent: { borderColor: Colors.secondary, backgroundColor: 'rgba(13,148,136,0.08)' },
  statusBtnDone: { borderColor: Colors.success, backgroundColor: Colors.successLight },
  statusBtnText: { ...Typography.label, color: Colors.text.secondary },
  statusBtnTextActive: { color: Colors.text.primary, fontWeight: '700' },
});
