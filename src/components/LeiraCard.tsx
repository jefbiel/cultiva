import { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PlantingRowSensor } from '@/types/agro';

export function LeiraCard({ row }: { row: PlantingRowSensor }): ReactElement {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{row.name}</Text>
      <Text style={styles.body}>
        {row.reading.temperature.toFixed(1)} C · solo {row.reading.soilHumidity}% · pH{' '}
        {row.reading.ph.toFixed(1)}
      </Text>
      {row.reading.alerts.map((alert) => (
        <Text key={alert} style={styles.alert}>{alert}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E0D6',
    backgroundColor: '#FCFBF8',
    padding: 12,
  },
  title: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '900',
  },
  body: {
    color: '#66746B',
    fontSize: 14,
  },
  alert: {
    color: '#9B2C2C',
    fontSize: 13,
    fontWeight: '800',
  },
});
