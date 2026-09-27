package jobs

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const outboxEvent = "rise.voice.requested"

type Postgres struct{ db *pgxpool.Pool }

func NewPostgres(db *pgxpool.Pool) *Postgres { return &Postgres{db: db} }

func (p *Postgres) Submit(ctx context.Context, owner Owner, key string, input NarrationInput) (Job, bool, error) {
	canonical, err := json.Marshal(input)
	if err != nil {
		return Job{}, false, err
	}
	id := uuid.New()
	tx, err := p.db.Begin(ctx)
	if err != nil {
		return Job{}, false, err
	}
	defer rollback(tx)

	var job Job
	err = tx.QueryRow(ctx, `
		INSERT INTO rise_jobs (id, owner_issuer, owner_subject, idempotency_key, operation, input_json, status)
		VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'queued')
		ON CONFLICT (owner_issuer, owner_subject, idempotency_key) DO NOTHING
		RETURNING id, operation, status, created_at`,
		id, owner.Issuer, owner.Subject, key, NarrationOperation, string(canonical),
	).Scan(&job.ID, &job.Operation, &job.Status, &job.CreatedAt)
	if err == nil {
		if _, err = tx.Exec(ctx, `INSERT INTO rise_job_outbox (job_id, event_type, status) VALUES ($1, $2, 'pending')`, job.ID, outboxEvent); err != nil {
			return Job{}, false, err
		}
		if err = tx.Commit(ctx); err != nil {
			return Job{}, false, err
		}
		return job, false, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return Job{}, false, err
	}

	var stored []byte
	err = tx.QueryRow(ctx, `
		SELECT id, operation, status, created_at, input_json
		FROM rise_jobs
		WHERE owner_issuer = $1 AND owner_subject = $2 AND idempotency_key = $3
		FOR UPDATE`, owner.Issuer, owner.Subject, key,
	).Scan(&job.ID, &job.Operation, &job.Status, &job.CreatedAt, &stored)
	if err != nil {
		return Job{}, false, err
	}
	var prior NarrationInput
	if err = json.Unmarshal(stored, &prior); err != nil {
		return Job{}, false, err
	}
	priorCanonical, err := json.Marshal(prior)
	if err != nil {
		return Job{}, false, err
	}
	if subtle.ConstantTimeCompare(canonical, priorCanonical) != 1 {
		return Job{}, false, ErrIdempotencyConflict
	}
	if err = tx.Commit(ctx); err != nil {
		return Job{}, false, err
	}
	return job, true, nil
}

func (p *Postgres) Get(ctx context.Context, owner Owner, id uuid.UUID) (Job, bool, error) {
	var job Job
	err := p.db.QueryRow(ctx, `
		SELECT id, operation, status, created_at FROM rise_jobs
		WHERE id = $1 AND owner_issuer = $2 AND owner_subject = $3`, id, owner.Issuer, owner.Subject,
	).Scan(&job.ID, &job.Operation, &job.Status, &job.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Job{}, false, nil
	}
	return job, err == nil, err
}

func (p *Postgres) Cancel(ctx context.Context, owner Owner, id uuid.UUID) (Job, bool, error) {
	tx, err := p.db.Begin(ctx)
	if err != nil {
		return Job{}, false, err
	}
	defer rollback(tx)

	var job Job
	err = tx.QueryRow(ctx, `
		SELECT id, operation, status, created_at FROM rise_jobs
		WHERE id = $1 AND owner_issuer = $2 AND owner_subject = $3
		FOR UPDATE`, id, owner.Issuer, owner.Subject,
	).Scan(&job.ID, &job.Operation, &job.Status, &job.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Job{}, false, nil
	}
	if err != nil {
		return Job{}, false, err
	}
	if job.Status == "queued" {
		if _, err = tx.Exec(ctx, `UPDATE rise_jobs SET status = 'canceled' WHERE id = $1`, id); err != nil {
			return Job{}, false, err
		}
		result, updateErr := tx.Exec(ctx, `UPDATE rise_job_outbox SET status = 'canceled' WHERE job_id = $1 AND status = 'pending'`, id)
		if updateErr != nil {
			return Job{}, false, updateErr
		}
		if result.RowsAffected() != 1 {
			return Job{}, false, errors.New("queued job has no pending outbox row")
		}
		job.Status = "canceled"
	}
	if err = tx.Commit(ctx); err != nil {
		return Job{}, false, err
	}
	return job, true, nil
}

func rollback(tx pgx.Tx) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	_ = tx.Rollback(ctx)
}
