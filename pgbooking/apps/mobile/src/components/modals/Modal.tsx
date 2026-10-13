import React, { useEffect, useRef } from 'react';
import {
  Modal as RNModal, View, Text, TouchableOpacity, StyleSheet,
  Animated, TouchableWithoutFeedback, Dimensions,
} from 'react-native';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function Modal({ visible, onClose, title, children, showCloseButton = true }: ModalProps) {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <RNModal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />
        {(title || showCloseButton) && (
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            {showCloseButton && (
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <Text style={styles.closeIcon}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        <View style={styles.content}>{children}</View>
      </Animated.View>
    </RNModal>
  );
}

// ─────────────────────────────────────────────
// Confirmation Modal (common pattern: delete/cancel confirmations)
// ─────────────────────────────────────────────

interface ConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
}

export function ConfirmModal({
  visible, onClose, onConfirm, title, message,
  confirmLabel = 'Confirm', destructive = false,
}: ConfirmModalProps) {
  return (
    <Modal visible={visible} onClose={onClose} title={title}>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmBtn, destructive && styles.confirmBtnDanger]}
          onPress={() => { onConfirm(); onClose(); }}
        >
          <Text style={styles.confirmBtnText}>{confirmLabel}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface.modal,
    borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl,
    paddingBottom: Spacing.xxl, maxHeight: SCREEN_HEIGHT * 0.85, ...Shadows.lg,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border.default, alignSelf: 'center', marginTop: Spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.screen, paddingBottom: Spacing.base },
  title: { ...Typography.h3 },
  closeIcon: { fontSize: 24, color: Colors.text.tertiary },
  content: { paddingHorizontal: Spacing.screen },
  message: { ...Typography.body, marginBottom: Spacing.xl, lineHeight: 22 },
  actionRow: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: { flex: 1, height: 52, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border.default, alignItems: 'center', justifyContent: 'center' },
  cancelBtnText: { ...Typography.button, color: Colors.text.secondary },
  confirmBtn: { flex: 1, height: 52, borderRadius: Radius.lg, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  confirmBtnDanger: { backgroundColor: Colors.error },
  confirmBtnText: { ...Typography.button, color: Colors.text.inverse },
});
