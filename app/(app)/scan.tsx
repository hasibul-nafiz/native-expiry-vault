import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { ScannerScreen } from '@/features/ocr';

/**
 * The scanner, full screen and outside the tabs.
 *
 * `from=add` means the add-item form is already underneath on the stack and is
 * waiting for the result, so a confirmed scan goes back to it. Opened from the
 * Scan tab instead, there is no form yet, so one is opened — it collects the
 * scan from the handoff store either way.
 */
export default function ScanRoute() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();

  const onScanned = useCallback(() => {
    if (from === 'add') {
      router.back();

      return;
    }

    router.replace('/add');
  }, [from, router]);

  const onCancel = useCallback(() => {
    router.back();
  }, [router]);

  return <ScannerScreen onCancel={onCancel} onScanned={onScanned} />;
}
