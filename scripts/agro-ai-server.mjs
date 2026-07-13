import express from 'express';
import multer from 'multer';

const port = Number.parseInt(process.env.AGRO_AI_PORT ?? '8787', 10);
const host = process.env.AGRO_AI_HOST ?? 'localhost';
const model = process.env.OPENAI_MODEL ?? 'gpt-5.4-mini';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
  fileFilter(request, file, callback) {
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      callback(new Error('Envie um PDF ou imagem JPG, PNG ou WebP.'));
      return;
    }

    callback(null, true);
  },
});

// Extrai o texto gerado pela OpenAI da resposta da Responses API.
function extractOutputText(payload) {
  if (typeof payload.output_text === 'string') {
    return payload.output_text;
  }

  if (!Array.isArray(payload.output)) {
    return '';
  }

  return payload.output
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .map((content) => {
      if (typeof content.text === 'string') {
        return content.text;
      }

      if (typeof content.output_text === 'string') {
        return content.output_text;
      }

      return '';
    })
    .join('\n')
    .trim();
}

// Converte o texto da IA para o JSON usado pelo aplicativo.
function parseDiagnosis(text) {
  const cleanedText = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '');
  const parsed = JSON.parse(cleanedText);

  if (
    typeof parsed.summary !== 'string' ||
    typeof parsed.severity !== 'string' ||
    typeof parsed.recommendation !== 'string' ||
    typeof parsed.nextStep !== 'string'
  ) {
    throw new Error('A IA retornou JSON sem os campos esperados.');
  }

  const allowedSeverity = ['Baixa', 'Média', 'Alta'];

  return {
    summary: parsed.summary,
    severity: allowedSeverity.includes(parsed.severity) ? parsed.severity : 'Média',
    recommendation: parsed.recommendation,
    nextStep: parsed.nextStep,
  };
}

// Converte o texto da IA para o JSON usado pelo chat do aplicativo.
function parseChatReply(text) {
  const cleanedText = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '');
  const parsed = JSON.parse(cleanedText);

  if (
    typeof parsed.reply !== 'string' ||
    typeof parsed.severity !== 'string' ||
    typeof parsed.recommendation !== 'string' ||
    typeof parsed.nextStep !== 'string'
  ) {
    throw new Error('A IA retornou JSON de chat sem os campos esperados.');
  }

  const allowedSeverity = ['Baixa', 'Média', 'Alta'];

  return {
    reply: parsed.reply,
    severity: allowedSeverity.includes(parsed.severity) ? parsed.severity : 'Média',
    recommendation: parsed.recommendation,
    nextStep: parsed.nextStep,
  };
}

// Converte a análise multimodal de laudo para o JSON usado pelo aplicativo.
function parseReportAnalysis(text) {
  const cleanedText = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '');
  const parsed = JSON.parse(cleanedText);

  if (
    typeof parsed.title !== 'string' ||
    typeof parsed.crop !== 'string' ||
    typeof parsed.lot !== 'string' ||
    typeof parsed.nitrogen !== 'number' ||
    typeof parsed.phosphorus !== 'number' ||
    typeof parsed.potassium !== 'number' ||
    typeof parsed.ph !== 'number' ||
    typeof parsed.organicMatter !== 'number' ||
    typeof parsed.humidity !== 'number' ||
    typeof parsed.status !== 'string' ||
    typeof parsed.recommendation !== 'string'
  ) {
    throw new Error('A IA retornou JSON de laudo sem os campos esperados.');
  }

  const allowedStatus = ['Adequado', 'Atenção', 'Crítico'];

  return {
    title: parsed.title,
    crop: parsed.crop,
    lot: parsed.lot,
    nitrogen: parsed.nitrogen,
    phosphorus: parsed.phosphorus,
    potassium: parsed.potassium,
    ph: parsed.ph,
    organicMatter: parsed.organicMatter,
    humidity: parsed.humidity,
    status: allowedStatus.includes(parsed.status) ? parsed.status : 'Atenção',
    recommendation: parsed.recommendation,
  };
}

function parseReportContext(rawContext) {
  if (typeof rawContext !== 'string' || rawContext.trim().length === 0) {
    return {};
  }

  return JSON.parse(rawContext);
}

function buildReportFileInput(file) {
  const fileData = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

  if (file.mimetype === 'application/pdf') {
    return {
      type: 'input_file',
      filename: file.originalname || 'laudo-agrícola.pdf',
      file_data: fileData,
    };
  }

  return {
    type: 'input_image',
    image_url: fileData,
    detail: 'high',
  };
}

// Chama a OpenAI usando a chave guardada no backend.
async function requestOpenAiDiagnosis(payload) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey === undefined || apiKey.trim().length === 0) {
    throw new Error('Defina OPENAI_API_KEY antes de iniciar o servidor de IA.');
  }

  const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content:
            'Você e uma IA agrícola para triagem de lavoura. Responda somente JSON válido, sem markdown, no formato {"summary":"...","severity":"Baixa|Média|Alta","recommendation":"...","nextStep":"..."}. Seja conservador, recomende validação de agrônomo em risco alto e não invente diagnóstico definitivo.',
        },
        {
          role: 'user',
          content: `Análise estes dados de uma operação agrícola e gere uma triagem objetiva:\n${JSON.stringify(
            payload,
            null,
            2
          )}`,
        },
      ],
    }),
  });

  const openAiPayload = await openAiResponse.json();

  if (!openAiResponse.ok) {
    const message =
      typeof openAiPayload.error?.message === 'string'
        ? openAiPayload.error.message
        : 'Erro ao consultar a OpenAI.';
    throw new Error(message);
  }

  const outputText = extractOutputText(openAiPayload);

  if (outputText.length === 0) {
    throw new Error('A OpenAI não retornou texto para o diagnóstico.');
  }

  return parseDiagnosis(outputText);
}

// Chama a OpenAI para responder uma conversa agrícola com contexto operacional.
async function requestOpenAiChat(payload) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey === undefined || apiKey.trim().length === 0) {
    throw new Error('Defina OPENAI_API_KEY antes de iniciar o servidor de IA.');
  }

  const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content:
            'Você e uma IA agrícola para atendimento em chat. Use o contexto da lavoura, sensores, colheitas, laudos, alertas e histórico da conversa para responder de forma prática. Responda somente JSON válido, sem markdown, no formato {"reply":"...","severity":"Baixa|Média|Alta","recommendation":"...","nextStep":"..."}. Não invente diagnóstico definitivo; recomende validação técnica em risco alto.',
        },
        {
          role: 'user',
          content: `Contexto e histórico do chat:\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
    }),
  });

  const openAiPayload = await openAiResponse.json();

  if (!openAiResponse.ok) {
    const message =
      typeof openAiPayload.error?.message === 'string'
        ? openAiPayload.error.message
        : 'Erro ao consultar a OpenAI.';
    throw new Error(message);
  }

  const outputText = extractOutputText(openAiPayload);

  if (outputText.length === 0) {
    throw new Error('A OpenAI não retornou texto para o chat.');
  }

  return parseChatReply(outputText);
}

// Chama a OpenAI para interpretar uma foto ou PDF de laudo agrícola.
async function requestOpenAiReportAnalysis({ file, sourceType, context }) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey === undefined || apiKey.trim().length === 0) {
    throw new Error('Defina OPENAI_API_KEY antes de iniciar o servidor de IA.');
  }

  const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content:
            'Você e uma IA agrícola que interpreta fotos ou PDFs de laudos técnicos de lavoura. Responda somente JSON válido, sem markdown, no formato {"title":"...","crop":"...","lot":"...","nitrogen":0,"phosphorus":0,"potassium":0,"ph":0,"organicMatter":0,"humidity":0,"status":"Adequado|Atenção|Crítico","recommendation":"..."}. Use 0 quando o dado numérico não aparecer claramente no arquivo. Seja conservador e recomende validação de agrônomo quando o documento estiver ilegível ou incompleto.',
        },
        {
          role: 'user',
          content: [
            buildReportFileInput(file),
            {
              type: 'input_text',
              text: `Análise este ${sourceType} de laudo agrícola e extraia indicadores para o aplicativo. Contexto operacional:\n${JSON.stringify(
                context,
                null,
                2
              )}`,
            },
          ],
        },
      ],
    }),
  });

  const openAiPayload = await openAiResponse.json();

  if (!openAiResponse.ok) {
    const message =
      typeof openAiPayload.error?.message === 'string'
        ? openAiPayload.error.message
        : 'Erro ao consultar a OpenAI.';
    throw new Error(message);
  }

  const outputText = extractOutputText(openAiPayload);

  if (outputText.length === 0) {
    throw new Error('A OpenAI não retornou texto para a análise do laudo.');
  }

  return parseReportAnalysis(outputText);
}

const app = express();

app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json({ limit: '1mb' }));

// Endpoints locais que recebem os dados da lavoura e devolvem as respostas da IA.
app.post('/agro-diagnosis', async (request, response) => {
  try {
    const diagnosis = await requestOpenAiDiagnosis(request.body);
    response.json(diagnosis);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Erro inesperado no diagnóstico de IA.',
    });
  }
});

app.post('/agro-chat', async (request, response) => {
  try {
    const chatReply = await requestOpenAiChat(request.body);
    response.json(chatReply);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Erro inesperado no diagnóstico de IA.',
    });
  }
});

app.post('/agro-report', upload.single('report'), async (request, response) => {
  try {
    if (request.file === undefined) {
      response.status(400).json({ error: 'Envie o arquivo do laudo no campo report.' });
      return;
    }

    const sourceType = request.body.sourceType === 'PDF' ? 'PDF' : 'Foto';
    const context = parseReportContext(request.body.context);
    const analysis = await requestOpenAiReportAnalysis({
      file: request.file,
      sourceType,
      context,
    });

    response.json(analysis);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Erro inesperado na análise do laudo.',
    });
  }
});

app.use((request, response) => {
  response.status(404).json({ error: 'Endpoint não encontrado.' });
});

app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const statusCode = error.type === 'entity.too.large' ? 413 : 400;
  const message = (() => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return 'Arquivo muito grande para análise. Envie um PDF ou imagem de até 15 MB.';
    }

    if (error.type === 'entity.too.large') {
      return 'Payload muito grande para diagnóstico.';
    }

    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return 'JSON inválido enviado ao backend.';
  })();

  response.status(statusCode).json({ error: message });
});

app.listen(port, host, (error) => {
  if (error) {
    console.error(error);
    process.exitCode = 1;
    return;
  }

  console.log(`Agro AI server running at http://${host}:${port}/agro-diagnosis`);
  console.log(`Agro AI chat running at http://${host}:${port}/agro-chat`);
  console.log(`Agro AI report upload running at http://${host}:${port}/agro-report`);
});
