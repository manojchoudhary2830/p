import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ownerApi } from '../../api/services';
import { StatusBadge, EmptyState } from '../../components/skeletons';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import type { OwnerStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<OwnerStackParamList>;

interface Tenant {
  id: string; legal_full_name: string; phone_number: string; identity_kyc_status: string;
  booking_id: string; booking_status: string; monthly_rent_amount: string;
  property_display_name: string; room_identifier_code: string; bed_spatial_code: string;
}

export default function OwnerTenantsScreen() {
  const navigation = useNavigation<Nav>();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ownerApi.getTenants();
      setTenants(res.data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchTenants(); }, [fetchTenants]));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tenants</Text>
        <Text style={styles.headerCount}>{tenants.length} active</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.secondary} size="large" /></View>
      ) : (
        <FlatList
          data={tenants}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState icon="👥" title="No active tenants" subtitle="Confirmed bookings will appear here" />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('TenantDetail', { tenantId: item.id, bookingId: item.booking_id })}
              activeOpacity={0.85}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.legal_full_name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.legal_full_name}</Text>
                <Text style={styles.meta}>{item.property_display_name} • Room {item.room_identifier_code}, Bed {item.bed_spatial_code}</Text>
                <View style={styles.bottomRow}>
                  <StatusBadge status={item.identity_kyc_status} />
                  <Text style={styles.rent}>₹{parseFloat(item.monthly_rent_amount).toLocaleString('en-IN')}/mo</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${item.phone_number}`)} hitSlop={8}>
                <Text style={styles.callIcon}>📞</Text>
              </TouchableOpacity>
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
  headerCount: { ...Typography.bodySmall },
  list: { padding: Spacing.screen, paddingTop: 0 },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface.card, borderRadius: Radius.lg, padding: Spacing.base, marginBottom: Spacing.sm, ...Shadows.sm },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  name: { ...Typography.label, marginBottom: 2 },
  meta: { ...Typography.caption, marginBottom: Spacing.xs },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rent: { ...Typography.bodySmall, color: Colors.primary, fontWeight: '700' },
  callBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.successLight, alignItems: 'center', justifyContent: 'center' },
  callIcon: { fontSize: 16 },
});
