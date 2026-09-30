"""Score the RISE affect corpus with EmoPair checkpoints.

PERT-EmoPair is a roberta-large encoder plus a 3-way regression head.
Reward-EmoPair is scored only when its checkpoint loads; the file also
holds an optimizer, so a small machine may refuse it. Raw scores are
written untouched. Any later rescaling lives next to them and is named.
"""

import gc
import json
import subprocess
import time
from pathlib import Path

import torch
import torch.nn as nn
from huggingface_hub import hf_hub_download
from transformers import AutoTokenizer, RobertaConfig, RobertaModel

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "affect" / "emopair-scores.json"
PROMPT = (
    "- Valence: The emotional valence of the context is <mask>. "
    "- Arousal: The level of arousal of the context is <mask>. "
    "- Dominance: The perceived dominance associated with the context is <mask>. "
    "Please predict the missing value for each dimension using the content provided."
)


class RobertaForVAD(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.base_model = RobertaModel(config)
        self.dropout = nn.Dropout(0.1)
        self.regressor = nn.Linear(config.hidden_size, 3)

    def forward(self, input_ids, attention_mask):
        outputs = self.base_model(input_ids=input_ids, attention_mask=attention_mask)
        cls = self.dropout(outputs.last_hidden_state[:, 0, :])
        return self.regressor(cls)


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


def summarize(rows):
    summary = {}
    for key in ("valence", "arousal", "dominance"):
        values = [row["raw"][key] for row in rows]
        summary[key] = {
            "min": min(values),
            "max": max(values),
            "mean": sum(values) / len(values),
        }
    return summary


def score_pert(items):
    config_path = hf_hub_download("edsi-umd/PERT-EmoPair", "config.json")
    weight_path = hf_hub_download("edsi-umd/PERT-EmoPair", "pytorch_model.bin")
    tokenizer = AutoTokenizer.from_pretrained("edsi-umd/PERT-EmoPair")
    config = RobertaConfig.from_pretrained(Path(config_path).parent)
    model = RobertaForVAD(config)
    state = torch.load(weight_path, map_location="cpu", weights_only=True)
    blob = state["model_state_dict"] if isinstance(state, dict) and "model_state_dict" in state else state
    model.load_state_dict(blob)
    model.eval()
    rows = []
    with torch.no_grad():
        for item in items:
            prompted = f"Context: '{item['text']}' {PROMPT}"
            encoded = tokenizer(prompted, return_tensors="pt", truncation=True, max_length=256)
            started = time.perf_counter()
            values = model(**encoded).squeeze(0).tolist()
            elapsed = time.perf_counter() - started
            rows.append({
                "id": item["id"],
                "raw": {
                    "valence": values[0],
                    "arousal": values[1],
                    "dominance": values[2],
                },
                "ms": elapsed * 1000,
            })
    del model, state
    gc.collect()
    return {
        "modelId": "edsi-umd/PERT-EmoPair",
        "family": "emopair",
        "architecture": "roberta-large + linear VAD head",
        "prompted": True,
        "device": "cpu",
        "summary": summarize(rows),
        "passages": rows,
    }


def score_reward(items):
    """Minimal scorer. The published RewardModel class imports a training
    helper that is not in the checkpoint repo, so the head is rebuilt here
    to match RewardModel._build_model."""
    weight_path = hf_hub_download("edsi-umd/Reward-EmoPair", "pytorch_model.pth")
    tokenizer = AutoTokenizer.from_pretrained("roberta-large")

    class EncoderWithHead(nn.Module):
        def __init__(self):
            super().__init__()
            config = RobertaConfig.from_pretrained("roberta-large")
            self.encoder = RobertaModel(config)
            hidden = config.hidden_size
            self.dropout = nn.Dropout(0.2)
            self.valence_head = nn.Linear(hidden, 1)
            self.arousal_dominance_head = nn.Linear(hidden, 2)

        def forward(self, input_ids, attention_mask):
            pooled = self.encoder(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state[:, 0, :]
            pooled = self.dropout(pooled)
            return self.valence_head(pooled), self.arousal_dominance_head(pooled)

    model = EncoderWithHead()
    checkpoint = torch.load(weight_path, map_location="cpu", weights_only=False)
    model.load_state_dict(checkpoint["model_state_dict"])
    del checkpoint
    gc.collect()
    model.eval()
    rows = []
    with torch.no_grad():
        for item in items:
            encoded = tokenizer(
                item["text"],
                max_length=256,
                padding="max_length",
                truncation=True,
                return_tensors="pt",
            )
            started = time.perf_counter()
            valence, arousal_dominance = model(encoded["input_ids"], encoded["attention_mask"])
            elapsed = time.perf_counter() - started
            rows.append({
                "id": item["id"],
                "raw": {
                    "valence": float(valence[0, 0]),
                    "arousal": float(arousal_dominance[0, 0]),
                    "dominance": float(arousal_dominance[0, 1]),
                },
                "ms": elapsed * 1000,
            })
    return {
        "modelId": "edsi-umd/Reward-EmoPair",
        "family": "emopair",
        "architecture": "roberta-large + valence head + arousal/dominance head",
        "prompted": False,
        "device": "cpu",
        "normParams": json.loads(Path(hf_hub_download("edsi-umd/Reward-EmoPair", "norm_params.json")).read_text()),
        "summary": summarize(rows),
        "passages": rows,
    }


def write(document):
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(document, indent=2) + "\n")


def main():
    items = passages()
    document = {"passages": [item["id"] for item in items], "models": {}}
    document["models"]["pert-emopair"] = score_pert(items)
    write(document)
    try:
        document["models"]["reward-emopair"] = score_reward(items)
    except Exception as error:
        document["models"]["reward-emopair"] = {
            "modelId": "edsi-umd/Reward-EmoPair",
            "status": "unavailable",
            "reason": f"{type(error).__name__}: {error}",
        }
    write(document)
    brief = {
        name: {
            "status": model.get("status", "scored"),
            "summary": model.get("summary"),
            "reason": model.get("reason"),
        }
        for name, model in document["models"].items()
    }
    print(json.dumps(brief, indent=2))


if __name__ == "__main__":
    main()
