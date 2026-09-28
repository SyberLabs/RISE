"""Synthetic, authenticated System One smoke check; sends no RISE reader data."""

import argparse
import json
import os
import sys
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

EXPECTED_REVISION = "139fdd94f1b6a6ad80cc15e08fcb99cac885a101"
EXPECTED_BASE = "Qwen/Qwen3.5-4B-Base"
RUN = f"jaredpalmer/kev-4b@{EXPECTED_REVISION}"


class RejectRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


OPENER = build_opener(RejectRedirects)
# A bearer key sent to this machine must not detour through a configured HTTP proxy.
LOOPBACK_OPENER = build_opener(ProxyHandler({}), RejectRedirects)
LOOPBACK_HOST = "127.0.0.1"


def is_loopback_origin(parsed):
    """http://127.0.0.1:<port> exactly: no other host, credentials, path, query, or fragment."""
    try:
        port = parsed.port
    except ValueError:
        return False
    return (parsed.scheme == "http" and port is not None and 0 < port
            and parsed.netloc == f"{LOOPBACK_HOST}:{port}"
            and not (parsed.path or parsed.query or parsed.fragment))


def arguments(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--allow-loopback", action="store_true",
                        help="also accept KEV_BASE_URL=http://127.0.0.1:<port> for a local Kev (local.ps1)")
    return parser.parse_args(argv)


def required_environment(allow_loopback=False):
    base_url = os.environ.get("KEV_BASE_URL", "").rstrip("/")
    key = os.environ.get("KEV_API_KEY", "")
    model = os.environ.get("KEV_MODEL", "kev-latest")
    revision = os.environ.get("KEV_REVISION", "")
    parsed = urlsplit(base_url)
    https = (parsed.scheme == "https" and parsed.netloc and not parsed.path and not parsed.query
             and not parsed.fragment and not parsed.username)
    if not https and not (allow_loopback and is_loopback_origin(parsed)):
        raise ValueError("KEV_BASE_URL must be an HTTPS origin without a path or credentials"
                         + (f", or http://{LOOPBACK_HOST}:<port>" if allow_loopback else ""))
    if not key.strip():
        raise ValueError("KEV_API_KEY must be nonempty")
    if model != "kev-latest":
        raise ValueError("KEV_MODEL must be kev-latest for this deployment")
    if revision != EXPECTED_REVISION:
        raise ValueError(f"KEV_REVISION must be {EXPECTED_REVISION}")
    return base_url, key, model


def request(base_url, path, key=None, body=None):
    headers = {"Accept": "application/json"}
    if key is not None:
        headers["Authorization"] = f"Bearer {key}"
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = Request(
        base_url + path,
        data=json.dumps(body).encode("utf-8") if body is not None else None,
        headers=headers,
        method="POST" if body is not None else "GET",
    )
    opener = LOOPBACK_OPENER if is_loopback_origin(urlsplit(base_url)) else OPENER
    try:
        with opener.open(req, timeout=45) as response:
            return response.status, json.load(response), response.headers
    except HTTPError as error:
        return error.code, None, error.headers


def check_revision_header(headers):
    if (headers or {}).get("X-Kev-Revision") != EXPECTED_REVISION:
        raise AssertionError("/v1 response lacks the pinned X-Kev-Revision serving attestation")


def check(allow_loopback=False):
    base_url, key, model = required_environment(allow_loopback)
    status, _, headers = request(base_url, "/v1/models")
    if status != 401:
        raise AssertionError(f"Unauthenticated /v1/models returned {status}, expected 401")
    check_revision_header(headers)
    status, _, headers = request(base_url, "/v1/models", "definitely-the-wrong-key")
    if status != 401:
        raise AssertionError(f"Invalid bearer key returned {status}, expected 401")
    check_revision_header(headers)

    status, card, headers = request(base_url, "/v1/models", key)
    if status != 200 or not isinstance(card, dict):
        raise AssertionError(f"Authenticated /v1/models returned {status}")
    check_revision_header(headers)
    matches = [entry for entry in card.get("models", []) if entry.get("name") == model]
    if len(matches) != 1 or matches[0].get("run") != RUN or matches[0].get("base") != EXPECTED_BASE:
        raise AssertionError("/v1/models does not report the pinned Kev checkpoint and base")

    synthetic = {
        "state": "Synthetic support ticket: A package arrived late and the customer asks about a refund.",
        "model": model,
        "questions": {
            "department": {
                "type": "choice", "instructions": "Choose a team.",
                "criteria": {"returns": "Refunds", "shipping": "Delivery"},
            },
            "escalate": {"type": "noul", "instructions": "Is urgent human attention needed?"},
        },
    }
    status, result, headers = request(base_url, "/v1/systemone", key, synthetic)
    if status != 200 or not isinstance(result, dict) or result.get("model") != model:
        raise AssertionError(f"Synthetic /v1/systemone returned {status} or wrong model")
    check_revision_header(headers)
    answers = result.get("answers", {})
    choice = answers.get("department", {})
    probs = choice.get("probabilities", {})
    if (choice.get("type") != "choice"
            or choice.get("choice") not in {"returns", "shipping"}
            or not isinstance(choice.get("confidence"), (int, float))
            or not 0 <= choice["confidence"] <= 1
            or set(probs) != {"returns", "shipping"}
            or not all(isinstance(p, (int, float)) and 0 <= p <= 1 for p in probs.values())
            or abs(sum(probs.values()) - 1) > 0.01):
        raise AssertionError("Choice answer has an invalid System One shape")
    noul = answers.get("escalate", {})
    if (noul.get("type") != "noul" or not isinstance(noul.get("noul"), (int, float))
            or not 0 <= noul["noul"] <= 1):
        raise AssertionError("Noul answer has an invalid System One shape")
    print(f"PASS: bearer auth, pinned {RUN}, revision headers, and synthetic System One response")


if __name__ == "__main__":
    try:
        check(arguments().allow_loopback)
    except (AssertionError, ValueError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        raise SystemExit(1) from error
