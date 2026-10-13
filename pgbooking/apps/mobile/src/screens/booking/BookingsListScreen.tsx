import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { bookingsApi } from '../../api/services';
import { StatusBadge, EmptyState } from '../../components/skeletons';
import { Button } from '../../components/common/Button';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import type { TenantStackParamList, TenantTabParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<TenantStackParamList>;

interface Booking {
  id: string; current_booking_lifecycle_state: string;
  scheduled_check_in_date: string; monthly_rent_amount: string;
  property_display_name?: string; room_identifier_code?: string;
  bed_spatial_code?: string; created_at: string;
}

// ─────────────────────────────────────────────
// Bookings List Screen
// ─────────────────────────────────────────────

export default function BookingsListScreen() {
  const navigation = useNavigation<Nav>();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await bookingsApi.getMyBookings();
      setBookings(res.data.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchBookings(); }, [fetchBookings]));

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.headerTitle}>My Bookings</Text></View>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBookings(); }} />}
        ListEmptyComponent={
          <EmptyState
            icon="📋" title="No bookings yet"
            subtitle="Browse properties and reserve a bed to see it here"
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
            activeOpacity={0.85}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.propertyName}>{item.property_display_name ?? 'Property'}</Text>
              <Text style={styles.roomInfo}>
                Room {item.room_identifier_code} • Bed {item.bed_spatial_code}
              </Text>
              <Text style={styles.checkIn}>Check-in: {new Date(item.scheduled_check_in_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: Spacing.sm }}>
              <StatusBadge status={item.current_booking_lifecycle_state} />
              <Text style={styles.rent}>₹{parseFloat(item.monthly_rent_amount).toLocaleString('en-IN')}/mo</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.secondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: 56, paddingHorizontal: Spacing.screen, paddingBottom: Spacing.base },
  headerTitle: { ...Typography.h1 },
  list: { padding: Spacing.screen, paddingTop: 0 },
  card: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: Colors.surface.card, borderRadius: Radius.lg,
    padding: Spacing.base, marginBottom: Spacing.sm, ...Shadows.sm,
  },
  propertyName: { ...Typography.h4, marginBottom: 2 },
  roomInfo: { ...Typography.bodySmall, marginBottom: 4 },
  checkIn: { ...Typography.caption },
  rent: { ...Typography.label, color: Colors.primary },
});
