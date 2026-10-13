import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Marker, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { propertiesApi } from '../../api/services';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import type { TenantStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<TenantStackParamList, 'MapView'>;
type Route = RouteProp<TenantStackParamList, 'MapView'>;

export default function MapViewScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const mapRef = useRef<MapView>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  const initialLat = route.params?.lat ?? 12.9716;
  const initialLng = route.params?.lng ?? 77.5946;

  useEffect(() => {
    fetchInArea(initialLat, initialLng);
  }, []);

  async function fetchInArea(lat: number, lng: number) {
    setLoading(true);
    try {
      const res = await propertiesApi.search({ lat, lng, radius_km: 8, limit: 50 });
      setProperties(res.data.data);
    } finally {
      setLoading(false);
    }
  }

  function onRegionChangeComplete(region: Region) {
    fetchInArea(region.latitude, region.longitude);
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: initialLat, longitude: initialLng,
          latitudeDelta: 0.08, longitudeDelta: 0.08,
        }}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton
      >
        {properties.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
            onPress={() => setSelected(p)}
          >
            <View style={[styles.markerPill, p.vacant_beds === 0 && styles.markerPillFull]}>
              <Text style={styles.markerText}>₹{(p.min_rent / 1000).toFixed(0)}k</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>

      {loading && (
        <View style={styles.loadingPill}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Searching this area...</Text>
        </View>
      )}

      {selected && (
        <TouchableOpacity
          style={styles.previewCard}
          onPress={() => navigation.navigate('PropertyDetail', { propertyId: selected.id })}
          activeOpacity={0.9}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.previewName} numberOfLines={1}>{selected.property_display_name}</Text>
            <Text style={styles.previewMeta}>{selected.municipality_city} • {selected.vacant_beds} beds available</Text>
            <Text style={styles.previewPrice}>₹{selected.min_rent.toLocaleString('en-IN')}/mo</Text>
          </View>
          <Text style={styles.previewArrow}>→</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: {
    position: 'absolute', top: 56, left: Spacing.screen, width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surface.card, alignItems: 'center', justifyContent: 'center', ...Shadows.md,
  },
  backIcon: { fontSize: 20 },
  markerPill: {
    backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 2, borderColor: '#fff', ...Shadows.sm,
  },
  markerPillFull: { backgroundColor: Colors.text.tertiary },
  markerText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  loadingPill: {
    position: 'absolute', top: 56, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.surface.card, borderRadius: Radius.full,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, ...Shadows.md,
  },
  loadingText: { ...Typography.bodySmall },
  previewCard: {
    position: 'absolute', bottom: Spacing.xl, left: Spacing.screen, right: Spacing.screen,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface.card, borderRadius: Radius.xl, padding: Spacing.base, ...Shadows.lg,
  },
  previewName: { ...Typography.h4, marginBottom: 2 },
  previewMeta: { ...Typography.caption, marginBottom: 4 },
  previewPrice: { ...Typography.label, color: Colors.primary },
  previewArrow: { fontSize: 22, color: Colors.primary, marginLeft: Spacing.sm },
});
