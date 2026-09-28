"""Predeclared synthetic RISE intent probes; reports results without claiming model quality."""

import json
import sys
import time

from smoke import arguments, check_revision_header, request, required_environment

# Intents come from worker/jev-recommend.test.js. Expected values below are
# explicit reader constraints for human review, not labels established by mocks.
CASES = [
    ("piano", "Read with piano music.", "audio", {"silent": "Silence", "piano": "Piano music", "aurora": "Ambient sound"}, "piano"),
    ("no-motion", "A quiet reading with no moving visuals.", "visual", {"off": "No visual field", "focals": "One quiet figure", "interlocution": "Continuous moving Gallery"}, "off"),
    ("large-type", "Strong book serif with extra large text.", "fontSize", {"medium": "Medium text", "large": "Large text", "xlarge": "Extra large text"}, "xlarge"),
    ("psychedelic", "A psychedelic reading.", "visualStyle", {"quiet": "Minimal visual energy", "gentle": "Soft visual presence", "psychedelic": "Kaleidoscopic, prismatic visual experience"}, "psychedelic"),
    ("reflective", "A quiet reflective reading.", "visualStyle", {"quiet": "Minimal visual energy", "immersive": "Strong continuous color and motion", "psychedelic": "Kaleidoscopic color"}, "quiet"),
    ("silent-finale", "Start with a triumphant synth theme, then let the ending be silent with no visuals.", "finaleAudio", {"silent": "Silence", "triumph": "Triumphant theme", "piano": "Piano music"}, "silent"),
]


def main(argv=None):
    base_url, key, model = required_environment(arguments(argv).allow_loopback)
    observations = []
    for case_id, intent, question, criteria, expected in CASES:
        body = {
            "model": model,
            "state": {"reader_intent": intent},
            "questions": {question: {
                "type": "choice", "instructions": f"Honor the reader's stated preference for {question}.",
                "criteria": criteria,
            }},
        }
        started = time.perf_counter()
        status, result, headers = request(base_url, "/v1/systemone", key, body)
        check_revision_header(headers)
        elapsed_ms = round((time.perf_counter() - started) * 1000)
        answer = result.get("answers", {}).get(question, {}) if isinstance(result, dict) else {}
        choice = answer.get("choice")
        observations.append({
            "case": case_id, "expected": expected, "observed": choice,
            "constraint_met": status == 200 and choice == expected,
            "http_status": status, "wall_ms": elapsed_ms,
        })
    print(json.dumps(observations, indent=2))
    passed = sum(row["constraint_met"] for row in observations)
    print(f"Explicit preference probes: {passed}/{len(observations)}; evaluate full RISE requests separately")
    return 0 if passed == len(observations) else 1


if __name__ == "__main__":
    sys.exit(main())
