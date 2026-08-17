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
