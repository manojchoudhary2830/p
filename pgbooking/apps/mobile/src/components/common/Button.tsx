import React from 'react';
import {
  TouchableOpacity, Text, StyleSheet, ActivityIndicator,
  ViewStyle, TextStyle, TouchableOpacityProps,
} from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../../theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title, variant = 'primary', size = 'md', loading = false,
  disabled = false, fullWidth = true, icon, style, textStyle, ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        sizeStyles[size],
        variantStyles[variant],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      disabled={isDisabled}
      activeOpacity={0.8}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? Colors.primary : Colors.text.inverse} />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, textVariantStyles[variant], textSizeStyles[size], textStyle]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.lg, gap: Spacing.xs,
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  text: { ...Typography.button },
});

const sizeStyles: Record<Size, ViewStyle> = {
  sm: { height: 40, paddingHorizontal: Spacing.base },
  md: { height: 52, paddingHorizontal: Spacing.lg },
  lg: { height: 56, paddingHorizontal: Spacing.xl },
};

const textSizeStyles: Record<Size, TextStyle> = {
  sm: { fontSize: 13 },
  md: { fontSize: 15 },
  lg: { fontSize: 16 },
};

const variantStyles: Record<Variant, ViewStyle> = {
  primary:   { backgroundColor: Colors.primary },
  secondary: { backgroundColor: Colors.secondary },
  outline:   { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.border.default },
  ghost:     { backgroundColor: 'transparent' },
  danger:    { backgroundColor: Colors.error },
};

const textVariantStyles: Record<Variant, TextStyle> = {
  primary:   { color: Colors.text.inverse },
  secondary: { color: Colors.text.inverse },
  outline:   { color: Colors.text.primary },
  ghost:     { color: Colors.primary },
  danger:    { color: Colors.text.inverse },
};
