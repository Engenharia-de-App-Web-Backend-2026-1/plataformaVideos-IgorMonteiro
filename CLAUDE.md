# CLAUDE.md

Contexto e regras deste repositório. Leia antes de escrever qualquer código.

## Projeto

Plataforma de processamento de vídeos sob demanda. O usuário envia um vídeo bruto;
o sistema converte para 360p/720p/1080p, extrai o áudio para legendagem automática e
aplica marca d'água. O processo demora minutos e o painel do usuário exibe o progresso
em tempo real (ex: "Convertendo 1080p... 45%").

Trabalho acadêmico avaliado por **aplicação correta de Clean Architecture** e por
**decisões arquiteturais de comunicação**. Código que funciona mas viola a arquitetura
vale menos que código simples e bem separado. Priorize clareza sobre esperteza.

## Stack — fixa, não substitua

| Camada | Escolha |
|---|---|
| Runtime | Node.js 20, **CommonJS** (`require`/`module.exports`) |
| HTTP | Express 4 |
| Upload | multer, gravando **em disco** (nunca em memória) |
| Fila de trabalho | RabbitMQ via `amqplib` |
| Progresso | Redis Pub/Sub via `ioredis` |
| Push ao navegador | SSE nativo do Express (sem biblioteca) |
| Banco | PostgreSQL via `pg` puro, SQL escrito à mão. **Sem ORM.** |
| Vídeo | `fluent-ffmpeg` sobre o binário ffmpeg da imagem |

Regras duras:
- **CommonJS em todos os arquivos.** Nunca misture `import`/`export`.
- **Sem TypeScript.** JavaScript puro.
- **Sem ORM, sem framework de DI, sem Nest.** Injeção de dependência é por parâmetro
  de função/construtor, montada à mão em `src/container.js`.

## Fluxo do sistema

```
POST /videos  →  salva arquivo em disco + registro no Postgres
              →  publica job na fila AMQP  →  responde 202 com videoId

worker consome job  →  ffmpeg (360p, 720p, 1080p, áudio, marca d'água)
                    →  a cada evento de progresso, PUBLISH em redis canal video:<id>
                    →  ao fim, UPDATE status no Postgres

GET /videos/:id/progress (SSE)  →  API assina redis canal video:<id>
                                →  repassa cada mensagem como evento SSE
```

## Estrutura de pastas

```
src/
  domain/         Entidades e regras invariantes. ZERO imports de terceiros.
                  Video, ProcessingJob, ProgressUpdate.
  usecases/       Regra de negócio. Recebe dependências por parâmetro.
                  uploadVideo, processVideo, trackProgress.
  interfaces/     TODOS os controllers ficam aqui.
    http/         routes.js, uploadController, progressController (SSE)
    messaging/    videoJobConsumer — o consumer AMQP é um controller
  services/       APENAS chamadas a APIs externas.
                  transcriptionService (legendagem automática).
  infra/          Detalhes técnicos: postgresVideoRepository, amqpPublisher,
                  amqpConnection, redisPubSub, ffmpegAdapter, config.
  container.js    Monta as dependências e injeta nos use cases.
  server.js       Entrypoint da API.
  worker.js       Entrypoint do worker.
db/init.sql       Schema, carregado automaticamente pelo Postgres no 1º boot.
public/index.html Mini-cliente para testar upload + SSE.
```

## Direção de dependência — a regra mais importante

`interfaces` → `usecases` → `domain`
`infra` e `services` implementam interfaces consumidas pelos `usecases`.

Consequências obrigatórias:
- Um arquivo em `usecases/` **nunca** faz `require` de `express`, `amqplib`,
  `ioredis`, `pg`, `fluent-ffmpeg` ou de qualquer coisa em `infra/`.
- Um use case recebe `{ videoRepository, jobPublisher, progressPublisher, videoProcessor }`
  como parâmetro. Ele chama métodos com nomes de domínio (`videoRepository.save(video)`),
  não conhece SQL, canal Redis nem nome de fila.
- `req` e `res` do Express não passam da pasta `interfaces/http`. O controller extrai
  os dados, chama o use case, formata a resposta.
- O consumer AMQP em `interfaces/messaging` faz o mesmo papel: desserializa a mensagem,
  chama o use case, dá ack/nack.

## Armadilhas conhecidas — não repita

1. **Volume compartilhado.** API e worker são containers separados. Ambos montam o mesmo
   volume em `/app/storage`. O caminho gravado no banco é relativo a esse ponto de montagem.
2. **SSE no Express.** A rota de progresso precisa de `Content-Type: text/event-stream`,
   `Cache-Control: no-cache`, `Connection: keep-alive`, `res.flushHeaders()` e um keepalive
   `res.write(': ping\n\n')` a cada 15s. Registre `req.on('close', ...)` para desinscrever
   do Redis. **Nunca** aplique `compression()` nessa rota.
3. **ioredis em modo subscriber.** Uma conexão que fez `subscribe` não aceita outros comandos.
   A API precisa de duas instâncias separadas de ioredis.
4. **Prefetch do consumer.** `channel.prefetch(1)` no worker, senão um worker engole
   todos os jobs e o escalonamento horizontal não demonstra nada.
5. **Progresso real.** `fluent-ffmpeg` emite evento `progress` com `percent`. Use esse valor.
   Não invente porcentagem sintética.
6. **Escalonamento.** O serviço `worker` não tem `container_name` no compose, para permitir
   `docker compose up -d --scale worker=3`. Não adicione.

## Convenções

- Toda configuração vem de variável de ambiente, lida em um único lugar: `src/infra/config.js`.
- Nada de `console.log` espalhado; um helper simples de log em `src/infra/logger.js`.
- Erro de negócio é classe de erro do domínio; o controller HTTP traduz para status code.
- Mensagens AMQP e eventos SSE em JSON.

## Milestones

Um commit por milestone. Não comece a seguinte sem a anterior rodando.

1. Esqueleto + `docker compose up -d` subindo Postgres, RabbitMQ, Redis e API vazia com `GET /health`.
2. Upload: multer em disco, INSERT no Postgres, publish do job na fila. Resposta 202.
3. Worker: consumer, fluent-ffmpeg (3 resoluções + áudio + marca d'água), publish de progresso no Redis.
4. SSE: rota de progresso + `public/index.html` com `<progress>` consumindo `EventSource`.
5. README com passo a passo, ADR preenchido, exemplos de teste. Tag `v1.0.0`.

## ADR — argumentos já decididos

Escolhidos:
- **AMQP** para distribuir trabalho pesado. Fila durável com ack garante que job não se perde
  se o worker morrer no meio; competing consumers dá escalonamento horizontal por réplica.
- **Redis Pub/Sub** para o caminho de volta worker → API. Fan-out efêmero, sem necessidade de
  persistência: progresso desatualizado não tem valor. Desacopla a API do número de workers.
- **SSE** para o navegador. Fluxo unidirecional servidor→cliente, sobre HTTP comum, com
  reconexão automática nativa do `EventSource`.

Descartados (justifique no README):
- **gRPC**: otimiza RPC síncrono de baixa latência entre serviços; aqui a operação dura minutos
  e exige desacoplamento temporal, o oposto do caso de uso.
- **WebSocket**: o cliente só recebe. Bidirecionalidade traria handshake, gestão de estado de
  conexão e complexidade de proxy sem contrapartida.
- **Redis como fila de trabalho** (em vez do AMQP): Pub/Sub não tem ack nem persistência; um
  worker que cai durante uma conversão de 10 minutos perderia o job silenciosamente.
