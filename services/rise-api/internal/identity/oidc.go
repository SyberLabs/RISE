package identity

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/SyberLabs/RISE/services/rise-api/internal/jobs"
	"github.com/coreos/go-oidc/v3/oidc"
)

type Verifier struct{ verifier *oidc.IDTokenVerifier }

const maxTokenAge = 5 * time.Minute
const clockSkew = 30 * time.Second

func NewVerifier(ctx context.Context, issuer, audience string, client *http.Client) (*Verifier, error) {
	parsed, err := url.Parse(issuer)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil || audience == "" {
		return nil, errors.New("OIDC issuer must be an HTTPS URL and audience must be configured")
	}
	if client == nil {
		client = http.DefaultClient
	}
	clientCopy := *client
	clientCopy.CheckRedirect = func(*http.Request, []*http.Request) error {
		return errors.New("OIDC redirects are disabled")
	}
	providerContext := oidc.ClientContext(ctx, &clientCopy)
	provider, err := oidc.NewProvider(providerContext, issuer)
	if err != nil {
		return nil, errors.New("OIDC provider discovery failed")
	}
	var metadata struct {
		JWKSURL string `json:"jwks_uri"`
	}
	if err := provider.Claims(&metadata); err != nil {
		return nil, errors.New("OIDC JWKS metadata is invalid")
	}
	jwksURL, err := url.Parse(metadata.JWKSURL)
	if err != nil || jwksURL.Scheme != "https" || jwksURL.Host == "" || jwksURL.User != nil {
		return nil, errors.New("OIDC JWKS endpoint must be HTTPS")
	}
	return &Verifier{verifier: provider.Verifier(&oidc.Config{
		ClientID:             audience,
		SupportedSigningAlgs: []string{"RS256", "PS256", "ES256", "EdDSA"},
	})}, nil
}

func (v *Verifier) Verify(ctx context.Context, authorization string) (jobs.Owner, error) {
	if v == nil || v.verifier == nil {
		return jobs.Owner{}, errors.New("identity is not configured")
	}
	if len(authorization) > 16<<10 {
		return jobs.Owner{}, errors.New("authorization header is too large")
	}
	parts := strings.Fields(authorization)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return jobs.Owner{}, errors.New("bearer token required")
	}
	if !isAccessToken(parts[1]) {
		return jobs.Owner{}, errors.New("API access token required")
	}
	token, err := v.verifier.Verify(ctx, parts[1])
	if err != nil || strings.TrimSpace(token.Subject) == "" || token.Expiry.IsZero() || token.IssuedAt.IsZero() {
		return jobs.Owner{}, errors.New("invalid identity token")
	}
	now := time.Now()
	if token.IssuedAt.After(now.Add(clockSkew)) || now.Sub(token.IssuedAt) > maxTokenAge+clockSkew {
		return jobs.Owner{}, errors.New("API access token is outside the accepted age")
	}
	return jobs.Owner{Issuer: token.Issuer, Subject: token.Subject}, nil
}

func isAccessToken(raw string) bool {
	parts := strings.Split(raw, ".")
	if len(parts) != 3 {
		return false
	}
	headerJSON, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return false
	}
	var header struct {
		Type string `json:"typ"`
	}
	if json.Unmarshal(headerJSON, &header) != nil {
		return false
	}
	return header.Type == "at+jwt" || header.Type == "application/at+jwt"
}
