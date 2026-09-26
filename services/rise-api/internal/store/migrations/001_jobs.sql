CREATE TABLE IF NOT EXISTS rise_jobs (
    id UUID PRIMARY KEY,
    owner_issuer TEXT NOT NULL,
    owner_subject TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation = 'rise.voice'),
    input_json JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'canceled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (owner_issuer, owner_subject, idempotency_key)
);

CREATE TABLE IF NOT EXISTS rise_job_outbox (
    job_id UUID PRIMARY KEY REFERENCES rise_jobs(id),
    event_type TEXT NOT NULL CHECK (event_type = 'rise.voice.requested'),
    status TEXT NOT NULL CHECK (status IN ('pending', 'canceled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rise_jobs_owner_created_idx
    ON rise_jobs (owner_issuer, owner_subject, created_at DESC);
