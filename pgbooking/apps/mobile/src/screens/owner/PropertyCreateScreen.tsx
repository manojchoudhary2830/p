import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Geolocation from '@react-native-community/geolocation';
import { propertiesApi, roomsApi, bedsApi } from '../../api/services';
import { Button } from '../../components/common/Button';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import type { OwnerStackParamList } from '../../navigation';

type CreateNav = NativeStackNavigationProp<OwnerStackParamList, 'PropertyCreate'>;
type RoomNav = NativeStackNavigationProp<OwnerStackParamList, 'RoomManage'>;
type RoomRoute = RouteProp<OwnerStackParamList, 'RoomManage'>;

const GENDER_OPTIONS = [
  { value: 'CO_LIVING', label: 'Co-Living' },
  { value: 'MALE', label: 'Male Only' },
  { value: 'FEMALE', label: 'Female Only' },
];

// ─────────────────────────────────────────────
// Property Create Screen
// ─────────────────────────────────────────────

export function PropertyCreateScreen() {
  const navigation = useNavigation<CreateNav>();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [gender, setGender] = useState('CO_LIVING');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    Geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setCoords({ lat: 12.9716, lng: 77.5946 }),
    );
  }, []);

  const isValid = name.trim().length >= 5 && address.trim().length >= 10 && coords;

  async function handleSubmit() {
    if (!isValid || !coords) { setError('Please fill in all required fields'); return; }
    setSubmitting(true);
    try {
      const res = await propertiesApi.create({
        property_display_name: name.trim(),
        physical_address_line: address.trim(),
        municipality_city: city.trim(),
        latitude: coords.lat, longitude: coords.lng,
        gender_segregation_policy: gender,
        structural_amenities: [],
      });
      const propertyId = res.data.data.id;
      navigation.replace('PropertyManage', { propertyId });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(msg ?? 'Failed to create property');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Add Property</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.label}>Property Name</Text>
        <TextInput style={styles.input} placeholder="e.g. Urban Nest Co-Living" value={name} onChangeText={setName} placeholderTextColor={Colors.text.tertiary} />

        <Text style={styles.label}>Address</Text>
        <TextInput style={[styles.input, styles.textArea]} placeholder="Full street address" value={address} onChangeText={setAddress} multiline placeholderTextColor={Colors.text.tertiary} />

        <Text style={styles.label}>City</Text>
        <TextInput style={styles.input} value={city} onChangeText={setCity} placeholderTextColor={Colors.text.tertiary} />

        <Text style={styles.label}>Gender Policy</Text>
        <View style={styles.optionRow}>
          {GENDER_OPTIONS.map((g) => (
            <TouchableOpacity key={g.value} style={[styles.optionChip, gender === g.value && styles.optionChipActive]} onPress={() => setGender(g.value)}>
              <Text style={[styles.optionText, gender === g.value && styles.optionTextActive]}>{g.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!coords && <Text style={styles.locationNote}>📍 Fetching your current location...</Text>}
        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <Button title="Create Property" onPress={handleSubmit} loading={submitting} disabled={!isValid} style={{ marginTop: Spacing.xl }} />
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────
// Room Manage Screen (create/edit room + beds)
// ─────────────────────────────────────────────

export function RoomManageScreen() {
  const navigation = useNavigation<RoomNav>();
  const route = useRoute<RoomRoute>();
  const { propertyId, roomId } = route.params;
  const isEdit = !!roomId;

  const [code, setCode] = useState('');
  const [sharing, setSharing] = useState('2');
  const [rent, setRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [bedCount, setBedCount] = useState('2');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEdit) {
      roomsApi.get(propertyId, roomId!).then((res) => {
        const r = res.data.data;
        setCode(r.room_identifier_code);
        setSharing(String(r.max_occupancy_sharing_limit));
        setRent(String(r.standard_monthly_rent_amount));
        setDeposit(String(r.required_security_deposit_amount));
      }).finally(() => setLoading(false));
    }
  }, [isEdit, propertyId, roomId]);

  const isValid = code.trim().length > 0 && parseFloat(rent) > 0 && parseFloat(deposit) >= 0;

  async function handleSubmit() {
    if (!isValid) { setError('Please fill in all fields with valid values'); return; }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        room_identifier_code: code.trim(),
        max_occupancy_sharing_limit: parseInt(sharing, 10),
        standard_monthly_rent_amount: parseFloat(rent),
        required_security_deposit_amount: parseFloat(deposit),
      };

      if (isEdit) {
        await roomsApi.update(propertyId, roomId!, payload);
      } else {
        const res = await roomsApi.create(propertyId, payload);
        const newRoomId = res.data.data.id;
        // Auto-create beds
        const beds = Array.from({ length: parseInt(bedCount, 10) }, (_, i) => ({
          bed_spatial_code: String.fromCharCode(65 + i), // A, B, C...
        }));
        await bedsApi.create(newRoomId, beds);
      }
      navigation.goBack();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(msg ?? 'Failed to save room');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.secondary} size="large" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Room' : 'Add Room'}</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.label}>Room Code</Text>
        <TextInput style={styles.input} placeholder="e.g. 101" value={code} onChangeText={setCode} placeholderTextColor={Colors.text.tertiary} />

        <Text style={styles.label}>Sharing Type</Text>
        <View style={styles.optionRow}>
          {['1', '2', '3', '4'].map((n) => (
            <TouchableOpacity key={n} style={[styles.optionChip, sharing === n && styles.optionChipActive]} onPress={() => setSharing(n)}>
              <Text style={[styles.optionText, sharing === n && styles.optionTextActive]}>{n} Sharing</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Monthly Rent (₹)</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={rent} onChangeText={setRent} placeholderTextColor={Colors.text.tertiary} placeholder="12000" />

        <Text style={styles.label}>Security Deposit (₹)</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={deposit} onChangeText={setDeposit} placeholderTextColor={Colors.text.tertiary} placeholder="24000" />

        {!isEdit && (
          <>
            <Text style={styles.label}>Number of Beds</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={bedCount} onChangeText={setBedCount} placeholderTextColor={Colors.text.tertiary} />
          </>
        )}

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <Button title={isEdit ? 'Save Changes' : 'Create Room'} onPress={handleSubmit} loading={submitting} disabled={!isValid} style={{ marginTop: Spacing.xl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.secondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: Spacing.screen, paddingBottom: Spacing.base, backgroundColor: Colors.surface.card },
  backIcon: { fontSize: 22 },
  headerTitle: { ...Typography.h3 },
  scroll: { padding: Spacing.screen },
  label: { ...Typography.label, marginBottom: Spacing.sm, marginTop: Spacing.base },
  input: { height: 52, borderWidth: 1.5, borderColor: Colors.border.default, borderRadius: Radius.lg, paddingHorizontal: Spacing.base, backgroundColor: Colors.surface.input, ...Typography.body, color: Colors.text.primary },
  textArea: { height: 80, paddingTop: Spacing.sm },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  optionChip: { borderWidth: 1.5, borderColor: Colors.border.default, borderRadius: Radius.full, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, backgroundColor: Colors.surface.input },
  optionChipActive: { borderColor: Colors.secondary, backgroundColor: 'rgba(13,148,136,0.08)' },
  optionText: { ...Typography.bodySmall, color: Colors.text.secondary },
  optionTextActive: { color: Colors.secondary, fontWeight: '700' },
  locationNote: { ...Typography.caption, marginTop: Spacing.base },
  errorText: { ...Typography.bodySmall, color: Colors.error, marginTop: Spacing.base },
});
