import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Geolocation from '@react-native-community/geolocation';
import { propertiesApi } from '../../api/services';
import { PropertyCard } from '../../components/cards/PropertyCard';
import { PropertyCardSkeleton, EmptyState } from '../../components/skeletons';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import type { TenantStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<TenantStackParamList>;

const GENDER_OPTIONS = [
  { label: 'All', value: undefined },
  { label: 'Co-Living', value: 'CO_LIVING' },
  { label: 'Male', value: 'MALE' },
  { label: 'Female', value: 'FEMALE' },
];

const RENT_RANGES = [
  { label: 'Any Budget', min: undefined, max: undefined },
  { label: 'Under ₹8k', min: undefined, max: 8000 },
  { label: '₹8k–15k', min: 8000, max: 15000 },
  { label: '₹15k+', min: 15000, max: undefined },
];

export default function SearchScreen() {
  const navigation = useNavigation<Nav>();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [genderFilter, setGenderFilter] = useState<string | undefined>();
  const [rentFilter, setRentFilter] = useState(0);
  const [radius, setRadius] = useState(5);

  useEffect(() => {
    Geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => setCoords({ lat: 12.9716, lng: 77.5946 }),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, []);

  const search = useCallback(async () => {
    if (!coords) return;
    setLoading(true);
    try {
      const res = await propertiesApi.search({
        lat: coords.lat, lng: coords.lng, radius_km: radius,
        gender_policy: genderFilter,
        min_rent: RENT_RANGES[rentFilter].min,
        max_rent: RENT_RANGES[rentFilter].max,
        limit: 30,
      });
      setResults(res.data.data);
    } finally {
      setLoading(false);
    }
  }, [coords, genderFilter, rentFilter, radius]);

  useEffect(() => { search(); }, [search]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
        <TouchableOpacity onPress={() => navigation.navigate('MapView', { lat: coords?.lat, lng: coords?.lng })}>
          <Text style={styles.mapIcon}>🗺</Text>
        </TouchableOpacity>
      </View>

      {/* Gender Filter */}
      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={GENDER_OPTIONS}
        keyExtractor={(item) => item.label}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.chip, genderFilter === item.value && styles.chipActive]}
            onPress={() => setGenderFilter(item.value)}
          >
            <Text style={[styles.chipText, genderFilter === item.value && styles.chipTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Rent Filter */}
      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={RENT_RANGES}
        keyExtractor={(item) => item.label}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[styles.chip, rentFilter === index && styles.chipActive]}
            onPress={() => setRentFilter(index)}
          >
            <Text style={[styles.chipText, rentFilter === index && styles.chipTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Results */}
      <FlatList
        data={loading ? [] : results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.resultsList}
        ListHeaderComponent={
          !loading ? <Text style={styles.resultCount}>{results.length} properties found within {radius}km</Text> : null
        }
        ListEmptyComponent={
          loading ? (
            <>
              <PropertyCardSkeleton /><PropertyCardSkeleton /><PropertyCardSkeleton />
            </>
          ) : (
            <EmptyState icon="🔍" title="No matches found" subtitle="Try adjusting your filters or search radius" />
          )
        }
        renderItem={({ item }) => (
          <PropertyCard
            id={item.id} name={item.property_display_name} city={item.municipality_city}
            genderPolicy={item.gender_segregation_policy} minRent={item.min_rent} maxRent={item.max_rent}
            vacantBeds={item.vacant_beds} distanceKm={item.distance_km} coverPhotoUrl={item.cover_photo_url}
            avgRating={item.avg_rating}
            onPress={() => navigation.navigate('PropertyDetail', { propertyId: item.id })}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.secondary },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 56, paddingHorizontal: Spacing.screen, paddingBottom: Spacing.sm,
  },
  headerTitle: { ...Typography.h1 },
  mapIcon: { fontSize: 22 },
  filterRow: { paddingHorizontal: Spacing.screen, gap: Spacing.sm, paddingBottom: Spacing.sm },
  chip: { backgroundColor: Colors.surface.card, borderRadius: Radius.full, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Colors.border.light },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Typography.label, color: Colors.text.secondary },
  chipTextActive: { color: Colors.text.inverse },
  resultsList: { padding: Spacing.screen, paddingTop: Spacing.sm },
  resultCount: { ...Typography.bodySmall, marginBottom: Spacing.base },
});
