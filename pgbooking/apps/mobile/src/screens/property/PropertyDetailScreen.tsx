import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Image, StyleSheet, TouchableOpacity,
  ActivityIndicator, FlatList, Dimensions,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { propertiesApi, roomsApi } from '../../api/services';
import { Button } from '../../components/common/Button';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import type { TenantStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<TenantStackParamList, 'PropertyDetail'>;
type Route = RouteProp<TenantStackParamList, 'PropertyDetail'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Room {
  id: string; room_identifier_code: string; max_occupancy_sharing_limit: number;
  standard_monthly_rent_amount: string; vacant_beds: number; total_beds: number;
  room_type: string | null;
}

export default function PropertyDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { propertyId } = route.params;

  const [property, setProperty] = useState<any>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    Promise.all([
      propertiesApi.getById(propertyId),
      roomsApi.list(propertyId),
    ]).then(([propRes, roomsRes]) => {
      setProperty(propRes.data.data);
      setRooms(roomsRes.data.data);
    }).finally(() => setLoading(false));
  }, [propertyId]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }
  if (!property) return null;

  const photos = property.photos?.length ? property.photos : [{ url: null }];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Photo Carousel */}
        <View>
          <FlatList
            data={photos}
            horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setActivePhoto(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item }) => (
              item.url ? (
                <Image source={{ uri: item.url }} style={{ width: SCREEN_WIDTH, height: 280 }} resizeMode="cover" />
              ) : (
                <View style={[{ width: SCREEN_WIDTH, height: 280 }, styles.photoPlaceholder]}>
                  <Text style={{ fontSize: 56 }}>🏠</Text>
                </View>
              )
            )}
          />
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          {photos.length > 1 && (
            <View style={styles.dots}>
              {photos.map((_: unknown, i: number) => (
                <View key={i} style={[styles.dot, i === activePhoto && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.title}>{property.property_display_name}</Text>
          <Text style={styles.address}>{property.physical_address_line}, {property.municipality_city}</Text>

          <View style={styles.tagsRow}>
            <View style={styles.tag}><Text style={styles.tagText}>{property.gender_segregation_policy.replace('_',' ')}</Text></View>
            {property.is_listing_verified_by_admin && (
              <View style={[styles.tag, styles.tagVerified]}><Text style={[styles.tagText, { color: Colors.success }]}>✓ Verified</Text></View>
            )}
          </View>

          {/* Description */}
          {!!property.descriptive_summary && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.description}>{property.descriptive_summary}</Text>
            </View>
          )}

          {/* Amenities */}
          {!!property.structural_amenities?.length && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Amenities</Text>
              <View style={styles.amenitiesGrid}>
                {property.structural_amenities.map((a: string) => (
                  <View key={a} style={styles.amenityPill}>
                    <Text style={styles.amenityText}>{a.replace(/_/g, ' ')}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Rooms */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available Rooms</Text>
            {rooms.map((room) => (
              <TouchableOpacity
                key={room.id}
                style={[styles.roomCard, room.vacant_beds === 0 && styles.roomCardDisabled]}
                disabled={room.vacant_beds === 0}
                onPress={() => navigation.navigate('BedSelection', {
                  propertyId, roomId: room.id, propertyName: property.property_display_name,
                })}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.roomCode}>Room {room.room_identifier_code}</Text>
                  <Text style={styles.roomMeta}>{room.max_occupancy_sharing_limit} Sharing • {room.room_type ?? 'Standard'}</Text>
                  <Text style={styles.roomVacancy}>
                    {room.vacant_beds > 0 ? `${room.vacant_beds} of ${room.total_beds} beds available` : 'Fully occupied'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.roomPrice}>₹{parseFloat(room.standard_monthly_rent_amount).toLocaleString('en-IN')}</Text>
                  <Text style={styles.roomPriceUnit}>/month</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.cta}>
        <View>
          <Text style={styles.ctaFromLabel}>Starting from</Text>
          <Text style={styles.ctaPrice}>₹{property.min_rent?.toLocaleString('en-IN')}/mo</Text>
        </View>
        <Button
          title="View Rooms"
          fullWidth={false}
          style={{ paddingHorizontal: Spacing.xl }}
          onPress={() => rooms[0] && navigation.navigate('BedSelection', {
            propertyId, roomId: rooms[0].id, propertyName: property.property_display_name,
          })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoPlaceholder: { backgroundColor: Colors.background.tertiary, alignItems: 'center', justifyContent: 'center' },
  backBtn: { position: 'absolute', top: 50, left: Spacing.screen, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: '#fff', fontSize: 20 },
  dots: { position: 'absolute', bottom: Spacing.base, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: '#fff', width: 18 },
  content: { padding: Spacing.screen, paddingBottom: 100 },
  title: { ...Typography.h1, marginBottom: Spacing.xs },
  address: { ...Typography.body, marginBottom: Spacing.sm },
  tagsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  tag: { backgroundColor: Colors.background.tertiary, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  tagVerified: { backgroundColor: Colors.successLight },
  tagText: { ...Typography.caption, fontWeight: '700', color: Colors.text.secondary },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { ...Typography.h2, marginBottom: Spacing.sm },
  description: { ...Typography.body, lineHeight: 22 },
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  amenityPill: { backgroundColor: Colors.background.tertiary, borderRadius: Radius.full, paddingHorizontal: Spacing.base, paddingVertical: Spacing.xs },
  amenityText: { ...Typography.bodySmall, color: Colors.text.primary },
  roomCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface.card, borderRadius: Radius.lg, padding: Spacing.base,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border.light, ...Shadows.sm,
  },
  roomCardDisabled: { opacity: 0.5 },
  roomCode: { ...Typography.h4, marginBottom: 2 },
  roomMeta: { ...Typography.bodySmall, marginBottom: 2 },
  roomVacancy: { ...Typography.caption, color: Colors.secondary, fontWeight: '600' },
  roomPrice: { ...Typography.price },
  roomPriceUnit: { ...Typography.caption },
  cta: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface.card, padding: Spacing.base, paddingBottom: Spacing.xl,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, ...Shadows.lg,
  },
  ctaFromLabel: { ...Typography.caption },
  ctaPrice: { ...Typography.h3, color: Colors.primary },
});
