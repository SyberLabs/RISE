package jobs

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/SyberLabs/RISE/services/rise-api/internal/store"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPostgresIdempotencyOwnershipAndCancelTransaction(t *testing.T) {
	db, owner, key := testDatabase(t)
	repo := NewPostgres(db)
	input := NarrationInput{Operation: NarrationOperation, Text: "synthetic fixture, no real reader text"}

	job, replay, err := repo.Submit(context.Background(), owner, key, input)
	if err != nil || replay || job.Status != "queued" {
		t.Fatalf("initial submit: job=%#v replay=%v err=%v", job, replay, err)
	}
	replayed, replay, err := repo.Submit(context.Background(), owner, key, input)
	if err != nil || !replay || replayed.ID != job.ID {
		t.Fatalf("same-body retry: job=%#v replay=%v err=%v", replayed, replay, err)
	}
	changed := input
	changed.Text += " changed"
	if _, _, err := repo.Submit(context.Background(), owner, key, changed); !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("changed body should conflict, got %v", err)
	}

	otherOwner := owner
	otherOwner.Subject = uuid.NewString()
	if _, found, err := repo.Get(context.Background(), otherOwner, job.ID); err != nil || found {
		t.Fatalf("cross-owner status access: found=%v err=%v", found, err)
	}
	if _, found, err := repo.Cancel(context.Background(), otherOwner, job.ID); err != nil || found {
		t.Fatalf("cross-owner cancellation: found=%v err=%v", found, err)
	}

	canceled, found, err := repo.Cancel(context.Background(), owner, job.ID)
	if err != nil || !found || canceled.Status != "canceled" {
		t.Fatalf("owner cancel: job=%#v found=%v err=%v", canceled, found, err)
	}
	var outboxStatus string
	if err := db.QueryRow(context.Background(), `SELECT status FROM rise_job_outbox WHERE job_id = $1`, job.ID).Scan(&outboxStatus); err != nil || outboxStatus != "canceled" {
		t.Fatalf("cancel did not atomically suppress pending outbox: status=%q err=%v", outboxStatus, err)
	}
	if again, replay, err := repo.Submit(context.Background(), owner, key, input); err != nil || !replay || again.ID != job.ID || again.Status != "canceled" {
		t.Fatalf("canceled submit replay changed identity/state: %#v replay=%v err=%v", again, replay, err)
	}

	orphan, _, err := repo.Submit(context.Background(), owner, uuid.NewString(), input)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(context.Background(), `DELETE FROM rise_job_outbox WHERE job_id = $1`, orphan.ID); err != nil {
		t.Fatal(err)
	}
	if _, _, err := repo.Cancel(context.Background(), owner, orphan.ID); err == nil {
		t.Fatal("broken outbox invariant should abort cancel")
	}
	stillQueued, found, err := repo.Get(context.Background(), owner, orphan.ID)
	if err != nil || !found || stillQueued.Status != "queued" {
		t.Fatalf("failed cancel partially changed job: %#v found=%v err=%v", stillQueued, found, err)
	}

	db.Close()
	reopened, err := pgxpool.New(context.Background(), os.Getenv("RISE_TEST_DATABASE_URL"))
	if err != nil {
		t.Fatal("could not reopen PostgreSQL pool")
	}
	defer reopened.Close()
	persisted, found, err := NewPostgres(reopened).Get(context.Background(), owner, job.ID)
	if err != nil || !found || persisted.Status != "canceled" {
		t.Fatalf("canceled state did not persist across pool reopen: %#v found=%v err=%v", persisted, found, err)
	}
	if err := reopened.QueryRow(context.Background(), `SELECT status FROM rise_job_outbox WHERE job_id = $1`, job.ID).Scan(&outboxStatus); err != nil || outboxStatus != "canceled" {
		t.Fatalf("outbox cancellation did not persist: status=%q err=%v", outboxStatus, err)
	}
	_, _ = reopened.Exec(context.Background(), `DELETE FROM rise_job_outbox WHERE job_id IN (SELECT id FROM rise_jobs WHERE owner_issuer=$1 AND owner_subject=$2)`, owner.Issuer, owner.Subject)
	_, _ = reopened.Exec(context.Background(), `DELETE FROM rise_jobs WHERE owner_issuer=$1 AND owner_subject=$2`, owner.Issuer, owner.Subject)
}

func TestPostgresOutboxInsertFailureRollsBackAcceptedJob(t *testing.T) {
	db, owner, key := testDatabase(t)
	name := "rise_test_fail_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if _, err := db.Exec(context.Background(), fmt.Sprintf(`CREATE FUNCTION public.%s() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected outbox insert failure'; END; $$`, name)); err != nil {
		t.Fatal("could not install scoped failure trigger")
	}
	if _, err := db.Exec(context.Background(), fmt.Sprintf(`CREATE TRIGGER %s BEFORE INSERT ON rise_job_outbox FOR EACH ROW EXECUTE FUNCTION public.%s()`, name, name)); err != nil {
		_, _ = db.Exec(context.Background(), fmt.Sprintf(`DROP FUNCTION public.%s()`, name))
		t.Fatal("could not install scoped failure trigger")
	}
	t.Cleanup(func() {
		_, _ = db.Exec(context.Background(), fmt.Sprintf(`DROP TRIGGER IF EXISTS %s ON rise_job_outbox`, name))
		_, _ = db.Exec(context.Background(), fmt.Sprintf(`DROP FUNCTION IF EXISTS public.%s()`, name))
	})

	_, _, err := NewPostgres(db).Submit(context.Background(), owner, key, NarrationInput{
		Operation: NarrationOperation, Text: "synthetic rollback fixture",
	})
	if err == nil {
		t.Fatal("outbox insert fault was not returned")
	}
	var count int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM rise_jobs WHERE owner_issuer=$1 AND owner_subject=$2 AND idempotency_key=$3`, owner.Issuer, owner.Subject, key).Scan(&count); err != nil || count != 0 {
		t.Fatalf("failed outbox insert left an accepted job: count=%d err=%v", count, err)
	}
}

func TestPostgresConcurrentSameKeyCreatesOneJob(t *testing.T) {
	db, owner, key := testDatabase(t)
	repo := NewPostgres(db)
	input := NarrationInput{Operation: NarrationOperation, Text: "concurrent synthetic fixture"}
	const callers = 8
	ids := make(chan uuid.UUID, callers)
	errs := make(chan error, callers)
	var started sync.WaitGroup
	started.Add(callers)
	for range callers {
		go func() {
			started.Done()
			job, _, err := repo.Submit(context.Background(), owner, key, input)
			if err != nil {
				errs <- err
				return
			}
			ids <- job.ID
		}()
	}
	started.Wait()
	for range callers {
		select {
		case err := <-errs:
			t.Fatal(err)
		case id := <-ids:
			if id == uuid.Nil {
				t.Fatal("submit returned empty job id")
			}
		}
	}
	var count int
	if err := db.QueryRow(context.Background(), `SELECT count(*) FROM rise_jobs WHERE owner_issuer=$1 AND owner_subject=$2 AND idempotency_key=$3`, owner.Issuer, owner.Subject, key).Scan(&count); err != nil || count != 1 {
		t.Fatalf("concurrent submit created %d jobs, err=%v", count, err)
	}
}

func testDatabase(t *testing.T) (*pgxpool.Pool, Owner, string) {
	t.Helper()
	dsn := os.Getenv("RISE_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("RISE_TEST_DATABASE_URL is not configured; PostgreSQL integration test skipped")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal("could not configure PostgreSQL test pool")
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		t.Fatal("PostgreSQL integration database is unavailable")
	}
	if err := store.Migrate(ctx, pool); err != nil {
		pool.Close()
		t.Fatalf("apply job schema: %v", err)
	}
	ownerSubject := uuid.NewString()
	t.Cleanup(func() {
		cleanCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, _ = pool.Exec(cleanCtx, `DELETE FROM rise_job_outbox WHERE job_id IN (SELECT id FROM rise_jobs WHERE owner_issuer=$1 AND owner_subject=$2)`, "https://test.invalid", ownerSubject)
		_, _ = pool.Exec(cleanCtx, `DELETE FROM rise_jobs WHERE owner_issuer=$1 AND owner_subject=$2`, "https://test.invalid", ownerSubject)
		pool.Close()
	})
	owner := Owner{Issuer: "https://test.invalid", Subject: ownerSubject}
	return pool, owner, fmt.Sprintf("test-%s", uuid.NewString())
}
