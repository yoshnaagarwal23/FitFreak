import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { layout } from '@/theme';

type Props = {
  name: SymbolViewProps['name'];
  color: ColorValue;
};

// SF Symbols on iOS, Material Symbols on Android and web.
export function TabIcon({ name, color }: Props) {
  return <SymbolView name={name} tintColor={color} size={layout.tabIconSize} />;
}
