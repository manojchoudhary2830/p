import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { logout, toggleDarkMode } from '../../store';
import { authApi } from '../../api/services';
import { StatusBadge } from '../../components/skeletons';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import type { TenantStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<TenantStackParamList>;

const MENU_ITEMS = [
  { icon: '🆔', label: 'KYC Verification', route: 'KycUpload' as const },
  { icon: '❤️', label: 'Favorites', route: 'Favorites' as const },
  { icon: '🔔', label: 'Notifications', route: 'Notifications' as const },
];

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const user = useSelector((s: RootState) => s.auth.user);
  const isDark = useSelector((s: RootState) => s.ui.isDarkMode);

  function handleLogout() {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          try { await authApi.logout(); } catch {}
          dispatch(logout());
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.legal_full_name?.charAt(0)?.toUpperCase() ?? 'U'}</Text>
        </View>
        <Text style={styles.name}>{user?.legal_full_name}</Text>
        <Text style={styles.phone}>{user?.phone_number}</Text>
        <StatusBadge status={user?.identity_kyc_status ?? 'UNVERIFIED'} />
      </View>

      <View style={styles.menuCard}>
        {MENU_ITEMS.map((item, i) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.menuItem, i < MENU_ITEMS.length - 1 && styles.menuItemBorder]}
            onPress={() => navigation.navigate(item.route)}
          >
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.menuCard}>
        <View style={[styles.menuItem, styles.menuItemBorder]}>
          <Text style={styles.menuIcon}>🌙</Text>
          <Text style={styles.menuLabel}>Dark Mode</Text>
          <TouchableOpacity onPress={() => dispatch(toggleDarkMode())}>
            <View style={[styles.toggle, isDark && styles.toggleActive]}>
              <View style={[styles.toggleDot, isDark && styles.toggleDotActive]} />
            </View>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
          <Text style={styles.menuIcon}>🚪</Text>
          <Text style={[styles.menuLabel, { color: Colors.error }]}>Logout</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>PG Booking v1.0.0</Text>
      <View style={{ height: Spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.secondary },
  header: { alignItems: 'center', paddingTop: 64, paddingBottom: Spacing.xl },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  name: { ...Typography.h2, marginBottom: 2 },
  phone: { ...Typography.bodySmall, marginBottom: Spacing.sm },
  menuCard: {
    marginHorizontal: Spacing.screen, backgroundColor: Colors.surface.card,
    borderRadius: Radius.xl, marginBottom: Spacing.base, ...Shadows.sm,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, gap: Spacing.sm },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  menuIcon: { fontSize: 18 },
  menuLabel: { ...Typography.body, flex: 1, color: Colors.text.primary },
  menuArrow: { fontSize: 20, color: Colors.text.tertiary },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: Colors.border.default, padding: 3, justifyContent: 'center' },
  toggleActive: { backgroundColor: Colors.primary },
  toggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleDotActive: { alignSelf: 'flex-end' },
  version: { ...Typography.caption, textAlign: 'center', marginTop: Spacing.base },
});
