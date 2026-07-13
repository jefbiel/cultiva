import { fetchFieldLots } from '@/services/api';
import { loadFieldLots, saveFieldLots } from '@/services/storage';
import { FieldLot, LotStatus } from '@/types/agro';

export type CreateLotInput = {
  name: string;
  crop: string;
  totalSize: string;
  rowCount: number;
  rowSizeMeters: number;
  stage: FieldLot['stage'];
  location?: string;
  imageUri?: string;
};

export async function listLots(): Promise<FieldLot[]> {
  return (await loadFieldLots()) ?? (await fetchFieldLots());
}

export async function getLotById(lotId: string): Promise<FieldLot | null> {
  const lots = await listLots();
  return lots.find((lot) => lot.id === lotId) ?? null;
}

export async function createLot(input: CreateLotInput): Promise<FieldLot> {
  const now = new Date().toISOString();
  const lot: FieldLot = {
    id: `lote-${Date.now()}`,
    name: input.name,
    crop: input.crop,
    totalSize: input.totalSize,
    stage: input.stage,
    rowCount: input.rowCount,
    rowSizeMeters: input.rowSizeMeters,
    location: input.location,
    status: LotStatus.Healthy,
    imageUri: input.imageUri,
    createdAt: now,
    updatedAt: now,
    lastIrrigation: 'Sem rega registrada',
    lastFertilization: 'Sem fertilizacao registrada',
    lastSensorReadingAt: now,
  };
  const lots = await listLots();
  await saveFieldLots([lot, ...lots]);
  return lot;
}

export async function updateLot(updatedLot: FieldLot): Promise<FieldLot> {
  const lots = await listLots();
  const nextLot = { ...updatedLot, updatedAt: new Date().toISOString() };
  await saveFieldLots(lots.map((lot) => (lot.id === nextLot.id ? nextLot : lot)));
  return nextLot;
}
