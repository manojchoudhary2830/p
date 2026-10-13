import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps, TouchableOpacity } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  rightElement?: React.ReactNode;
}

export function Input({
  label, error, helperText, required, rightElement,
  style, onFocus, onBlur, ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      {!!label && (
        <Text style={styles.label}>
          {label}{required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      <View style={[
        styles.inputRow,
        focused && styles.inputRowFocused,
        !!error && styles.inputRowError,
      ]}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={Colors.text.tertiary}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...rest}
        />
        {rightElement}
      </View>
      {!!error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : !!helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────
// Password-style input with show/hide toggle
// (kept generic — not used for actual passwords since this app is OTP-only,
// but reused for masked fields like document numbers)
// ─────────────────────────────────────────────

export function MaskedInput(props: InputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      secureTextEntry={!visible}
      rightElement={
        <TouchableOpacity onPress={() => setVisible((v) => !v)} hitSlop={8}>
          <Text style={styles.toggleText}>{visible ? 'Hide' : 'Show'}</Text>
        </TouchableOpacity>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.base },
  label: { ...Typography.label, marginBottom: Spacing.sm, color: Colors.text.primary },
  required: { color: Colors.error },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    height: 52, borderWidth: 1.5, borderColor: Colors.border.default,
    borderRadius: Radius.lg, backgroundColor: Colors.surface.input,
    paddingHorizontal: Spacing.base,
  },
  inputRowFocused: { borderColor: Colors.primary, backgroundColor: Colors.background.primary },
  inputRowError: { borderColor: Colors.error },
  input: { flex: 1, ...Typography.body, color: Colors.text.primary, fontSize: 15 },
  errorText: { ...Typography.bodySmall, color: Colors.error, marginTop: Spacing.xs },
  helperText: { ...Typography.caption, marginTop: Spacing.xs },
  toggleText: { ...Typography.bodySmall, color: Colors.primary, fontWeight: '600' },
});
