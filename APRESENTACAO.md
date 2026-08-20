# Script de Apresentação — Plataforma de Processamento de Vídeos sob Demanda

> Guia para a apresentação em aula. Cada seção é um bloco de fala + o comando
> a executar naquele momento. Testado ponta a ponta antes desta entrega.

---

## 1. Abertura — o problema (30s)

"O cenário escolhido foi uma plataforma de processamento de vídeo sob
demanda. O usuário sobe um vídeo bruto; o sistema precisa:

- Converter para 360p, 720p e 1080p
- Extrair o áudio para legendagem automática
- Aplicar marca d'água
- Mostrar progresso em tempo real no painel, sem o usuário dar refresh

O processamento leva minutos e consome CPU pesado — isso por si só já
descarta qualquer solução ingênua de fazer tudo numa única requisição HTTP
síncrona."

---

## 2. O desafio arquitetural (30s)

Dois problemas de comunicação distintos, cada um resolvido com uma
tecnologia diferente:

1. **Desacoplamento e escalonamento**: como separar a API (que só recebe o
   upload) dos workers (que fazem a conversão pesada), permitindo distribuir
   o trabalho entre várias máquinas/réplicas?
2. **Feedback ao cliente**: como o worker informa progresso para a API, e
   como a API empurra isso para o navegador sem polling?

---

## 3. Decisões tecnológicas (o ADR, resumido) (1min)

Usamos **três** das tecnologias da lista (o mínimo exigido era duas):

| Comunicação | Tecnologia | Por quê |
|---|---|---|
| API → Worker (job de conversão) | **AMQP (RabbitMQ)** | Fila durável + ack manual: se o worker morre no meio de uma conversão de 10 min, o job não se perde. *Competing consumers* dá escalonamento horizontal só subindo réplicas. |
| Worker → API (progresso) | **Redis Pub/Sub** | Progresso é efêmero — uma atualização atrasada não vale nada, não precisa de persistência. Pub/Sub é fan-out puro e desacopla a API do número de workers. |
| API → Navegador | **SSE** | Fluxo é unidirecional (só o servidor fala). `EventSource` reconecta sozinho, roda sobre HTTP comum, sem a complexidade de handshake do WebSocket. |

**Descartados, e por quê:**
- **gRPC**: otimiza RPC síncrono de baixa latência. Aqui a operação dura
  minutos — é o oposto do caso de uso, exige desacoplamento temporal.
- **WebSocket**: o cliente só recebe, nunca envia nada de volta pelo mesmo
  canal. Bidirecionalidade traria handshake e complexidade de proxy sem
  nenhuma contrapartida real.
- **Redis como fila de trabalho** (em vez de AMQP): Pub/Sub não tem ack nem
  persistência — um worker que morre no meio da conversão perderia o job
  silenciosamente. Aceitável para progresso, inaceitável para o job em si.

(Texto completo do ADR está no `README.md`.)

---

## 4. Clean Architecture (1min, mostrando a árvore de pastas)

```
src/
  domain/         Video, ProcessingJob, ProgressUpdate — zero imports de terceiros
  usecases/       uploadVideo, processVideo — recebem dependências por parâmetro
  interfaces/
    http/         uploadController, progressController (SSE) — os controllers HTTP
    messaging/    videoJobConsumer — o consumer AMQP É um controller
  services/       transcriptionService — a ÚNICA chamada a API externa
  infra/          postgresVideoRepository, amqpPublisher, redisPubSub, ffmpegAdapter
  container.js    monta tudo à mão (sem DI framework)
```

Regra de ouro: `interfaces → usecases → domain`. Um use case nunca importa
`express`, `amqplib`, `ioredis`, `pg` ou `fluent-ffmpeg` diretamente — recebe
tudo isso já encapsulado via parâmetro (`videoRepository`, `jobPublisher`,
`progressPublisher`, `videoProcessor`). **Verificado por grep antes desta
apresentação: nenhum `require` de infra dentro de `usecases/` ou `domain/`.**

---

## 5. Containerização (30s)

```bash
docker compose up -d --build
```

Sobe **5 serviços**: `postgres`, `rabbitmq`, `redis`, `api`, `worker`. A API
e o worker esperam os três primeiros ficarem `healthy` (`depends_on` com
`condition: service_healthy`) antes de iniciar.

Escalonamento horizontal — o `worker` não tem `container_name` no compose
justamente para permitir múltiplas réplicas:

```bash
docker compose up -d --scale worker=3
```

---

## 6. Demonstração ao vivo — roteiro de comandos

### 6.1 Subir o ambiente

```bash
docker compose up -d --build
docker compose ps          # todos "healthy"/"running"
curl http://localhost:3000/health   # {"status":"ok"}
```

### 6.2 Testar pelo mini-cliente (mais visual para a banca)

Abra `http://localhost:3000` no navegador, selecione um arquivo de vídeo e
marque quais ações executar (nada roda automaticamente): resoluções
(360p/720p/1080p), extração de áudio e/ou marca d'água. Ao enviar, a barra de
progresso atualiza sozinha via SSE — sem refresh — e a tela mostra o
diretório e a lista de arquivos de destino, trocando cada item por um link
"baixar" conforme o worker termina aquela etapa — clique baixa o arquivo
direto do navegador (`GET /videos/:id/files/:filename`).

### 6.3 Testar via linha de comando (mostra o payload cru)

```bash
curl -F "video=@caminho/do/video.mp4" \
     -F "resolutions=720p" \
     -F "extractAudio=true" \
     -F "watermark=true" \
     http://localhost:3000/videos
# => {"videoId":"...","status":"uploaded","actions":{...},
#     "destination":{"directory":"/app/storage","files":["<nome>-720p.mp4","<nome>.mp3"]}}
#   (HTTP 202)

curl -N http://localhost:3000/videos/<videoId>/progress
# stream SSE: data: {"stage":"convertendo_720p","percent":45,"outputPath":null,...}
# ao concluir a etapa: {"stage":"convertendo_720p","percent":100,"outputPath":"<nome>-720p.mp4",...}
```

> Enviar sem marcar nenhuma ação retorna `400` — é o domínio
> (`processingActions`) recusando um job que não faria nada.

> **Importante para a demo**: conecte o SSE **logo após** o upload (ou use o
> mini-cliente, que já faz isso automaticamente). Redis Pub/Sub não faz
> replay — se você conectar depois que o worker já terminou, só verá o
> `: ping` de keepalive e o vídeo já vai constar como `completed` no banco.
> Isso é uma consequência direta e esperada da decisão arquitetural (mostrar
> isso à banca reforça que a escolha foi entendida, não só copiada).

### 6.4 Provar o escalonamento horizontal

```bash
docker compose up -d --scale worker=3
docker compose ps          # 3 réplicas de worker
# suba vários vídeos em sequência e mostre nos logs que cada worker pega jobs diferentes
docker compose logs -f worker
```

### 6.5 Provar que o job sobrevive à morte de um worker (opcional, se sobrar tempo)

```bash
# suba um vídeo grande (~1min de conversão), depois mate o worker no meio:
docker compose kill worker
docker compose up -d worker   # RabbitMQ redistribui o job não confirmado (nack automático por desconexão)
```

### 6.6 Rodar os testes automatizados

```bash
npm install
npm test
```

47 testes (`node:test`, sem framework adicional), cobrindo:
- `domain/`: invariantes de `Video`, parsing de `ProcessingJob`, validação de
  `processingActions` (escolha de ações do usuário), `ProgressUpdate`
  (incluindo `outputPath`), `resolutions`
- `usecases/`: `uploadVideo` e `processVideo` — caminho feliz, execução
  seletiva das ações escolhidas, falha do ffmpeg, falha best-effort de
  transcrição
- `interfaces/messaging/videoJobConsumer`: ack em sucesso, nack sem requeue em erro/JSON inválido
- `interfaces/http/progressController`: assinatura/desinscrição do canal Redis, incluindo **duas conexões SSE simultâneas no mesmo vídeo** (bug corrigido no último commit — a primeira que fecha não pode cortar a segunda)

---

## 7. Limitação conhecida, declarada de propósito

`TRANSCRIPTION_API_URL` aponta para `http://transcription.invalid/v1`
(TLD reservado, nunca resolve). A chamada em `services/transcriptionService.js`
é best-effort: se falhar, o worker loga um aviso e o vídeo conclui normalmente,
sem legenda. Simula uma API externa real sem exigir integração de fato — e
prova que a camada `services/` está isolada (um endpoint real só troca a env var).

---

## 8. Checklist de conformidade com o edital

| Requisito | Status |
|---|---|
| Pelo menos 2 tecnologias entre gRPC/SSE/WebSocket/Redis Pub/Sub/AMQP | ✅ 3 usadas: AMQP, Redis Pub/Sub, SSE |
| Controllers dentro de `interfaces/` | ✅ `interfaces/http` e `interfaces/messaging` |
| Chamadas a API externa isoladas em `services/` | ✅ `services/transcriptionService.js` |
| Lógica de negócio em Use Cases, isolada de infra/protocolo | ✅ verificado por grep — zero imports de infra em `usecases/` |
| `docker compose up -d` sobe tudo (API, workers, banco, brokers/caches) | ✅ testado agora — 5 serviços, todos healthy |
| `docker-compose.yml` e Dockerfile na raiz | ✅ |
| README com passo a passo exato | ✅ |
| ADR preenchido no README, com alternativas descartadas justificadas | ✅ |
| Exemplos de teste (mini-cliente web / payloads) | ✅ `public/index.html` + exemplos `curl` |
| Tag Git `v1.0.0` no código avaliado | ⚠️ **ver seção 9 — a tag existe mas está desatualizada** |
| Repositório publicado no GitHub da disciplina | ⚠️ **ver seção 9 — nenhum remote configurado ainda** |

---

## 9. Versionamento — o que falta fazer, com comandos

Dois pontos abertos, encontrados nesta revisão:

### 9.1 A tag `v1.0.0` está um commit atrás do HEAD

```
v1.0.0 → a83a20e  "Milestone 5: README, ADR e testes de domínio"
HEAD   → adab7e7  "Adiciona cobertura de testes para usecases/interfaces
                    e corrige bug de SSE multi-cliente"
```

O último commit corrige um bug real (duas conexões SSE no mesmo vídeo) e
adiciona testes — ou seja, é código melhor que o que a tag aponta hoje. Como
a tag ainda não foi enviada a nenhum remoto, é seguro só movê-la para o
commit atual:

```bash
git tag -d v1.0.0
git tag -a v1.0.0 -m "Entrega P1 — plataforma de processamento de vídeo"
```

(Use `-a` com mensagem para tag anotada, mais apropriada para uma entrega
formal do que uma tag leve.)

### 9.2 Nenhum remote configurado — o repositório ainda não está no GitHub

```bash
git remote -v   # vazio — confirmado nesta sessão
```

Depois de criar/obter o repositório no espaço da disciplina, ligue o remote
e envie tudo (branch + tag):

```bash
git remote add origin <URL-do-repo-no-GitHub-da-disciplina>
git push -u origin master
git push origin v1.0.0
```

Se o repositório da disciplina usa `main` em vez de `master` como branch
padrão, renomeie antes de subir:

```bash
git branch -m master main
git push -u origin main
git push origin v1.0.0
```

### 9.3 Confirmação final antes de submeter

```bash
git log --oneline -1                 # HEAD == commit da tag?
git describe --tags                  # deve imprimir exatamente "v1.0.0"
git ls-remote --tags origin          # confirma que a tag chegou no GitHub
```

**Prazo**: 20/08/2026 até 13h20 — commits depois disso são desconsiderados.
Faça o push com folga.
