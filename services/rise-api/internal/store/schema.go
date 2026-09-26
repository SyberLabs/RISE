package store

import (
	"context"
	"embed"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/001_jobs.sql
var migrations embed.FS

func Migrate(ctx context.Context, db *pgxpool.Pool) error {
	sql, err := migrations.ReadFile("migrations/001_jobs.sql")
	if err != nil {
		return err
	}
	_, err = db.Exec(ctx, string(sql))
	return err
}
