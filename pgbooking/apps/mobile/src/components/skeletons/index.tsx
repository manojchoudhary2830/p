import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ViewStyle } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../../theme';

// ─────────────────────────────────────────────
// Skeleton Loader (shimmer placeholder)
// ─────────────────────────────────────────────

export function Skeleton({ width = '100%', height = 16, radius = Radius.sm, style }: {
  width?: number | string; height?: number; radius?: number; style?: ViewStyle;
}) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { width: width as never, height, borderRadius: radius, backgroundColor: Colors.border.default, opacity },
        style,
      ]}
    />
  );
}

export function PropertyCardSkeleton() {
  return (
    <View style={skStyles.card}>
      <Skeleton height={160} radius={0} />
      <View style={{ padding: Spacing.base }}>
        <Skeleton width="70%" height={18} style={{ marginBottom: Spacing.sm }} />
        <Skeleton width="40%" height={14} style={{ marginBottom: Spacing.sm }} />
        <Skeleton width="50%" height={14} />
      </View>
    </View>
  );
}

const skStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface.card, borderRadius: Radius.xl,
    overflow: 'hidden', marginBottom: Spacing.base,
  },
});

// ─────────────────────────────────────────────
// Empty State
// ─────────────────────────────────────────────

export function EmptyState({
  icon = '📭', title, subtitle, action,
}: { icon?: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <View style={emptyStyles.container}>
      <Text style={emptyStyles.icon}>{icon}</Text>
      <Text style={emptyStyles.title}>{title}</Text>
      {!!subtitle && <Text style={emptyStyles.subtitle}>{subtitle}</Text>}
      {action}
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl },
  icon: { fontSize: 48, marginBottom: Spacing.base },
  title: { ...Typography.h3, textAlign: 'center', marginBottom: Spacing.xs },
  subtitle: { ...Typography.bodySmall, textAlign: 'center', maxWidth: 280 },
});

// ─────────────────────────────────────────────
// Status Badge
// ─────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING:      { bg: Colors.warningLight, text: Colors.warning },
  CONFIRMED:    { bg: Colors.successLight, text: Colors.success },
  CANCELLED:    { bg: Colors.errorLight,   text: Colors.error },
  CHECKED_OUT:  { bg: Colors.background.tertiary, text: Colors.text.secondary },
  OPEN:         { bg: Colors.warningLight, text: Colors.warning },
  IN_PROGRESS:  { bg: Colors.infoLight,    text: Colors.info },
  RESOLVED:     { bg: Colors.successLight, text: Colors.success },
  CLOSED:       { bg: Colors.background.tertiary, text: Colors.text.secondary },
  SUCCESSFUL:   { bg: Colors.successLight, text: Colors.success },
  FAILED:       { bg: Colors.errorLight,   text: Colors.error },
  VERIFIED:     { bg: Colors.successLight, text: Colors.success },
  UNVERIFIED:   { bg: Colors.warningLight, text: Colors.warning },
  REJECTED:     { bg: Colors.errorLight,   text: Colors.error },
};

export function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? { bg: Colors.background.tertiary, text: Colors.text.secondary };
  return (
    <View style={[badgeStyles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[badgeStyles.text, { color: colors.text }]}>{status.replace(/_/g, ' ')}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, alignSelf: 'flex-start' },
  text: { ...Typography.caption, fontWeight: '700', letterSpacing: 0.3 },
});
