import React, { useEffect, useRef, useState, createContext, useContext, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Colors, Typography, Spacing, Radius, Shadows } from '../../theme';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastConfig {
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastContextValue {
  show: (config: ToastConfig) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_STYLES: Record<ToastType, { bg: string; icon: string }> = {
  success: { bg: Colors.success, icon: '✓' },
  error:   { bg: Colors.error,   icon: '✕' },
  warning: { bg: Colors.warning, icon: '!' },
  info:    { bg: Colors.info,    icon: 'i' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback((config: ToastConfig) => {
    clearTimeout(timerRef.current);
    setToast(config);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();

    timerRef.current = setTimeout(() => {
      Animated.timing(slideAnim, { toValue: -100, duration: 200, useNativeDriver: true })
        .start(() => setToast(null));
    }, config.duration ?? 3000);
  }, []);

  const dismiss = () => {
    clearTimeout(timerRef.current);
    Animated.timing(slideAnim, { toValue: -100, duration: 200, useNativeDriver: true })
      .start(() => setToast(null));
  };

  const style = toast ? TOAST_STYLES[toast.type ?? 'info'] : TOAST_STYLES.info;

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <Animated.View style={[styles.toast, { backgroundColor: style.bg, transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity style={styles.content} onPress={dismiss} activeOpacity={0.9}>
            <View style={styles.iconCircle}><Text style={styles.icon}>{style.icon}</Text></View>
            <Text style={styles.message} numberOfLines={2}>{toast.message}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', top: 56, left: Spacing.screen, right: Spacing.screen,
    borderRadius: Radius.lg, zIndex: 999, ...Shadows.lg,
  },
  content: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, gap: Spacing.sm },
  iconCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  icon: { color: '#fff', fontSize: 13, fontWeight: '700' },
  message: { ...Typography.bodySmall, color: '#fff', flex: 1, fontWeight: '600' },
});
