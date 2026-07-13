import { FieldLot, IrrigationStatus, LotStatus, PlantingRowSensor, SensorReading } from '@/types/agro';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function variation(seed: number, spread: number): number {
  return Math.sin(seed * 12.9898) * spread;
}

export function buildSensorReading(lot: FieldLot, rowIndex: number): SensorReading {
  const measuredAt = new Date().toISOString();
  const temperature = Number(clamp(23.5 + variation(rowIndex + lot.rowCount, 3.8), 17, 36).toFixed(1));
  const humidity = Math.round(clamp(69 + variation(rowIndex + 3, 13), 40, 95));
  const soilHumidity = Math.round(clamp(64 + variation(rowIndex + 7, 16), 28, 92));
  const ph = Number(clamp(6 + variation(rowIndex + 11, 0.8), 4.8, 7.6).toFixed(1));
  const electricalConductivity = Number(clamp(1.4 + variation(rowIndex + 13, 0.55), 0.3, 3.2).toFixed(2));
  const luminosity = Math.round(clamp(520 + variation(rowIndex + 17, 230), 120, 980));
  const alerts = [
    temperature > 30 ? 'Temperatura acima do ideal' : null,
    soilHumidity < 45 ? 'Umidade do substrato baixa' : null,
    ph < 5.5 || ph > 7 ? 'pH fora da faixa recomendada' : null,
  ].filter((alert): alert is string => alert !== null);

  return {
    id: `${lot.id}-leira-${rowIndex + 1}-${Date.now()}`,
    lotId: lot.id,
    rowId: `${lot.id}-leira-${rowIndex + 1}`,
    measuredAt,
    temperature,
    humidity,
    soilHumidity,
    ph,
    electricalConductivity,
    luminosity,
    irrigationStatus: soilHumidity < 48 ? IrrigationStatus.Scheduled : IrrigationStatus.Off,
    alerts,
  };
}

export function buildRowsForLot(lot: FieldLot): PlantingRowSensor[] {
  return Array.from({ length: lot.rowCount }, (_, index) => ({
    id: `${lot.id}-leira-${index + 1}`,
    lotId: lot.id,
    name: `Leira ${String(index + 1).padStart(2, '0')}`,
    rowSizeMeters: lot.rowSizeMeters,
    reading: buildSensorReading(lot, index),
  }));
}

export async function fetchSensorReadings(lots: FieldLot[]): Promise<PlantingRowSensor[]> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 240);
  });

  return lots.flatMap(buildRowsForLot);
}

export function inferLotStatus(rows: PlantingRowSensor[]): LotStatus {
  const alertCount = rows.reduce((total, row) => total + row.reading.alerts.length, 0);

  if (alertCount >= 3) {
    return LotStatus.Critical;
  }

  if (alertCount > 0) {
    return LotStatus.Attention;
  }

  return LotStatus.Healthy;
}
