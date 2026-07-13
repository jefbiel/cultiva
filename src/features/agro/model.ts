import { SymbolView } from 'expo-symbols';
import { type ComponentProps } from 'react';

import { AlertSeverity, FieldLot, LoginForm, OnboardingForm, UserRole } from '@/types/agro';

export type LiveSensorState = {
  soilTemperature: number;
  soilHumidity: number;
  soilPh: number;
  irrigationPumpOn: boolean;
  connected: boolean;
  lastUpdatedAt: Date;
};

export type LotForm = {
  name: string;
  crop: string;
  totalSize: string;
  stage: FieldLot['stage'];
  rowCount: string;
  rowSizeMeters: string;
  location: string;
  imageUri?: string;
};

export type HarvestForm = {
  lot: string;
  crop: string;
  harvestDate: string;
  quantity: string;
  unit: string;
  qualityClass: string;
  losses: string;
  destination: string;
  responsible: string;
  notes: string;
};

export type HarvestRecord = {
  id: string;
  lot: string;
  crop: string;
  harvestDate: string;
  quantity: number;
  unit: string;
  qualityClass: string;
  losses: number;
  destination: string;
  responsible: string;
  notes: string;
};

export type ReportSourceType = 'Foto' | 'PDF';

export type ReportRecord = {
  id: string;
  sourceType: ReportSourceType;
  sourceUri?: string;
  capturedAt: string;
  title: string;
  crop: string;
  lot: string;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  ph: number;
  organicMatter: number;
  humidity: number;
  status: 'Adequado' | 'Atenção' | 'Crítico';
  recommendation: string;
};

export type ActionMenuMode = 'menu' | 'harvest' | 'lot';
export type SymbolName = ComponentProps<typeof SymbolView>['name'];
export type DiagnosisChatMessage = {
  id: string;
  sender: 'user' | 'ai';
  kind: 'text';
  text: string;
};

export type PestFocus = {
  id: string;
  label: string;
  severity: 'Controlado' | 'Atenção' | 'Crítico';
  top: number;
  left: number;
};

export type AgriculturalMapType = 'ndvi' | 'productivity' | 'soil' | 'relief';

export type AgriculturalMapInfo = {
  type: AgriculturalMapType;
  label: string;
  icon: string;
  apiStatus: string;
  shortDescription: string;
  detail: string;
  usage: string;
};

export const roleLabels: Record<UserRole, string> = {
  [UserRole.Farmer]: 'Agricultor',
  [UserRole.Agronomist]: 'Agrônomo',
};

export const appName = 'Cultiva';
export const cultivaLogo = require('../../../assets/images/cultiva-logo.png');

export const severityLabels: Record<AlertSeverity, string> = {
  [AlertSeverity.Low]: 'Baixo',
  [AlertSeverity.Medium]: 'Médio',
  [AlertSeverity.High]: 'Alto',
};

export const cropOptions = ['Morango', 'Soja', 'Milho', 'Café', 'Hortaliças', 'Algodão'];
export const farmSizeUnitOptions = ['hectares', 'metros quadrados', 'alqueires'];
export const specialtyOptions = ['Solos', 'Fitotecnia', 'Defensivos', 'Irrigação', 'Fruticultura'];
export const assistedClientsOptions = ['Até 5 produtores', '6 a 20 produtores', '21 a 50 produtores', 'Mais de 50'];

export const pestFocuses: PestFocus[] = [
  { id: 'pin-1', label: 'Oídio', severity: 'Crítico', top: 36, left: 64 },
  { id: 'pin-2', label: 'Ácaro', severity: 'Atenção', top: 58, left: 34 },
  { id: 'pin-3', label: 'Área tratada', severity: 'Controlado', top: 24, left: 24 },
];

export const defaultAgriculturalMap: AgriculturalMapInfo = {
  type: 'ndvi',
  label: 'NDVI',
  icon: 'ND',
  apiStatus: 'Simulado com base de satélite',
  shortDescription:
    'Mostra o vigor da vegetação e ajuda a encontrar estresse hídrico ou pragas antes da colheita.',
  detail:
    'O NDVI compara a luz refletida pelas folhas para indicar se a planta está ativa, fraca ou sob estresse. No app, a imagem de satélite usa a localização cadastrada e a camada colorida e simulada.',
  usage:
    'Use as manchas amarelas e vermelhas para priorizar vistoria de campo, reduzir irrigação excessiva e decidir onde pedir avaliação do agrônomo.',
};

export const agriculturalMaps: AgriculturalMapInfo[] = [
  defaultAgriculturalMap,
  {
    type: 'productivity',
    label: 'Produtividade',
    icon: 'KG',
    apiStatus: 'Simulado sem API de colheitadeira',
    shortDescription:
      'Aponta quais áreas renderam mais caixas por metro quadrado e quais ficaram abaixo do esperado.',
    detail:
      'Em uma operação real, esse mapa viria de sensores de colheita ou registros de pesagem por lote. Aqui simulamos zonas de alto, médio e baixo rendimento para estudo.',
    usage:
      'Compare com NDVI e solo para entender se a baixa produção veio de nutrição, umidade, praga ou manejo.',
  },
  {
    type: 'soil',
    label: 'Solo',
    icon: 'SO',
    apiStatus: 'Simulado com zonas de manejo',
    shortDescription:
      'Organiza pH, textura, argila e matéria orgânica para orientar fertilização e correção do solo.',
    detail:
      'O mapa de solo normalmente nasce de amostras georreferenciadas enviadas ao laboratório. No protótipo, as zonas são simuladas para demonstrar a decisão técnica.',
    usage:
      'Use para separar talhões por necessidade de calagem, adubação e irrigação, evitando aplicar tudo igual na propriedade inteira.',
  },
  {
    type: 'relief',
    label: 'Relevo',
    icon: 'RV',
    apiStatus: 'Simulado com curvas de nível',
    shortDescription:
      'Mostra declividade e escoamento de água para prevenir erosão e excesso de umidade nas leiras.',
    detail:
      'Mapas topográficos reais podem vir de drone, satélite ou levantamento em campo. Aqui simulamos curvas de nível e fluxo da água.',
    usage:
      'Use para planejar drenagem, posicionar novas leiras e entender pontos onde fertilizante ou água podem se acumular.',
  },
];

export const defaultSatelliteImageUri =
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=-46.735,-23.645,-46.715,-23.625&bboxSR=4326&imageSR=4326&size=900,700&format=png&f=image';

export const initialLoginForm: LoginForm = {
  role: UserRole.Farmer,
  email: '',
  username: '',
  password: '',
};

export const initialOnboardingForm: OnboardingForm = {
  name: '',
  email: '',
  password: '',
  role: UserRole.Farmer,
  document: '',
  preferredCrop: '',
  region: '',
  useReason: '',
  cep: '',
  street: '',
  neighborhood: '',
  city: '',
  state: '',
  notificationsEnabled: true,
  farmName: '',
  farmSize: '',
  farmSizeUnit: 'hectares',
  productionGoal: '',
  specialty: '',
  registration: '',
  serviceRegion: '',
  assistedClients: '',
};
