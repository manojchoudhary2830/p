import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, type RouteProp, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { bookingsApi } from '../../api/services';
import { Button } from '../../components/common/Button';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import type { TenantStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<TenantStackParamList, 'BookingSuccess'>;
type Route = RouteProp<TenantStackParamList, 'BookingSuccess'>;

export default function BookingSuccessScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { bookingId } = route.params;
  const [booking, setBooking] = useState<any>(null);

  useEffect(() => {
    bookingsApi.getById(bookingId).then((res) => setBooking(res.data.data)).catch(() => {});
  }, [bookingId]);

  function goHome() {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'TenantTabs', state: { routes: [{ name: 'BookingsTab' }] } }],
      }),
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkIcon}>✓</Text>
        </View>
        <Text style={styles.title}>Booking Confirmed!</Text>
        <Text style={styles.subtitle}>
          Your bed has been reserved successfully. You'll receive a confirmation receipt shortly.
        </Text>

        {booking && (
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Booking ID</Text>
              <Text style={styles.detailValue}>{booking.id?.slice(0, 8).toUpperCase()}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Check-in Date</Text>
              <Text style={styles.detailValue}>
                {new Date(booking.scheduled_check_in_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Monthly Rent</Text>
              <Text style={styles.detailValue}>₹{parseFloat(booking.monthly_rent_amount).toLocaleString('en-IN')}</Text>
            </View>
          </View>
        )}

        <View style={styles.tipBox}>
          <Text style={styles.tipText}>
            💡 Complete your KYC verification before check-in to avoid delays.
          </Text>
        </View>
      </View>

      <View style={styles.cta}>
        <Button title="View Booking Details" variant="outline" onPress={() => navigation.replace('BookingDetail', { bookingId })} />
        <View style={{ height: Spacing.sm }} />
        <Button title="Back to Home" onPress={goHome} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.primary },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.screen },
  checkCircle: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.successLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl,
  },
  checkIcon: { fontSize: 44, color: Colors.success, fontWeight: '700' },
  title: { ...Typography.h1, marginBottom: Spacing.sm, textAlign: 'center' },
  subtitle: { ...Typography.body, textAlign: 'center', marginBottom: Spacing.xl, paddingHorizontal: Spacing.lg },
  detailsCard: {
    width: '100%', backgroundColor: Colors.surface.card, borderRadius: Radius.xl,
    padding: Spacing.base, marginBottom: Spacing.base, ...Shadows.sm,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  detailLabel: { ...Typography.bodySmall },
  detailValue: { ...Typography.bodySmall, fontWeight: '700', color: Colors.text.primary },
  divider: { height: 1, backgroundColor: Colors.border.light },
  tipBox: {
    backgroundColor: Colors.infoLight, borderRadius: Radius.md,
    padding: Spacing.base, width: '100%',
  },
  tipText: { ...Typography.bodySmall, color: Colors.info },
  cta: { padding: Spacing.screen, paddingBottom: Spacing.xl },
});
