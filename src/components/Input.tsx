import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View, type TextInputProps } from 'react-native';

import { minTouchTarget, useTheme } from '@/theme';

import { Text } from './Text';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  testID?: string;
}

export function Input({
  label,
  error,
  helperText,
  required = false,
  onFocus,
  onBlur,
  testID,
  ...rest
}: InputProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const invalid = error !== undefined;

  // The design uses outline-variant for field borders, but that token is M3's
  // decorative divider and fails WCAG's 3:1 for interactive boundaries, so the
  // meaningful `outline` token is used instead. Logged as a design conflict.
  const borderColor = invalid
    ? theme.colors.error
    : focused
      ? theme.colors.primary
      : theme.colors.outline;

  const handleFocus = (event: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
    setFocused(true);
    onFocus?.(event);
  };

  const handleBlur = (event: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
    setFocused(false);
    onBlur?.(event);
  };

  const caption = error ?? helperText;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text color="onSurfaceVariant" variant="labelMd">
        {required ? `${label} *` : label}
      </Text>

      <TextInput
        accessibilityLabel={required ? t('common.requiredField', { label }) : label}
        accessibilityState={{ disabled: rest.editable === false }}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholderTextColor={theme.colors.outline}
        style={[
          theme.typography.bodyMd,
          {
            backgroundColor: theme.colors.surfaceContainerLowest,
            borderColor,
            borderRadius: theme.radius.lg,
            borderWidth: focused || invalid ? 2 : 1,
            color: theme.colors.onSurface,
            minHeight: minTouchTarget,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
          },
        ]}
        testID={testID}
        {...rest}
      />

      {caption === undefined ? null : (
        <Text color={invalid ? 'error' : 'onSurfaceVariant'} variant="bodySm">
          {caption}
        </Text>
      )}
    </View>
  );
}
