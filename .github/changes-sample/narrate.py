"""A one-off sample narrator (delete before merging): says each spoken passage with a local Piper voice where the
recording showed it, fitted to the time RISE gave it, and muxes the voice onto the recording as an mp4.
   python3 narrate.py <outDir> <voice.onnx>"""
import json, subprocess, sys, wave
from pathlib import Path

out, voice = Path(sys.argv[1]), sys.argv[2]
timing = json.loads((out / 'timing.json').read_text())
spoken = [p for p in timing['passages'] if p['spoken'] and p['startMs'] is not None and p['text'].strip()]
starts = [p['startMs'] for p in spoken]
inputs, filters = [], []
for i, p in enumerate(spoken):
    raw = out / f'v{i:02d}.wav'
    subprocess.run(['piper', '-m', voice, '-f', str(raw)], input=' '.join(p['text'].split()).encode(), check=True, capture_output=True)
    with wave.open(str(raw)) as w:
        dur = w.getnframes() / w.getframerate() * 1000
    nxt = starts[i + 1] if i + 1 < len(starts) else timing['endMs']
    slot = max(500, min(nxt, p['endMs'] + 1500) - p['startMs'] - 150)
    tempo = min(1.5, max(1.0, dur / slot))
    inputs += ['-i', str(raw)]
    filters.append(f'[{i + 1}:a]atempo={tempo:.3f},adelay={p["startMs"]}|{p["startMs"]}[a{i}]')
mix = ''.join(f'[a{i}]' for i in range(len(spoken)))
filters.append(f'{mix}amix=inputs={len(spoken)}:normalize=0,apad[voice]')
start = max(0, timing['marks']['open'] - 2500) / 1000
cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-i', str(out / 'silent.webm'), *inputs,
       '-filter_complex', ';'.join(filters), '-map', '0:v', '-map', '[voice]', '-ss', f'{start:.2f}', '-shortest',
       '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-r', '25',
       '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', str(out / 'sample.mp4')]
subprocess.run(cmd, check=True)
print(json.dumps({'passages': len(spoken), 'mp4': str(out / 'sample.mp4')}))
