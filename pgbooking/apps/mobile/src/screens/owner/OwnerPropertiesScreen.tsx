import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { propertiesApi } from '../../api/services';
import { StatusBadge, EmptyState } from '../../components/skeletons';
import { Button } from '../../components/common/Button';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import type { OwnerStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<OwnerStackParamList>;

interface Property {
  id: string; property_display_name: string; municipality_city: string;
  verification_status: string; total_beds: number; vacant_beds: number;
  min_rent: number; max_rent: number; photo_count: number;
}

export default function OwnerPropertiesScreen() {
  const navigation = useNavigation<Nav>();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      const res = await propertiesApi.getMyProperties();
      setProperties(res.data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchProperties(); }, [fetchProperties]));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Properties</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('PropertyCreate')}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.secondary} size="large" /></View>
      ) : (
        <FlatList
          data={properties}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="🏢" title="No properties yet"
              subtitle="Add your first property to start accepting bookings"
              action={<Button title="Add Property" onPress={() => navigation.navigate('PropertyCreate')} fullWidth={false} style={{ marginTop: Spacing.base }} />}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('PropertyManage', { propertyId: item.id })}
              activeOpacity={0.85}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.propertyName} numberOfLines={1}>{item.property_display_name}</Text>
                <StatusBadge status={item.verification_status} />
              </View>
              <Text style={styles.city}>{item.municipality_city}</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{item.total_beds}</Text>
                  <Text style={styles.statLabel}>Total Beds</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: Colors.success }]}>{item.total_beds - item.vacant_beds}</Text>
                  <Text style={styles.statLabel}>Occupied</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: Colors.warning }]}>{item.vacant_beds}</Text>
                  <Text style={styles.statLabel}>Vacant</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>₹{(item.min_rent / 1000).toFixed(0)}k+</Text>
                  <Text style={styles.statLabel}>Rent</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.secondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 56, paddingHorizontal: Spacing.screen, paddingBottom: Spacing.base },
  headerTitle: { ...Typography.h1 },
  addBtn: { backgroundColor: Colors.secondary, borderRadius: Radius.full, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  addBtnText: { ...Typography.label, color: '#fff' },
  list: { padding: Spacing.screen, paddingTop: 0 },
  card: { backgroundColor: Colors.surface.card, borderRadius: Radius.xl, padding: Spacing.base, marginBottom: Spacing.base, ...Shadows.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  propertyName: { ...Typography.h4, flex: 1, marginRight: Spacing.sm },
  city: { ...Typography.bodySmall, marginBottom: Spacing.base },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border.light },
  statItem: { alignItems: 'center' },
  statValue: { ...Typography.h4, color: Colors.text.primary },
  statLabel: { ...Typography.caption, marginTop: 2 },
});
