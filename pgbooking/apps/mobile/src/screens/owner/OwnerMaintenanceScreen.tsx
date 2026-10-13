import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { maintenanceApi } from '../../api/services';
import { StatusBadge, EmptyState } from '../../components/skeletons';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import type { OwnerStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<OwnerStackParamList>;

interface Ticket {
  id: string; title: string; category: string; current_status: string;
  priority: number; reporter_name: string; property_display_name: string;
  created_at: string;
}

const FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Open', value: 'OPEN' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Resolved', value: 'RESOLVED' },
];

const CATEGORY_ICONS: Record<string, string> = {
  PLUMBING: '🚰', ELECTRICAL: '⚡', FURNITURE: '🪑', CLEANING: '🧹',
  INTERNET: '📶', APPLIANCE: '🔌', SECURITY: '🔒', OTHER: '📋',
};

export default function OwnerMaintenanceScreen() {
  const navigation = useNavigation<Nav>();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | undefined>();

  const fetchTickets = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      const res = await maintenanceApi.getOwnerTickets(1, status);
      setTickets(res.data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchTickets(filter); }, [filter, fetchTickets]));

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.headerTitle}>Maintenance</Text></View>

      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={FILTERS}
        keyExtractor={(item) => item.label}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.chip, filter === item.value && styles.chipActive]}
            onPress={() => setFilter(item.value)}
          >
            <Text style={[styles.chipText, filter === item.value && styles.chipTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.secondary} size="large" /></View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState icon="🔧" title="No tickets found" subtitle="Maintenance requests from tenants will appear here" />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('MaintenanceManage', { ticketId: item.id })}
              activeOpacity={0.85}
            >
              <Text style={styles.categoryIcon}>{CATEGORY_ICONS[item.category] ?? '📋'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.meta}>{item.property_display_name} • by {item.reporter_name}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: Spacing.xs }}>
                <StatusBadge status={item.current_status} />
                {item.priority >= 4 && <Text style={styles.urgentTag}>🔴 Urgent</Text>}
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
  header: { paddingTop: 56, paddingHorizontal: Spacing.screen, paddingBottom: Spacing.sm },
  headerTitle: { ...Typography.h1 },
  filterRow: { paddingHorizontal: Spacing.screen, gap: Spacing.sm, paddingBottom: Spacing.base },
  chip: { backgroundColor: Colors.surface.card, borderRadius: Radius.full, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Colors.border.light },
  chipActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  chipText: { ...Typography.label, color: Colors.text.secondary },
  chipTextActive: { color: '#fff' },
  list: { padding: Spacing.screen, paddingTop: 0 },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface.card, borderRadius: Radius.lg, padding: Spacing.base, marginBottom: Spacing.sm, ...Shadows.sm },
  categoryIcon: { fontSize: 22 },
  title: { ...Typography.label, marginBottom: 2 },
  meta: { ...Typography.caption },
  urgentTag: { ...Typography.caption, color: Colors.error, fontWeight: '700' },
});
