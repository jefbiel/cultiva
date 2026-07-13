# Decisoes Tecnicas

## Arquitetura de telas e navegação

O aplicativo foi construído com Expo, React Native e TypeScript em modo estrito. A interface usa componentes nativos como `View`, `Text`, `Image`, `TextInput`, `ScrollView`, `FlatList`, `Modal`, `Switch`, `Pressable` e `StyleSheet`, sem WebView. A navegação principal foi organizada por estado: `AppScreen` controla o fluxo Login, Cadastro, Dashboard e Detalhes, enquanto `AppTab` alterna as abas internas Home, Mapa, Dados e Ajustes.

A decisão de concentrar o dashboard em uma tela principal foi tomada porque várias áreas compartilham os mesmos dados da sessão: identidade do usuário, alertas, lotes, sensores simulados, colheitas, laudos e mensagens do chat. Isso evita duplicação de estado entre telas e deixa os handlers de cadastro, diagnóstico, laudo e colheita em um ponto central. A barra inferior foi implementada como componente próprio (`BottomDock`) com quatro abas e um botão central de ações.

As partes maiores da interface foram separadas em componentes internos para facilitar leitura e manutenção: `LiveDashboardTab` exibe sensores e leiras, `MapTab` mostra mapa e focos, `DataTab` concentra lotes, colheitas, laudos, filtros e gráficos, `SettingsTab` guarda dados de conta e propriedade, `ActionMenuModal` organiza as ações do botão central, `ReportCameraModal` captura foto/PDF de laudo e `DiagnosisChatModal` concentra o chat agrícola com IA.

## Consumo de dados e tipagem

As chamadas de dados ficam isoladas em `src/services/api.ts`, separadas da UI. O app consome dados locais simulando API do grupo e também APIs externas por funções assíncronas tipadas, como `fetchAgroAlerts`, `fetchFieldLots`, `fetchAddressByCep`, `fetchCoordinatesByAddress`, `chatWithAgroAi` e `analyzeAgroReportWithAi`. Alertas e lotes ficam em `src/data`, mas sempre passam pela camada de serviço, com latência simulada e validação antes de chegarem aos componentes.

A aba Dados usa `FlatList` com `data`, `renderItem` e `keyExtractor` a partir dos lotes carregados por `fetchFieldLots()` em `useEffect`. Enquanto os dados carregam, a tela mostra estado de loading; se a fonte falhar, exibe erro. O cadastro de novos lotes fica no botão central `+`, junto das demais ações de campo, para manter a aba Dados focada em consulta, filtros, indicadores e histórico.

Os principais contratos ficam em `src/types/agro.ts`, usando `enum` e `type` para telas, abas, usuário, alertas, lotes, sensores, diagnósticos, chat, payloads de IA e formulários. Respostas externas entram como `unknown` e passam por type guards antes de serem usadas. Essa escolha evita `any`, reduz risco de quebrar telas com JSON inválido e torna explícito o formato esperado pelo aplicativo.

O backend próprio fica em `scripts/agro-ai-server.mjs`, usa Express e serve a API consumida pelo app. Ele oferece `/agro-diagnosis`, `/agro-chat` e `/agro-report`, mantendo a chave `OPENAI_API_KEY` fora do mobile. O endpoint `/agro-report` recebe foto ou PDF via `multipart/form-data`, interpreta o arquivo com IA multimodal e devolve um JSON tipado para alimentar a seção de laudos.

## Persistência local

A identidade e preferências do usuário são persistidas com `@react-native-async-storage/async-storage`, encapsulado em `src/services/storage.ts`. São salvos dados de login/cadastro, perfil, notificações, endereço e informações da propriedade ou do agrônomo. A persistência foi escolhida para manter a experiência contínua: ao abrir o app novamente, o usuário não precisa refazer cadastro nem reconfigurar suas preferências.

Ao iniciar o app, `loadUserIdentity()` restaura esses dados e valida a estrutura com type guards. Se o registro local estiver inválido, ele é removido e o usuário volta ao fluxo de login. Essa validação evita que uma versão antiga ou corrompida do armazenamento quebre a interface.

Os lotes cadastrados também são persistidos localmente por `saveFieldLots()` e `loadFieldLots()`. Isso permite que os lotes criados no botão central continuem disponíveis depois que o app fecha, aproximando o protótipo de um uso real no campo. Já sensores em tempo real, alertas simulados, colheitas e mensagens temporárias ficam em memória porque representam dados voláteis do MVP ou fluxos que ainda seriam sincronizados com um backend completo em uma evolução futura.

## Recursos nativos e integrações

O app usa recursos nativos para atender aos requisitos de campo: `expo-image-picker` para imagem de lote, `expo-camera` para fotografar laudos, `expo-document-picker` para anexar PDF, `Modal` para ações e chat, `Switch` para preferências e `AsyncStorage` para persistência. O mapa usa imagem de satélite do ArcGIS e camadas agrícolas simuladas; sensores continuam simulados por enquanto, pois a integração com hardware real exigiria infraestrutura MQTT ou WebSocket.

O chat e os laudos usam backend real para não expor segredo no app mobile. Se a API ou o backend estiverem indisponíveis, o app mostra erro claro ao usuário em vez de fingir uma resposta real. Essa decisão evita confundir demonstração local com recomendação técnica validada por IA.
