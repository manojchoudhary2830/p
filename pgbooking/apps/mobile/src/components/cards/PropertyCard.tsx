import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';

interface PropertyCardProps {
  id: string;
  name: string;
  city: string;
  genderPolicy: string;
  minRent: number;
  maxRent: number;
  vacantBeds: number;
  distanceKm?: number;
  coverPhotoUrl: string | null;
  avgRating?: number | null;
  isFavorite?: boolean;
  onPress: () => void;
  onToggleFavorite?: () => void;
}

const GENDER_LABELS: Record<string, string> = {
  MALE: 'Male Only', FEMALE: 'Female Only', CO_LIVING: 'Co-Living',
};

export function PropertyCard({
  name, city, genderPolicy, minRent, maxRent, vacantBeds,
  distanceKm, coverPhotoUrl, avgRating, isFavorite, onPress, onToggleFavorite,
}: PropertyCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageContainer}>
        {coverPhotoUrl ? (
          <Image source={{ uri: coverPhotoUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.imagePlaceholderText}>🏠</Text>
          </View>
        )}
        {onToggleFavorite && (
          <TouchableOpacity style={styles.favoriteBtn} onPress={onToggleFavorite} hitSlop={8}>
            <Text style={styles.favoriteIcon}>{isFavorite ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
        )}
        {typeof distanceKm === 'number' && (
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceText}>{distanceKm.toFixed(1)} km</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {!!avgRating && (
            <View style={styles.ratingPill}>
              <Text style={styles.ratingText}>★ {avgRating.toFixed(1)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.city} numberOfLines={1}>{city}</Text>

        <View style={styles.tagsRow}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{GENDER_LABELS[genderPolicy] ?? genderPolicy}</Text>
          </View>
          <View style={[styles.tag, vacantBeds > 0 ? styles.tagSuccess : styles.tagError]}>
            <Text style={[styles.tagText, vacantBeds > 0 ? styles.tagTextSuccess : styles.tagTextError]}>
              {vacantBeds > 0 ? `${vacantBeds} beds left` : 'Full'}
            </Text>
          </View>
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>₹{minRent.toLocaleString('en-IN')}</Text>
          {maxRent > minRent && (
            <Text style={styles.priceRange}> – ₹{maxRent.toLocaleString('en-IN')}</Text>
          )}
          <Text style={styles.priceUnit}> /month</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface.card, borderRadius: Radius.xl,
    overflow: 'hidden', marginBottom: Spacing.base, ...Shadows.sm,
  },
  imageContainer: { height: 160, position: 'relative' },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { backgroundColor: Colors.background.tertiary, alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { fontSize: 36 },
  favoriteBtn: {
    position: 'absolute', top: Spacing.sm, right: Spacing.sm,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
  },
  favoriteIcon: { fontSize: 15 },
  distanceBadge: {
    position: 'absolute', bottom: Spacing.sm, left: Spacing.sm,
    backgroundColor: 'rgba(15,23,42,0.75)', borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
  },
  distanceText: { ...Typography.caption, color: '#fff' },
  content: { padding: Spacing.base },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { ...Typography.h3, flex: 1, marginRight: Spacing.sm },
  ratingPill: { backgroundColor: Colors.successLight, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  ratingText: { ...Typography.caption, color: Colors.success, fontWeight: '700' },
  city: { ...Typography.bodySmall, marginTop: 2, marginBottom: Spacing.sm },
  tagsRow: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.sm },
  tag: { backgroundColor: Colors.background.tertiary, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  tagSuccess: { backgroundColor: Colors.successLight },
  tagError: { backgroundColor: Colors.errorLight },
  tagText: { ...Typography.caption, color: Colors.text.secondary, fontWeight: '600' },
  tagTextSuccess: { color: Colors.success },
  tagTextError: { color: Colors.error },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  price: { ...Typography.price },
  priceRange: { ...Typography.bodySmall, color: Colors.text.secondary },
  priceUnit: { ...Typography.caption },
});
