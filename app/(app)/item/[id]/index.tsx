import { useLocalSearchParams } from 'expo-router';

import { ItemDetailScreen } from '@/features/item-detail/ItemDetailScreen';

export default function ItemDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <ItemDetailScreen itemId={id} />;
}
