import { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function SensorMetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}): ReactElement {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {helper !== undefined && <Text style={styles.helper}>{helper}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexBasis: '47%',
    gap: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E0D6',
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  label: {
    color: '#66746B',
    fontSize: 13,
    fontWeight: '800',
  },
  value: {
    color: '#1A1A1A',
    fontSize: 18,
    fontWeight: '900',
  },
  helper: {
    color: '#66746B',
    fontSize: 12,
  },
});
