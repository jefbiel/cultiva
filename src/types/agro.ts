// Telas principais controladas pelo fluxo do app.
export enum AppScreen {
  Login = 'login',
  Onboarding = 'onboarding',
  Dashboard = 'dashboard',
  Detail = 'detail',
  LotDetail = 'lot-detail',
}

// Abas exibidas na barra inferior do dashboard.
export enum AppTab {
  Home = 'home',
  Map = 'map',
  Data = 'data',
  Settings = 'settings',
}

// Tipo de usuário usado no login, cadastro e dashboard.
export enum UserRole {
  Farmer = 'farmer',
  Agronomist = 'agronomist',
}

// Nivel de risco dos alertas agrícolas.
export enum AlertSeverity {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

export type UserPreferences = {
  notificationsEnabled: boolean;
  preferredCrop: string;
  region: string;
  useReason: string;
};

export type AddressInfo = {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
};

export type MapCoordinates = {
  latitude: number;
  longitude: number;
  label: string;
};

export type CultivationStage = 'Vegetativo' | 'Florescimento' | 'Frutificação' | 'Colheita';

export enum LotStatus {
  Healthy = 'healthy',
  Attention = 'attention',
  Critical = 'critical',
}

export enum IrrigationStatus {
  On = 'on',
  Off = 'off',
  Scheduled = 'scheduled',
}

export type FieldLot = {
  id: string;
  name: string;
  crop: string;
  totalSize: string;
  stage: CultivationStage;
  rowCount: number;
  rowSizeMeters: number;
  location?: string;
  coordinates?: MapCoordinates;
  status: LotStatus;
  imageUri?: string;
  createdAt: string;
  updatedAt: string;
  lastIrrigation: string;
  lastFertilization: string;
  lastSensorReadingAt?: string;
};

export type SensorReading = {
  id: string;
  lotId: string;
  rowId: string;
  measuredAt: string;
  temperature: number;
  humidity: number;
  soilHumidity: number;
  ph: number;
  electricalConductivity: number;
  luminosity: number;
  irrigationStatus: IrrigationStatus;
  alerts: string[];
};

export type PlantingRowSensor = {
  id: string;
  lotId: string;
  name: string;
  rowSizeMeters: number;
  reading: SensorReading;
};

export type DiagnosisSensorSnapshot = {
  averageTemperature: number;
  soilTemperature: number;
  soilHumidity: number;
  soilPh: number;
  irrigationPumpOn: boolean;
  connected: boolean;
};

export type DiagnosisPlantingRow = {
  name: string;
  crop: string;
  sensors: number;
  temperature: number;
  humidity: number;
  iotStatus: string;
};

// Dados enviados do app para o backend de IA.
export type DiagnosisPayload = {
  userRole: string;
  crop: string;
  region: string;
  sensors: DiagnosisSensorSnapshot;
  plantingRows: DiagnosisPlantingRow[];
  activeAlerts: Pick<AgroAlert, 'title' | 'severity' | 'summary'>[];
};

// Resposta estruturada que a IA devolve para o aplicativo.
export type DiagnosisResult = {
  summary: string;
  severity: 'Baixa' | 'Média' | 'Alta';
  recommendation: string;
  nextStep: string;
};

export type AgroChatMessage = {
  role: 'user' | 'assistant';
  kind: 'text';
  content: string;
};

export type AgroChatContext = {
  userRole: string;
  crop: string;
  region: string;
  sensors: DiagnosisSensorSnapshot;
  plantingRows: DiagnosisPlantingRow[];
  activeAlerts: Pick<AgroAlert, 'title' | 'severity' | 'summary'>[];
  harvests: {
    lot: string;
    crop: string;
    quantity: number;
    unit: string;
    losses: number;
    destination: string;
    harvestDate: string;
  }[];
  reports: {
    title: string;
    sourceType: string;
    crop: string;
    lot: string;
    nitrogen: number;
    phosphorus: number;
    potassium: number;
    ph: number;
    organicMatter: number;
    humidity: number;
    status: string;
    recommendation: string;
  }[];
};

export type AgroChatPayload = {
  messages: AgroChatMessage[];
  context: AgroChatContext;
};

export type AgroChatResult = {
  reply: string;
  severity: 'Baixa' | 'Média' | 'Alta';
  recommendation: string;
  nextStep: string;
};

export type AgroReportAnalysisPayload = {
  sourceType: 'Foto' | 'PDF';
  sourceUri: string;
  context: {
    userRole: string;
    crop: string;
    region: string;
    lots: Pick<FieldLot, 'name' | 'crop' | 'stage' | 'status'>[];
  };
};

export type AgroReportAnalysisResult = {
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

export type FarmerProfile = {
  farmName: string;
  farmSize: string;
  mainCrop: string;
  productionGoal: string;
};

export type AgronomistProfile = {
  specialty: string;
  registration: string;
  serviceRegion: string;
  assistedClients: string;
};

export type UserIdentity = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  document?: string;
  preferences: UserPreferences;
  address?: AddressInfo;
  farmerProfile?: FarmerProfile;
  agronomistProfile?: AgronomistProfile;
};

export type AgroAlert = {
  id: string;
  title: string;
  crop: string;
  region: string;
  severity: AlertSeverity;
  summary: string;
  recommendation: string;
  updatedAt: string;
};

export type LoginForm = {
  role: UserRole | null;
  email: string;
  username: string;
  password: string;
};

export type OnboardingForm = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  document: string;
  preferredCrop: string;
  region: string;
  useReason: string;
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  notificationsEnabled: boolean;
  farmName: string;
  farmSize: string;
  farmSizeUnit: string;
  productionGoal: string;
  specialty: string;
  registration: string;
  serviceRegion: string;
  assistedClients: string;
};
