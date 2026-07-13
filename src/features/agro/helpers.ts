import { agriculturalMaps, defaultAgriculturalMap, farmSizeUnitOptions, type AgriculturalMapInfo, type AgriculturalMapType, type HarvestRecord, type PestFocus, type ReportRecord } from '@/features/agro/model';
import { palette } from '@/features/agro/styles';
import { FieldLot, IrrigationStatus, LotStatus, MapCoordinates, PlantingRowSensor, UserIdentity } from '@/types/agro';

export function buildMapAddress(identity: UserIdentity): string {
  if (identity.address !== undefined) {
    const street = identity.address.street.trim();
    const neighborhood = identity.address.neighborhood.trim();
    const city = identity.address.city.trim();
    const state = identity.address.state.trim();

    return [street, neighborhood, city, state, 'Brasil'].filter(Boolean).join(', ');
  }

  return `${identity.preferences.region}, Brasil`;
}

// Monta a URL da imagem de satélite com base nas coordenadas.
export function buildSatelliteImageUri(coordinates: MapCoordinates): string {
  const offset = 0.012;
  const minLongitude = coordinates.longitude - offset;
  const minLatitude = coordinates.latitude - offset;
  const maxLongitude = coordinates.longitude + offset;
  const maxLatitude = coordinates.latitude + offset;
  const bbox = `${minLongitude},${minLatitude},${maxLongitude},${maxLatitude}`;

  return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=900,700&format=png&f=image`;
}

export function getAgriculturalMapInfo(type: AgriculturalMapType): AgriculturalMapInfo {
  const selectedMap = agriculturalMaps.find((mapInfo) => mapInfo.type === type);

  return selectedMap ?? defaultAgriculturalMap;
}

// Desenha a camada agrícola escolhida sobre o mapa.

export function getPestColor(severity: PestFocus['severity']): string {
  if (severity === 'Crítico') {
    return '#C84630';
  }

  if (severity === 'Atenção') {
    return '#D9A441';
  }

  return palette.medium;
}

// Barra inferior com quatro abas e o botão central de ações.

export function formatAddress(identity: UserIdentity): string {
  if (identity.address === undefined) {
    return 'Não informado';
  }

  return `${identity.address.street}, ${identity.address.neighborhood} - ${identity.address.city}/${identity.address.state}`;
}

export function formatDate(value: string): string {
  const date = new Date(value);

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatShortDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('pt-BR').format(date);
}

export function formatQuantity(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 1,
  }).format(value);
}

export function getHarvestRecordsForLot(records: HarvestRecord[], lot: FieldLot): HarvestRecord[] {
  return records.filter((record) => record.lot === lot.name);
}

export function formatFarmSize(size: string, unit: string): string {
  return `${size.trim()} ${unit.trim()}`.trim();
}

export function readFarmSizeValue(savedSize?: string): string {
  if (savedSize === undefined) {
    return '';
  }

  const knownUnit = farmSizeUnitOptions.find((unit) => savedSize.endsWith(unit));

  if (knownUnit === undefined) {
    return savedSize;
  }

  return savedSize.replace(knownUnit, '').trim();
}

export function readFarmSizeUnit(savedSize?: string): string {
  if (savedSize === undefined) {
    return farmSizeUnitOptions[0];
  }

  return farmSizeUnitOptions.find((unit) => savedSize.endsWith(unit)) ?? farmSizeUnitOptions[0];
}

export function getReportStatusStyle(status: ReportRecord['status']): { backgroundColor: string; color?: string } {
  if (status === 'Crítico') {
    return { backgroundColor: '#FDE2E2', color: palette.critical };
  }

  if (status === 'Atenção') {
    return { backgroundColor: '#FFF3CD', color: palette.warning };
  }

  return { backgroundColor: '#D8F3DC', color: palette.primary };
}

export function getLotStatusLabel(status: LotStatus): string {
  if (status === LotStatus.Critical) {
    return 'Crítico';
  }

  if (status === LotStatus.Attention) {
    return 'Atenção';
  }

  return 'Saudável';
}

export function getLotStatusStyle(status: LotStatus): { backgroundColor: string; color?: string } {
  if (status === LotStatus.Critical) {
    return { backgroundColor: '#FDE2E2', color: palette.critical };
  }

  if (status === LotStatus.Attention) {
    return { backgroundColor: '#FFF3CD', color: palette.warning };
  }

  return { backgroundColor: '#D8F3DC', color: palette.primary };
}

export function formatIrrigationStatus(status: IrrigationStatus): string {
  if (status === IrrigationStatus.On) {
    return 'Irrigando';
  }

  if (status === IrrigationStatus.Scheduled) {
    return 'Agendada';
  }

  return 'Desligada';
}

export function averageMetric(
  rows: PlantingRowSensor[],
  selector: (row: PlantingRowSensor) => number
): number {
  if (rows.length === 0) {
    return 0;
  }

  return rows.reduce((total, row) => total + selector(row), 0) / rows.length;
}

export function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

export function getCropCareHint(crop: string): string {
  const normalizedCrop = normalizeText(crop);

  if (normalizedCrop.includes('morango')) {
    return 'Morango exige atenção fina a umidade, ventilação e fungos.';
  }

  if (normalizedCrop.includes('alface')) {
    return 'Alface responde rápido a variações de água, luminosidade e temperatura.';
  }

  if (normalizedCrop.includes('tomate')) {
    return 'Tomate pede acompanhamento de irrigação, condução e alerta de pragas.';
  }

  return 'As recomendações se adaptam conforme cultura, fase e leituras das leiras.';
}

export function getCropRecommendation(
  crop: string,
  soilHumidity: number,
  averageTemperature: number
): string {
  const careHint = getCropCareHint(crop);

  if (soilHumidity > 0 && soilHumidity < 45) {
    return `${careHint} Umidade do solo baixa: priorize vistoria e ajuste de irrigação.`;
  }

  if (averageTemperature > 30) {
    return `${careHint} Temperatura elevada: monitore estresse térmico e ventilação.`;
  }

  return `${careHint} Leituras estáveis: mantenha rotina de rega, fertilização e revisão preventiva.`;
}
