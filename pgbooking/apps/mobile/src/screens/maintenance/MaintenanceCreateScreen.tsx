import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, Image, ActivityIndicator, Alert,
} from 'react-native';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { maintenanceApi } from '../../api/services';
import { Button } from '../../components/common/Button';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import type { TenantStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<TenantStackParamList, 'MaintenanceCreate'>;
type Route = RouteProp<TenantStackParamList, 'MaintenanceCreate'>;

const CATEGORIES = [
  { value: 'PLUMBING', label: 'Plumbing', icon: '🚰' },
  { value: 'ELECTRICAL', label: 'Electrical', icon: '⚡' },
  { value: 'FURNITURE', label: 'Furniture', icon: '🪑' },
  { value: 'CLEANING', label: 'Cleaning', icon: '🧹' },
  { value: 'INTERNET', label: 'Internet', icon: '📶' },
  { value: 'APPLIANCE', label: 'Appliance', icon: '🔌' },
  { value: 'SECURITY', label: 'Security', icon: '🔒' },
  { value: 'OTHER', label: 'Other', icon: '📋' },
];

export default function MaintenanceCreateScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { bookingId } = route.params;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [priority, setPriority] = useState(2);
  const [photos, setPhotos] = useState<Asset[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isValid = title.trim().length >= 5 && description.trim().length >= 10;

  async function pickPhotos() {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 3 - photos.length, quality: 0.7 });
    if (result.assets) setPhotos((prev) => [...prev, ...result.assets!].slice(0, 3));
  }

  function removePhoto(uri: string) {
    setPhotos((prev) => prev.filter((p) => p.uri !== uri));
  }

  async function handleSubmit() {
    if (!isValid) { setError('Please fill in title (5+ chars) and description (10+ chars)'); return; }
    setSubmitting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('booking_id', bookingId);
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('category', category);
      formData.append('priority', String(priority));
      photos.forEach((photo, i) => {
        formData.append('photos', {
          uri: photo.uri, type: photo.type ?? 'image/jpeg', name: photo.fileName ?? `photo_${i}.jpg`,
        } as never);
      });

      await maintenanceApi.create(formData);
      Alert.alert('Ticket Submitted', 'Your maintenance request has been sent to the property owner.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(msg ?? 'Failed to submit ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Report an Issue</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.value}
              style={[styles.categoryCard, category === c.value && styles.categoryCardActive]}
              onPress={() => setCategory(c.value)}
            >
              <Text style={styles.categoryIcon}>{c.icon}</Text>
              <Text style={[styles.categoryLabel, category === c.value && styles.categoryLabelActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Leaking tap in bathroom"
          placeholderTextColor={Colors.text.tertiary}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe the issue in detail..."
          placeholderTextColor={Colors.text.tertiary}
          value={description}
          onChangeText={setDescription}
          multiline numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={styles.label}>Priority</Text>
        <View style={styles.priorityRow}>
          {[1, 2, 3, 4, 5].map((p) => (
            <TouchableOpacity key={p} style={[styles.priorityDot, p <= priority && styles.priorityDotActive]} onPress={() => setPriority(p)}>
              <Text style={[styles.priorityNum, p <= priority && styles.priorityNumActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
          <Text style={styles.priorityLabel}>{priority <= 2 ? 'Low' : priority <= 3 ? 'Medium' : 'High'}</Text>
        </View>

        <Text style={styles.label}>Photos (optional, max 3)</Text>
        <View style={styles.photoRow}>
          {photos.map((p) => (
            <View key={p.uri} style={styles.photoThumb}>
              <Image source={{ uri: p.uri }} style={styles.photoImg} />
              <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(p.uri!)}>
                <Text style={styles.photoRemoveText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          {photos.length < 3 && (
            <TouchableOpacity style={styles.photoAdd} onPress={pickPhotos}>
              <Text style={styles.photoAddIcon}>+</Text>
            </TouchableOpacity>
          )}
        </View>

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <Button title="Submit Ticket" onPress={handleSubmit} loading={submitting} disabled={!isValid} style={{ marginTop: Spacing.xl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.secondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: Spacing.screen, paddingBottom: Spacing.base, backgroundColor: Colors.surface.card },
  backIcon: { fontSize: 22 },
  headerTitle: { ...Typography.h3 },
  scroll: { padding: Spacing.screen },
  label: { ...Typography.label, marginBottom: Spacing.sm, marginTop: Spacing.base },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  categoryCard: { width: '23%', aspectRatio: 1, borderWidth: 1.5, borderColor: Colors.border.default, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface.input },
  categoryCardActive: { borderColor: Colors.primary, backgroundColor: 'rgba(30,58,138,0.06)' },
  categoryIcon: { fontSize: 20, marginBottom: 4 },
  categoryLabel: { ...Typography.caption, textAlign: 'center', color: Colors.text.secondary },
  categoryLabelActive: { color: Colors.primary, fontWeight: '700' },
  input: { height: 52, borderWidth: 1.5, borderColor: Colors.border.default, borderRadius: Radius.lg, paddingHorizontal: Spacing.base, backgroundColor: Colors.surface.input, ...Typography.body, color: Colors.text.primary },
  textArea: { height: 100, paddingTop: Spacing.sm },
  priorityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  priorityDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: Colors.border.default, alignItems: 'center', justifyContent: 'center' },
  priorityDotActive: { backgroundColor: Colors.warning, borderColor: Colors.warning },
  priorityNum: { ...Typography.label, color: Colors.text.secondary },
  priorityNumActive: { color: '#fff' },
  priorityLabel: { ...Typography.bodySmall, marginLeft: Spacing.sm },
  photoRow: { flexDirection: 'row', gap: Spacing.sm },
  photoThumb: { width: 72, height: 72, borderRadius: Radius.md, position: 'relative' },
  photoImg: { width: '100%', height: '100%', borderRadius: Radius.md },
  photoRemove: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center' },
  photoRemoveText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  photoAdd: { width: 72, height: 72, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border.default, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  photoAddIcon: { fontSize: 24, color: Colors.text.tertiary },
  errorText: { ...Typography.bodySmall, color: Colors.error, marginTop: Spacing.base },
});
