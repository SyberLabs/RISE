package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/SyberLabs/RISE/services/rise-api/internal/identity"
	"github.com/SyberLabs/RISE/services/rise-api/internal/jobs"
	"github.com/google/uuid"
)

const maxRequestBytes = 32 << 10
const maxTextBytes = 24 << 10
const RequestDeadline = 10 * time.Second

type HealthCheck func(context.Context) error

type API struct {
	jobs     jobs.Repository
	identity *identity.Verifier
	ready    HealthCheck
}

func New(repository jobs.Repository, verifier *identity.Verifier, ready HealthCheck) *API {
	return &API{jobs: repository, identity: verifier, ready: ready}
}

func (a *API) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /livez", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "alive"})
	})
	mux.Handle("GET /readyz", withDeadline(http.HandlerFunc(a.readiness)))
	mux.Handle("POST /v1/jobs", withDeadline(http.HandlerFunc(a.submit)))
	mux.Handle("GET /v1/jobs/{id}", withDeadline(http.HandlerFunc(a.get)))
	mux.Handle("DELETE /v1/jobs/{id}", withDeadline(http.HandlerFunc(a.cancel)))
	return securityHeaders(mux)
}

func (a *API) readiness(w http.ResponseWriter, r *http.Request) {
	if a.identity == nil || a.ready == nil {
		writeError(w, http.StatusServiceUnavailable, "NOT_READY", "Service is not configured.")
		return
	}
	if err := a.ready(r.Context()); err != nil {
		writeError(w, http.StatusServiceUnavailable, "NOT_READY", "Service is not configured.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready", "jobExecution": "not_configured"})
}

func (a *API) submit(w http.ResponseWriter, r *http.Request) {
	owner, ok := a.authorize(w, r)
	if !ok {
		return
	}
	key := r.Header.Get("Idempotency-Key")
	if len(key) < 1 || len(key) > 128 || strings.TrimSpace(key) != key || strings.ContainsAny(key, "\r\n") {
		writeError(w, http.StatusBadRequest, "INVALID_IDEMPOTENCY_KEY", "A valid Idempotency-Key is required.")
		return
	}
	mediaType, _, mediaErr := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if mediaErr != nil || !strings.EqualFold(mediaType, "application/json") {
		writeError(w, http.StatusUnsupportedMediaType, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.")
		return
	}
	var input jobs.NarrationInput
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxRequestBytes))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			writeError(w, http.StatusRequestEntityTooLarge, "REQUEST_TOO_LARGE", "Narration request exceeds 32 KB.")
			return
		}
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "Narration request is invalid.")
		return
	}
	if err := decoder.Decode(new(any)); !errors.Is(err, io.EOF) {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "Narration request must contain one JSON object.")
		return
	}
	if input.Operation != jobs.NarrationOperation || len(input.Text) == 0 || len(input.Text) > maxTextBytes || !utf8.ValidString(input.Text) || strings.TrimSpace(input.Text) == "" {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "Narration text must be non-empty and at most 24 KB.")
		return
	}
	if a.jobs == nil {
		writeError(w, http.StatusServiceUnavailable, "JOB_STORE_UNAVAILABLE", "Job could not be accepted.")
		return
	}
	job, replay, err := a.jobs.Submit(r.Context(), owner, key, input)
	if errors.Is(err, jobs.ErrIdempotencyConflict) {
		writeError(w, http.StatusConflict, "IDEMPOTENCY_CONFLICT", "Idempotency-Key was already used for different input.")
		return
	}
	if err != nil {
		if errors.Is(r.Context().Err(), context.DeadlineExceeded) {
			writeError(w, http.StatusGatewayTimeout, "REQUEST_TIMEOUT", "Request exceeded its time limit.")
			return
		}
		writeError(w, http.StatusServiceUnavailable, "JOB_STORE_UNAVAILABLE", "Job could not be accepted.")
		return
	}
	if replay {
		w.Header().Set("Idempotency-Replayed", "true")
	}
	w.Header().Set("Location", "/v1/jobs/"+job.ID.String())
	writeJSON(w, http.StatusAccepted, job)
}

func (a *API) get(w http.ResponseWriter, r *http.Request) {
	owner, ok := a.authorize(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "JOB_NOT_FOUND", "Job was not found.")
		return
	}
	job, found, err := a.jobs.Get(r.Context(), owner, id)
	if err != nil {
		if errors.Is(r.Context().Err(), context.DeadlineExceeded) {
			writeError(w, http.StatusGatewayTimeout, "REQUEST_TIMEOUT", "Request exceeded its time limit.")
			return
		}
		writeError(w, http.StatusServiceUnavailable, "JOB_STORE_UNAVAILABLE", "Job status is unavailable.")
		return
	}
	if !found {
		writeError(w, http.StatusNotFound, "JOB_NOT_FOUND", "Job was not found.")
		return
	}
	writeJSON(w, http.StatusOK, job)
}

func (a *API) cancel(w http.ResponseWriter, r *http.Request) {
	owner, ok := a.authorize(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "JOB_NOT_FOUND", "Job was not found.")
		return
	}
	job, found, err := a.jobs.Cancel(r.Context(), owner, id)
	if err != nil {
		if errors.Is(r.Context().Err(), context.DeadlineExceeded) {
			writeError(w, http.StatusGatewayTimeout, "REQUEST_TIMEOUT", "Request exceeded its time limit.")
			return
		}
		writeError(w, http.StatusServiceUnavailable, "JOB_STORE_UNAVAILABLE", "Job could not be cancelled.")
		return
	}
	if !found {
		writeError(w, http.StatusNotFound, "JOB_NOT_FOUND", "Job was not found.")
		return
	}
	writeJSON(w, http.StatusOK, job)
}

func (a *API) authorize(w http.ResponseWriter, r *http.Request) (jobs.Owner, bool) {
	if a.identity == nil {
		writeError(w, http.StatusServiceUnavailable, "IDENTITY_NOT_CONFIGURED", "Private job service is not configured.")
		return jobs.Owner{}, false
	}
	owner, err := a.identity.Verify(r.Context(), r.Header.Get("Authorization"))
	if err != nil {
		if errors.Is(r.Context().Err(), context.DeadlineExceeded) {
			writeError(w, http.StatusGatewayTimeout, "REQUEST_TIMEOUT", "Request exceeded its time limit.")
			return jobs.Owner{}, false
		}
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "A valid bearer token is required.")
		return jobs.Owner{}, false
	}
	return owner, true
}

func withDeadline(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), RequestDeadline)
		defer cancel()
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		next.ServeHTTP(w, r)
	})
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{"error": map[string]string{"code": code, "message": message}})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
