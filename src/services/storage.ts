import AsyncStorage from '@react-native-async-storage/async-storage';

import { FieldLot, LotStatus, UserIdentity, UserRole } from '@/types/agro';

const USER_IDENTITY_KEY = '@agroconnect:user-identity';
const FIELD_LOTS_KEY = '@agroconnect:field-lots';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUserRole(value: unknown): value is UserRole {
  return value === UserRole.Farmer || value === UserRole.Agronomist;
}

function isUserIdentity(value: unknown): value is UserIdentity {
  if (!isRecord(value) || !isRecord(value.preferences)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.email === 'string' &&
    isUserRole(value.role) &&
    (typeof value.document === 'string' || typeof value.document === 'undefined') &&
    typeof value.preferences.notificationsEnabled === 'boolean' &&
    typeof value.preferences.preferredCrop === 'string' &&
    typeof value.preferences.region === 'string' &&
    (typeof value.preferences.useReason === 'string' ||
      typeof value.preferences.useReason === 'undefined') &&
    (typeof value.address === 'undefined' || isRecord(value.address)) &&
    (typeof value.farmerProfile === 'undefined' || isRecord(value.farmerProfile)) &&
    (typeof value.agronomistProfile === 'undefined' || isRecord(value.agronomistProfile))
  );
}

function isFieldLot(value: unknown): value is FieldLot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.crop === 'string' &&
    typeof value.totalSize === 'string' &&
    (value.stage === 'Vegetativo' ||
      value.stage === 'Florescimento' ||
      value.stage === 'Frutificacao' ||
      value.stage === 'Colheita') &&
    typeof value.rowCount === 'number' &&
    typeof value.rowSizeMeters === 'number' &&
    (value.status === LotStatus.Healthy ||
      value.status === LotStatus.Attention ||
      value.status === LotStatus.Critical) &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    typeof value.lastIrrigation === 'string' &&
    typeof value.lastFertilization === 'string'
  );
}

function normalizeFieldLot(value: unknown): FieldLot | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    (value.stage !== 'Vegetativo' &&
      value.stage !== 'Florescimento' &&
      value.stage !== 'Frutificacao' &&
      value.stage !== 'Frutificação' &&
      value.stage !== 'Colheita') ||
    typeof value.rowCount !== 'number' ||
    typeof value.rowSizeMeters !== 'number' ||
    typeof value.lastIrrigation !== 'string' ||
    typeof value.lastFertilization !== 'string'
  ) {
    return null;
  }

  const now = new Date().toISOString();
  const migratedId = value.id === 'lote-07' ? 'lote-01' : value.id;
  const migratedName =
    value.name === 'Lote 07 - Morango Albion' ? 'Lote 01 - Morango Albion' : value.name;

  return {
    id: migratedId,
    name: migratedName,
    crop: typeof value.crop === 'string' ? value.crop : value.name.replace(/^Lote \d+\s-\s/, ''),
    totalSize: typeof value.totalSize === 'string' ? value.totalSize : `${value.rowCount * value.rowSizeMeters} m`,
    stage: value.stage === 'Frutificacao' ? 'Frutificação' : value.stage,
    rowCount: value.rowCount,
    rowSizeMeters: value.rowSizeMeters,
    location: typeof value.location === 'string' ? value.location : undefined,
    status:
      value.status === LotStatus.Attention || value.status === LotStatus.Critical
        ? value.status
        : LotStatus.Healthy,
    imageUri: typeof value.imageUri === 'string' ? value.imageUri : undefined,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : now,
    lastIrrigation: value.lastIrrigation,
    lastFertilization: value.lastFertilization,
    lastSensorReadingAt:
      typeof value.lastSensorReadingAt === 'string' ? value.lastSensorReadingAt : undefined,
  };
}

function isDeletedLot(lot: FieldLot): boolean {
  const normalizedId = lot.id.trim().toLowerCase();
  const normalizedName = lot.name.trim().toLowerCase();

  return (
    normalizedId === 'lote-04' ||
    normalizedId === 'lote-11' ||
    normalizedId === 'lote-68' ||
    normalizedName.startsWith('lote 04') ||
    normalizedName.startsWith('lote 11') ||
    normalizedName.startsWith('lote 68')
  );
}

export async function saveUserIdentity(identity: UserIdentity): Promise<void> {
  await AsyncStorage.setItem(USER_IDENTITY_KEY, JSON.stringify(identity));
}

export async function loadUserIdentity(): Promise<UserIdentity | null> {
  const rawValue = await AsyncStorage.getItem(USER_IDENTITY_KEY);

  if (rawValue === null) {
    return null;
  }

  const parsedValue: unknown = JSON.parse(rawValue);

  if (!isUserIdentity(parsedValue)) {
    await clearUserIdentity();
    return null;
  }

  return parsedValue;
}

export async function clearUserIdentity(): Promise<void> {
  await AsyncStorage.removeItem(USER_IDENTITY_KEY);
}

export async function saveFieldLots(lots: FieldLot[]): Promise<void> {
  await AsyncStorage.setItem(FIELD_LOTS_KEY, JSON.stringify(lots));
}

export async function loadFieldLots(): Promise<FieldLot[] | null> {
  const rawValue = await AsyncStorage.getItem(FIELD_LOTS_KEY);

  if (rawValue === null) {
    return null;
  }

  const parsedValue: unknown = JSON.parse(rawValue);

  if (!Array.isArray(parsedValue)) {
    await AsyncStorage.removeItem(FIELD_LOTS_KEY);
    return null;
  }

  const normalizedLots = parsedValue.map(normalizeFieldLot);

  if (normalizedLots.some((lot) => lot === null)) {
    await AsyncStorage.removeItem(FIELD_LOTS_KEY);
    return null;
  }

  const validLots = normalizedLots.filter(isFieldLot);
  const visibleLots = validLots.filter((lot) => !isDeletedLot(lot));

  if (visibleLots.length !== validLots.length) {
    await saveFieldLots(visibleLots);
  }

  return visibleLots;
}
