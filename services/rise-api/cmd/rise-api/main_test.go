package main

import "testing"

func TestHostedDatabaseRequiresVerifiedTLS(t *testing.T) {
	cases := []struct {
		name        string
		environment string
		dsn         string
		wantError   bool
	}{
		{name: "local mode", environment: "local", dsn: "postgres://localhost/rise", wantError: false},
		{name: "verified hosted connection", environment: "staging", dsn: "postgres://user:password@db.example/rise?sslmode=verify-full", wantError: false},
		{name: "production weak TLS", environment: "production", dsn: "postgres://user:password@db.example/rise?sslmode=require", wantError: true},
		{name: "missing hosted TLS", environment: "staging", dsn: "postgres://user:password@db.example/rise", wantError: true},
		{name: "unknown environment", environment: "stage", dsn: "postgres://localhost/rise", wantError: true},
		{name: "unset environment", environment: "", dsn: "postgres://localhost/rise", wantError: true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := requireVerifiedTLS(tc.environment, tc.dsn)
			if (err != nil) != tc.wantError {
				t.Fatalf("requireVerifiedTLS() error=%v wantError=%v", err, tc.wantError)
			}
		})
	}
}

func TestDefaultListenerIsLoopbackOnly(t *testing.T) {
	t.Setenv("RISE_API_ADDR", "")
	if got := envOr("RISE_API_ADDR", defaultAPIAddr); got != "127.0.0.1:8080" {
		t.Fatalf("default listener=%q want loopback", got)
	}
}
