package identity_test

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/SyberLabs/RISE/services/rise-api/internal/identity"
	"github.com/SyberLabs/RISE/services/rise-api/internal/testoidc"
)

const audience = "rise-api-test"

func TestVerifierRequiresSignedShortLivedAPIAccessToken(t *testing.T) {
	issuer := testoidc.New(t)
	verifier := issuer.Verifier(t, audience)
	issuerURL := issuer.Server.URL
	now := time.Now()
	valid := testoidc.Claims{Subject: "reader-17", Audience: audience, ExpiresAt: now.Add(2 * time.Minute), IssuedAt: now}
	owner, err := verifier.Verify(context.Background(), "Bearer "+issuer.Token(t, "at+jwt", valid))
	if err != nil {
		t.Fatalf("valid access token rejected: %v", err)
	}
	if owner.Issuer != issuerURL || owner.Subject != valid.Subject {
		t.Fatalf("unexpected verified owner: %#v", owner)
	}
	if _, err := verifier.Verify(context.Background(), "Bearer "+strings.Repeat("x", 16<<10+1)); err == nil {
		t.Fatal("oversized authorization header was accepted")
	}

	cases := []struct {
		name string
		typ  string
		edit func(*testoidc.Claims)
	}{
		{name: "ID token type", typ: "JWT"},
		{name: "wrong issuer", typ: "at+jwt", edit: func(c *testoidc.Claims) { c.Issuer = "https://wrong.example" }},
		{name: "wrong audience", typ: "at+jwt", edit: func(c *testoidc.Claims) { c.Audience = "other-api" }},
		{name: "missing subject", typ: "at+jwt", edit: func(c *testoidc.Claims) { c.Subject = "" }},
		{name: "missing expiration", typ: "at+jwt", edit: func(c *testoidc.Claims) { c.OmitExpires = true }},
		{name: "expired", typ: "at+jwt", edit: func(c *testoidc.Claims) { c.ExpiresAt = now.Add(-time.Minute) }},
		{name: "missing issued-at", typ: "at+jwt", edit: func(c *testoidc.Claims) { c.OmitIssued = true }},
		{name: "older than five minutes", typ: "at+jwt", edit: func(c *testoidc.Claims) { c.IssuedAt = now.Add(-6 * time.Minute) }},
		{name: "future issued-at", typ: "at+jwt", edit: func(c *testoidc.Claims) { c.IssuedAt = now.Add(time.Minute) }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			candidate := valid
			if tc.edit != nil {
				tc.edit(&candidate)
			}
			if _, err := verifier.Verify(context.Background(), "Bearer "+issuer.Token(t, tc.typ, candidate)); err == nil {
				t.Fatal("invalid token was accepted")
			}
		})
	}
}

func TestVerifierRejectsNonHTTPSIssuerOrJWKS(t *testing.T) {
	if _, err := identity.NewVerifier(context.Background(), "http://issuer.example", audience, http.DefaultClient); err == nil {
		t.Fatal("HTTP issuer was accepted")
	}
	if _, err := identity.NewVerifier(context.Background(), "https://issuer.example", "", http.DefaultClient); err == nil {
		t.Fatal("missing API audience was accepted")
	}
	issuer := testoidc.New(t)
	issuer.SetJWKSURL("http://keys.example/jwks")
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if _, err := identity.NewVerifier(ctx, issuer.Server.URL, audience, issuer.Server.Client()); err == nil {
		t.Fatal("HTTPS issuer advertising HTTP signing keys was accepted")
	}
	issuer.SetJWKSURL(issuer.Server.URL + "/keys")
	issuer.SetDiscoveryRedirect("http://keys.example/discovery")
	if _, err := identity.NewVerifier(ctx, issuer.Server.URL, audience, issuer.Server.Client()); err == nil {
		t.Fatal("OIDC discovery redirect was accepted")
	}
}

func TestVerifierPreservesIssuerStringWithTrailingSlash(t *testing.T) {
	issuer := testoidc.New(t)
	exactIssuer := issuer.Server.URL + "/"
	issuer.SetIssuer(exactIssuer)
	verifier := issuer.Verifier(t, audience)
	now := time.Now()
	token := issuer.Token(t, "at+jwt", testoidc.Claims{
		Subject: "reader-slash", Audience: audience,
		IssuedAt: now, ExpiresAt: now.Add(time.Minute),
	})
	owner, err := verifier.Verify(context.Background(), "Bearer "+token)
	if err != nil || owner.Issuer != exactIssuer {
		t.Fatalf("exact issuer claim was not preserved: owner=%#v err=%v", owner, err)
	}
}
