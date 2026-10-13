import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { apiClient } from '../../api/interceptors/axios.interceptor';
import { Button } from '../../components/common/Button';
import { StatusBadge } from '../../components/skeletons';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import type { TenantStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<TenantStackParamList, 'KycUpload'>;

const DOC_TYPES = [
  { value: 'AADHAAR', label: 'Aadhaar Card' },
  { value: 'PAN_CARD', label: 'PAN Card' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'DRIVING_LICENSE', label: 'Driving License' },
  { value: 'VOTER_ID', label: 'Voter ID' },
];

export default function KycUploadScreen() {
  const navigation = useNavigation<Nav>();
  const user = useSelector((s: RootState) => s.auth.user);

  const [docType, setDocType] = useState('AADHAAR');
  const [photo, setPhoto] = useState<Asset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function pickDocument() {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    if (result.assets?.[0]) setPhoto(result.assets[0]);
  }

  async function handleUpload() {
    if (!photo) { setError('Please select a document photo'); return; }
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('document_type', docType);
      formData.append('document', {
        uri: photo.uri, type: photo.type ?? 'image/jpeg', name: photo.fileName ?? 'kyc_doc.jpg',
      } as never);

      await apiClient.post('/users/kyc-documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert(
        'Document Submitted',
        'Your KYC document has been submitted for review. This usually takes 24-48 hours.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(msg ?? 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  const kycStatus = user?.identity_kyc_status ?? 'UNVERIFIED';
  const isVerified = kycStatus === 'VERIFIED';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>KYC Verification</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Current Status</Text>
          <StatusBadge status={kycStatus} />
        </View>

        {isVerified ? (
          <View style={styles.successBox}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successText}>Your identity has been verified. You're all set to book!</Text>
          </View>
        ) : (
          <>
            <Text style={styles.infoText}>
              Upload a government-issued photo ID to verify your identity. This is required before booking a bed.
            </Text>

            <Text style={styles.label}>Document Type</Text>
            <View style={styles.docTypeGrid}>
              {DOC_TYPES.map((d) => (
                <TouchableOpacity
                  key={d.value}
                  style={[styles.docTypeChip, docType === d.value && styles.docTypeChipActive]}
                  onPress={() => setDocType(d.value)}
                >
                  <Text style={[styles.docTypeText, docType === d.value && styles.docTypeTextActive]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Document Photo</Text>
            <TouchableOpacity style={styles.uploadBox} onPress={pickDocument}>
              {photo ? (
                <Image source={{ uri: photo.uri }} style={styles.previewImage} resizeMode="cover" />
              ) : (
                <>
                  <Text style={styles.uploadIcon}>📄</Text>
                  <Text style={styles.uploadText}>Tap to select document photo</Text>
                  <Text style={styles.uploadHint}>JPG, PNG or PDF under 5MB</Text>
                </>
              )}
            </TouchableOpacity>

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <Button title="Submit for Verification" onPress={handleUpload} loading={uploading} disabled={!photo} style={{ marginTop: Spacing.xl }} />

            <View style={styles.privacyNote}>
              <Text style={styles.privacyText}>
                🔒 Your document is encrypted and stored securely. Only authorized verification staff can access it.
              </Text>
            </View>
          </>
        )}
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
  statusCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface.card, borderRadius: Radius.lg, padding: Spacing.base, marginBottom: Spacing.base },
  statusLabel: { ...Typography.body },
  successBox: { alignItems: 'center', backgroundColor: Colors.successLight, borderRadius: Radius.lg, padding: Spacing.xl },
  successIcon: { fontSize: 40, marginBottom: Spacing.sm },
  successText: { ...Typography.body, textAlign: 'center', color: Colors.success },
  infoText: { ...Typography.body, marginBottom: Spacing.lg, lineHeight: 22 },
  label: { ...Typography.label, marginBottom: Spacing.sm },
  docTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  docTypeChip: { borderWidth: 1.5, borderColor: Colors.border.default, borderRadius: Radius.full, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, backgroundColor: Colors.surface.input },
  docTypeChipActive: { borderColor: Colors.primary, backgroundColor: 'rgba(30,58,138,0.06)' },
  docTypeText: { ...Typography.bodySmall, color: Colors.text.secondary },
  docTypeTextActive: { color: Colors.primary, fontWeight: '700' },
  uploadBox: { height: 180, borderWidth: 1.5, borderColor: Colors.border.default, borderStyle: 'dashed', borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface.input, overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%' },
  uploadIcon: { fontSize: 36, marginBottom: Spacing.sm },
  uploadText: { ...Typography.body, color: Colors.text.secondary },
  uploadHint: { ...Typography.caption, marginTop: 2 },
  errorText: { ...Typography.bodySmall, color: Colors.error, marginTop: Spacing.base },
  privacyNote: { backgroundColor: Colors.infoLight, borderRadius: Radius.md, padding: Spacing.base, marginTop: Spacing.base },
  privacyText: { ...Typography.caption, color: Colors.info, lineHeight: 18 },
});
