package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/SyberLabs/RISE/services/rise-api/internal/jobs"
	"github.com/SyberLabs/RISE/services/rise-api/internal/testoidc"
	"github.com/google/uuid"
)

func TestPrivateJobRoutesVerifyOwnerAndNeverReturnInput(t *testing.T) {
	const audience = "rise-api-test"
	issuer := testoidc.New(t)
	verifier := issuer.Verifier(t, audience)
	repo := newMemoryRepository()
	handler := New(repo, verifier, func(context.Context) error { return nil }).Handler()
	now := time.Now()
	token := func(subject string) string {
		return issuer.Token(t, "at+jwt", testoidc.Claims{
			Subject: subject, Audience: audience,
			IssuedAt: now, ExpiresAt: now.Add(time.Minute),
		})
	}
	inputText := "private narration fixture: never return this passage"
	body := `{"operation":"rise.voice","text":"` + inputText + `"}`
	request := func(method, target, auth, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, target, strings.NewReader(body))
		if auth != "" {
			req.Header.Set("Authorization", "Bearer "+auth)
		}
		if method == http.MethodPost {
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Idempotency-Key", "test-submit-1")
		}
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, req)
		return response
	}

	created := request(http.MethodPost, "/v1/jobs", token("reader-a"), body)
	if created.Code != http.StatusAccepted {
		t.Fatalf("submit status=%d body=%s", created.Code, created.Body.String())
	}
	var first jobs.Job
	if err := json.Unmarshal(created.Body.Bytes(), &first); err != nil {
		t.Fatal(err)
	}
	if first.Status != "queued" || first.Operation != jobs.NarrationOperation || first.ID == uuid.Nil {
		t.Fatalf("unexpected job response: %#v", first)
	}
	if strings.Contains(created.Body.String(), inputText) || created.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("response exposed input or was cacheable")
	}

	replay := request(http.MethodPost, "/v1/jobs", token("reader-a"), body)
	var repeated jobs.Job
	_ = json.Unmarshal(replay.Body.Bytes(), &repeated)
	if replay.Code != http.StatusAccepted || replay.Header().Get("Idempotency-Replayed") != "true" || repeated.ID != first.ID {
		t.Fatalf("same-owner/same-body retry was not replayed: %d %s", replay.Code, replay.Body.String())
	}
	changed := strings.Replace(body, "private narration fixture", "changed narration", 1)
	conflict := request(http.MethodPost, "/v1/jobs", token("reader-a"), changed)
	if conflict.Code != http.StatusConflict {
		t.Fatalf("same key with different input status=%d", conflict.Code)
	}

	foreignGet := request(http.MethodGet, "/v1/jobs/"+first.ID.String(), token("reader-b"), "")
	foreignCancel := request(http.MethodDelete, "/v1/jobs/"+first.ID.String(), token("reader-b"), "")
	if foreignGet.Code != http.StatusNotFound || foreignCancel.Code != http.StatusNotFound {
		t.Fatalf("cross-owner routes disclosed job: GET=%d DELETE=%d", foreignGet.Code, foreignCancel.Code)
	}
	ownedGet := request(http.MethodGet, "/v1/jobs/"+first.ID.String(), token("reader-a"), "")
	if ownedGet.Code != http.StatusOK || strings.Contains(ownedGet.Body.String(), inputText) {
		t.Fatalf("owner status response invalid or included input: %d %s", ownedGet.Code, ownedGet.Body.String())
	}
	canceled := request(http.MethodDelete, "/v1/jobs/"+first.ID.String(), token("reader-a"), "")
	var canceledJob jobs.Job
	_ = json.Unmarshal(canceled.Body.Bytes(), &canceledJob)
	if canceled.Code != http.StatusOK || canceledJob.Status != "canceled" {
		t.Fatalf("owner cancellation failed: %d %s", canceled.Code, canceled.Body.String())
	}

	spoofed := httptest.NewRequest(http.MethodGet, "/v1/jobs/"+first.ID.String(), nil)
	spoofed.Header.Set("X-Rise-Subject", "reader-a")
	spoofed.Header.Set("X-Forwarded-User", "reader-a")
	spoofedResponse := httptest.NewRecorder()
	handler.ServeHTTP(spoofedResponse, spoofed)
	if spoofedResponse.Code != http.StatusUnauthorized {
		t.Fatalf("identity headers bypassed bearer verification: %d", spoofedResponse.Code)
	}
}

func TestRoutesFailClosedWhenIdentityIsUnconfigured(t *testing.T) {
	handler := New(newMemoryRepository(), nil, func(context.Context) error { return nil }).Handler()
	request := httptest.NewRequest(http.MethodPost, "/v1/jobs", strings.NewReader(`{"operation":"rise.voice","text":"fixture"}`))
	request.Header.Set("X-Rise-Subject", "forged")
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Idempotency-Key", "key")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("unconfigured private route status=%d", response.Code)
	}
	liveness := httptest.NewRecorder()
	func() {
		handler.ServeHTTP(liveness, httptest.NewRequest(http.MethodGet, "/livez", nil))
	}()
	if liveness.Code != http.StatusOK {
		t.Fatalf("liveness should remain available, got %d", liveness.Code)
	}
	ready := httptest.NewRecorder()
	handler.ServeHTTP(ready, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if ready.Code != http.StatusServiceUnavailable {
		t.Fatalf("unconfigured service reported ready: %d", ready.Code)
	}
}

func TestSubmitRejectsUnknownOperationAndOversizedBody(t *testing.T) {
	issuer := testoidc.New(t)
	verifier := issuer.Verifier(t, "rise-api-test")
	repo := newMemoryRepository()
	handler := New(repo, verifier, nil).Handler()
	now := time.Now()
	token := issuer.Token(t, "at+jwt", testoidc.Claims{
		Subject: "reader-a", Audience: "rise-api-test", IssuedAt: now, ExpiresAt: now.Add(time.Minute),
	})
	for _, tc := range []struct {
		name string
		body string
		want int
	}{
		{name: "unknown operation", body: `{"operation":"rise.other","text":"x"}`, want: http.StatusBadRequest},
		{name: "oversized input", body: `{"operation":"rise.voice","text":"` + strings.Repeat("x", maxRequestBytes) + `"}`, want: http.StatusRequestEntityTooLarge},
		{name: "trailing JSON", body: `{"operation":"rise.voice","text":"x"}{}`, want: http.StatusBadRequest},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/v1/jobs", strings.NewReader(tc.body))
			req.Header.Set("Authorization", "Bearer "+token)
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Idempotency-Key", "test-"+tc.name)
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, req)
			if response.Code != tc.want {
				t.Fatalf("status=%d want=%d body=%s", response.Code, tc.want, response.Body.String())
			}
		})
	}
	if repo.count() != 0 {
		t.Fatal("invalid request reached persistence")
	}
}

type memoryRepository struct {
	mu          sync.Mutex
	entries     map[string]memoryEntry
	idempotency map[string]uuid.UUID
}

type memoryEntry struct {
	job   jobs.Job
	owner jobs.Owner
	key   string
	input jobs.NarrationInput
}

func newMemoryRepository() *memoryRepository {
	return &memoryRepository{entries: map[string]memoryEntry{}, idempotency: map[string]uuid.UUID{}}
}

func (m *memoryRepository) Submit(_ context.Context, owner jobs.Owner, key string, input jobs.NarrationInput) (jobs.Job, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	key = owner.Issuer + "\x00" + owner.Subject + "\x00" + key
	if id, ok := m.idempotency[key]; ok {
		entry := m.entries[id.String()]
		if entry.input != input {
			return jobs.Job{}, false, jobs.ErrIdempotencyConflict
		}
		return entry.job, true, nil
	}
	job := jobs.Job{ID: uuid.New(), Operation: jobs.NarrationOperation, Status: "queued", CreatedAt: time.Now()}
	m.entries[job.ID.String()] = memoryEntry{job: job, owner: owner, input: input}
	m.idempotency[key] = job.ID
	return job, false, nil
}

func (m *memoryRepository) Get(_ context.Context, owner jobs.Owner, id uuid.UUID) (jobs.Job, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	entry, ok := m.entries[id.String()]
	if !ok || entry.owner != owner {
		return jobs.Job{}, false, nil
	}
	return entry.job, true, nil
}

func (m *memoryRepository) Cancel(_ context.Context, owner jobs.Owner, id uuid.UUID) (jobs.Job, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	entry, ok := m.entries[id.String()]
	if !ok || entry.owner != owner {
		return jobs.Job{}, false, nil
	}
	entry.job.Status = "canceled"
	m.entries[id.String()] = entry
	return entry.job, true, nil
}

func (m *memoryRepository) count() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.entries)
}
