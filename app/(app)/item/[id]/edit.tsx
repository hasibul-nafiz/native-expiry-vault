import { useLocalSearchParams } from 'expo-router';

import { EditItemScreen } from '@/features/edit-item/EditItemScreen';

export default function EditItemRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <EditItemScreen itemId={id} />;
}
