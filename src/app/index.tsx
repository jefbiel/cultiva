import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  analyzeAgroReportWithAi,
  chatWithAgroAi,
  fetchAgroAlerts,
  fetchCoordinatesByAddress,
  fetchFieldLots,
} from '@/services/api';
import {
  Field,
  InfoRow,
  OptionGroup,
  PrimaryButton,
  SecondaryButton,
  SeverityPill,
} from '@/features/agro/components';
import {
  averageMetric,
  buildMapAddress,
  buildSatelliteImageUri,
  formatAddress,
  formatDate,
  formatFarmSize,
  formatIrrigationStatus,
  formatQuantity,
  formatShortDate,
  getAgriculturalMapInfo,
  getCropCareHint,
  getCropRecommendation,
  getHarvestRecordsForLot,
  getLotStatusLabel,
  getLotStatusStyle,
  getPestColor,
  getReportStatusStyle,
  readFarmSizeUnit,
  readFarmSizeValue,
} from '@/features/agro/helpers';
import {
  agriculturalMaps,
  appName,
  cultivaLogo,
  defaultSatelliteImageUri,
  initialLoginForm,
  initialOnboardingForm,
  pestFocuses,
  roleLabels,
  type ActionMenuMode,
  type AgriculturalMapType,
  type DiagnosisChatMessage,
  type HarvestForm,
  type HarvestRecord,
  type LiveSensorState,
  type LotForm,
  type ReportRecord,
  type ReportSourceType,
  type SymbolName,
} from '@/features/agro/model';
import { LoginScreen, OnboardingScreen } from '@/features/agro/screens/AuthScreens';
import { palette, styles } from '@/features/agro/styles';
import { useSensors } from '@/hooks/useSensors';
import { summarizeIotRows } from '@/services/iot';
import { buildRowsForLot, inferLotStatus } from '@/services/sensors';
import {
  clearUserIdentity,
  loadFieldLots as loadStoredFieldLots,
  loadUserIdentity,
  saveFieldLots,
  saveUserIdentity,
} from '@/services/storage';
import {
  AgroAlert,
  AgroChatPayload,
  AgroReportAnalysisPayload,
  AgroReportAnalysisResult,
  AppScreen,
  AppTab,
  FieldLot,
  LoginForm,
  LotStatus,
  OnboardingForm,
  PlantingRowSensor,
  UserIdentity,
  UserRole,
} from '@/types/agro';

function createInitialHarvestForm(identity?: UserIdentity, lots: FieldLot[] = []): HarvestForm {
  return {
    lot: lots[0]?.name ?? 'Lote 01 - Morango Albion',
    crop: identity?.preferences.preferredCrop || lots[0]?.crop || 'Cultura principal',
    harvestDate: new Date().toISOString().slice(0, 10),
    quantity: '',
    unit: 'caixas',
    qualityClass: 'Classe A',
    losses: '0',
    destination: 'Venda direta',
    responsible: identity?.name ?? '',
    notes: '',
  };
}

function createInitialLotForm(identity: UserIdentity): LotForm {
  const crop = identity.preferences.preferredCrop || 'Nova cultura';

  return {
    name: `Lote ${String(Date.now()).slice(-2)} - ${crop}`,
    crop,
    totalSize: '',
    stage: 'Vegetativo',
    rowCount: '3',
    rowSizeMeters: '24',
    location: identity.address !== undefined ? formatAddress(identity) : identity.preferences.region,
  };
}

// Simula sensores ao vivo de solo, umidade, pH e bomba de irrigação.
function useWeatherLive(): LiveSensorState {
  const [liveState, setLiveState] = useState<LiveSensorState>({
    soilTemperature: 22.8,
    soilHumidity: 68,
    soilPh: 6.1,
    irrigationPumpOn: true,
    connected: true,
    lastUpdatedAt: new Date(),
  });

  useEffect(() => {
    const intervalId = setInterval(() => {
      setLiveState((current) => {
        const nextConnected = Math.random() > 0.08;
        const humidityShift = current.irrigationPumpOn ? 1.4 : -0.8;

        return {
          soilTemperature: clampNumber(current.soilTemperature + randomBetween(-0.3, 0.35), 18, 31),
          soilHumidity: clampNumber(current.soilHumidity + humidityShift + randomBetween(-0.7, 0.7), 42, 88),
          soilPh: clampNumber(current.soilPh + randomBetween(-0.04, 0.04), 5.3, 7.2),
          irrigationPumpOn: Math.random() > 0.42,
          connected: nextConnected,
          lastUpdatedAt: new Date(),
        };
      });
    }, 2400);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return liveState;
}

// Mantém os números simulados dentro de limites seguros.
function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Gera pequenas variações para parecer leitura em tempo real.
function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function createReportRecordFromAnalysis({
  analysis,
  sourceType,
  sourceUri,
}: {
  analysis: AgroReportAnalysisResult;
  sourceType: ReportSourceType;
  sourceUri?: string;
}): ReportRecord {
  return {
    id: `laudo-${Date.now()}`,
    sourceType,
    sourceUri,
    capturedAt: new Date().toISOString(),
    title: analysis.title,
    crop: analysis.crop,
    lot: analysis.lot,
    nitrogen: analysis.nitrogen,
    phosphorus: analysis.phosphorus,
    potassium: analysis.potassium,
    ph: analysis.ph,
    organicMatter: analysis.organicMatter,
    humidity: analysis.humidity,
    status: analysis.status,
    recommendation: analysis.recommendation,
  };
}

// Componente raiz: decide entre login, cadastro, dashboard e detalhe de alerta.
export default function AppHome(): ReactElement {
  const [screen, setScreen] = useState<AppScreen>(AppScreen.Login);
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.Home);
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<AgroAlert | null>(null);
  const [selectedLot, setSelectedLot] = useState<FieldLot | null>(null);
  const [alerts, setAlerts] = useState<AgroAlert[]>([]);
  const [isBooting, setIsBooting] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState<LoginForm>(initialLoginForm);
  const [onboardingForm, setOnboardingForm] = useState<OnboardingForm>(initialOnboardingForm);

  const restoreIdentity = useCallback(async (): Promise<void> => {
    try {
      const storedIdentity = await loadUserIdentity();

      if (storedIdentity !== null) {
        setIdentity(storedIdentity);
        setLoginForm({
          role: storedIdentity.role,
          email: storedIdentity.email,
          username: storedIdentity.name,
          password: '',
        });
        setOnboardingForm({
          name: storedIdentity.name,
          email: storedIdentity.email,
          password: '',
          role: storedIdentity.role,
          document: storedIdentity.document ?? '',
          preferredCrop: storedIdentity.preferences.preferredCrop,
          region: storedIdentity.preferences.region,
          useReason: storedIdentity.preferences.useReason ?? '',
          cep: storedIdentity.address?.cep ?? '',
          street: storedIdentity.address?.street ?? '',
          neighborhood: storedIdentity.address?.neighborhood ?? '',
          city: storedIdentity.address?.city ?? '',
          state: storedIdentity.address?.state ?? '',
          notificationsEnabled: storedIdentity.preferences.notificationsEnabled,
          farmName: storedIdentity.farmerProfile?.farmName ?? '',
          farmSize: readFarmSizeValue(storedIdentity.farmerProfile?.farmSize),
          farmSizeUnit: readFarmSizeUnit(storedIdentity.farmerProfile?.farmSize),
          productionGoal: storedIdentity.farmerProfile?.productionGoal ?? '',
          specialty: storedIdentity.agronomistProfile?.specialty ?? '',
          registration: storedIdentity.agronomistProfile?.registration ?? '',
          serviceRegion: storedIdentity.agronomistProfile?.serviceRegion ?? '',
          assistedClients: storedIdentity.agronomistProfile?.assistedClients ?? '',
        });
        setActiveTab(AppTab.Home);
        setScreen(AppScreen.Dashboard);
      }
    } catch {
      setErrorMessage('Não foi possível carregar os dados salvos neste aparelho.');
    } finally {
      setIsBooting(false);
    }
  }, []);

  const loadAlerts = useCallback(async (): Promise<void> => {
    setErrorMessage(null);

    try {
      const loadedAlerts = await fetchAgroAlerts();
      setAlerts(loadedAlerts);
    } catch {
      setErrorMessage('Não foi possível buscar os alertas agrícolas.');
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void restoreIdentity();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [restoreIdentity]);

  useEffect(() => {
    if (identity !== null) {
      const timeoutId = setTimeout(() => {
        void loadAlerts();
      }, 0);

      return () => {
        clearTimeout(timeoutId);
      };
    }

    return undefined;
  }, [identity, loadAlerts]);

  // Valida o login usando o usuário salvo no aparelho.
  async function handleLogin(): Promise<void> {
    setErrorMessage(null);

    const storedIdentity = await loadUserIdentity();

    if (storedIdentity === null) {
      setErrorMessage('Nenhum cadastro encontrado neste aparelho. Crie sua conta primeiro.');
      return;
    }

    const identifier =
      loginForm.role === UserRole.Farmer ? loginForm.email.trim().toLowerCase() : loginForm.username.trim();

    const expectedIdentifier =
      storedIdentity.role === UserRole.Farmer
        ? storedIdentity.email.toLowerCase()
        : storedIdentity.name.trim();

    if (loginForm.role !== storedIdentity.role || identifier !== expectedIdentifier) {
      setErrorMessage('Perfil ou dados de acesso não conferem com o cadastro salvo.');
      return;
    }

    setIdentity(storedIdentity);
    setActiveTab(AppTab.Home);
    setScreen(AppScreen.Dashboard);
  }

  // Salva o cadastro localmente e entra no dashboard.
  async function handleSaveIdentity(): Promise<void> {
    const nextIdentity: UserIdentity = {
      id: `usuário-${Date.now()}`,
      name: onboardingForm.name.trim(),
      email: onboardingForm.email.trim().toLowerCase(),
      role: onboardingForm.role,
      document: onboardingForm.document.trim() || undefined,
      preferences: {
        notificationsEnabled: onboardingForm.notificationsEnabled,
        preferredCrop: onboardingForm.preferredCrop.trim(),
        region: onboardingForm.region.trim(),
        useReason: onboardingForm.useReason.trim(),
      },
      address:
        onboardingForm.cep.trim().length > 0
          ? {
              cep: onboardingForm.cep.trim(),
              street: onboardingForm.street.trim(),
              neighborhood: onboardingForm.neighborhood.trim(),
              city: onboardingForm.city.trim(),
              state: onboardingForm.state.trim(),
            }
      : undefined,
      farmerProfile:
        onboardingForm.role === UserRole.Farmer
          ? {
              farmName: onboardingForm.farmName.trim(),
              farmSize: formatFarmSize(onboardingForm.farmSize, onboardingForm.farmSizeUnit),
              mainCrop: onboardingForm.preferredCrop.trim(),
              productionGoal: onboardingForm.productionGoal.trim() || 'Monitorar lotes de cultivo',
            }
          : undefined,
      agronomistProfile:
        onboardingForm.role === UserRole.Agronomist
          ? {
              specialty: onboardingForm.specialty.trim(),
              registration: onboardingForm.registration.trim(),
              serviceRegion: onboardingForm.serviceRegion.trim(),
              assistedClients: onboardingForm.assistedClients.trim(),
            }
          : undefined,
    };

    await saveUserIdentity(nextIdentity);
    setIdentity(nextIdentity);
    setLoginForm({
      role: nextIdentity.role,
      email: nextIdentity.email,
      username: nextIdentity.name,
      password: '',
    });
    setActiveTab(AppTab.Home);
    setScreen(AppScreen.Dashboard);
  }

  // Limpa os dados locais e volta para o login.
  async function handleClearIdentity(): Promise<void> {
    await clearUserIdentity();
    setIdentity(null);
    setSelectedAlert(null);
    setSelectedLot(null);
    setLoginForm(initialLoginForm);
    setOnboardingForm(initialOnboardingForm);
    setActiveTab(AppTab.Home);
    setScreen(AppScreen.Login);
  }

  function handleOpenAlert(alert: AgroAlert): void {
    setSelectedAlert(alert);
    setScreen(AppScreen.Detail);
  }

  function handleOpenLot(lot: FieldLot): void {
    setSelectedLot(lot);
    setScreen(AppScreen.LotDetail);
  }

  function handleBackToDashboard(): void {
    setSelectedAlert(null);
    setSelectedLot(null);
    setActiveTab(AppTab.Map);
    setScreen(AppScreen.Dashboard);
  }

  function handleBackToHome(): void {
    setSelectedLot(null);
    setActiveTab(AppTab.Home);
    setScreen(AppScreen.Dashboard);
  }

  // Atualiza a preferência de notificações no AsyncStorage.
  async function handleToggleNotifications(notificationsEnabled: boolean): Promise<void> {
    if (identity === null) {
      return;
    }

    const nextIdentity: UserIdentity = {
      ...identity,
      preferences: {
        ...identity.preferences,
        notificationsEnabled,
      },
    };

    await saveUserIdentity(nextIdentity);
    setIdentity(nextIdentity);
    setOnboardingForm((current) => ({ ...current, notificationsEnabled }));
  }

  const canLogin: boolean =
    loginForm.role !== null &&
    loginForm.password.trim().length >= 3 &&
    (loginForm.role === UserRole.Farmer
      ? loginForm.email.includes('@')
      : loginForm.username.trim().length >= 3);

  const canSubmit: boolean =
    onboardingForm.name.trim().length >= 3 &&
    onboardingForm.email.includes('@') &&
    onboardingForm.password.trim().length >= 3 &&
    onboardingForm.preferredCrop.trim().length >= 2 &&
    onboardingForm.region.trim().length >= 2 &&
    onboardingForm.cep.replace(/\D/g, '').length === 8 &&
    onboardingForm.street.trim().length >= 2 &&
    onboardingForm.city.trim().length >= 2 &&
    onboardingForm.state.trim().length === 2 &&
    (onboardingForm.role === UserRole.Farmer
      ? onboardingForm.farmName.trim().length >= 2 &&
        Number(onboardingForm.farmSize.replace(',', '.')) > 0 &&
        onboardingForm.farmSizeUnit.trim().length >= 2
      : onboardingForm.specialty.trim().length >= 2 &&
        onboardingForm.registration.trim().length >= 2 &&
        onboardingForm.serviceRegion.trim().length >= 2);

  const filteredAlerts: AgroAlert[] = useMemo(() => {
    if (identity === null) {
      return alerts;
    }

    const crop = identity.preferences.preferredCrop.trim().toLowerCase();
    const region = identity.preferences.region.trim().toLowerCase();

    const preferredAlerts = alerts.filter((alert) => {
      const sameCrop = alert.crop.toLowerCase().includes(crop);
      const sameRegion = alert.region.toLowerCase().includes(region);
      return sameCrop || sameRegion;
    });

    return preferredAlerts.length > 0 ? preferredAlerts : alerts;
  }, [alerts, identity]);

  if (isBooting) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator color={palette.medium} size="large" />
        <Text style={styles.mutedText}>Carregando sua experiência...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', default: undefined })}
      style={styles.root}>
      {screen === AppScreen.Login && (
        <LoginScreen
          form={loginForm}
          canSubmit={canLogin}
          errorMessage={errorMessage}
          onChangeForm={setLoginForm}
          onCreateAccount={(role) => {
            setErrorMessage(null);
            setOnboardingForm((current) => ({ ...current, role }));
            setScreen(AppScreen.Onboarding);
          }}
          onSubmit={() => void handleLogin()}
        />
      )}

      {screen === AppScreen.Onboarding && (
        <OnboardingScreen
          form={onboardingForm}
          canSubmit={canSubmit}
          onChangeForm={setOnboardingForm}
          onBackToLogin={() => {
            setErrorMessage(null);
            setScreen(AppScreen.Login);
          }}
          onSubmit={() => void handleSaveIdentity()}
        />
      )}

      {screen === AppScreen.Dashboard && identity !== null && (
        <DashboardScreen
          identity={identity}
          activeTab={activeTab}
          alerts={filteredAlerts}
          onChangeTab={setActiveTab}
          onOpenAlert={handleOpenAlert}
          onOpenLot={handleOpenLot}
          onToggleNotifications={(enabled) => void handleToggleNotifications(enabled)}
          onClearIdentity={() => void handleClearIdentity()}
        />
      )}

      {screen === AppScreen.Detail && selectedAlert !== null && identity !== null && (
        <DetailScreen alert={selectedAlert} identity={identity} onBack={handleBackToDashboard} />
      )}

      {screen === AppScreen.LotDetail && selectedLot !== null && identity !== null && (
        <LotDetailScreen lot={selectedLot} identity={identity} onBack={handleBackToHome} />
      )}
    </KeyboardAvoidingView>
  );
}

function DashboardScreen({
  identity,
  activeTab,
  alerts,
  onChangeTab,
  onOpenAlert,
  onOpenLot,
  onToggleNotifications,
  onClearIdentity,
}: {
  identity: UserIdentity;
  activeTab: AppTab;
  alerts: AgroAlert[];
  onChangeTab: (tab: AppTab) => void;
  onOpenAlert: (alert: AgroAlert) => void;
  onOpenLot: (lot: FieldLot) => void;
  onToggleNotifications: (enabled: boolean) => void;
  onClearIdentity: () => void;
}): ReactElement {
  const [actionMenuVisible, setActionMenuVisible] = useState<boolean>(false);
  const [actionMenuMode, setActionMenuMode] = useState<ActionMenuMode>('menu');
  const [reportCameraVisible, setReportCameraVisible] = useState<boolean>(false);
  const [diagnosisChatVisible, setDiagnosisChatVisible] = useState<boolean>(false);
  const [fieldActionResult, setFieldActionResult] = useState<string | null>(null);
  const [fieldLots, setFieldLots] = useState<FieldLot[]>([]);
  const [fieldLotsLoading, setFieldLotsLoading] = useState<boolean>(true);
  const [fieldLotsError, setFieldLotsError] = useState<string | null>(null);
  const [harvestForm, setHarvestForm] = useState<HarvestForm>(() => createInitialHarvestForm(identity));
  const [lotForm, setLotForm] = useState<LotForm>(() => createInitialLotForm(identity));
  const [harvestRecords, setHarvestRecords] = useState<HarvestRecord[]>([]);
  const [reportRecords, setReportRecords] = useState<ReportRecord[]>([]);
  const [reportAnalysisLoading, setReportAnalysisLoading] = useState<boolean>(false);
  const [diagnosisMessages, setDiagnosisMessages] = useState<DiagnosisChatMessage[]>([
    {
      id: 'ia-inicial',
      sender: 'ai',
      kind: 'text',
      text: 'Sou a IA agrícola conectada ao backend. Envie sua pergunta para eu analisar o contexto da lavoura.',
    },
  ]);
  const [diagnosisText, setDiagnosisText] = useState<string>('');
  const [diagnosisLoading, setDiagnosisLoading] = useState<boolean>(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const liveSensors = useWeatherLive();
  const { rows: sensorRows } = useSensors(fieldLots);

  useEffect(() => {
    let active = true;

    async function loadFieldLots(): Promise<void> {
      setFieldLotsLoading(true);
      setFieldLotsError(null);

      try {
        const loadedLots = (await loadStoredFieldLots()) ?? (await fetchFieldLots());

        if (active) {
          setFieldLots(loadedLots);
          setHarvestForm((current) => ({
            ...current,
            lot: current.lot.trim().length > 0 ? current.lot : loadedLots[0]?.name ?? current.lot,
          }));
        }
      } catch {
        if (active) {
          setFieldLotsError('Não foi possível carregar os lotes produtivos.');
        }
      } finally {
        if (active) {
          setFieldLotsLoading(false);
        }
      }
    }

    void loadFieldLots();

    return () => {
      active = false;
    };
  }, []);

  const canSubmitHarvest =
    harvestForm.lot.trim().length >= 2 &&
    harvestForm.crop.trim().length >= 2 &&
    harvestForm.harvestDate.trim().length >= 8 &&
    Number(harvestForm.quantity.replace(',', '.')) > 0 &&
    harvestForm.destination.trim().length >= 2;

  const canSubmitLot =
    lotForm.name.trim().length >= 3 &&
    lotForm.crop.trim().length >= 2 &&
    lotForm.totalSize.trim().length >= 1 &&
    Number.parseInt(lotForm.rowCount, 10) > 0 &&
    Number(lotForm.rowSizeMeters.replace(',', '.')) > 0 &&
    lotForm.location.trim().length >= 2;

  function handleSubmitLot(): void {
    if (!canSubmitLot) {
      return;
    }

    const rowCount = clampNumber(Number.parseInt(lotForm.rowCount, 10), 1, 60);
    const rowSizeMeters = clampNumber(Number(lotForm.rowSizeMeters.replace(',', '.')), 1, 500);
    const lot: FieldLot = {
      id: `lote-${Date.now()}`,
      name: lotForm.name.trim(),
      crop: lotForm.crop.trim(),
      totalSize: lotForm.totalSize.trim(),
      stage: lotForm.stage,
      rowCount,
      rowSizeMeters,
      location: lotForm.location.trim(),
      status: LotStatus.Healthy,
      imageUri: lotForm.imageUri,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastIrrigation: 'Sem rega registrada',
      lastFertilization: 'Sem fertilização registrada',
      lastSensorReadingAt: new Date().toISOString(),
    };

    setFieldLots((current) => {
      const nextLots = [lot, ...current];
      void saveFieldLots(nextLots);
      return nextLots;
    });
    setHarvestForm((current) => ({ ...current, lot: lot.name, crop: lotForm.crop.trim() }));
    setLotForm(createInitialLotForm(identity));
    setFieldActionResult(
      `Lote cadastrado: ${lot.name}, com ${lot.rowCount} leiras de ${formatQuantity(lot.rowSizeMeters)} m.`
    );
    setActionMenuVisible(false);
    onChangeTab(AppTab.Data);
  }

  async function handlePickLotImage(): Promise<void> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setFieldActionResult('Permissão de mídia negada. Não foi possível anexar imagem ao lote.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.72,
      allowsEditing: true,
    });

    if (!result.canceled) {
      setLotForm((current) => ({ ...current, imageUri: result.assets[0]?.uri }));
    }
  }

  function updateLotRows(lotId: string, rowShift: number): void {
    setFieldLots((currentLots) => {
      const nextLots = currentLots.map((lot) =>
        lot.id === lotId
          ? {
              ...lot,
              rowCount: Math.round(clampNumber(lot.rowCount + rowShift, 1, 60)),
              updatedAt: new Date().toISOString(),
            }
          : lot
      );

      void saveFieldLots(nextLots);
      return nextLots;
    });
  }

  function updateLotRowSize(lotId: string, value: string): void {
    const rowSizeMeters = Number(value.replace(',', '.'));

    if (!Number.isFinite(rowSizeMeters) || rowSizeMeters <= 0) {
      return;
    }

    setFieldLots((currentLots) => {
      const nextLots = currentLots.map((lot) =>
        lot.id === lotId
          ? {
              ...lot,
              rowSizeMeters: clampNumber(rowSizeMeters, 1, 500),
              updatedAt: new Date().toISOString(),
            }
          : lot
      );

      void saveFieldLots(nextLots);
      return nextLots;
    });
  }

  async function handleOpenReportCamera(): Promise<void> {
    setActionMenuVisible(false);

    if (cameraPermission?.granted !== true) {
      const permission = await requestCameraPermission();

      if (!permission.granted) {
        handleSimulateReportPhoto();
        return;
      }
    }

    setReportCameraVisible(true);
  }

  async function handlePickReportPdf(): Promise<void> {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });

    if (!result.canceled) {
      await handleSaveReport('PDF', result.assets[0]?.uri);
    }
  }

  function handleOpenDiagnosisChat(): void {
    setActionMenuVisible(false);
    setDiagnosisChatVisible(true);
  }

  async function handleSendDiagnosisMessage(text: string): Promise<void> {
    const userText = text.trim();

    if (userText.length === 0) {
      return;
    }

    const nextUserMessage: DiagnosisChatMessage = {
      id: `usuário-${Date.now()}`,
      sender: 'user',
      kind: 'text',
      text: userText,
    };

    const nextMessages = [...diagnosisMessages, nextUserMessage];
    setDiagnosisMessages(nextMessages);
    setDiagnosisText('');
    setDiagnosisLoading(true);

    try {
      const result = await chatWithAgroAi(buildAgroChatPayload(nextMessages));
      const nextAiMessage: DiagnosisChatMessage = {
        id: `ia-${Date.now()}`,
        sender: 'ai',
        kind: 'text',
        text: `${result.reply}\n\nRecomendação: ${result.recommendation}\nPróximo passo: ${result.nextStep}`,
      };

      setDiagnosisMessages((current) => [...current, nextAiMessage]);
    } catch (error) {
      const nextErrorMessage: DiagnosisChatMessage = {
        id: `ia-error-${Date.now()}`,
        sender: 'ai',
        kind: 'text',
        text:
          error instanceof Error
            ? `Não consegui consultar a IA real agora: ${error.message}`
            : 'Não consegui consultar a IA real agora. Verifique o backend e a chave OPENAI_API_KEY.',
      };

      setDiagnosisMessages((current) => [...current, nextErrorMessage]);
    } finally {
      setDiagnosisLoading(false);
    }
  }

  function buildAgroChatPayload(messages: DiagnosisChatMessage[]): AgroChatPayload {
    const averageTemperature =
      sensorRows.length === 0
        ? 0
        : sensorRows.reduce((total, row) => total + row.reading.temperature, 0) / sensorRows.length;

    return {
      messages: messages.map((message) => ({
        role: message.sender === 'user' ? 'user' : 'assistant',
        kind: message.kind,
        content: message.text,
      })),
      context: {
        userRole: roleLabels[identity.role],
        crop: identity.preferences.preferredCrop,
        region: identity.preferences.region,
        sensors: {
          averageTemperature,
          soilTemperature: liveSensors.soilTemperature,
          soilHumidity: liveSensors.soilHumidity,
          soilPh: liveSensors.soilPh,
          irrigationPumpOn: liveSensors.irrigationPumpOn,
          connected: liveSensors.connected,
        },
        plantingRows: sensorRows.map((row) => ({
          name: row.name,
          crop: fieldLots.find((lot) => lot.id === row.lotId)?.crop ?? identity.preferences.preferredCrop,
          sensors: 1,
          temperature: row.reading.temperature,
          humidity: row.reading.humidity,
          iotStatus: row.reading.alerts.length > 0 ? 'Atenção' : 'Online',
        })),
        activeAlerts: alerts.slice(0, 3).map((alert) => ({
          title: alert.title,
          severity: alert.severity,
          summary: alert.summary,
        })),
        harvests: harvestRecords.slice(0, 5).map((record) => ({
          lot: record.lot,
          crop: record.crop,
          quantity: record.quantity,
          unit: record.unit,
          losses: record.losses,
          destination: record.destination,
          harvestDate: record.harvestDate,
        })),
        reports: reportRecords.slice(0, 5).map((record) => ({
          title: record.title,
          sourceType: record.sourceType,
          crop: record.crop,
          lot: record.lot,
          nitrogen: record.nitrogen,
          phosphorus: record.phosphorus,
          potassium: record.potassium,
          ph: record.ph,
          organicMatter: record.organicMatter,
          humidity: record.humidity,
          status: record.status,
          recommendation: record.recommendation,
        })),
      },
    };
  }

  function buildAgroReportPayload(
    sourceType: ReportSourceType,
    sourceUri: string
  ): AgroReportAnalysisPayload {
    return {
      sourceType,
      sourceUri,
      context: {
        userRole: roleLabels[identity.role],
        crop: identity.preferences.preferredCrop,
        region: identity.preferences.region,
        lots: fieldLots.slice(0, 5).map((lot) => ({
          name: lot.name,
          crop: lot.crop,
          stage: lot.stage,
          status: lot.status,
        })),
      },
    };
  }

  function handleSimulateReportPhoto(): void {
    const selectedLot = fieldLots[0];
    const crop = (selectedLot?.crop ?? identity.preferences.preferredCrop) || 'Cultura principal';
    const lotName = selectedLot?.name ?? 'Lote demonstrativo';
    const simulatedAnalysis: AgroReportAnalysisResult = {
      title: 'Laudo fotográfico simulado',
      crop,
      lot: lotName,
      nitrogen: 38,
      phosphorus: 24,
      potassium: 142,
      ph: 6.2,
      organicMatter: 3.4,
      humidity: 64,
      status: 'Adequado',
      recommendation:
        'Foto simulada processada no app. Nutrientes dentro da faixa esperada; manter irrigação regular e repetir análise na próxima vistoria.',
    };
    const report = createReportRecordFromAnalysis({
      analysis: simulatedAnalysis,
      sourceType: 'Foto',
    });

    setReportRecords((current) => [report, ...current]);
    setReportCameraVisible(false);
    setFieldActionResult('Foto de laudo simulada e registrada com sucesso.');
    onChangeTab(AppTab.Data);
  }

  async function handleSaveReport(sourceType: ReportSourceType, sourceUri?: string): Promise<void> {
    if (sourceUri === undefined) {
      setFieldActionResult('Não foi possível localizar o arquivo do laudo para enviar ao backend.');
      return;
    }

    setReportAnalysisLoading(true);
    setFieldActionResult('Enviando laudo ao backend Express para análise multimodal real...');

    try {
      const analysis = await analyzeAgroReportWithAi(buildAgroReportPayload(sourceType, sourceUri));
      const report = createReportRecordFromAnalysis({ analysis, sourceType, sourceUri });

      setReportRecords((current) => [report, ...current]);
      setReportCameraVisible(false);
      setFieldActionResult(
        `Laudo analisado por IA real: N ${report.nitrogen} mg/dm3, P ${report.phosphorus} mg/dm3, pH ${report.ph}.`
      );
      onChangeTab(AppTab.Data);
    } catch (error) {
      setFieldActionResult(
        error instanceof Error
          ? `Não consegui analisar o laudo com IA real: ${error.message}`
          : 'Não consegui analisar o laudo com IA real. Verifique o backend e a chave OPENAI_API_KEY.'
      );
    } finally {
      setReportAnalysisLoading(false);
    }
  }

  function handleSubmitHarvest(): void {
    if (!canSubmitHarvest) {
      return;
    }

    const quantity = Number(harvestForm.quantity.replace(',', '.'));
    const losses = Number(harvestForm.losses.replace(',', '.')) || 0;
    const record: HarvestRecord = {
      id: `colheita-${Date.now()}`,
      lot: harvestForm.lot.trim(),
      crop: harvestForm.crop.trim(),
      harvestDate: harvestForm.harvestDate.trim(),
      quantity,
      unit: harvestForm.unit,
      qualityClass: harvestForm.qualityClass,
      losses,
      destination: harvestForm.destination.trim(),
      responsible: harvestForm.responsible.trim() || identity.name,
      notes: harvestForm.notes.trim(),
    };

    setHarvestRecords((current) => [record, ...current]);
    setHarvestForm(createInitialHarvestForm(identity, fieldLots));
    setFieldActionResult(
      `Colheita registrada: ${formatQuantity(record.quantity)} ${record.unit} de ${record.crop}, ${record.qualityClass}, em ${record.lot}.`
    );
    setActionMenuVisible(false);
    onChangeTab(AppTab.Data);
  }

  function renderActiveTab(): ReactElement {
    if (activeTab === AppTab.Map) {
      return <MapTab identity={identity} alerts={alerts} fieldLots={fieldLots} onOpenAlert={onOpenAlert} />;
    }

    if (activeTab === AppTab.Data) {
      return (
        <DataTab
          fieldLots={fieldLots}
          loading={fieldLotsLoading}
          errorMessage={fieldLotsError}
          harvestRecords={harvestRecords}
          reportRecords={reportRecords}
          sensorRows={sensorRows}
          onUpdateLotRows={updateLotRows}
          onUpdateLotRowSize={updateLotRowSize}
        />
      );
    }

    if (activeTab === AppTab.Settings) {
      return (
        <SettingsTab
          identity={identity}
          onToggleNotifications={onToggleNotifications}
          onClearIdentity={onClearIdentity}
        />
      );
    }

    return (
      <LiveDashboardTab
        identity={identity}
        liveSensors={liveSensors}
        fieldLots={fieldLots}
        sensorRows={sensorRows}
        onOpenLot={onOpenLot}
      />
    );
  }

  return (
    <SafeAreaView style={styles.appShell}>
      <View style={styles.appContent}>{renderActiveTab()}</View>
      {fieldActionResult !== null && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setFieldActionResult(null)}
          style={({ pressed }) => [styles.actionFeedback, pressed && styles.pressed]}>
          <Text style={styles.actionFeedbackTitle}>Ação concluída</Text>
          <Text style={styles.actionFeedbackText}>{fieldActionResult}</Text>
        </Pressable>
      )}
      <BottomDock
        activeTab={activeTab}
        onChangeTab={onChangeTab}
        onOpenActionMenu={() => {
          setActionMenuMode('menu');
          setActionMenuVisible(true);
        }}
      />
      <ActionMenuModal
        visible={actionMenuVisible}
        mode={actionMenuMode}
        form={harvestForm}
        lotForm={lotForm}
        fieldLots={fieldLots}
        canSubmit={canSubmitHarvest}
        canSubmitLot={canSubmitLot}
        onClose={() => setActionMenuVisible(false)}
        onChangeMode={setActionMenuMode}
        onChangeForm={setHarvestForm}
        onChangeLotForm={setLotForm}
        onSubmitHarvest={handleSubmitHarvest}
        onSubmitLot={handleSubmitLot}
        onPickLotImage={() => void handlePickLotImage()}
        onOpenReportCamera={() => void handleOpenReportCamera()}
        onOpenDiagnosisChat={handleOpenDiagnosisChat}
      />
      <ReportCameraModal
        visible={reportCameraVisible}
        loading={reportAnalysisLoading}
        onClose={() => setReportCameraVisible(false)}
        onCapture={(uri) => void handleSaveReport('Foto', uri)}
        onPickPdf={() => void handlePickReportPdf()}
        onSimulatePhoto={handleSimulateReportPhoto}
      />
      <DiagnosisChatModal
        visible={diagnosisChatVisible}
        messages={diagnosisMessages}
        text={diagnosisText}
        loading={diagnosisLoading}
        onClose={() => setDiagnosisChatVisible(false)}
        onChangeText={setDiagnosisText}
        onSendText={() => void handleSendDiagnosisMessage(diagnosisText)}
      />
    </SafeAreaView>
  );
}

// Aba Home: mostra temperatura, leiras, sensores e resumo da operação.
function LiveDashboardTab({
  identity,
  liveSensors,
  fieldLots,
  sensorRows,
  onOpenLot,
}: {
  identity: UserIdentity;
  liveSensors: LiveSensorState;
  fieldLots: FieldLot[];
  sensorRows: PlantingRowSensor[];
  onOpenLot: (lot: FieldLot) => void;
}): ReactElement {
  const averageTemperature = averageMetric(sensorRows, (row) => row.reading.temperature);
  const totalAlerts = sensorRows.reduce((total, row) => total + row.reading.alerts.length, 0);
  const fieldRecordCount = fieldLots.length + sensorRows.length;

  return (
    <ScrollView contentContainerStyle={styles.tabScrollContent}>
      <View style={styles.homeBrandHero}>
        <View style={styles.homeLogoFrame}>
          <Image source={cultivaLogo} style={styles.homeLogoImage} resizeMode="contain" />
        </View>

        <View style={styles.homeHeroContent}>
          <View style={styles.homeHeroTopline}>
            <Text style={styles.homeBrandName}>{appName}</Text>
            <View style={[styles.badge, !liveSensors.connected && styles.offlineBadge]}>
              <Text style={styles.badgeText}>
                {liveSensors.connected ? 'Conectado ao Vivo' : 'Modo Offline'}
              </Text>
            </View>
          </View>

          <Text style={styles.homeHeroTitle}>Resumo da lavoura</Text>
          <Text style={styles.homeHeroSubtitle}>
            {identity.name}, veja rapidamente lotes, leiras, sensores e pontos que precisam de atenção.
          </Text>
          <Text style={styles.homeHeroRole}>{roleLabels[identity.role]} · {identity.preferences.region || 'Operação agrícola'}</Text>
        </View>
      </View>

      <View style={styles.metricGrid}>
        <MetricCard icon="TE" label="Temp. média" value={`${formatQuantity(averageTemperature)} C`} />
        <MetricCard
          icon="BP"
          label="Bomba"
          value={liveSensors.irrigationPumpOn ? 'Ligada' : 'Desligada'}
        />
        <MetricCard icon="LR" label="Leiras monitoradas" value={String(sensorRows.length)} />
        <MetricCard
          icon="SN"
          label="Sensores"
          value={liveSensors.connected ? 'Ao vivo' : 'Offline'}
        />
        <MetricCard icon="RG" label="Registros" value={String(fieldRecordCount)} />
        <MetricCard icon="AL" label="Alertas" value={String(totalAlerts)} />
      </View>

      <View style={styles.card}>
        <View style={styles.detailTopline}>
          <Text style={styles.sectionTitle}>Lotes e leiras</Text>
          <Text style={styles.harvestBadge}>{fieldLots.length} lote(s)</Text>
        </View>
        {fieldLots.length === 0 ? (
          <Text style={styles.bodyText}>
            Nenhum lote cadastrado ainda. Cadastre um lote na aba Dados para agrupar as leiras e iniciar o monitoramento.
          </Text>
        ) : (
          fieldLots.map((lot) => {
            const lotRows = sensorRows.filter((row) => row.lotId === lot.id);

            return (
              <Pressable
                key={lot.id}
                accessibilityRole="button"
                accessibilityLabel={`Abrir detalhes do lote ${lot.name}`}
                onPress={() => onOpenLot(lot)}
                style={({ pressed }) => [styles.homeLotCard, pressed && styles.pressed]}>
                <View style={styles.detailTopline}>
                  <View style={styles.homeLotTitleGroup}>
                    <Text style={styles.cardTitle}>{lot.name}</Text>
                    <Text style={styles.helper}>{lot.crop} · {lot.stage}</Text>
                  </View>
                  <Text style={[styles.harvestBadge, getLotStatusStyle(inferLotStatus(lotRows))]}>
                    {getLotStatusLabel(inferLotStatus(lotRows))}
                  </Text>
                </View>
                <InfoRow
                  label="Leiras"
                  value={`${lot.rowCount} leiras de ${formatQuantity(lot.rowSizeMeters)} m`}
                />
                <InfoRow label="Área" value={lot.totalSize} />
                <InfoRow label="Último sensor" value={summarizeIotRows(lotRows)} />
                <Text style={styles.helper}>{getCropCareHint(lot.crop)}</Text>
              </Pressable>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

// Card pequeno usado nos resumos financeiros e indicadores.
function MetricCard({
  icon,
  label,
  value,
}: {
  icon?: string;
  label: string;
  value: string;
}): ReactElement {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricHeader}>
        {icon !== undefined && <Text style={styles.metricIcon}>{icon}</Text>}
        <Text style={styles.mutedText}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// Botão de alternância das camadas do mapa.
function LayerButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.layerButton,
        active && styles.layerButtonActive,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.layerButtonText, active && styles.layerButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

// Monta um endereço legível para buscar o mapa da propriedade.
function AgriculturalMapOverlay({ type }: { type: AgriculturalMapType }): ReactElement {
  if (type === 'productivity') {
    return (
      <View style={styles.productivityLayer} pointerEvents="none">
        <View style={[styles.productivityZone, styles.productivityHigh]}>
          <Text style={styles.mapOverlayText}>Alta</Text>
          <Text style={styles.mapOverlayValue}>82 cx</Text>
        </View>
        <View style={[styles.productivityZone, styles.productivityMedium]}>
          <Text style={styles.mapOverlayText}>Média</Text>
          <Text style={styles.mapOverlayValue}>61 cx</Text>
        </View>
        <View style={[styles.productivityZone, styles.productivityLow]}>
          <Text style={styles.mapOverlayText}>Baixa</Text>
          <Text style={styles.mapOverlayValue}>38 cx</Text>
        </View>
      </View>
    );
  }

  if (type === 'soil') {
    return (
      <View style={styles.soilLayer} pointerEvents="none">
        <View style={[styles.soilZone, styles.soilZoneClay]}>
          <Text style={styles.mapOverlayText}>Argila alta</Text>
        </View>
        <View style={[styles.soilZone, styles.soilZonePh]}>
          <Text style={styles.mapOverlayText}>pH baixo</Text>
        </View>
        <View style={[styles.soilZone, styles.soilZoneOrganic]}>
          <Text style={styles.mapOverlayText}>Matéria org.</Text>
        </View>
      </View>
    );
  }

  if (type === 'relief') {
    return (
      <View style={styles.reliefLayer} pointerEvents="none">
        <View style={[styles.contourLine, styles.contourOne]} />
        <View style={[styles.contourLine, styles.contourTwo]} />
        <View style={[styles.contourLine, styles.contourThree]} />
        <Text style={[styles.flowArrow, styles.flowArrowOne]}>↓</Text>
        <Text style={[styles.flowArrow, styles.flowArrowTwo]}>↓</Text>
        <Text style={styles.reliefLabel}>Fluxo da água</Text>
      </View>
    );
  }

  return <View style={styles.ndviLayer} pointerEvents="none" />;
}

// Aba Mapa: mostra imagem de satélite, camadas e focos ativos.
function MapTab({
  identity,
  alerts,
  fieldLots,
  onOpenAlert,
}: {
  identity: UserIdentity;
  alerts: AgroAlert[];
  fieldLots: FieldLot[];
  onOpenAlert: (alert: AgroAlert) => void;
}): ReactElement {
  const firstAlert = alerts[0];
  const mappedLots = fieldLots.slice(0, 2);
  const [showSatellite, setShowSatellite] = useState<boolean>(true);
  const [activeMapType, setActiveMapType] = useState<AgriculturalMapType>('ndvi');
  const [showMapDetails, setShowMapDetails] = useState<boolean>(false);
  const [selectedMapLotId, setSelectedMapLotId] = useState<string | null>(mappedLots[0]?.id ?? null);
  const [satelliteFailed, setSatelliteFailed] = useState<boolean>(false);
  const [satelliteUri, setSatelliteUri] = useState<string>(defaultSatelliteImageUri);
  const [mapLocationLabel, setMapLocationLabel] = useState<string>('Localização padrão');
  const [mapStatus, setMapStatus] = useState<string>('Buscando mapa da localização escolhida...');

  const mapAddress = useMemo(() => buildMapAddress(identity), [identity]);
  const activeMapInfo = useMemo(() => getAgriculturalMapInfo(activeMapType), [activeMapType]);
  const selectedMapLot = fieldLots.find((lot) => lot.id === selectedMapLotId) ?? mappedLots[0];

  const loadSatelliteForAddress = useCallback(async (): Promise<void> => {
    setMapStatus('Buscando mapa da localização escolhida...');
    setSatelliteFailed(false);

    try {
      const coordinates = await fetchCoordinatesByAddress(mapAddress);
      setSatelliteUri(buildSatelliteImageUri(coordinates));
      setMapLocationLabel(coordinates.label);
      setMapStatus('Imagem ajustada para a localização do cadastro.');
    } catch {
      setSatelliteUri(defaultSatelliteImageUri);
      setMapLocationLabel(identity.preferences.region || 'Localização padrão');
      setMapStatus('Não foi possível localizar o endereço. Exibindo mapa padrão.');
    }
  }, [identity.preferences.region, mapAddress]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadSatelliteForAddress();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [loadSatelliteForAddress]);

  return (
    <ScrollView contentContainerStyle={styles.tabScrollContent}>
      <View style={styles.mapHeader}>
        <View style={styles.panelHeroText}>
          <Text style={[styles.kicker, styles.heroKicker]}>Mapa da propriedade</Text>
          <Text style={[styles.title, styles.heroTitle]}>Visão Espacial</Text>
          <Text style={[styles.subtitle, styles.heroSubtitle]}>
            Escolha o tipo de mapa e visualize a propriedade em {mapLocationLabel}.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowMapDetails((current) => !current)}
          style={({ pressed }) => [styles.mapSettingsButton, pressed && styles.pressed]}>
          <Text style={styles.mapSettingsIcon}>⚙</Text>
        </Pressable>
      </View>

      <View style={styles.mapTypeGrid}>
        {agriculturalMaps.map((mapInfo) => {
          const isActive = activeMapType === mapInfo.type;

          return (
            <Pressable
              key={mapInfo.type}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => {
                setActiveMapType(mapInfo.type);
                setShowMapDetails(false);
              }}
              style={({ pressed }) => [
                styles.mapTypeButton,
                isActive && styles.mapTypeButtonActive,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.mapTypeIcon, isActive && styles.mapTypeTextActive]}>{mapInfo.icon}</Text>
              <Text style={[styles.mapTypeTitle, isActive && styles.mapTypeTextActive]}>{mapInfo.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.kicker}>{activeMapInfo.apiStatus}</Text>
        <Text style={styles.sectionTitle}>{activeMapInfo.label}</Text>
        <Text style={styles.bodyText}>{activeMapInfo.shortDescription}</Text>
        <SecondaryButton
          label={showMapDetails ? 'Ocultar explicação' : 'Mais info'}
          onPress={() => setShowMapDetails((current) => !current)}
        />
        {showMapDetails && (
          <View style={styles.mapInfoBox}>
            <InfoRow label="Para que serve" value={activeMapInfo.detail} />
            <InfoRow label="Como usar" value={activeMapInfo.usage} />
          </View>
        )}
      </View>

      <View style={styles.mapLayerControls}>
        <LayerButton
          label="Satélite"
          active={showSatellite && !satelliteFailed}
          onPress={() => setShowSatellite((current) => !current)}
        />
        <LayerButton
          label="NDVI"
          active={activeMapType === 'ndvi'}
          onPress={() => setActiveMapType('ndvi')}
        />
      </View>

      <View style={styles.mapCanvas}>
        {showSatellite && !satelliteFailed && (
          <Image
            source={{ uri: satelliteUri }}
            style={styles.satelliteImage}
            resizeMode="cover"
            onError={() => setSatelliteFailed(true)}
          />
        )}
        {(!showSatellite || satelliteFailed) && (
          <View style={styles.satelliteFallback}>
            <Text style={styles.mapFallbackText}>
              {satelliteFailed ? 'Imagem de satélite indisponível' : 'Camada satélite oculta'}
            </Text>
          </View>
        )}
        <View style={styles.satelliteShade} />
        <View style={styles.mapHeaderPill}>
          <Text style={styles.mapHeaderText}>
            {showSatellite && !satelliteFailed ? 'Satélite ativo' : 'Mapa local'} · {activeMapType === 'ndvi' ? 'NDVI 0.76' : activeMapInfo.label}
          </Text>
        </View>
        {mappedLots.map((lot, index) => {
          const selected = selectedMapLotId === lot.id;

          return (
            <Pressable
              key={lot.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setSelectedMapLotId(lot.id)}
              style={({ pressed }) => [
                styles.greenhouseBlock,
                index === 0 ? styles.greenhouseOne : styles.greenhouseTwo,
                selected && styles.greenhouseBlockSelected,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.mapBlockText, selected && styles.mapBlockTextSelected]}>
                {lot.name.replace('Lote ', '')}
              </Text>
            </Pressable>
          );
        })}
        <AgriculturalMapOverlay type={activeMapType} />
        {activeMapType === 'ndvi' &&
          pestFocuses.map((focus) => (
            <View
              key={focus.id}
              style={[
                styles.pestPin,
                {
                  top: `${focus.top}%`,
                  left: `${focus.left}%`,
                  backgroundColor: getPestColor(focus.severity),
                },
              ]}>
              <Text style={styles.pestPinText}>!</Text>
            </View>
          ))}
      </View>

      {selectedMapLot !== undefined && (
        <View style={styles.card}>
          <Text style={styles.kicker}>Lote selecionado</Text>
          <Text style={styles.sectionTitle}>{selectedMapLot.name}</Text>
          <InfoRow label="Fase atual" value={selectedMapLot.stage} />
          <InfoRow label="Última rega" value={selectedMapLot.lastIrrigation} />
          <InfoRow label="Última fertilização" value={selectedMapLot.lastFertilization} />
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.helper}>{mapStatus}</Text>
        <Text style={styles.sectionTitle}>Focos ativos</Text>
        {pestFocuses.map((focus) => (
          <View key={focus.id} style={styles.mapLegendRow}>
            <View style={[styles.legendDot, { backgroundColor: getPestColor(focus.severity) }]} />
            <Text style={styles.bodyText}>
              {focus.label} - {focus.severity}
            </Text>
          </View>
        ))}
        {firstAlert !== undefined && (
          <SecondaryButton label="Abrir alerta relacionado" onPress={() => onOpenAlert(firstAlert)} />
        )}
      </View>
    </ScrollView>
  );
}

// Aba Dados: lista lotes e relatórios com FlatList.
function DataTab({
  fieldLots,
  loading,
  errorMessage,
  harvestRecords,
  reportRecords,
  sensorRows,
  onUpdateLotRows,
  onUpdateLotRowSize,
}: {
  fieldLots: FieldLot[];
  loading: boolean;
  errorMessage: string | null;
  harvestRecords: HarvestRecord[];
  reportRecords: ReportRecord[];
  sensorRows: PlantingRowSensor[];
  onUpdateLotRows: (lotId: string, rowShift: number) => void;
  onUpdateLotRowSize: (lotId: string, value: string) => void;
}): ReactElement {
  const [selectedLotId, setSelectedLotId] = useState<string>('todos');
  const [selectedRowId, setSelectedRowId] = useState<string>('todas');
  const filteredRows = sensorRows.filter((row) => {
    const lotMatches = selectedLotId === 'todos' || row.lotId === selectedLotId;
    const rowMatches = selectedRowId === 'todas' || row.id === selectedRowId;
    return lotMatches && rowMatches;
  });

  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator color={palette.medium} size="large" />
        <Text style={styles.mutedText}>Carregando lotes produtivos...</Text>
      </View>
    );
  }

  if (errorMessage !== null) {
    return (
      <ScrollView contentContainerStyle={styles.tabScrollContent}>
        <View style={styles.errorBox}>
          <Text style={styles.sectionTitle}>Erro ao carregar dados</Text>
          <Text style={styles.bodyText}>{errorMessage}</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <FlatList
      data={fieldLots}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <LotCard
          lot={item}
          harvestRecords={getHarvestRecordsForLot(harvestRecords, item)}
          onUpdateRows={onUpdateLotRows}
          onUpdateRowSize={onUpdateLotRowSize}
        />
      )}
      ListHeaderComponent={
        <DataHeader
          fieldLots={fieldLots}
          harvestRecords={harvestRecords}
          reportRecords={reportRecords}
          sensorRows={sensorRows}
          filteredRows={filteredRows}
          selectedLotId={selectedLotId}
          selectedRowId={selectedRowId}
          onSelectLot={setSelectedLotId}
          onSelectRow={setSelectedRowId}
        />
      }
      contentContainerStyle={styles.listContent}
    />
  );
}

// Cabecalho da aba Dados com cards financeiros e gráficos.
function DataHeader({
  fieldLots,
  harvestRecords,
  reportRecords,
  sensorRows,
  filteredRows,
  selectedLotId,
  selectedRowId,
  onSelectLot,
  onSelectRow,
}: {
  fieldLots: FieldLot[];
  harvestRecords: HarvestRecord[];
  reportRecords: ReportRecord[];
  sensorRows: PlantingRowSensor[];
  filteredRows: PlantingRowSensor[];
  selectedLotId: string;
  selectedRowId: string;
  onSelectLot: (lotId: string) => void;
  onSelectRow: (rowId: string) => void;
}): ReactElement {
  const averageTemperature = averageMetric(filteredRows, (row) => row.reading.temperature);
  const averageSoilHumidity = averageMetric(filteredRows, (row) => row.reading.soilHumidity);
  const averagePh = averageMetric(filteredRows, (row) => row.reading.ph);
  const alertCount = filteredRows.reduce((total, row) => total + row.reading.alerts.length, 0);
  const totalHarvest = harvestRecords.reduce((total, record) => total + record.quantity, 0);
  const totalLosses = harvestRecords.reduce((total, record) => total + record.losses, 0);
  const netHarvest = Math.max(totalHarvest - totalLosses, 0);
  const selectedLot =
    selectedLotId === 'todos' ? fieldLots[0] : fieldLots.find((lot) => lot.id === selectedLotId);
  const rowOptions = sensorRows
    .filter((row) => selectedLotId === 'todos' || row.lotId === selectedLotId)
    .map((row) => row.id);
  const selectedFilterLot = fieldLots.find((lot) => lot.id === selectedLotId);
  const selectedFilterRow = sensorRows.find((row) => row.id === selectedRowId);
  const lotFilterOptions = fieldLots.map((lot) => ({
    value: lot.id,
    label: lot.name,
    helper: `${lot.crop} · ${lot.rowCount} leiras`,
  }));
  const rowFilterOptions = rowOptions.map((rowId) => {
    const row = sensorRows.find((item) => item.id === rowId);

    return {
      value: rowId,
      label: row?.name ?? rowId,
      helper: row !== undefined ? `${row.reading.soilHumidity}% solo` : undefined,
    };
  });
  const filterSummary =
    selectedFilterLot === undefined
      ? `Todos os lotes · ${filteredRows.length} leiras analisadas`
      : `${selectedFilterLot.name} · ${
          selectedFilterRow?.name ?? 'todas as leiras'
        } · ${filteredRows.length} leitura(s)`;
  const humidity = filteredRows.slice(0, 6).map((row) => row.reading.soilHumidity);
  const temperature = filteredRows.slice(0, 6).map((row) => Math.round(row.reading.temperature * 3));

  return (
    <View style={styles.dashboardHeader}>
      <View style={styles.dataHero}>
        <Text style={[styles.kicker, styles.heroKicker]}>{appName} dados</Text>
        <Text style={[styles.title, styles.heroTitle]}>Campo em números</Text>
        <Text style={[styles.subtitle, styles.heroSubtitle]}>
          Leituras de sensores, colheitas, perdas, laudos e recomendações organizadas por lote e leira.
        </Text>
      </View>

      <View style={styles.metricGrid}>
        <MetricCard icon="TE" label="Temp. média" value={`${formatQuantity(averageTemperature)} C`} />
        <MetricCard icon="SO" label="Umidade solo" value={`${formatQuantity(averageSoilHumidity)}%`} />
        <MetricCard icon="PH" label="pH médio" value={formatQuantity(averagePh)} />
        <MetricCard icon="AL" label="Alertas" value={String(alertCount)} />
        <MetricCard icon="CL" label="Colhido" value={formatQuantity(totalHarvest)} />
        <MetricCard icon="AP" label="Aproveitado" value={formatQuantity(netHarvest)} />
      </View>

      <View style={styles.card}>
        <View style={styles.detailTopline}>
          <View style={styles.filterTitleGroup}>
            <Text style={styles.sectionTitle}>Visão dos dados</Text>
            <Text style={styles.helper}>{filterSummary}</Text>
          </View>
          {(selectedLotId !== 'todos' || selectedRowId !== 'todas') && (
            <SecondaryButton
              label="Limpar"
              onPress={() => {
                onSelectLot('todos');
                onSelectRow('todas');
              }}
            />
          )}
        </View>
        <FilterSection
          label="Lote"
          options={[{ value: 'todos', label: 'Todos os lotes', helper: `${fieldLots.length} ativo(s)` }, ...lotFilterOptions]}
          selectedValue={selectedLotId}
          onSelect={(lotId) => {
            onSelectLot(lotId);
            onSelectRow('todas');
          }}
        />
        <FilterSection
          label="Leira"
          options={[{ value: 'todas', label: 'Todas as leiras', helper: `${rowOptions.length} disponível(is)` }, ...rowFilterOptions]}
          selectedValue={selectedRowId}
          onSelect={onSelectRow}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Histórico de temperatura
        </Text>
        <View style={styles.barChart}>
          {(temperature.length > 0 ? temperature : [42, 58, 63, 74, 69, 82]).map((value, index) => (
            <View key={`prod-${index}`} style={styles.barColumn}>
              <View style={[styles.bar, { height: value }]} />
              <Text style={styles.chartLabel}>
                L{index + 1}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Umidade do solo</Text>
        <View style={styles.lineChart}>
          {(humidity.length > 0 ? humidity : [62, 66, 70, 74, 71, 78]).map((value, index) => (
            <View
              key={`hum-${index}`}
              style={[
                styles.linePoint,
                {
                  left: `${index * 18}%`,
                  bottom: `${value - 40}%`,
                },
              ]}
            />
          ))}
        </View>
        <Text style={styles.helper}>Vire o celular para horizontal para ver gráficos expandidos.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Alertas e recomendações</Text>
        {filteredRows.flatMap((row) => row.reading.alerts.map((alert) => `${row.name}: ${alert}`)).length === 0 ? (
          <Text style={styles.bodyText}>
            Leituras dentro da faixa simulada. Mantenha monitoramento e valide com sensores reais.
          </Text>
        ) : (
          filteredRows.flatMap((row) =>
            row.reading.alerts.map((alert) => (
              <Text key={`${row.id}-${alert}`} style={styles.errorText}>
                {row.name}: {alert}
              </Text>
            ))
          )
        )}
        <Text style={styles.helper}>
          {selectedLot !== undefined
            ? getCropRecommendation(selectedLot.crop, averageSoilHumidity, averageTemperature)
            : 'Cadastre um lote para receber recomendações por cultura, fase e escala da produção.'}
        </Text>
      </View>

      {harvestRecords.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Colheitas registradas</Text>
          {harvestRecords.slice(0, 3).map((record) => (
            <HarvestRecordCard key={record.id} record={record} />
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Laudos e imagens</Text>
        {reportRecords.length === 0 ? (
          <Text style={styles.bodyText}>
            Nenhum laudo analisado ainda. Use o botão + para fotografar, simular uma foto ou anexar PDF.
          </Text>
        ) : (
          reportRecords.map((record) => <ReportRecordCard key={record.id} record={record} />)
        )}
      </View>

      <Text style={styles.sectionTitle}>Lotes ativos</Text>
    </View>
  );
}

function HarvestRecordCard({ record }: { record: HarvestRecord }): ReactElement {
  return (
    <View style={styles.harvestRecord}>
      <View style={styles.detailTopline}>
        <Text style={styles.cardTitle}>{record.crop}</Text>
        <Text style={styles.harvestBadge}>{record.qualityClass}</Text>
      </View>
      <InfoRow label="Lote" value={record.lot} />
      <InfoRow
        label="Quantidade"
        value={`${formatQuantity(record.quantity)} ${record.unit} · perdas ${formatQuantity(record.losses)} ${record.unit}`}
      />
      <InfoRow label="Destino" value={record.destination} />
      <InfoRow label="Data" value={formatShortDate(record.harvestDate)} />
      {record.notes.length > 0 && <Text style={styles.helper}>{record.notes}</Text>}
    </View>
  );
}

function ReportRecordCard({ record }: { record: ReportRecord }): ReactElement {
  return (
    <View style={styles.reportRecord}>
      <View style={styles.detailTopline}>
        <View style={styles.reportTitleGroup}>
          <Text style={styles.cardTitle}>{record.title}</Text>
          <Text style={styles.helper}>{record.sourceType} · {formatDate(record.capturedAt)}</Text>
        </View>
        <Text style={[styles.harvestBadge, getReportStatusStyle(record.status)]}>{record.status}</Text>
      </View>

      {record.sourceType === 'Foto' && record.sourceUri !== undefined && (
        <Image source={{ uri: record.sourceUri }} style={styles.reportImage} />
      )}

      <View style={styles.reportGrid}>
        <ReportMetric label="N" value={`${record.nitrogen} mg/dm3`} />
        <ReportMetric label="P" value={`${record.phosphorus} mg/dm3`} />
        <ReportMetric label="K" value={`${record.potassium} mg/dm3`} />
        <ReportMetric label="pH" value={record.ph.toFixed(1)} />
        <ReportMetric label="M.O." value={`${record.organicMatter.toFixed(1)}%`} />
        <ReportMetric label="Umidade" value={`${record.humidity}%`} />
      </View>

      <InfoRow label="Lote vinculado" value={record.lot} />
      <InfoRow label="Cultura" value={record.crop} />
      <Text style={styles.bodyText}>{record.recommendation}</Text>
    </View>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <View style={styles.reportMetric}>
      <Text style={styles.mutedText}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

type FilterOption = {
  value: string;
  label: string;
  helper?: string;
};

function FilterSection({
  label,
  options,
  selectedValue,
  onSelect,
}: {
  label: string;
  options: FilterOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
}): ReactElement {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterChipRow}>
        {options.map((option) => (
          <FilterChip
            key={option.value}
            option={option}
            selected={selectedValue === option.value}
            onPress={() => onSelect(option.value)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function FilterChip({
  option,
  selected,
  onPress,
}: {
  option: FilterOption;
  selected: boolean;
  onPress: () => void;
}): ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        selected && styles.filterChipSelected,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>
        {option.label}
      </Text>
      {option.helper !== undefined && (
        <Text style={[styles.filterChipHelper, selected && styles.filterChipTextSelected]}>
          {option.helper}
        </Text>
      )}
    </Pressable>
  );
}

// Card de lote com linha do tempo do ciclo produtivo.
function LotCard({
  lot,
  harvestRecords,
  onUpdateRows,
  onUpdateRowSize,
}: {
  lot: FieldLot;
  harvestRecords: HarvestRecord[];
  onUpdateRows: (lotId: string, rowShift: number) => void;
  onUpdateRowSize: (lotId: string, value: string) => void;
}): ReactElement {
  const steps: FieldLot['stage'][] = ['Vegetativo', 'Florescimento', 'Frutificação', 'Colheita'];
  const displayStage = harvestRecords.length > 0 ? 'Colheita' : lot.stage;
  const currentIndex = steps.indexOf(displayStage);
  const totalHarvest = harvestRecords.reduce((total, record) => total + record.quantity, 0);
  const totalLosses = harvestRecords.reduce((total, record) => total + record.losses, 0);
  const latestHarvest = harvestRecords[0];

  return (
    <View style={styles.alertCard}>
      <Text style={styles.cardTitle}>{lot.name}</Text>
      <InfoRow label="Cultura" value={lot.crop} />
      <InfoRow label="Tamanho total" value={lot.totalSize} />
      <View style={styles.timeline}>
        {steps.map((step, index) => (
          <TimelineStep key={step} label={step} active={index <= currentIndex} />
        ))}
      </View>
      <View style={styles.lotRowsPanel}>
        <InfoRow label="Leiras cadastradas" value={`${lot.rowCount} leiras de ${formatQuantity(lot.rowSizeMeters)} m`} />
        <View style={styles.quickActions}>
          <SecondaryButton label="- leira" onPress={() => onUpdateRows(lot.id, -1)} />
          <SecondaryButton label="+ leira" onPress={() => onUpdateRows(lot.id, 1)} />
        </View>
        <Field
          label="Tamanho médio das leiras (m)"
          value={String(lot.rowSizeMeters)}
          placeholder="Ex: 24"
          onChangeText={(value) => onUpdateRowSize(lot.id, value)}
          keyboardType="numeric"
        />
      </View>
      <InfoRow label="Última rega" value={lot.lastIrrigation} />
      <InfoRow label="Última fertilização" value={lot.lastFertilization} />
      {latestHarvest !== undefined && (
        <View style={styles.lotHarvestSummary}>
          <InfoRow
            label="Colheita vinculada"
            value={`${formatQuantity(totalHarvest)} ${latestHarvest.unit} · perdas ${formatQuantity(totalLosses)} ${latestHarvest.unit}`}
          />
          <InfoRow label="Destino" value={latestHarvest.destination} />
          <InfoRow label="Último registro" value={formatShortDate(latestHarvest.harvestDate)} />
        </View>
      )}
      <PrimaryButton label="Avançar ciclo" onPress={() => undefined} />
    </View>
  );
}

function TimelineStep({ label, active }: { label: string; active: boolean }): ReactElement {
  return (
    <View style={styles.timelineStep}>
      <View style={[styles.timelineDot, active && styles.timelineDotActive]} />
      <Text style={[styles.timelineText, active && styles.timelineTextActive]}>{label}</Text>
    </View>
  );
}

// Aba Ajustes: preferências, visualização e conta.
function SettingsTab({
  identity,
  onToggleNotifications,
  onClearIdentity,
}: {
  identity: UserIdentity;
  onToggleNotifications: (enabled: boolean) => void;
  onClearIdentity: () => void;
}): ReactElement {
  return (
    <ScrollView contentContainerStyle={styles.tabScrollContent}>
      <View>
        <Text style={styles.kicker}>Ajustes</Text>
        <Text style={styles.title}>Preferências do app</Text>
        <Text style={styles.subtitle}>
          Modifique notificações e comportamento da experiência local.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Conta e operação</Text>
        <Text style={styles.bodyText}>{identity.name} · {roleLabels[identity.role]}</Text>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.label}>Receber notificações</Text>
            <Text style={styles.helper}>Alertas visuais e preventivos do campo.</Text>
          </View>
          <Switch
            value={identity.preferences.notificationsEnabled}
            onValueChange={onToggleNotifications}
            thumbColor={identity.preferences.notificationsEnabled ? '#FFFFFF' : palette.background}
            trackColor={{ false: '#DCE8DE', true: palette.medium }}
          />
        </View>
        <View style={styles.quickActions}>
          <SecondaryButton label="Sair" onPress={onClearIdentity} />
        </View>
      </View>

      {identity.role === UserRole.Farmer && <ProfileSummary identity={identity} />}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Visualização</Text>
        <SettingRow title="Modo compacto" value="Desligado" />
        <SettingRow title="Atualização dos sensores" value="Ao vivo" />
        <SettingRow title="Tema" value="Claro" />
      </View>
    </ScrollView>
  );
}

function SettingRow({ title, value }: { title: string; value: string }): ReactElement {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.label}>{title}</Text>
      <Text style={styles.settingValue}>{value}</Text>
    </View>
  );
}

// Modal aberto pelo botão central de mais ações.
function ActionMenuModal({
  visible,
  mode,
  form,
  lotForm,
  fieldLots,
  canSubmit,
  canSubmitLot,
  onClose,
  onChangeMode,
  onChangeForm,
  onChangeLotForm,
  onSubmitHarvest,
  onSubmitLot,
  onPickLotImage,
  onOpenReportCamera,
  onOpenDiagnosisChat,
}: {
  visible: boolean;
  mode: ActionMenuMode;
  form: HarvestForm;
  lotForm: LotForm;
  fieldLots: FieldLot[];
  canSubmit: boolean;
  canSubmitLot: boolean;
  onClose: () => void;
  onChangeMode: (mode: ActionMenuMode) => void;
  onChangeForm: (form: HarvestForm) => void;
  onChangeLotForm: (form: LotForm) => void;
  onSubmitHarvest: () => void;
  onSubmitLot: () => void;
  onPickLotImage: () => void;
  onOpenReportCamera: () => void;
  onOpenDiagnosisChat: () => void;
}): ReactElement {
  function updateForm(changes: Partial<HarvestForm>): void {
    onChangeForm({ ...form, ...changes });
  }

  function updateLotForm(changes: Partial<LotForm>): void {
    onChangeLotForm({ ...lotForm, ...changes });
  }

  if (mode === 'menu') {
    return (
      <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
        <Pressable style={styles.modalBackdrop} onPress={onClose}>
          <Pressable style={styles.actionSheet}>
            <Text style={styles.sectionTitle}>Adicionar</Text>
            <Text style={styles.helper}>Escolha o tipo de registro ou análise que deseja iniciar.</Text>
            <ActionChoice
              iconName={{ ios: 'square.grid.2x2.fill', android: 'dashboard', web: 'dashboard' }}
              title="Cadastrar lote"
              description="Cria um lote e gera as leiras para monitoramento."
              onPress={() => onChangeMode('lot')}
            />
            <ActionChoice
              iconName={{ ios: 'basket.fill', android: 'inventory_2', web: 'archive' }}
              title="Registrar colheita"
              description="Abre o formulario com lote, volume, perdas e destino."
              onPress={() => onChangeMode('harvest')}
            />
            <ActionChoice
              iconName={{ ios: 'doc.text.fill', android: 'description', web: 'description' }}
              title="Anexar laudo"
              description="Tire foto real do documento ou selecione um PDF do dispositivo."
              onPress={onOpenReportCamera}
            />
            <ActionChoice
              iconName={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
              title="Diagnosticar com IA"
              description="Abre um chat conectado ao backend de IA real."
              onPress={onOpenDiagnosisChat}
            />
            <SecondaryButton label="Fechar" onPress={onClose} />
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  if (mode === 'lot') {
    return (
      <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
        <Pressable style={styles.modalBackdrop} onPress={onClose}>
          <Pressable style={styles.actionSheet}>
            <View style={styles.detailTopline}>
              <Text style={styles.sectionTitle}>Cadastrar lote</Text>
              <SecondaryButton label="Voltar" onPress={() => onChangeMode('menu')} />
            </View>
            <Text style={styles.helper}>
              O lote agrupa as leiras. Informe cultura, área, fase e localização para iniciar o monitoramento.
            </Text>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.harvestFormScroll}
              contentContainerStyle={styles.harvestFormContent}>
              <Field
                label="Nome do lote"
                value={lotForm.name}
                placeholder="Ex: Lote 12 - Morango Albion"
                onChangeText={(name) => updateLotForm({ name })}
              />
              <Field
                label="Cultura"
                value={lotForm.crop}
                placeholder="Ex: Morango"
                onChangeText={(crop) => updateLotForm({ crop })}
              />
              <Field
                label="Tamanho total do lote"
                value={lotForm.totalSize}
                placeholder="Ex: 840 m2 ou 0,8 ha"
                onChangeText={(totalSize) => updateLotForm({ totalSize })}
              />
              <View style={styles.harvestInlineFields}>
                <View style={styles.harvestInlineField}>
                  <Field
                    label="Quantidade de leiras"
                    value={lotForm.rowCount}
                    placeholder="Ex: 4"
                    onChangeText={(rowCount) => updateLotForm({ rowCount })}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.harvestInlineField}>
                  <Field
                    label="Tamanho por leira (m)"
                    value={lotForm.rowSizeMeters}
                    placeholder="Ex: 24"
                    onChangeText={(rowSizeMeters) => updateLotForm({ rowSizeMeters })}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <OptionGroup
                label="Fase inicial"
                options={['Vegetativo', 'Florescimento', 'Frutificação', 'Colheita']}
                selectedValue={lotForm.stage}
                onSelect={(stage) => updateLotForm({ stage: stage as FieldLot['stage'] })}
              />
              <Field
                label="Localização ou área"
                value={lotForm.location}
                placeholder="Ex: Estufa 1, setor norte ou coordenadas"
                onChangeText={(location) => updateLotForm({ location })}
              />
              {lotForm.imageUri !== undefined && (
                <Image source={{ uri: lotForm.imageUri }} style={styles.lotFormImage} />
              )}
              <SecondaryButton label="Anexar imagem do lote" onPress={onPickLotImage} />
            </ScrollView>

            <PrimaryButton label="Adicionar lote" disabled={!canSubmitLot} onPress={onSubmitLot} />
            <SecondaryButton label="Fechar" onPress={onClose} />
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.actionSheet}>
          <View style={styles.detailTopline}>
            <Text style={styles.sectionTitle}>Registrar colheita</Text>
            <SecondaryButton label="Voltar" onPress={() => onChangeMode('menu')} />
          </View>
          <Text style={styles.helper}>
            Informe lote, cultura, data, volume, qualidade, perdas e destino da produção.
          </Text>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.harvestFormScroll}
            contentContainerStyle={styles.harvestFormContent}>
            <OptionGroup
              label="Lote"
              options={fieldLots.length > 0 ? fieldLots.map((lot) => lot.name) : [form.lot]}
              selectedValue={form.lot}
              onSelect={(lot) => updateForm({ lot })}
            />
            <Field
              label="Cultura"
              value={form.crop}
              placeholder="Ex: Morango San Andreas"
              onChangeText={(crop) => updateForm({ crop })}
            />
            <Field
              label="Data da colheita"
              value={form.harvestDate}
              placeholder="AAAA-MM-DD"
              onChangeText={(harvestDate) => updateForm({ harvestDate })}
              keyboardType="numeric"
            />
            <View style={styles.harvestInlineFields}>
              <View style={styles.harvestInlineField}>
                <Field
                  label="Quantidade"
                  value={form.quantity}
                  placeholder="Ex: 18"
                  onChangeText={(quantity) => updateForm({ quantity })}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.harvestInlineField}>
                <Field
                  label="Perdas"
                  value={form.losses}
                  placeholder="Ex: 1"
                  onChangeText={(losses) => updateForm({ losses })}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <OptionGroup
              label="Unidade"
              options={['caixas', 'kg', 'bandejas']}
              selectedValue={form.unit}
              onSelect={(unit) => updateForm({ unit })}
            />
            <OptionGroup
              label="Classificação"
              options={['Classe A', 'Classe B', 'Processamento']}
              selectedValue={form.qualityClass}
              onSelect={(qualityClass) => updateForm({ qualityClass })}
            />
            <OptionGroup
              label="Destino"
              options={['Venda direta', 'Cooperativa', 'Estoque', 'Processamento']}
              selectedValue={form.destination}
              onSelect={(destination) => updateForm({ destination })}
            />
            <Field
              label="Responsável"
              value={form.responsible}
              placeholder="Quem registrou"
              onChangeText={(responsible) => updateForm({ responsible })}
            />
            <Field
              label="Observações"
              value={form.notes}
              placeholder="Ex: frutos menores por chuva"
              onChangeText={(notes) => updateForm({ notes })}
            />
          </ScrollView>

          <PrimaryButton
            label="Salvar colheita"
            disabled={!canSubmit}
            onPress={onSubmitHarvest}
          />

          <SecondaryButton label="Fechar" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionChoice({
  iconName,
  title,
  description,
  onPress,
}: {
  iconName: SymbolName;
  title: string;
  description: string;
  onPress: () => void;
}): ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionChoice, pressed && styles.pressed]}>
      <View style={styles.actionChoiceIcon}>
        <SymbolView tintColor={palette.primary} name={iconName} size={22} />
      </View>
      <View style={styles.actionChoiceText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.mutedText}>{description}</Text>
      </View>
    </Pressable>
  );
}

function ReportCameraModal({
  visible,
  loading,
  onClose,
  onCapture,
  onPickPdf,
  onSimulatePhoto,
}: {
  visible: boolean;
  loading: boolean;
  onClose: () => void;
  onCapture: (uri?: string) => void;
  onPickPdf: () => void;
  onSimulatePhoto: () => void;
}): ReactElement {
  const cameraRef = useRef<CameraView | null>(null);

  async function handleTakePicture(): Promise<void> {
    try {
      const picture = await cameraRef.current?.takePictureAsync({ quality: 0.75 });

      if (picture?.uri === undefined) {
        onSimulatePhoto();
        return;
      }

      onCapture(picture.uri);
    } catch {
      onSimulatePhoto();
    }
  }

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.cameraScreen}>
        <View style={styles.cameraHeader}>
          <View>
            <Text style={styles.kicker}>Laudo técnico</Text>
            <Text style={styles.sectionTitle}>Fotografar documento</Text>
          </View>
          <SecondaryButton label="Fechar" onPress={onClose} />
        </View>

        <View style={styles.cameraPreviewWrap}>
          <CameraView ref={cameraRef} style={styles.cameraPreview} facing="back" />
        </View>

        <View style={styles.cameraFooter}>
          <Text style={styles.helper}>
            Enquadre a foto ou resultado de laboratório. O backend Express envia o arquivo para análise multimodal real.
          </Text>
          <PrimaryButton
            label={loading ? 'Analisando laudo...' : 'Tirar foto e analisar'}
            disabled={loading}
            onPress={() => void handleTakePicture()}
          />
          <SecondaryButton label="Simular foto do laudo" disabled={loading} onPress={onSimulatePhoto} />
          <SecondaryButton label="Anexar PDF do dispositivo" disabled={loading} onPress={onPickPdf} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function DiagnosisChatModal({
  visible,
  messages,
  text,
  loading,
  onClose,
  onChangeText,
  onSendText,
}: {
  visible: boolean;
  messages: DiagnosisChatMessage[];
  text: string;
  loading: boolean;
  onClose: () => void;
  onChangeText: (text: string) => void;
  onSendText: () => void;
}): ReactElement {
  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.chatScreen}>
        <View style={styles.cameraHeader}>
          <View>
            <Text style={styles.kicker}>Diagnóstico com IA</Text>
            <Text style={styles.sectionTitle}>Chat agrícola com IA real</Text>
          </View>
          <SecondaryButton label="Fechar" onPress={onClose} />
        </View>

        <ScrollView contentContainerStyle={styles.chatMessages}>
          {messages.map((message) => {
            const userMessage = message.sender === 'user';

            return (
              <View
                key={message.id}
                style={[styles.chatBubble, userMessage ? styles.chatBubbleUser : styles.chatBubbleAi]}>
                <Text style={[styles.chatBubbleLabel, userMessage && styles.chatBubbleLabelUser]}>
                  {userMessage ? message.kind.toUpperCase() : 'IA'}
                </Text>
                <Text style={[styles.chatBubbleText, userMessage && styles.chatBubbleTextUser]}>
                  {message.text}
                </Text>
              </View>
            );
          })}
          {loading && (
            <View style={[styles.chatBubble, styles.chatBubbleAi]}>
              <Text style={styles.chatBubbleLabel}>IA</Text>
              <Text style={styles.chatBubbleText}>Analisando contexto da lavoura...</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.chatComposer}>
          <TextInput
            value={text}
            placeholder="Descreva sintomas, manchas, solo ou irrigação..."
            placeholderTextColor={palette.muted}
            onChangeText={onChangeText}
            style={styles.chatInput}
            multiline
          />
          <View style={styles.quickActions}>
            <PrimaryButton
              label={loading ? 'Enviando...' : 'Enviar'}
              disabled={loading || text.trim().length === 0}
              onPress={onSendText}
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function BottomDock({
  activeTab,
  onChangeTab,
  onOpenActionMenu,
}: {
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
  onOpenActionMenu: () => void;
}): ReactElement {
  const tabs: { tab: AppTab; label: string; icon: string; iconSize: number }[] = [
    { tab: AppTab.Home, label: 'Home', icon: '⌂', iconSize: 24 },
    { tab: AppTab.Map, label: 'Mapa', icon: '⌖', iconSize: 25 },
    { tab: AppTab.Data, label: 'Dados', icon: '▦', iconSize: 23 },
    { tab: AppTab.Settings, label: 'Ajustes', icon: '⚙', iconSize: 24 },
  ];
  const leftTabs = tabs.slice(0, 2);
  const rightTabs = tabs.slice(2);

  function renderDockItem(item: {
    tab: AppTab;
    label: string;
    icon: string;
    iconSize: number;
  }): ReactElement {
    const selected = activeTab === item.tab;

    return (
      <View key={item.tab} style={styles.dockSlot}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected }}
          onPress={() => onChangeTab(item.tab)}
          style={({ pressed }) => [
            styles.dockItem,
            selected && styles.dockItemSelected,
            pressed && styles.pressed,
          ]}>
          <View style={styles.dockIconFrame}>
            <Text
              style={[
                styles.dockIcon,
                { fontSize: item.iconSize, lineHeight: item.iconSize + 2 },
                selected && styles.dockTextSelected,
              ]}>
              {item.icon}
            </Text>
          </View>
          <Text style={[styles.dockText, selected && styles.dockTextSelected]}>{item.label}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.dockWrap}>
      <View style={styles.dock}>
        {leftTabs.map(renderDockItem)}
        <View style={styles.dockCenterSlot}>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenActionMenu}
            style={({ pressed }) => [styles.centralActionButton, pressed && styles.pressed]}>
            <Text style={styles.centralActionText}>+</Text>
          </Pressable>
        </View>
        {rightTabs.map(renderDockItem)}
      </View>
    </View>
  );
}

// Resumo do perfil salvo no cadastro.
function ProfileSummary({ identity }: { identity: UserIdentity }): ReactElement {
  const rows =
    identity.role === UserRole.Farmer
      ? [
          ['Propriedade', identity.farmerProfile?.farmName ?? 'Não informado'],
          ['Área', identity.farmerProfile?.farmSize ?? 'Não informado'],
          ['Meta', identity.farmerProfile?.productionGoal ?? 'Não informado'],
          ['Endereço', formatAddress(identity)],
        ]
      : [
          ['Especialidade', identity.agronomistProfile?.specialty ?? 'Não informado'],
          ['Registro', identity.agronomistProfile?.registration ?? 'Não informado'],
          ['Endereço', formatAddress(identity)],
          ['Atendimento', identity.agronomistProfile?.serviceRegion ?? 'Não informado'],
        ];

  return (
    <View style={styles.profileSummary}>
      <Text style={styles.sectionTitle}>Resumo da propriedade</Text>
      <View style={styles.profileGrid}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.profileItem}>
            <Text style={styles.mutedText}>{label}</Text>
            <Text style={styles.infoValue}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function LotDetailScreen({
  lot,
  identity,
  onBack,
}: {
  lot: FieldLot;
  identity: UserIdentity;
  onBack: () => void;
}): ReactElement {
  const [rows, setRows] = useState<PlantingRowSensor[]>(() => buildRowsForLot(lot));

  useEffect(() => {
    const intervalId = setInterval(() => {
      setRows(buildRowsForLot(lot));
    }, 4200);

    return () => {
      clearInterval(intervalId);
    };
  }, [lot]);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <SafeAreaView style={styles.safeArea}>
        <SecondaryButton label="Voltar a Home" onPress={onBack} />

        <View style={styles.card}>
          <View style={styles.detailTopline}>
            <Text style={styles.kicker}>{identity.preferences.region || 'Operação agrícola'}</Text>
            <Text style={[styles.harvestBadge, getLotStatusStyle(inferLotStatus(rows))]}>
              {getLotStatusLabel(inferLotStatus(rows))}
            </Text>
          </View>
          {lot.imageUri !== undefined && <Image source={{ uri: lot.imageUri }} style={styles.lotDetailImage} />}
          <Text style={styles.title}>{lot.name}</Text>
          <Text style={styles.subtitle}>{lot.crop} em fase de {lot.stage.toLowerCase()}.</Text>
          <InfoRow label="Tamanho total" value={lot.totalSize} />
          <InfoRow label="Leiras" value={`${lot.rowCount} leiras de ${formatQuantity(lot.rowSizeMeters)} m`} />
          <InfoRow label="Localização" value={lot.location ?? 'Não informada'} />
          <InfoRow label="Última rega" value={lot.lastIrrigation} />
          <InfoRow label="Última fertilização" value={lot.lastFertilization} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Leiras e sensores IoT</Text>
          {rows.map((row) => (
            <View key={row.id} style={styles.leiraCard}>
              <View style={styles.detailTopline}>
                <Text style={styles.cardTitle}>{row.name}</Text>
                <Text style={styles.harvestBadge}>{formatIrrigationStatus(row.reading.irrigationStatus)}</Text>
              </View>
              <View style={styles.reportGrid}>
                <ReportMetric label="Temp." value={`${row.reading.temperature.toFixed(1)} C`} />
                <ReportMetric label="Umidade" value={`${row.reading.humidity}%`} />
                <ReportMetric label="Solo" value={`${row.reading.soilHumidity}%`} />
                <ReportMetric label="pH" value={row.reading.ph.toFixed(1)} />
                <ReportMetric label="CE" value={`${row.reading.electricalConductivity.toFixed(2)} mS/cm`} />
                <ReportMetric label="Luz" value={`${row.reading.luminosity} lx`} />
              </View>
              {row.reading.alerts.length === 0 ? (
                <Text style={styles.successText}>Sem alertas nesta leira.</Text>
              ) : (
                row.reading.alerts.map((alert) => (
                  <Text key={alert} style={styles.errorText}>{alert}</Text>
                ))
              )}
            </View>
          ))}
        </View>
      </SafeAreaView>
    </ScrollView>
  );
}

// Tela de detalhes de um alerta agrícola selecionado no mapa.
function DetailScreen({
  alert,
  identity,
  onBack,
}: {
  alert: AgroAlert;
  identity: UserIdentity;
  onBack: () => void;
}): ReactElement {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <SafeAreaView style={styles.safeArea}>
        <SecondaryButton label="Voltar ao painel" onPress={onBack} />

        <View style={styles.card}>
          <View style={styles.detailTopline}>
            <Text style={styles.kicker}>{alert.crop}</Text>
            <SeverityPill severity={alert.severity} />
          </View>
          <Text style={styles.title}>{alert.title}</Text>
          <Text style={styles.subtitle}>{alert.summary}</Text>

          <InfoRow label="Região" value={alert.region} />
          <InfoRow label="Atualizado em" value={formatDate(alert.updatedAt)} />
          <InfoRow label="Perfil aplicado" value={roleLabels[identity.role]} />
        </View>

        <View style={styles.recommendationCard}>
          <Text style={styles.sectionTitle}>Recomendação técnica</Text>
          <Text style={styles.bodyText}>{alert.recommendation}</Text>
        </View>
      </SafeAreaView>
    </ScrollView>
  );
}

// Campo de texto padrão usado no login e cadastro.
