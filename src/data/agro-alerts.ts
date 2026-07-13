import { AgroAlert, AlertSeverity } from '@/types/agro';

export const agroAlerts: AgroAlert[] = [
  {
    id: 'alerta-001',
    title: 'Risco de ferrugem asiática',
    crop: 'Soja',
    region: 'Norte do Paraná',
    severity: AlertSeverity.High,
    summary:
      'Umidade alta e temperaturas amenas aumentam o risco de desenvolvimento da doença nos próximos dias.',
    recommendation:
      'Monitore folhas do terço inferior, registre imagens da lavoura e consulte um agrônomo antes da aplicação preventiva.',
    updatedAt: '2026-06-08T10:30:00.000Z',
  },
  {
    id: 'alerta-002',
    title: 'Janela ideal de adubação',
    crop: 'Milho',
    region: 'Oeste de Santa Catarina',
    severity: AlertSeverity.Medium,
    summary: 'A previsão de chuva leve favorece incorporação de nitrogênio em cobertura.',
    recommendation: 'Priorize talhões em V4 a V6 e confira a umidade do solo antes da operação.',
    updatedAt: '2026-06-07T14:00:00.000Z',
  },
  {
    id: 'alerta-003',
    title: 'Atenção ao bicho-mineiro',
    crop: 'Café',
    region: 'Sul de Minas',
    severity: AlertSeverity.Medium,
    summary: 'Amostragens recentes indicam aumento gradual da incidência em áreas com baixa sombra.',
    recommendation: 'Acompanhe o percentual de folhas minadas e registre a evolução semanal no app.',
    updatedAt: '2026-06-06T09:15:00.000Z',
  },
  {
    id: 'alerta-004',
    title: 'Solo com baixa reserva hídrica',
    crop: 'Hortaliças',
    region: 'Interior de São Paulo',
    severity: AlertSeverity.High,
    summary: 'A baixa precipitação acumulada pode comprometer culturas sensíveis nas fases iniciais.',
    recommendation: 'Revise o manejo de irrigação, cobertura do solo e horários de aplicação.',
    updatedAt: '2026-06-05T18:45:00.000Z',
  },
  {
    id: 'alerta-005',
    title: 'Boas condições para pulverização',
    crop: 'Algodão',
    region: 'Oeste da Bahia',
    severity: AlertSeverity.Low,
    summary:
      'Velocidade do vento e umidade relativa estão dentro da faixa recomendada para aplicações planejadas.',
    recommendation: 'Confirme a regulagem dos bicos e mantenha registro do produto, dose e talhão.',
    updatedAt: '2026-06-04T11:20:00.000Z',
  },
];
