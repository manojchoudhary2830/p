import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, Dimensions } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import { LineChart } from 'react-native-chart-kit';
import { RootState } from '../../store';
import { ownerApi } from '../../api/services';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import type { OwnerStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<OwnerStackParamList>;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Dashboard {
  properties: { total: number; total_beds: number; vacant_beds: number; occupied_beds: number; occupancy_rate_percent: number };
  revenue: { this_month_inr: number; last_month_inr: number };
  pending_actions: { open_maintenance: number; pending_bookings: number };
}

export default function OwnerDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const user = useSelector((s: RootState) => s.auth.user);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [revenueChart, setRevenueChart] = useState<{ month: string; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, revRes] = await Promise.all([
        ownerApi.getDashboard(),
        ownerApi.getRevenue(6),
      ]);
      setDashboard(dashRes.data.data);
      setRevenueChart(revRes.data.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  if (loading || !dashboard) {
    return <View style={styles.center}><ActivityIndicator color={Colors.secondary} size="large" /></View>;
  }

  const revenueChange = dashboard.revenue.last_month_inr > 0
    ? ((dashboard.revenue.this_month_inr - dashboard.revenue.last_month_inr) / dashboard.revenue.last_month_inr) * 100
    : 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={Colors.secondary} />}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back, {user?.legal_full_name?.split(' ')[0]}</Text>
        <Text style={styles.subGreeting}>Here's how your properties are doing</Text>
      </View>

      {/* Revenue Card */}
      <View style={styles.revenueCard}>
        <Text style={styles.revenueLabel}>This Month's Revenue</Text>
        <Text style={styles.revenueValue}>₹{dashboard.revenue.this_month_inr.toLocaleString('en-IN')}</Text>
        <View style={styles.revenueChangeRow}>
          <Text style={[styles.revenueChange, { color: revenueChange >= 0 ? '#fff' : '#FCA5A5' }]}>
            {revenueChange >= 0 ? '↑' : '↓'} {Math.abs(revenueChange).toFixed(1)}% vs last month
          </Text>
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{dashboard.properties.total}</Text>
          <Text style={styles.statLabel}>Properties</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: Colors.success }]}>{dashboard.properties.occupied_beds}</Text>
          <Text style={styles.statLabel}>Occupied Beds</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: Colors.warning }]}>{dashboard.properties.vacant_beds}</Text>
          <Text style={styles.statLabel}>Vacant Beds</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{dashboard.properties.occupancy_rate_percent}%</Text>
          <Text style={styles.statLabel}>Occupancy</Text>
        </View>
      </View>

      {/* Revenue Chart */}
      {revenueChart.length > 1 && (
        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>Revenue Trend</Text>
          <LineChart
            data={{
              labels: revenueChart.map((r) => r.month.slice(5)),
              datasets: [{ data: revenueChart.map((r) => r.revenue) }],
            }}
            width={SCREEN_WIDTH - Spacing.screen * 2 - Spacing.base * 2}
            height={180}
            yAxisLabel="₹"
            chartConfig={{
              backgroundColor: Colors.surface.card,
              backgroundGradientFrom: Colors.surface.card,
              backgroundGradientTo: Colors.surface.card,
              decimalPlaces: 0,
              color: () => Colors.secondary,
              labelColor: () => Colors.text.secondary,
              propsForDots: { r: '4', fill: Colors.secondary },
            }}
            bezier
            style={{ borderRadius: Radius.lg }}
          />
        </View>
      )}

      {/* Pending Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Needs Attention</Text>
        <View style={styles.actionCard}>
          <Text style={styles.actionIcon}>🔧</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Open Maintenance Tickets</Text>
            <Text style={styles.actionSubtitle}>{dashboard.pending_actions.open_maintenance} tickets need your review</Text>
          </View>
          <Text style={styles.actionCount}>{dashboard.pending_actions.open_maintenance}</Text>
        </View>
        <View style={styles.actionCard}>
          <Text style={styles.actionIcon}>📋</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Pending Bookings</Text>
            <Text style={styles.actionSubtitle}>Reservations awaiting payment</Text>
          </View>
          <Text style={styles.actionCount}>{dashboard.pending_actions.pending_bookings}</Text>
        </View>
      </View>

      <View style={{ height: Spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.secondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: 56, paddingHorizontal: Spacing.screen, paddingBottom: Spacing.base },
  greeting: { ...Typography.h2 },
  subGreeting: { ...Typography.bodySmall, marginTop: 2 },
  revenueCard: { marginHorizontal: Spacing.screen, backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: Spacing.xl, marginBottom: Spacing.base },
  revenueLabel: { ...Typography.bodySmall, color: 'rgba(255,255,255,0.8)' },
  revenueValue: { fontSize: 32, fontWeight: '800', color: '#fff', marginTop: 4 },
  revenueChangeRow: { marginTop: Spacing.xs },
  revenueChange: { ...Typography.bodySmall, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.screen, gap: Spacing.sm, marginBottom: Spacing.base },
  statCard: { width: '47%', backgroundColor: Colors.surface.card, borderRadius: Radius.lg, padding: Spacing.base, ...Shadows.sm },
  statValue: { ...Typography.h2, color: Colors.primary },
  statLabel: { ...Typography.bodySmall, marginTop: 2 },
  chartCard: { marginHorizontal: Spacing.screen, backgroundColor: Colors.surface.card, borderRadius: Radius.xl, padding: Spacing.base, marginBottom: Spacing.base, ...Shadows.sm },
  section: { paddingHorizontal: Spacing.screen },
  sectionTitle: { ...Typography.h3, marginBottom: Spacing.sm },
  actionCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface.card, borderRadius: Radius.lg, padding: Spacing.base, marginBottom: Spacing.sm, ...Shadows.sm },
  actionIcon: { fontSize: 22 },
  actionTitle: { ...Typography.label },
  actionSubtitle: { ...Typography.caption, marginTop: 2 },
  actionCount: { ...Typography.h3, color: Colors.secondary },
});
