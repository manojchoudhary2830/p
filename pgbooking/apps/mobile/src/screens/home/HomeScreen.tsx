import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Platform, PermissionsAndroid,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import Geolocation from '@react-native-community/geolocation';
import { RootState } from '../../store';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { setSearchResults, setSearchLoading } from '../../store';
import { propertiesApi, notificationsApi } from '../../api/services';
import { PropertyCard } from '../../components/cards/PropertyCard';
import { PropertyCardSkeleton, EmptyState } from '../../components/skeletons';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import type { TenantStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<TenantStackParamList>;

const QUICK_FILTERS = [
  { label: 'Co-Living', value: 'CO_LIVING' },
  { label: 'Male Only', value: 'MALE' },
  { label: 'Female Only', value: 'FEMALE' },
];

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const user = useSelector((s: RootState) => s.auth.user);
  const { searchResults, searchLoading } = useSelector((s: RootState) => s.property);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    requestLocationAndFetch();
    fetchUnreadCount();
  }, []);

  async function requestLocationAndFetch() {
    if (Platform.OS === 'android') {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    }
    Geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        fetchNearby(c);
      },
      () => {
        // Fallback: Bengaluru center
        const c = { lat: 12.9716, lng: 77.5946 };
        setCoords(c);
        fetchNearby(c);
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  async function fetchNearby(c: { lat: number; lng: number }, genderFilter?: string) {
    dispatch(setSearchLoading(true));
    try {
      const res = await propertiesApi.search({
        lat: c.lat, lng: c.lng, radius_km: 10,
        gender_policy: genderFilter, limit: 10,
      });
      dispatch(setSearchResults(res.data));
    } catch {
      dispatch(setSearchLoading(false));
    }
  }

  async function fetchUnreadCount() {
    try {
      const res = await notificationsApi.getUnreadCount();
      setUnreadCount(res.data.data.unread_count);
    } catch {}
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (coords) await fetchNearby(coords);
    await fetchUnreadCount();
    setRefreshing(false);
  }, [coords]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.legal_full_name?.split(' ')[0] ?? 'there'} 👋</Text>
          <Text style={styles.subGreeting}>Find your perfect PG today</Text>
        </View>
        <TouchableOpacity style={styles.bellBtn} onPress={() => navigation.navigate('Notifications')}>
          <Text style={styles.bellIcon}>🔔</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <TouchableOpacity
        style={styles.searchBar}
        onPress={() => navigation.getParent()?.navigate('SearchTab' as never)}
        activeOpacity={0.8}
      >
        <Text style={styles.searchIcon}>🔍</Text>
        <Text style={styles.searchPlaceholder}>Search by location, college, tech park...</Text>
      </TouchableOpacity>

      {/* Quick Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersRow} contentContainerStyle={{ gap: Spacing.sm, paddingHorizontal: Spacing.screen }}>
        {QUICK_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={styles.filterChip}
            onPress={() => coords && fetchNearby(coords, f.value)}
          >
            <Text style={styles.filterChipText}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Map CTA */}
      <TouchableOpacity
        style={styles.mapCta}
        onPress={() => navigation.navigate('MapView', { lat: coords?.lat, lng: coords?.lng })}
      >
        <Text style={styles.mapCtaText}>🗺  View on map</Text>
      </TouchableOpacity>

      {/* Nearby Properties */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nearby PGs</Text>
        {searchLoading ? (
          <>
            <PropertyCardSkeleton />
            <PropertyCardSkeleton />
          </>
        ) : searchResults.length === 0 ? (
          <EmptyState icon="🏠" title="No properties found nearby" subtitle="Try expanding your search radius" />
        ) : (
          searchResults.map((p) => (
            <PropertyCard
              key={p.id}
              id={p.id}
              name={p.property_display_name}
              city={p.municipality_city}
              genderPolicy={p.gender_segregation_policy}
              minRent={p.min_rent}
              maxRent={p.max_rent}
              vacantBeds={p.vacant_beds}
              distanceKm={p.distance_km}
              coverPhotoUrl={p.cover_photo_url}
              avgRating={p.avg_rating}
              onPress={() => navigation.navigate('PropertyDetail', { propertyId: p.id })}
            />
          ))
        )}
      </View>
      <View style={{ height: Spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.secondary },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 56, paddingHorizontal: Spacing.screen, paddingBottom: Spacing.base,
  },
  greeting: { ...Typography.h2, fontSize: 20 },
  subGreeting: { ...Typography.bodySmall, marginTop: 2 },
  bellBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface.card, alignItems: 'center', justifyContent: 'center' },
  bellIcon: { fontSize: 18 },
  badge: { position: 'absolute', top: 4, right: 4, backgroundColor: Colors.error, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.screen, backgroundColor: Colors.surface.card,
    borderRadius: Radius.lg, height: 52, paddingHorizontal: Spacing.base,
    marginBottom: Spacing.base, borderWidth: 1, borderColor: Colors.border.light,
  },
  searchIcon: { fontSize: 16 },
  searchPlaceholder: { ...Typography.body, color: Colors.text.tertiary },
  filtersRow: { marginBottom: Spacing.base },
  filterChip: { backgroundColor: Colors.surface.card, borderRadius: Radius.full, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Colors.border.light },
  filterChipText: { ...Typography.label, color: Colors.primary },
  mapCta: { marginHorizontal: Spacing.screen, backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center', marginBottom: Spacing.xl },
  mapCtaText: { ...Typography.button, color: Colors.text.inverse },
  section: { paddingHorizontal: Spacing.screen },
  sectionTitle: { ...Typography.h2, marginBottom: Spacing.base },
});
