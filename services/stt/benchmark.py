import asyncio
import os
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

if sys.platform == "win32":
    site = os.path.join(sys.prefix, "Lib", "site-packages")
    for sub in ["nvidia/cublas/bin", "nvidia/cudnn/bin"]:
        p = os.path.join(site, sub.replace("/", os.sep))
        if os.path.exists(p):
            os.environ["PATH"] = p + os.pathsep + os.environ["PATH"]
            if hasattr(os, "add_dll_directory"):
                os.add_dll_directory(p)

import edge_tts
import faster_whisper

TEST_PHRASES = [
    ("thai_tired", "วันนี้เหนื่อยมาก ภาษาอังกฤษพูดยังไง", "th-TH-PremwadeeNeural"),
    ("thai_weather", "พรุ่งนี้อากาศเป็นยังไง", "th-TH-PremwadeeNeural"),
    ("mixed_explain", "ช่วย explain อันนี้แบบง่าย ๆ", "th-TH-PremwadeeNeural"),
    ("english_greeting", "Hello MAVE, what are we working on today?", "en-US-JennyNeural"),
]

async def generate_clips():
    os.makedirs("test_audio", exist_ok=True)
    for name, text, voice in TEST_PHRASES:
        out_path = f"test_audio/{name}.mp3"
        if os.path.exists(out_path) and os.path.getsize(out_path) > 100:
            continue
        for attempt in range(3):
            try:
                communicate = edge_tts.Communicate(text, voice)
                await communicate.save(out_path)
                print(f"Generated {out_path}")
                await asyncio.sleep(1.0)
                break
            except Exception as e:
                print(f"Retry {name}: {e}")
                await asyncio.sleep(2.0)

def run_benchmark():
    asyncio.run(generate_clips())

    models = ["small", "large-v3-turbo"]
    results = {}

    for model_name in models:
        print(f"\n==========================================")
        print(f"BENCHMARKING MODEL: {model_name} (CUDA float16)")
        print(f"==========================================")
        t_load_0 = time.time()
        model = faster_whisper.WhisperModel(model_name, device="cuda", compute_type="float16")
        load_time = time.time() - t_load_0
        print(f"Loaded {model_name} in {load_time:.2f}s")

        model_results = []
        for name, expected_text, _ in TEST_PHRASES:
            clip_path = f"test_audio/{name}.mp3"
            t_infer_0 = time.time()
            segments, info = model.transcribe(
                clip_path,
                beam_size=5,
                word_timestamps=True,
            )
            transcript = "".join(s.text for s in segments).strip()
            infer_duration = time.time() - t_infer_0

            res = {
                "clip": name,
                "expected": expected_text,
                "transcript": transcript,
                "language": info.language,
                "language_prob": round(info.language_probability, 3),
                "duration": round(info.duration, 2),
                "infer_latency": round(infer_duration, 3),
                "rtf": round(infer_duration / max(info.duration, 0.01), 3),
            }
            model_results.append(res)
            print(f"\n[Clip: {name}]")
            print(f"  Expected:    {expected_text}")
            print(f"  Transcribed: {transcript}")
            print(f"  Lang:        {info.language} ({info.language_probability:.2f})")
            print(f"  Audio Dur:   {info.duration:.2f}s | Latency: {infer_duration:.3f}s | RTF: {res['rtf']}")

        results[model_name] = {
            "load_time": round(load_time, 2),
            "clips": model_results,
        }

if __name__ == "__main__":
    run_benchmark()
