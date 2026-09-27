package jobs

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

var ErrIdempotencyConflict = errors.New("idempotency key was already used with different input")

const NarrationOperation = "rise.voice"

type Owner struct {
	Issuer  string
	Subject string
}

type NarrationInput struct {
	Operation string `json:"operation"`
	Text      string `json:"text"`
}

type Job struct {
	ID        uuid.UUID `json:"id"`
	Operation string    `json:"operation"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

type Repository interface {
	Submit(context.Context, Owner, string, NarrationInput) (Job, bool, error)
	Get(context.Context, Owner, uuid.UUID) (Job, bool, error)
	Cancel(context.Context, Owner, uuid.UUID) (Job, bool, error)
}
