import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Image, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { maintenanceApi } from '../../api/services';
import { StatusBadge } from '../../components/skeletons';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';
import type { TenantStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<TenantStackParamList, 'MaintenanceDetail'>;
type Route = RouteProp<TenantStackParamList, 'MaintenanceDetail'>;

interface Comment {
  id: string; content: string; author_name: string; author_role: string;
  is_internal: boolean; created_at: string;
}

interface Ticket {
  id: string; title: string; description: string; category: string;
  current_status: string; priority: number; photo_urls: string[];
  property_display_name: string; room_identifier_code: string;
  reporter_name: string; created_at: string; comments: Comment[];
}

const CATEGORY_ICONS: Record<string, string> = {
  PLUMBING: '🚰', ELECTRICAL: '⚡', FURNITURE: '🪑', CLEANING: '🧹',
  INTERNET: '📶', APPLIANCE: '🔌', SECURITY: '🔒', OTHER: '📋',
};

export default function MaintenanceDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { ticketId } = route.params;
  const currentUser = useSelector((s: RootState) => s.auth.user);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);

  const fetchTicket = useCallback(async () => {
    try {
      const res = await maintenanceApi.getTicket(ticketId);
      setTicket(res.data.data);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useFocusEffect(useCallback(() => { fetchTicket(); }, [fetchTicket]));

  async function handleSendComment() {
    if (!commentText.trim()) return;
    setSending(true);
    try {
      await maintenanceApi.addComment(ticketId, commentText.trim());
      setCommentText('');
      await fetchTicket();
    } finally {
      setSending(false);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  if (!ticket) return null;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{ticket.title}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: Spacing.screen }}>
        <View style={styles.topRow}>
          <Text style={styles.categoryIcon}>{CATEGORY_ICONS[ticket.category] ?? '📋'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{ticket.title}</Text>
            <Text style={styles.meta}>{ticket.property_display_name} • Room {ticket.room_identifier_code}</Text>
          </View>
          <StatusBadge status={ticket.current_status} />
        </View>

        <View style={styles.descCard}>
          <Text style={styles.description}>{ticket.description}</Text>
        </View>

        {ticket.photo_urls?.length > 0 && (
          <FlatList
            horizontal showsHorizontalScrollIndicator={false}
            data={ticket.photo_urls}
            keyExtractor={(uri) => uri}
            contentContainerStyle={{ gap: Spacing.sm, marginBottom: Spacing.base }}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={styles.photo} />
            )}
          />
        )}

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Comments ({ticket.comments?.length ?? 0})</Text>

        {(ticket.comments ?? []).map((c) => (
          <View key={c.id} style={[styles.commentBubble, c.author_role !== 'TENANT' && styles.commentBubbleOwner]}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentAuthor}>{c.author_name}</Text>
              <Text style={styles.commentRole}>{c.author_role === 'TENANT' ? '' : '· Owner'}</Text>
            </View>
            <Text style={styles.commentText}>{c.content}</Text>
            <Text style={styles.commentTime}>{new Date(c.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
        ))}

        {(!ticket.comments || ticket.comments.length === 0) && (
          <Text style={styles.noComments}>No comments yet. Start the conversation below.</Text>
        )}
      </ScrollView>

      <View style={styles.commentInputRow}>
        <TextInput
          style={styles.commentInput}
          placeholder="Add a comment..."
          placeholderTextColor={Colors.text.tertiary}
          value={commentText}
          onChangeText={setCommentText}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, !commentText.trim() && styles.sendBtnDisabled]}
          onPress={handleSendComment}
          disabled={!commentText.trim() || sending}
        >
          {sending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sendBtnText}>➤</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.secondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: Spacing.screen, paddingBottom: Spacing.base, backgroundColor: Colors.surface.card },
  backIcon: { fontSize: 22 },
  headerTitle: { ...Typography.h4, flex: 1, textAlign: 'center', marginHorizontal: Spacing.sm },
  scroll: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.base },
  categoryIcon: { fontSize: 28 },
  title: { ...Typography.h3, marginBottom: 2 },
  meta: { ...Typography.bodySmall },
  descCard: { backgroundColor: Colors.surface.card, borderRadius: Radius.lg, padding: Spacing.base, marginBottom: Spacing.base, ...Shadows.sm },
  description: { ...Typography.body, lineHeight: 22 },
  photo: { width: 100, height: 100, borderRadius: Radius.md },
  divider: { height: 1, backgroundColor: Colors.border.light, marginVertical: Spacing.base },
  sectionTitle: { ...Typography.h3, marginBottom: Spacing.base },
  commentBubble: { backgroundColor: Colors.surface.card, borderRadius: Radius.lg, padding: Spacing.base, marginBottom: Spacing.sm, ...Shadows.sm },
  commentBubbleOwner: { backgroundColor: 'rgba(13,148,136,0.06)', borderWidth: 1, borderColor: 'rgba(13,148,136,0.2)' },
  commentHeader: { flexDirection: 'row', marginBottom: 4 },
  commentAuthor: { ...Typography.label },
  commentRole: { ...Typography.caption, color: Colors.secondary, marginLeft: 4 },
  commentText: { ...Typography.bodySmall, marginBottom: 4 },
  commentTime: { ...Typography.caption },
  noComments: { ...Typography.bodySmall, textAlign: 'center', paddingVertical: Spacing.xl },
  commentInputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
    padding: Spacing.base, backgroundColor: Colors.surface.card,
    borderTopWidth: 1, borderTopColor: Colors.border.light,
  },
  commentInput: {
    flex: 1, minHeight: 40, maxHeight: 100, borderWidth: 1, borderColor: Colors.border.default,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    ...Typography.bodySmall, backgroundColor: Colors.surface.input,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontSize: 16 },
});
