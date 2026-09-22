import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  BottomSheet,
  Button,
  Card,
  Chip,
  IconButton,
  Input,
  StatusBadge,
  Text,
} from '@/components';
import { contrastRatio, documentStatuses, ThemeProvider, useTheme } from '@/theme';
import type { ColorSchemeName, TypographyVariant } from '@/theme';

const typographyVariants: TypographyVariant[] = [
  'displayLg',
  'displayLgMobile',
  'headlineLg',
  'headlineMd',
  'titleLg',
  'titleMd',
  'bodyLg',
  'bodyMd',
  'bodySm',
  'labelLg',
  'labelMd',
  'labelSm',
];

const noop = () => {};

/** A dot standing in for a glyph — F1 ships no icon library on purpose. */
function IconGlyph() {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.colors.onSurfaceVariant,
        borderRadius: theme.radius.full,
        height: 18,
        width: 18,
      }}
    />
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text color="onSurfaceVariant" variant="labelSm">
        {title.toUpperCase()}
      </Text>
      <View style={{ gap: theme.spacing.sm }}>{children}</View>
    </View>
  );
}

function Row({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { gap: theme.spacing.sm }]}>{children}</View>
  );
}

/**
 * Renders its child under the same state-layer tokens a real press applies, so
 * the pressed state is visible without holding a finger on the screen.
 */
function PressedPreview({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <View
      style={{
        opacity: theme.interaction.pressedOpacity,
        transform: [{ scale: theme.interaction.pressedScale }],
      }}
    >
      {children}
    </View>
  );
}

function GalleryBody({ scheme }: { scheme: ColorSchemeName }) {
  const theme = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        flex: 1,
        gap: theme.spacing.lg,
        padding: theme.spacing.margin,
      }}
    >
      <Text variant="titleLg">{scheme === 'dark' ? 'Dark' : 'Light'}</Text>

      <Section title="Typography">
        {typographyVariants.map((variant) => (
          <Text key={variant} variant={variant}>
            {variant}
          </Text>
        ))}
      </Section>

      <Section title="Button — default / pressed / disabled / loading">
        <Button label="Primary" onPress={noop} />
        <PressedPreview>
          <Button label="Primary pressed" onPress={noop} />
        </PressedPreview>
        <Button disabled label="Primary disabled" onPress={noop} />
        <Button label="Primary loading" loading onPress={noop} />
        <Button label="Secondary" onPress={noop} variant="secondary" />
        <PressedPreview>
          <Button label="Secondary pressed" onPress={noop} variant="secondary" />
        </PressedPreview>
        <Button disabled label="Secondary disabled" onPress={noop} variant="secondary" />
        <Button label="Ghost" onPress={noop} variant="ghost" />
        <Button disabled label="Ghost disabled" onPress={noop} variant="ghost" />
      </Section>

      <Section title="IconButton — default / pressed / disabled">
        <Row>
          <IconButton accessibilityLabel="Filled" icon={<IconGlyph />} onPress={noop} variant="filled" />
          <IconButton accessibilityLabel="Tonal" icon={<IconGlyph />} onPress={noop} variant="tonal" />
          <IconButton accessibilityLabel="Ghost" icon={<IconGlyph />} onPress={noop} />
          <PressedPreview>
            <IconButton accessibilityLabel="Pressed" icon={<IconGlyph />} onPress={noop} variant="tonal" />
          </PressedPreview>
          <IconButton accessibilityLabel="Disabled" disabled icon={<IconGlyph />} onPress={noop} variant="tonal" />
        </Row>
      </Section>

      <Section title="Chip — default / selected / pressed / disabled">
        <Row>
          <Chip label="All" onPress={noop} />
          <Chip count={12} label="Selected" onPress={noop} selected />
          <Chip count={4} label="Count" onPress={noop} />
          <PressedPreview>
            <Chip label="Pressed" onPress={noop} />
          </PressedPreview>
          <Chip disabled label="Disabled" onPress={noop} />
        </Row>
      </Section>

      <Section title="StatusBadge">
        <Row>
          {documentStatuses.map((status) => (
            <StatusBadge
              key={status}
              label={`${status} · ${contrastRatio(
                theme.status[status].foreground,
                theme.status[status].container,
              ).toFixed(1)}:1`}
              status={status}
            />
          ))}
        </Row>
      </Section>

      <Section title="Card — static / pressable / pressed / disabled">
        <Card>
          <Text variant="titleMd">Static card</Text>
          <Text color="onSurfaceVariant" variant="bodySm">
            Not interactive, so it has no button role.
          </Text>
        </Card>
        <Card accessibilityLabel="Pressable card" onPress={noop}>
          <Text variant="titleMd">Pressable card</Text>
        </Card>
        <PressedPreview>
          <Card accessibilityLabel="Pressed card" onPress={noop}>
            <Text variant="titleMd">Pressed card</Text>
          </Card>
        </PressedPreview>
        <Card accessibilityLabel="Disabled card" disabled onPress={noop}>
          <Text variant="titleMd">Disabled card</Text>
        </Card>
      </Section>

      <Section title="Input — default / required / helper / error / disabled">
        <Input label="Document name" placeholder="Passport" />
        <Input label="Passport number" placeholder="Required" required />
        <Input helperText="Shown below the field." label="With helper" placeholder="Helper" />
        <Input error="Enter a date in the future." label="With error" value="2019-01-01" />
        <Input editable={false} label="Disabled" value="Read only" />
      </Section>

      <Section title="BottomSheet">
        <Button label="Open bottom sheet" onPress={() => setSheetOpen(true)} />
        <BottomSheet onClose={() => setSheetOpen(false)} title="Bottom sheet" visible={sheetOpen}>
          <Text color="onSurfaceVariant" variant="bodyMd">
            Drag down, tap the scrim, or press Android back to dismiss.
          </Text>
          <Button label="Close" onPress={() => setSheetOpen(false)} variant="secondary" />
        </BottomSheet>
      </Section>
    </View>
  );
}

export function Gallery() {
  return (
    <ScrollView>
      <ThemeProvider scheme="light">
        <GalleryBody scheme="light" />
      </ThemeProvider>
      <ThemeProvider scheme="dark">
        <GalleryBody scheme="dark" />
      </ThemeProvider>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap' },
});
