package testoidc

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/SyberLabs/RISE/services/rise-api/internal/identity"
)

type Issuer struct {
	Server   *httptest.Server
	key      *rsa.PrivateKey
	issuer   string
	jwks     string
	redirect string
}

type Claims struct {
	Issuer      string
	Subject     string
	Audience    string
	IssuedAt    time.Time
	ExpiresAt   time.Time
	OmitIssued  bool
	OmitExpires bool
}

func New(t testing.TB) *Issuer {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	issuer := &Issuer{key: key}
	issuer.Server = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/.well-known/openid-configuration":
			if issuer.redirect != "" {
				http.Redirect(w, r, issuer.redirect, http.StatusFound)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"issuer": issuer.issuer, "jwks_uri": issuer.jwks,
				"authorization_endpoint": issuer.issuer + "/authorize", "token_endpoint": issuer.issuer + "/token",
				"response_types_supported":              []string{"code"},
				"subject_types_supported":               []string{"public"},
				"id_token_signing_alg_values_supported": []string{"RS256"},
			})
		case "/keys":
			_ = json.NewEncoder(w).Encode(map[string]any{"keys": []any{map[string]string{
				"kty": "RSA", "use": "sig", "alg": "RS256", "kid": "rise-test",
				"n": base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
				"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes()),
			}}})
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(issuer.Server.Close)
	issuer.issuer = issuer.Server.URL
	issuer.jwks = issuer.issuer + "/keys"
	return issuer
}

func (i *Issuer) Verifier(t testing.TB, audience string) *identity.Verifier {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	verifier, err := identity.NewVerifier(ctx, i.issuer, audience, i.Server.Client())
	if err != nil {
		t.Fatal(err)
	}
	return verifier
}

func (i *Issuer) SetJWKSURL(value string) { i.jwks = value }

func (i *Issuer) SetIssuer(value string) {
	i.issuer = value
	i.jwks = strings.TrimSuffix(value, "/") + "/keys"
}

func (i *Issuer) SetDiscoveryRedirect(value string) { i.redirect = value }

func (i *Issuer) Token(t testing.TB, typ string, c Claims) string {
	t.Helper()
	header, err := json.Marshal(map[string]string{"alg": "RS256", "kid": "rise-test", "typ": typ})
	if err != nil {
		t.Fatal(err)
	}
	issuer := c.Issuer
	if issuer == "" {
		issuer = i.issuer
	}
	payload := map[string]any{"iss": issuer, "aud": c.Audience}
	if c.Subject != "" {
		payload["sub"] = c.Subject
	}
	if !c.OmitExpires {
		payload["exp"] = c.ExpiresAt.Unix()
	}
	if !c.OmitIssued {
		payload["iat"] = c.IssuedAt.Unix()
	}
	claimsJSON, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	unsigned := base64.RawURLEncoding.EncodeToString(header) + "." + base64.RawURLEncoding.EncodeToString(claimsJSON)
	digest := sha256.Sum256([]byte(unsigned))
	signature, err := rsa.SignPKCS1v15(rand.Reader, i.key, crypto.SHA256, digest[:])
	if err != nil {
		t.Fatal(err)
	}
	return unsigned + "." + base64.RawURLEncoding.EncodeToString(signature)
}
