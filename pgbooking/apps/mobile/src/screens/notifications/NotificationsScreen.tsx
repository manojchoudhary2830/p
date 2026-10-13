import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { notificationsApi } from '../../api/services';
import { EmptyState } from '../../components/skeletons';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import type { TenantStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<TenantStackParamList, 'Notifications'>;

interface Notification {
  id: string; type: string; title: string; body: string;
  is_read: boolean; created_at: string; data: Record<string, unknown> | null;
}

const TYPE_ICONS: Record<string, string> = {
  BOOKING_CREATED: '📋', BOOKING_CONFIRMED: '✅', BOOKING_CANCELLED: '❌',
  PAYMENT_RECEIVED: '💳', PAYMENT_DUE: '⏰', PAYMENT_OVERDUE: '🚨',
  MAINTENANCE_CREATED: '🔧', MAINTENANCE_UPDATED: '🔧',
  KYC_APPROVED: '✅', KYC_REJECTED: '❌', RENT_INVOICE: '🧾', GENERAL: '📢',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    const res = await notificationsApi.getAll();
    setNotifications(res.data.data);
  }, []);

  useFocusEffect(useCallback(() => { fetchNotifications(); }, [fetchNotifications]));

  async function handlePress(item: Notification) {
    if (!item.is_read) {
      await notificationsApi.markRead([item.id]);
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
    }
    const bookingId = item.data?.booking_id as string | undefined;
    const ticketId = item.data?.ticket_id as string | undefined;
    if (bookingId) navigation.navigate('BookingDetail', { bookingId });
    else if (ticketId) navigation.navigate('MaintenanceDetail', { ticketId });
  }

  async function handleMarkAllRead() {
    await notificationsApi.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead}><Text style={styles.markAllText}>Mark all read</Text></TouchableOpacity>
        ) : <View style={{ width: 60 }} />}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchNotifications(); setRefreshing(false); }} />}
        ListEmptyComponent={<EmptyState icon="🔔" title="No notifications yet" subtitle="We'll let you know when something happens" />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, !item.is_read && styles.itemUnread]}
            onPress={() => handlePress(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.itemIcon}>{TYPE_ICONS[item.type] ?? '📢'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemBody} numberOfLines={2}>{item.body}</Text>
              <Text style={styles.itemTime}>{timeAgo(item.created_at)}</Text>
            </View>
            {!item.is_read && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.secondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: Spacing.screen, paddingBottom: Spacing.base, backgroundColor: Colors.surface.card },
  backIcon: { fontSize: 22 },
  headerTitle: { ...Typography.h3 },
  markAllText: { ...Typography.bodySmall, color: Colors.primary, fontWeight: '600' },
  list: { padding: Spacing.screen },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: Colors.surface.card, borderRadius: Radius.lg, padding: Spacing.base, marginBottom: Spacing.sm },
  itemUnread: { backgroundColor: 'rgba(30,58,138,0.04)', borderWidth: 1, borderColor: 'rgba(30,58,138,0.15)' },
  itemIcon: { fontSize: 20 },
  itemTitle: { ...Typography.label, marginBottom: 2 },
  itemBody: { ...Typography.bodySmall, marginBottom: 4 },
  itemTime: { ...Typography.caption },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 4 },
});
