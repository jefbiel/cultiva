import { FieldLot, PlantingRowSensor } from '@/types/agro';
import { subscribeToSensorUpdates, RealtimeUnsubscribe, SensorUpdateHandler } from '@/services/realtime';

export function connectMockIotStream(
  lots: FieldLot[],
  onUpdate: SensorUpdateHandler
): RealtimeUnsubscribe {
  return subscribeToSensorUpdates(lots, onUpdate);
}

export function summarizeIotRows(rows: PlantingRowSensor[]): string {
  if (rows.length === 0) {
    return 'Sem sensores conectados';
  }

  const latest = rows[0].reading;
  return `${latest.temperature.toFixed(1)} C · solo ${latest.soilHumidity}% · pH ${latest.ph.toFixed(1)}`;
}
