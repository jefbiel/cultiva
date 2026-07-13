import { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FieldLot, LotStatus } from '@/types/agro';

const statusLabels: Record<LotStatus, string> = {
  [LotStatus.Healthy]: 'Saudável',
  [LotStatus.Attention]: 'Atenção',
  [LotStatus.Critical]: 'Crítico',
};

export function LotCard({
  lot,
  lastSensorSummary,
  onPress,
}: {
  lot: FieldLot;
  lastSensorSummary: string;
  onPress: () => void;
}): ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir detalhes do lote ${lot.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.topline}>
        <Text style={styles.title}>{lot.name}</Text>
        <Text style={styles.badge}>{statusLabels[lot.status]}</Text>
      </View>
      <Text style={styles.meta}>{lot.crop} · {lot.stage}</Text>
      <Text style={styles.body}>{lot.rowCount} leiras · {lastSensorSummary}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E0D6',
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  pressed: {
    opacity: 0.72,
  },
  topline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    flex: 1,
    color: '#1A1A1A',
    fontSize: 18,
    fontWeight: '900',
  },
  badge: {
    color: '#1B4332',
    borderRadius: 999,
    backgroundColor: '#D8F3DC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '900',
  },
  meta: {
    color: '#2D6A4F',
    fontSize: 14,
    fontWeight: '800',
  },
  body: {
    color: '#66746B',
    fontSize: 14,
    lineHeight: 20,
  },
});
