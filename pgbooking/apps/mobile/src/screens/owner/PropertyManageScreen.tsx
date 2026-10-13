import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { propertiesApi, roomsApi } from '../../api/services';
import { StatusBadge } from '../../components/skeletons';
import { Button } from '../../components/common/Button';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import type { OwnerStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<OwnerStackParamList, 'PropertyManage'>;
type Route = RouteProp<OwnerStackParamList, 'PropertyManage'>;

interface Room {
  id: string; room_identifier_code: string; max_occupancy_sharing_limit: number;
  standard_monthly_rent_amount: string; vacant_beds: number; total_beds: number;
}

export default function PropertyManageScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { propertyId } = route.params;

  const [property, setProperty] = useState<any>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [propRes, roomsRes] = await Promise.all([
        propertiesApi.getById(propertyId),
        roomsApi.list(propertyId),
      ]);
      setProperty(propRes.data.data);
      setRooms(roomsRes.data.data);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleAddPhoto() {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    const asset = result.assets?.[0];
    if (!asset) return;

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', { uri: asset.uri, type: asset.type ?? 'image/jpeg', name: asset.fileName ?? 'photo.jpg' } as never);
      formData.append('is_cover', String(!property.photos?.length));
      await propertiesApi.uploadPhoto(propertyId, formData);
      load();
    } catch {
      Alert.alert('Upload Failed', 'Could not upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  function handleDeleteProperty() {
    Alert.alert('Delete Property', 'This will remove the property and all its rooms/beds. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await propertiesApi.delete(propertyId);
          navigation.goBack();
        },
      },
    ]);
  }

  if (loading || !property) {
    return <View style={styles.center}><ActivityIndicator color={Colors.secondary} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{property.property_display_name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.statusRow}>
          <StatusBadge status={property.verification_status} />
          {property.verification_status === 'PENDING' && (
            <Text style={styles.pendingNote}>Awaiting admin verification</Text>
          )}
        </View>

        {/* Photos */}
        <Text style={styles.sectionTitle}>Photos</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.lg }}>
          {(property.photos ?? []).map((p: any) => (
            <Image key={p.id} source={{ uri: p.url }} style={styles.photoThumb} />
          ))}
          <TouchableOpacity style={styles.addPhotoBtn} onPress={handleAddPhoto} disabled={uploadingPhoto}>
            {uploadingPhoto ? <ActivityIndicator color={Colors.secondary} /> : <Text style={styles.addPhotoIcon}>+</Text>}
          </TouchableOpacity>
        </ScrollView>

        {/* Rooms */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Rooms ({rooms.length})</Text>
          <TouchableOpacity onPress={() => navigation.navigate('RoomManage', { propertyId })}>
            <Text style={styles.addLink}>+ Add Room</Text>
          </TouchableOpacity>
        </View>
        {rooms.map((room) => (
          <TouchableOpacity
            key={room.id}
            style={styles.roomCard}
            onPress={() => navigation.navigate('RoomManage', { propertyId, roomId: room.id })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.roomCode}>Room {room.room_identifier_code}</Text>
              <Text style={styles.roomMeta}>{room.total_beds - room.vacant_beds}/{room.total_beds} occupied</Text>
            </View>
            <Text style={styles.roomPrice}>₹{parseFloat(room.standard_monthly_rent_amount).toLocaleString('en-IN')}</Text>
          </TouchableOpacity>
        ))}

        <View style={{ height: Spacing.xl }} />
        <Button title="Delete Property" variant="danger" onPress={handleDeleteProperty} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.secondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: Spacing.screen, paddingBottom: Spacing.base, backgroundColor: Colors.surface.card },
  backIcon: { fontSize: 22 },
  headerTitle: { ...Typography.h4, flex: 1, textAlign: 'center', marginHorizontal: Spacing.sm },
  scroll: { padding: Spacing.screen },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  pendingNote: { ...Typography.caption, color: Colors.warning },
  sectionTitle: { ...Typography.h3, marginBottom: Spacing.sm },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  addLink: { ...Typography.bodySmall, color: Colors.secondary, fontWeight: '700' },
  photoThumb: { width: 100, height: 100, borderRadius: Radius.md, marginRight: Spacing.sm },
  addPhotoBtn: { width: 100, height: 100, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border.default, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addPhotoIcon: { fontSize: 28, color: Colors.text.tertiary },
  roomCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface.card, borderRadius: Radius.lg, padding: Spacing.base, marginBottom: Spacing.sm, ...Shadows.sm },
  roomCode: { ...Typography.label, marginBottom: 2 },
  roomMeta: { ...Typography.caption },
  roomPrice: { ...Typography.label, color: Colors.primary },
});
