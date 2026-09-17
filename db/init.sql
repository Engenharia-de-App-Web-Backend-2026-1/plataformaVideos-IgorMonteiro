CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE video_status AS ENUM ('uploaded', 'processing', 'completed', 'failed');

CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status video_status NOT NULL DEFAULT 'uploaded',
  progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transactional Outbox: garante atomicidade entre "gravar o vídeo" e
-- "publicar o job de processamento na fila", sem transação distribuída
-- nativa entre Postgres e AMQP (ver README, ADR "Transactional Outbox").
-- O relay (src/outboxRelay.js) drena as linhas com published_at IS NULL.
CREATE TABLE outbox (
  id BIGSERIAL PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE INDEX idx_outbox_pending ON outbox (id) WHERE published_at IS NULL;
