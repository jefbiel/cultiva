import { FieldLot, LotStatus } from '@/types/agro';

export const fieldLots: FieldLot[] = [
  {
    id: 'lote-01',
    name: 'Lote 01 - Morango Albion',
    crop: 'Morango Albion',
    totalSize: '520 m2',
    stage: 'Florescimento',
    rowCount: 2,
    rowSizeMeters: 24,
    location: 'Estufa 2',
    status: LotStatus.Attention,
    createdAt: '2026-05-18T09:00:00.000Z',
    updatedAt: '2026-06-08T05:50:00.000Z',
    lastIrrigation: 'Hoje, 05:50 - 12 min',
    lastFertilization: '2 dias atras - calcio',
    lastSensorReadingAt: '2026-06-09T08:10:00.000Z',
  },
];
