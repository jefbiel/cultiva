import { agroAlerts } from '@/data/agro-alerts';
import { fieldLots } from '@/data/field-lots';
import { Platform } from 'react-native';

import {
  AddressInfo,
  AgroReportAnalysisPayload,
  AgroReportAnalysisResult,
  AgroAlert,
  AgroChatPayload,
  AgroChatResult,
  AlertSeverity,
  DiagnosisPayload,
  DiagnosisResult,
  FieldLot,
  LotStatus,
  MapCoordinates,
} from '@/types/agro';

const localAiBaseUrl = Platform.OS === 'android' ? 'http://10.0.2.2:8787' : 'http://localhost:8787';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Confere se o valor recebido é um nível de alerta conhecido.
function isSeverity(value: unknown): value is AlertSeverity {
  return (
    value === AlertSeverity.Low ||
    value === AlertSeverity.Medium ||
    value === AlertSeverity.High
  );
}

// Valida cada alerta antes de mostrar na tela.
function isAgroAlert(value: unknown): value is AgroAlert {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.crop === 'string' &&
    typeof value.region === 'string' &&
    isSeverity(value.severity) &&
    typeof value.summary === 'string' &&
    typeof value.recommendation === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

// Garante que a lista local ou externa esta no formato esperado.
function parseAgroAlerts(payload: unknown): AgroAlert[] {
  if (!Array.isArray(payload)) {
    throw new Error('A fonte de dados retornou um formato inválido.');
  }

  if (!payload.every(isAgroAlert)) {
    throw new Error('A lista de alertas possui dados incompletos.');
  }

  return payload;
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
      value.stage === 'Frutificação' ||
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

function parseFieldLots(payload: unknown): FieldLot[] {
  if (!Array.isArray(payload)) {
    throw new Error('A fonte de lotes retornou um formato inválido.');
  }

  if (!payload.every(isFieldLot)) {
    throw new Error('A lista de lotes possui dados incompletos.');
  }

  return payload;
}

// Remove caracteres que não são números para consultar o CEP.
function onlyNumbers(value: string): string {
  return value.replace(/\D/g, '');
}

// Valida a resposta do ViaCEP antes de preencher o cadastro.
function isViaCepResponse(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }

  if (value.erro === true) {
    return true;
  }

  return (
    typeof value.cep === 'string' &&
    typeof value.logradouro === 'string' &&
    typeof value.bairro === 'string' &&
    typeof value.localidade === 'string' &&
    typeof value.uf === 'string'
  );
}

// Le um campo de texto obrigatorio vindo de uma API externa.
function readStringField(record: Record<string, unknown>, field: string): string {
  const value = record[field];

  if (typeof value !== 'string') {
    throw new Error('A consulta de CEP retornou dados incompletos.');
  }

  return value;
}

// Confere se a severidade retornada pela IA e aceita pelo app.
function isDiagnosisSeverity(value: unknown): value is DiagnosisResult['severity'] {
  return value === 'Baixa' || value === 'Média' || value === 'Alta';
}

// Valida a resposta do backend de IA antes de exibir no app.
function parseDiagnosisResult(payload: unknown): DiagnosisResult {
  if (!isRecord(payload)) {
    throw new Error('A IA retornou um formato inválido.');
  }

  if (
    typeof payload.summary !== 'string' ||
    !isDiagnosisSeverity(payload.severity) ||
    typeof payload.recommendation !== 'string' ||
    typeof payload.nextStep !== 'string'
  ) {
    throw new Error('A resposta da IA veio incompleta.');
  }

  return {
    summary: payload.summary,
    severity: payload.severity,
    recommendation: payload.recommendation,
    nextStep: payload.nextStep,
  };
}

function parseAgroChatResult(payload: unknown): AgroChatResult {
  if (!isRecord(payload)) {
    throw new Error('A IA retornou um formato inválido.');
  }

  if (
    typeof payload.reply !== 'string' ||
    !isDiagnosisSeverity(payload.severity) ||
    typeof payload.recommendation !== 'string' ||
    typeof payload.nextStep !== 'string'
  ) {
    throw new Error('A resposta do chat de IA veio incompleta.');
  }

  return {
    reply: payload.reply,
    severity: payload.severity,
    recommendation: payload.recommendation,
    nextStep: payload.nextStep,
  };
}

function isReportStatus(value: unknown): value is AgroReportAnalysisResult['status'] {
  return value === 'Adequado' || value === 'Atenção' || value === 'Crítico';
}

function readNumberField(record: Record<string, unknown>, field: string): number {
  const value = record[field];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('A análise do laudo retornou dados numéricos inválidos.');
  }

  return value;
}

function parseAgroReportAnalysisResult(payload: unknown): AgroReportAnalysisResult {
  if (!isRecord(payload)) {
    throw new Error('A IA retornou um formato inválido para o laudo.');
  }

  if (
    typeof payload.title !== 'string' ||
    typeof payload.crop !== 'string' ||
    typeof payload.lot !== 'string' ||
    !isReportStatus(payload.status) ||
    typeof payload.recommendation !== 'string'
  ) {
    throw new Error('A resposta da IA para o laudo veio incompleta.');
  }

  return {
    title: payload.title,
    crop: payload.crop,
    lot: payload.lot,
    nitrogen: readNumberField(payload, 'nitrogen'),
    phosphorus: readNumberField(payload, 'phosphorus'),
    potassium: readNumberField(payload, 'potassium'),
    ph: readNumberField(payload, 'ph'),
    organicMatter: readNumberField(payload, 'organicMatter'),
    humidity: readNumberField(payload, 'humidity'),
    status: payload.status,
    recommendation: payload.recommendation,
  };
}

// Confere o formato básico da resposta de geocodificação do ArcGIS.
function isArcGisGeocodeResponse(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || !Array.isArray(value.candidates)) {
    return false;
  }

  return true;
}

// Extrai latitude, longitude e nome da localização retornada pelo ArcGIS.
function parseArcGisCoordinates(payload: unknown): MapCoordinates {
  if (!isArcGisGeocodeResponse(payload)) {
    throw new Error('A consulta de localização retornou um formato inválido.');
  }

  const candidates = payload.candidates;

  if (!Array.isArray(candidates)) {
    throw new Error('A consulta de localização retornou candidatos inválidos.');
  }

  const candidate: unknown = candidates[0];

  if (!isRecord(candidate) || !isRecord(candidate.location)) {
    throw new Error('Localização não encontrada para o endereço informado.');
  }

  const longitude = candidate.location.x;
  const latitude = candidate.location.y;
  const label = candidate.address;

  if (typeof longitude !== 'number' || typeof latitude !== 'number') {
    throw new Error('A localização retornou coordenadas inválidas.');
  }

  return {
    latitude,
    longitude,
    label: typeof label === 'string' ? label : 'Localização selecionada',
  };
}

// Simula o carregamento dos alertas agrícolas locais.
export async function fetchAgroAlerts(): Promise<AgroAlert[]> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 450);
  });

  return parseAgroAlerts(agroAlerts);
}

// Simula o consumo de lotes produtivos via camada de serviço.
export async function fetchFieldLots(): Promise<FieldLot[]> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 350);
  });

  return parseFieldLots(fieldLots);
}

// Busca o endereço completo a partir do CEP digitado no cadastro.
export async function fetchAddressByCep(cep: string): Promise<AddressInfo> {
  const normalizedCep = onlyNumbers(cep);

  if (normalizedCep.length !== 8) {
    throw new Error('Digite um CEP com 8 números.');
  }

  const response = await fetch(`https://viacep.com.br/ws/${normalizedCep}/json/`);
  const payload: unknown = await response.json();

  if (!isViaCepResponse(payload)) {
    throw new Error('A consulta de CEP retornou um formato inválido.');
  }

  if (payload.erro === true) {
    throw new Error('CEP não encontrado.');
  }

  return {
    cep: readStringField(payload, 'cep'),
    street: readStringField(payload, 'logradouro'),
    neighborhood: readStringField(payload, 'bairro'),
    city: readStringField(payload, 'localidade'),
    state: readStringField(payload, 'uf'),
  };
}

// Busca coordenadas para posicionar o mapa da propriedade.
export async function fetchCoordinatesByAddress(address: string): Promise<MapCoordinates> {
  const normalizedAddress = address.trim();

  if (normalizedAddress.length < 3) {
    throw new Error('Informe um endereço para buscar o mapa.');
  }

  const query = encodeURIComponent(normalizedAddress);
  const response = await fetch(
    `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&SingleLine=${query}&countryCode=BRA&maxLocations=1&outFields=Match_addr`
  );
  const payload: unknown = await response.json();

  return parseArcGisCoordinates(payload);
}

// Chama o backend local que consulta a OpenAI com dados da lavoura.
export async function diagnoseAgroWithAi(payload: DiagnosisPayload): Promise<DiagnosisResult> {
  const apiUrl = process.env.EXPO_PUBLIC_AGRO_AI_URL ?? `${localAiBaseUrl}/agro-diagnosis`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responsePayload: unknown = await response.json();

  if (!response.ok) {
    if (isRecord(responsePayload) && typeof responsePayload.error === 'string') {
      throw new Error(responsePayload.error);
    }

    throw new Error('Não foi possível consultar a IA agrícola.');
  }

  return parseDiagnosisResult(responsePayload);
}

// Chama o backend local que conversa com a OpenAI no chat agrícola.
export async function chatWithAgroAi(payload: AgroChatPayload): Promise<AgroChatResult> {
  const apiUrl = process.env.EXPO_PUBLIC_AGRO_CHAT_URL ?? `${localAiBaseUrl}/agro-chat`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responsePayload: unknown = await response.json();

  if (!response.ok) {
    if (isRecord(responsePayload) && typeof responsePayload.error === 'string') {
      throw new Error(responsePayload.error);
    }

    throw new Error('Não foi possível consultar o chat de IA agrícola.');
  }

  return parseAgroChatResult(responsePayload);
}

function getReportFileName(payload: AgroReportAnalysisPayload): string {
  const extension = payload.sourceType === 'PDF' ? 'pdf' : 'jpg';
  const uriFileName = payload.sourceUri.split('/').pop();

  if (uriFileName !== undefined && uriFileName.includes('.')) {
    return uriFileName;
  }

  return `laudo-agrícola.${extension}`;
}

function getReportMimeType(sourceType: AgroReportAnalysisPayload['sourceType']): string {
  return sourceType === 'PDF' ? 'application/pdf' : 'image/jpeg';
}

async function appendReportFile(
  formData: FormData,
  payload: AgroReportAnalysisPayload
): Promise<void> {
  const fileName = getReportFileName(payload);
  const mimeType = getReportMimeType(payload.sourceType);

  if (Platform.OS === 'web') {
    const fileResponse = await fetch(payload.sourceUri);
    const fileBlob = await fileResponse.blob();
    formData.append('report', fileBlob, fileName);
    return;
  }

  const reportFile = {
    uri: payload.sourceUri,
    name: fileName,
    type: mimeType,
  };

  formData.append('report', reportFile as unknown as Blob);
}

// Envia foto ou PDF ao backend Express para interpretação multimodal real.
export async function analyzeAgroReportWithAi(
  payload: AgroReportAnalysisPayload
): Promise<AgroReportAnalysisResult> {
  const apiUrl = process.env.EXPO_PUBLIC_AGRO_REPORT_URL ?? `${localAiBaseUrl}/agro-report`;
  const formData = new FormData();

  formData.append('sourceType', payload.sourceType);
  formData.append('context', JSON.stringify(payload.context));
  await appendReportFile(formData, payload);

  const response = await fetch(apiUrl, {
    method: 'POST',
    body: formData,
  });

  const responsePayload: unknown = await response.json();

  if (!response.ok) {
    if (isRecord(responsePayload) && typeof responsePayload.error === 'string') {
      throw new Error(responsePayload.error);
    }

    throw new Error('Não foi possível analisar o laudo com IA.');
  }

  return parseAgroReportAnalysisResult(responsePayload);
}
