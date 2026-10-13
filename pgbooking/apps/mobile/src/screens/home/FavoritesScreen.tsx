import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { propertiesApi } from '../../api/services';
import { PropertyCard } from '../../components/cards/PropertyCard';
import { EmptyState } from '../../components/skeletons';
import { Colors, Typography, Spacing } from '../../theme';
import type { TenantStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<TenantStackParamList, 'Favorites'>;

export default function FavoritesScreen() {
  const navigation = useNavigation<Nav>();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const res = await propertiesApi.getFavorites();
      setFavorites(res.data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchFavorites(); }, [fetchFavorites]));

  async function handleToggleFavorite(propertyId: string) {
    await propertiesApi.toggleFavorite(propertyId);
    setFavorites((prev) => prev.filter((p) => p.id !== propertyId));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Favorites</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState icon="❤️" title="No favorites yet" subtitle="Tap the heart icon on any property to save it here" />}
          renderItem={({ item }) => (
            <PropertyCard
              id={item.id} name={item.property_display_name} city={item.municipality_city}
              genderPolicy={item.gender_segregation_policy} minRent={item.min_rent} maxRent={item.max_rent}
              vacantBeds={item.vacant_beds} coverPhotoUrl={item.cover_photo_url} avgRating={item.avg_rating}
              isFavorite
              onPress={() => navigation.navigate('PropertyDetail', { propertyId: item.id })}
              onToggleFavorite={() => handleToggleFavorite(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.secondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: Spacing.screen, paddingBottom: Spacing.base, backgroundColor: Colors.surface.card },
  backIcon: { fontSize: 22 },
  headerTitle: { ...Typography.h3 },
  list: { padding: Spacing.screen },
});
