"""Ask a local instruction model to rate the corpus.

No hosted API credential is present in this environment. The benchmark's
teacher hook still speaks HTTP, so this script produces the ratings and
scripts/affect/teacher-server.mjs serves them at AFFECT_TEACHER_URL.
"""

import json
import re
import subprocess
import time
from pathlib import Path

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "affect" / "teacher-scores.json"
MODEL_ID = "Qwen/Qwen2.5-1.5B-Instruct"


def passages():
    raw = subprocess.check_output(
        [
            "node",
            "--input-type=module",
            "-e",
            "import { CORPUS, PROBES } from './src/affect/benchmark/corpus.js';"
            "process.stdout.write(JSON.stringify([...CORPUS, ...PROBES].map(p => ({id: p.id, text: p.text}))));",
        ],
        cwd=ROOT,
    )
    return json.loads(raw)


def extract_json(text):
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def main():
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    model = AutoModelForCausalLM.from_pretrained(MODEL_ID, dtype=torch.float32)
    model.eval()
    rows = []
    for item in passages():
        messages = [
            {
                "role": "system",
                "content": "You rate literary passages. Reply with one JSON object and no other text.",
            },
            {
                "role": "user",
                "content": (
                    "Rate the passage. valence is a number from -1 (negative) to 1 (positive). "
                    "arousal is a number from 0 (calm) to 1 (activated). "
                    "dominance is a number from -1 (submissive) to 1 (dominant).\n"
                    f"Passage: {item['text']}"
                ),
            },
        ]
        prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        encoded = tokenizer(prompt, return_tensors="pt")
        started = time.perf_counter()
        with torch.no_grad():
            generated = model.generate(
                **encoded,
                max_new_tokens=80,
                do_sample=False,
                pad_token_id=tokenizer.eos_token_id,
            )
        elapsed = time.perf_counter() - started
        completion = tokenizer.decode(generated[0][encoded["input_ids"].shape[1]:], skip_special_tokens=True)
        parsed = extract_json(completion) or {}
        dimensions = {}
        for key in ("valence", "arousal", "dominance"):
            value = parsed.get(key)
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                dimensions[key] = float(value)
        rows.append({
            "id": item["id"],
            "ms": elapsed * 1000,
            "completion": completion,
            "dimensions": dimensions,
        })
        print(item["id"], dimensions or completion[:120], flush=True)
    document = {
        "modelId": MODEL_ID,
        "parameters": 1_500_000_000,
        "note": "local-cpu-no-hosted-credential",
        "passages": rows,
    }
    OUT.write_text(json.dumps(document, indent=2) + "\n")
    parsed = sum(1 for row in rows if len(row["dimensions"]) == 3)
    print(json.dumps({"wrote": str(OUT), "parsed": parsed, "passages": len(rows)}))


if __name__ == "__main__":
    main()
