# P1 — Plataforma de Processamento de Vídeo

Upload de vídeo sob demanda: conversão para 360p/720p/1080p, extração de áudio
para legendagem automática e marca d'água, com progresso em tempo real no
navegador. Nenhuma ação roda automaticamente — o usuário escolhe, por
upload, exatamente quais resoluções converter, se extrai áudio e se aplica
marca d'água (ver `domain/processingActions.js`).

## Requisitos

- Docker e Docker Compose

## Como rodar

```bash
docker compose up -d --build
```

Aguarde os serviços ficarem `healthy` (`docker compose ps`) e abra
`http://localhost:3000` no navegador para usar o mini-cliente de upload, ou
teste via API. O upload aceita quais ações executar via campos de formulário
(`resolutions` pode se repetir, uma vez por resolução marcada):

```bash
curl -F "video=@caminho/do/video.mp4" \
     -F "resolutions=720p" \
     -F "resolutions=1080p" \
     -F "extractAudio=true" \
     -F "watermark=true" \
     http://localhost:3000/videos
# => {
#      "videoId": "...",
#      "status": "uploaded",
#      "actions": {"resolutions":["720p","1080p"],"extractAudio":true,"watermark":true},
#      "destination": {
#        "directory": "/app/storage",
#        "files": ["<nome>-720p.mp4", "<nome>-1080p.mp4", "<nome>.mp3"]
#      }
#    }

curl -N http://localhost:3000/videos/<videoId>/progress
# stream de eventos SSE: {"stage":"convertendo_720p","percent":100,"outputPath":"<nome>-720p.mp4",...}

curl -O -J http://localhost:3000/videos/<videoId>/files/<nome>-720p.mp4
```

Pelo menos uma ação precisa ser selecionada (uma resolução ou a extração de
áudio) — sem isso a API responde `400` (`ProcessingActions`, em
`src/domain/processingActions.js`). O campo `destination` avisa, já na
resposta do upload, onde os arquivos resultantes vão ser gravados no volume
compartilhado; cada evento SSE de conclusão de etapa repete o `outputPath`
daquele arquivo específico, e o mini-cliente usa isso para virar um link de
download (`GET /videos/:id/files/:filename`) assim que o arquivo fica
pronto. Esse endpoint só libera nomes que batem com a convenção de saída do
próprio vídeo pedido (`usecases/getVideoFile.js`) — path traversal ou nomes
de outro vídeo voltam `400`/`404`.

Para demonstrar o escalonamento horizontal dos workers (competing consumers):

```bash
docker compose up -d --scale worker=3
```

### Portas expostas no host

RabbitMQ e Redis foram remapeados (`5673`, `15673`, `6380`) para evitar
conflito com outros serviços que já pudessem estar rodando na máquina de
desenvolvimento. As portas internas dos containers continuam as padrão
(`5672`, `15672`, `6379`) — ajuste `docker-compose.yml` livremente se não
houver conflito no seu ambiente.

| Serviço | Host | Container |
|---|---|---|
| API | 3000 | 3000 |
| Postgres | 5432 | 5432 |
| RabbitMQ (AMQP) | 5673 | 5672 |
| RabbitMQ (painel) | 15673 | 15672 |
| Redis | 6380 | 6379 |

## Testes

```bash
npm install
npm test
```

Testes automatizados (`node:test`, sem framework adicional) cobrem:

- `domain/`: invariantes de `Video`, parsing de `ProcessingJob`, validação de
  `processingActions` (pelo menos uma ação escolhida, marca d'água sem
  resolução é desligada), arredondamento/`outputPath` de `ProgressUpdate` e a
  lista de `resolutions`.
- `usecases/`: `uploadVideo` e `processVideo` com mocks manuais das
  dependências injetadas (repositório, publisher, ffmpeg adapter, serviço de
  transcrição, logger) — cobrindo o caminho feliz, execução seletiva das
  ações escolhidas (só converte/extrai o que foi marcado), falha do ffmpeg
  (status `failed` + propagação do erro) e falha best-effort da transcrição
  (não derruba o job).
- `interfaces/messaging/videoJobConsumer`: ack em sucesso, nack sem requeue em
  JSON inválido e em erro do usecase.
- `usecases/getVideoFile`: libera download apenas de nomes que seguem a
  convenção de saída do vídeo pedido; rejeita path traversal (`400`) e
  vídeo/arquivo inexistente (`404`).
- `interfaces/http/progressController`: assinatura/desinscrição do canal
  Redis por vídeo, incluindo o caso de duas conexões SSE assistindo ao mesmo
  vídeo (a primeira que fecha não pode cortar a segunda).

Fluxos de integração (upload → fila → worker → SSE) foram validados
manualmente ponta a ponta durante o desenvolvimento, subindo os containers
reais e enviando um vídeo gerado com `ffmpeg` (ver histórico de commits).

## Limitação conhecida: legendagem automática

`TRANSCRIPTION_API_URL` aponta para `http://transcription.invalid/v1` — um
domínio do TLD reservado `.invalid` (RFC 2606), que nunca resolve por design.
Isso simula uma API externa de transcrição sem exigir uma integração real
para o trabalho acadêmico. A chamada em `services/transcriptionService.js` é
best-effort: se falhar, o worker registra um aviso e o vídeo é concluído
normalmente, sem legenda. Para usar um serviço real, basta apontar a
variável de ambiente para o endpoint correto.

## Arquitetura

Clean Architecture com direção de dependência `interfaces → usecases →
domain`; `infra` e `services` implementam o que os usecases consomem via
injeção de dependência manual (`src/container.js`). Ver `CLAUDE.md` para a
descrição completa da estrutura de pastas e das regras de camada.

## ADR — Decisões de comunicação

### Fila de trabalho: AMQP (RabbitMQ)

**Decisão:** usar uma fila durável (`video-processing`) com ack manual para
distribuir os jobs de conversão entre a API e os workers.

**Motivo:** a conversão de vídeo é uma operação longa (minutos) e cara em
CPU. Uma fila durável com ack garante que o job não se perde se um worker
morrer no meio do processamento — a mensagem volta para a fila (ou é
redirecionada) em vez de desaparecer. O padrão *competing consumers* permite
escalonamento horizontal simplesmente subindo mais réplicas de worker
(`docker compose up -d --scale worker=3`), sem nenhuma mudança de código.

### Progresso worker → API: Redis Pub/Sub

**Decisão:** o worker publica cada evento de progresso (`percent` real do
ffmpeg) em um canal Redis por vídeo (`video:<id>`); a API assina esse canal
para repassar aos clientes conectados via SSE.

**Motivo:** progresso é informação efêmera — uma atualização desatualizada
não tem valor, então não há necessidade de persistência ou garantia de
entrega, ao contrário do job em si. Pub/Sub é fan-out puro e desacopla
completamente a API do número de workers rodando: nenhum dos dois lados
precisa saber quantas réplicas existem do outro.

### Navegador: SSE (Server-Sent Events)

**Decisão:** expor o progresso ao navegador via `GET /videos/:id/progress`
usando SSE nativo do Express, sem biblioteca adicional.

**Motivo:** o fluxo é estritamente unidirecional (servidor → cliente).
`EventSource` roda sobre HTTP comum, tem reconexão automática embutida no
navegador e não exige nenhuma infraestrutura de proxy/load balancer
diferenciada, ao contrário de WebSocket.

### Alternativas descartadas

- **gRPC** para a comunicação entre serviços: otimiza RPC síncrono de baixa
  latência. O caso de uso aqui é o oposto — uma operação que dura minutos e
  exige desacoplamento temporal entre quem pede e quem processa. Um request
  gRPC bloqueado por minutos não é uma boa modelagem do problema.
- **WebSocket** para o navegador: o cliente só recebe atualizações, nunca
  envia nada pelo mesmo canal. A bidirecionalidade do WebSocket traria
  handshake próprio, gestão de estado de conexão e complexidade adicional de
  proxy/load balancer sem nenhuma contrapartida real para este fluxo.
- **Redis como fila de trabalho** (em vez de AMQP, para os jobs de
  conversão): Pub/Sub não tem ack nem persistência de mensagem — um worker
  que morre no meio de uma conversão de 10 minutos perderia o job em
  silêncio, sem nenhuma forma de retry ou redistribuição. Isso é aceitável
  para *progresso* (efêmero por natureza), mas inaceitável para o *job em
  si*, que representa trabalho real do usuário.

## Armadilhas conhecidas

Ver seção "Armadilhas conhecidas" em `CLAUDE.md` — volume compartilhado
API/worker, cabeçalhos SSE corretos (sem `compression()`), duas instâncias
de `ioredis` (subscriber não aceita outros comandos), `prefetch(1)` no
worker, progresso real do ffmpeg (não sintético).
