import { FieldLot, PlantingRowSensor } from '@/types/agro';

export type CropAnalysisPayload = {
  lot: FieldLot;
  rows: PlantingRowSensor[];
};

export type CropAnalysisResult = {
  risk: 'Baixo' | 'Médio' | 'Alto';
  summary: string;
  recommendation: string;
};

export async function analyzeCropData(payload: CropAnalysisPayload): Promise<CropAnalysisResult> {
  const alertCount = payload.rows.reduce((total, row) => total + row.reading.alerts.length, 0);
  const risk: CropAnalysisResult['risk'] = alertCount >= 3 ? 'Alto' : alertCount > 0 ? 'Médio' : 'Baixo';

  return {
    risk,
    summary: `${payload.lot.name} possui ${payload.rows.length} leiras monitoradas e ${alertCount} alerta(s) ativo(s).`,
    recommendation:
      risk === 'Baixo'
        ? 'Manter manejo atual e revisar leituras no próximo ciclo de irrigação.'
        : 'Priorizar vistoria nas leiras com alerta e ajustar irrigação ou nutrição conforme a leitura.',
  };
}

export async function classifyPlantImage(imageUri: string): Promise<CropAnalysisResult> {
  return {
    risk: 'Médio',
    summary: `Imagem recebida para triagem visual: ${imageUri.slice(0, 42)}...`,
    recommendation:
      'No app real, envie a imagem ao backend Express para classificar praga, doença ou estresse sem expor chave de IA no mobile.',
  };
}

export async function generateLotRecommendation(lotId: string): Promise<string> {
  return `Recomendação simulada para ${lotId}: revisar umidade do substrato, pH e luminosidade antes da próxima irrigação.`;
}
