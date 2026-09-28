package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/SyberLabs/RISE/services/rise-api/internal/api"
	"github.com/SyberLabs/RISE/services/rise-api/internal/identity"
	"github.com/SyberLabs/RISE/services/rise-api/internal/jobs"
	"github.com/jackc/pgx/v5/pgxpool"
)

const defaultAPIAddr = "127.0.0.1:8080"

func main() {
	if err := run(); err != nil {
		slog.Error("RISE API stopped", "error", err)
		os.Exit(1)
	}
}

func run() error {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return errors.New("DATABASE_URL is required")
	}
	if err := requireVerifiedTLS(os.Getenv("RISE_ENV"), dsn); err != nil {
		return err
	}

	poolConfig, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return errors.New("DATABASE_URL is invalid")
	}
	pool, err := pgxpool.NewWithConfig(context.Background(), poolConfig)
	if err != nil {
		return errors.New("PostgreSQL connection could not be configured")
	}
	defer pool.Close()
	connectCtx, cancelConnect := context.WithTimeout(context.Background(), 5*time.Second)
	err = pool.Ping(connectCtx)
	cancelConnect()
	if err != nil {
		return errors.New("PostgreSQL is unavailable")
	}

	var verifier *identity.Verifier
	issuer, audience := os.Getenv("RISE_OIDC_ISSUER"), os.Getenv("RISE_OIDC_AUDIENCE")
	if issuer != "" || audience != "" {
		providerCtx, cancelProvider := context.WithTimeout(context.Background(), 5*time.Second)
		verifier, err = identity.NewVerifier(providerCtx, issuer, audience, &http.Client{Timeout: 5 * time.Second})
		cancelProvider()
		if err != nil {
			slog.Error("OIDC provider is not ready; private job routes remain disabled")
			verifier = nil
		}
	}

	apiHandler := api.New(jobs.NewPostgres(pool), verifier, func(ctx context.Context) error {
		return checkDatabase(ctx, pool)
	})
	server := &http.Server{
		Addr:              envOr("RISE_API_ADDR", defaultAPIAddr),
		Handler:           apiHandler.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       api.RequestDeadline,
		WriteTimeout:      api.RequestDeadline + time.Second,
		IdleTimeout:       60 * time.Second,
	}

	serveErr := make(chan error, 1)
	shutdownCtx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	go func() { serveErr <- server.ListenAndServe() }()
	slog.Info("RISE job API started", "address", server.Addr)
	select {
	case err := <-serveErr:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-shutdownCtx.Done():
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(ctx); err != nil {
			_ = server.Close()
			return err
		}
		err := <-serveErr
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}

func checkDatabase(ctx context.Context, pool *pgxpool.Pool) error {
	if err := pool.Ping(ctx); err != nil {
		return err
	}
	var schemaReady bool
	if err := pool.QueryRow(ctx, `SELECT to_regclass('public.rise_jobs') IS NOT NULL AND to_regclass('public.rise_job_outbox') IS NOT NULL`).Scan(&schemaReady); err != nil {
		return err
	}
	if !schemaReady {
		return errors.New("job schema is not installed")
	}
	return nil
}

func requireVerifiedTLS(environment, dsn string) error {
	if environment == "local" {
		return nil
	}
	if environment != "staging" && environment != "production" {
		return errors.New("RISE_ENV must be local, staging, or production")
	}
	parsed, err := url.Parse(dsn)
	if err != nil || (parsed.Scheme != "postgres" && parsed.Scheme != "postgresql") || parsed.Query().Get("sslmode") != "verify-full" {
		return errors.New("hosted DATABASE_URL must be a PostgreSQL URL with sslmode=verify-full")
	}
	return nil
}

func envOr(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}
