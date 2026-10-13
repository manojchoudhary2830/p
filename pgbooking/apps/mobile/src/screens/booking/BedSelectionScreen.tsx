import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Animated, Alert,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { setBookingInitiation } from '../../store';
import { roomsApi, bookingsApi } from '../../api/services';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import type { TenantStackParamList } from '../../navigation';
import { v4 as uuidv4 } from 'uuid';

type Nav = NativeStackNavigationProp<TenantStackParamList, 'BedSelection'>;
type Route = RouteProp<TenantStackParamList, 'BedSelection'>;

interface Bed { id: string; bed_spatial_code: string; current_occupancy_status: 'VACANT' | 'RESERVED' | 'OCCUPIED' }
interface Room {
  id: string; room_identifier_code: string; floor_level_index: number;
  max_occupancy_sharing_limit: number; standard_monthly_rent_amount: string;
  required_security_deposit_amount: string; token_deposit_amount: string;
  beds: Bed[];
}

export default function BedSelectionScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const dispatch = useAppDispatch();
  const { propertyId, roomId, propertyName } = route.params;

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [checkIn, setCheckIn] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0],
  );

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchRoom();
  }, []);

  useEffect(() => {
    if (selectedBedId) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [selectedBedId]);

  async function fetchRoom() {
    try {
      const res = await roomsApi.get(propertyId, roomId);
      setRoom(res.data.data);
    } catch {
      Alert.alert('Error', 'Failed to load room details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!selectedBedId || !room) return;
    setBooking(true);
    const idempotencyKey = `bed-select-${selectedBedId}-${Date.now()}`;
    try {
      const res = await bookingsApi.initiate(
        { bed_id: selectedBedId, intended_check_in: checkIn },
        idempotencyKey,
      );
      const data = res.data.data;
      dispatch(setBookingInitiation({
        bookingId: data.booking_id,
        lockExpirationTimestamp: data.lock_expiration_timestamp,
        requiredTokenAmount: data.required_token_amount,
        monthlyRent: data.monthly_rent,
        securityDeposit: data.security_deposit,
        propertyName: data.property_name,
        roomCode: data.room_code,
        bedCode: data.bed_code,
      }));
      navigation.navigate('Checkout', { bookingInitiation: {
        bookingId: data.booking_id,
        lockExpirationTimestamp: data.lock_expiration_timestamp,
        requiredTokenAmount: data.required_token_amount,
        monthlyRent: data.monthly_rent,
        securityDeposit: data.security_deposit,
        propertyName: data.property_name,
        roomCode: data.room_code,
        bedCode: data.bed_code,
      }});
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      Alert.alert('Booking Failed', msg ?? 'This bed is no longer available. Please select another.');
      fetchRoom(); // Refresh availability
      setSelectedBedId(null);
    } finally {
      setBooking(false);
    }
  }

  function getBedStyle(bed: Bed) {
    if (bed.current_occupancy_status === 'OCCUPIED') return styles.bedOccupied;
    if (bed.current_occupancy_status === 'RESERVED') return styles.bedReserved;
    if (bed.id === selectedBedId) return styles.bedSelected;
    return styles.bedVacant;
  }

  function getBedTextStyle(bed: Bed) {
    if (bed.current_occupancy_status === 'OCCUPIED') return styles.bedTextOccupied;
    if (bed.id === selectedBedId) return styles.bedTextSelected;
    return styles.bedTextVacant;
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  if (!room) return null;

  const vacantCount = room.beds.filter((b) => b.current_occupancy_status === 'VACANT').length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Room {room.room_identifier_code}</Text>
          <Text style={styles.headerSubtitle}>{propertyName}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Room Info Card */}
        <View style={styles.roomCard}>
          <View style={styles.roomStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>₹{parseFloat(room.standard_monthly_rent_amount).toLocaleString('en-IN')}</Text>
              <Text style={styles.statLabel}>/ month</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{room.max_occupancy_sharing_limit}</Text>
              <Text style={styles.statLabel}>Sharing</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: vacantCount > 0 ? Colors.success : Colors.error }]}>
                {vacantCount}
              </Text>
              <Text style={styles.statLabel}>Available</Text>
            </View>
          </View>
          <View style={styles.depositRow}>
            <Text style={styles.depositLabel}>Token Deposit:</Text>
            <Text style={styles.depositValue}>₹{parseFloat(room.token_deposit_amount).toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          {[
            { color: Colors.bed.vacant, label: 'Available', border: Colors.border.default },
            { color: Colors.bed.selected, label: 'Selected', border: Colors.primary },
            { color: Colors.bed.reserved, label: 'Reserved', border: Colors.warning },
            { color: Colors.bed.occupied, label: 'Occupied', border: Colors.border.strong },
          ].map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color, borderColor: item.border }]} />
              <Text style={styles.legendLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Bed Grid — Interactive Floorplan (from UX Brief) */}
        <Text style={styles.sectionTitle}>Select a Bed</Text>
        <View style={styles.bedGrid}>
          {room.beds.map((bed) => {
            const isOccupied = bed.current_occupancy_status !== 'VACANT';
            const isSelected = bed.id === selectedBedId;

            return (
              <Animated.View
                key={bed.id}
                style={[{ transform: [{ scale: isSelected ? pulseAnim : 1 }] }]}
              >
                <TouchableOpacity
                  style={[styles.bedCard, getBedStyle(bed)]}
                  onPress={() => !isOccupied && setSelectedBedId(isSelected ? null : bed.id)}
                  disabled={isOccupied}
                  activeOpacity={0.8}
                >
                  <Text style={styles.bedIcon}>🛏</Text>
                  <Text style={[styles.bedCode, getBedTextStyle(bed)]}>
                    {bed.bed_spatial_code}
                  </Text>
                  {isOccupied && (
                    <View style={styles.occupiedBadge}>
                      <Text style={styles.occupiedBadgeText}>
                        {bed.current_occupancy_status === 'RESERVED' ? 'Reserved' : 'Occupied'}
                      </Text>
                    </View>
                  )}
                  {isSelected && (
                    <View style={styles.selectedRing} />
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom CTA */}
      {selectedBedId && (
        <View style={styles.ctaContainer}>
          <View style={styles.ctaSummary}>
            <Text style={styles.ctaLabel}>Selected: Bed {room.beds.find((b) => b.id === selectedBedId)?.bed_spatial_code}</Text>
            <Text style={styles.ctaPrice}>Token: ₹{parseFloat(room.token_deposit_amount).toLocaleString('en-IN')}</Text>
          </View>
          <TouchableOpacity
            style={[styles.ctaButton, booking && styles.ctaButtonDisabled]}
            onPress={handleConfirm}
            disabled={booking}
            activeOpacity={0.85}
          >
            {booking ? (
              <ActivityIndicator color={Colors.text.inverse} />
            ) : (
              <Text style={styles.ctaButtonText}>Reserve Bed →</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.secondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 56,
    paddingHorizontal: Spacing.screen, paddingBottom: Spacing.base,
    backgroundColor: Colors.primary,
  },
  backBtn: { padding: Spacing.sm, marginRight: Spacing.sm },
  backText: { fontSize: 24, color: Colors.text.inverse },
  headerInfo: { flex: 1 },
  headerTitle: { ...Typography.h2, color: Colors.text.inverse, fontSize: 18 },
  headerSubtitle: { ...Typography.bodySmall, color: 'rgba(255,255,255,0.75)' },
  scrollContent: { padding: Spacing.screen },
  roomCard: {
    backgroundColor: Colors.surface.card, borderRadius: Radius.xl,
    padding: Spacing.base, marginBottom: Spacing.base, ...Shadows.md,
  },
  roomStats: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { ...Typography.h3, color: Colors.primary },
  statLabel: { ...Typography.caption, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.border.light },
  depositRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border.light },
  depositLabel: { ...Typography.bodySmall, color: Colors.text.secondary },
  depositValue: { ...Typography.bodySmall, color: Colors.secondary, fontWeight: '700' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.base },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  legendDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  legendLabel: { ...Typography.caption, color: Colors.text.secondary },
  sectionTitle: { ...Typography.h2, marginBottom: Spacing.sm },
  bedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  bedCard: {
    width: 90, height: 90, borderRadius: Radius.lg, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', padding: Spacing.xs,
    position: 'relative', overflow: 'hidden',
  },
  bedVacant: { backgroundColor: Colors.bed.vacant, borderColor: Colors.border.default },
  bedSelected: { backgroundColor: Colors.bed.selected, borderColor: Colors.primary, borderWidth: 2.5 },
  bedReserved: { backgroundColor: Colors.bed.reserved, borderColor: Colors.warning },
  bedOccupied: { backgroundColor: Colors.bed.occupied, borderColor: Colors.border.strong },
  bedIcon: { fontSize: 24, marginBottom: 2 },
  bedCode: { ...Typography.label, fontWeight: '700' },
  bedTextVacant: { color: Colors.text.primary },
  bedTextSelected: { color: Colors.primary },
  bedTextOccupied: { color: Colors.text.tertiary },
  occupiedBadge: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.35)', paddingVertical: 2,
  },
  occupiedBadgeText: { ...Typography.caption, color: '#fff', textAlign: 'center' },
  selectedRing: {
    position: 'absolute', top: -2, left: -2, right: -2, bottom: -2,
    borderRadius: Radius.lg + 2, borderWidth: 2, borderColor: Colors.secondary,
  },
  ctaContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface.card, padding: Spacing.base,
    paddingBottom: Spacing.xl, ...Shadows.lg,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
  },
  ctaSummary: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  ctaLabel: { ...Typography.label, color: Colors.text.secondary },
  ctaPrice: { ...Typography.label, color: Colors.secondary, fontWeight: '700' },
  ctaButton: {
    height: 56, backgroundColor: Colors.secondary,
    borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center',
  },
  ctaButtonDisabled: { opacity: 0.6 },
  ctaButtonText: { ...Typography.button, color: Colors.text.inverse },
});
