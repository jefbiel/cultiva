import { FieldLot, PlantingRowSensor } from '@/types/agro';
import { fetchSensorReadings } from '@/services/sensors';

export type RealtimeUnsubscribe = () => void;
export type SensorUpdateHandler = (rows: PlantingRowSensor[]) => void;

export function subscribeToSensorUpdates(
  lots: FieldLot[],
  onUpdate: SensorUpdateHandler
): RealtimeUnsubscribe {
  let active = true;

  async function emitMockUpdate(): Promise<void> {
    const rows = await fetchSensorReadings(lots);

    if (active) {
      onUpdate(rows);
    }
  }

  void emitMockUpdate();
  const intervalId = setInterval(() => {
    void emitMockUpdate();
  }, 4500);

  return () => {
    active = false;
    clearInterval(intervalId);
  };
}
