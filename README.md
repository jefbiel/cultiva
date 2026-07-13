# Cultiva Mobile

Aplicativo mobile nativo em React Native/Expo para gestão agrícola. O app permite cadastrar o perfil do usuário, acompanhar lotes e leiras, visualizar sensores, consultar dados de produção, abrir mapa da propriedade e acionar registros de campo como cadastro de lote, colheita, laudo técnico e diagnóstico com IA.

## Integrantes

- Gilson Dias Ramos Junior (RM552345)
- Isabelle Toricelli da Silva (RM552806)
- Jeferson Gabriel de Mendonca (RM553149)

## Como rodar

Instale as dependências:

```bash
npm install
```

Inicie o Expo:

```bash
npx expo start
```

Depois, use uma das opções exibidas no terminal:

- Expo Go no celular.
- Android Emulator.
- iOS Simulator.
- Web, para uma validação rápida de interface.

## Fonte de dados e backend

O projeto roda sem backend próprio para as telas principais, mas possui um backend local opcional para IA real. As fontes usadas são:

- `src/data/agro-alerts.ts`: base local simulada de alertas agrícolas.
- `src/data/field-lots.ts`: base local inicial de lotes.
- `src/services/realtime.ts`: atualização simulada em tempo real para leituras IoT.
- ViaCEP: consulta de CEP durante o cadastro.
- ArcGIS Geocode: busca de coordenadas para ajustar a imagem de satélite do mapa.
- ArcGIS World Imagery: imagem de satélite usada na tela de mapa.
- OpenAI Responses API: diagnóstico agrícola real, chat agrícola e interpretação multimodal de foto/PDF de laudo.

Se as APIs externas estiverem indisponíveis, o app trata erro e usa mensagens ou mapa padrão quando aplicável.

## Como subir a fonte de IA/backend

Defina a chave da OpenAI no terminal:

```bash
export OPENAI_API_KEY="sua_chave_aqui"
```

Inicie o backend local:

```bash
npm run ai:server
```

Em outro terminal, inicie o app:

```bash
npx expo start
```

Por padrão, o app chama:

```text
http://localhost:8787/agro-diagnosis
http://localhost:8787/agro-chat
http://localhost:8787/agro-report
```

Se precisar trocar a URL do backend, defina:

```bash
export EXPO_PUBLIC_AGRO_AI_URL="http://SEU_IP_LOCAL:8787/agro-diagnosis"
export EXPO_PUBLIC_AGRO_CHAT_URL="http://SEU_IP_LOCAL:8787/agro-chat"
export EXPO_PUBLIC_AGRO_REPORT_URL="http://SEU_IP_LOCAL:8787/agro-report"
```

Em um celular físico pelo Expo Go, use o IP local do computador no lugar de `localhost`.

## Funcionalidades avançadas usadas

- Persistência local com AsyncStorage.
- Lista dinâmica com FlatList.
- Câmera, galeria e PDF para anexar laudos e imagens de lote.
- Mapa com geocodificação, satélite e camadas agrícolas simuladas.
- Gráficos simples com componentes nativos.
- Tempo real simulado para sensores IoT.
- Backend local opcional para chat/diagnóstico com IA.

## Scripts úteis

Checar TypeScript:

```bash
npx tsc --noEmit
```

Rodar lint:

```bash
npm run lint
```

