"""Benchmark evaluation tool for MAVE openWakeWord models against local audio datasets.

Evaluates an ONNX wake model using the exact same live inference pipeline
(streaming 1280-sample chunks at 16kHz via WakeEngine).
Outputs machine-readable JSON metrics and a human-readable report.
"""

import argparse
import json
import statistics
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Import WakeConfig and WakeEngine
try:
    from mave_wake.config import WakeConfig
    from mave_wake.engine import WakeEngine
except ImportError:
    # Allow running directly from tools directory or repo root
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
    from mave_wake.config import WakeConfig
    from mave_wake.engine import WakeEngine


def get_score_distribution(scores: List[float], num_bins: int = 10) -> Dict[str, int]:
    """Bucket scores into evenly spaced bins from 0.0 to 1.0."""
    bins: Dict[str, int] = {}
    bin_size = 1.0 / num_bins
    for i in range(num_bins):
        low = round(i * bin_size, 2)
        high = round((i + 1) * bin_size, 2)
        bins[f"{low:.1f}-{high:.1f}"] = 0

    for s in scores:
        clamped = max(0.0, min(1.0, s))
        bin_idx = min(int(clamped / bin_size), num_bins - 1)
        low = round(bin_idx * bin_size, 2)
        high = round((bin_idx + 1) * bin_size, 2)
        bins[f"{low:.1f}-{high:.1f}"] += 1

    return bins


def compute_summary_stats(scores: List[float]) -> Dict[str, float]:
    """Compute aggregate statistics for a list of scores."""
    if not scores:
        return {
            "count": 0,
            "avg": 0.0,
            "median": 0.0,
            "min": 0.0,
            "max": 0.0,
        }
    return {
        "count": len(scores),
        "avg": round(statistics.mean(scores), 4),
        "median": round(statistics.median(scores), 4),
        "min": round(min(scores), 4),
        "max": round(max(scores), 4),
    }


def evaluate_dataset(
    dataset_dir: Path,
    model_path: Path,
    threshold: float = 0.50,
    engine: Optional[WakeEngine] = None,
) -> Dict[str, Any]:
    """Evaluate all WAV files in dataset_dir against model_path at threshold."""
    if engine is None:
        cfg = WakeConfig(model_path=str(model_path), threshold=threshold)
        engine = WakeEngine(cfg, base_dir=dataset_dir.parent.parent.parent)
        loaded, err = engine.load_model()
        if not loaded:
            raise RuntimeError(f"Failed to load model from {model_path}: {err}")

    # Discover all .wav files under dataset_dir
    wav_files = sorted(dataset_dir.glob("**/*.wav"))
    clip_results: List[Dict[str, Any]] = []

    pos_scores: List[float] = []
    neg_scores: List[float] = []
    category_map: Dict[str, List[Dict[str, Any]]] = {}

    for wav_file in wav_files:
        rel_path = wav_file.relative_to(dataset_dir).as_posix()
        # Determine category from folder path
        parts = rel_path.split("/")
        if len(parts) >= 2:
            category = f"{parts[0]}/{parts[1]}"
        else:
            category = parts[0]

        is_positive = category.startswith("positive")

        # Process through exact inference path
        eval_res = engine.process_wav_file(str(wav_file), threshold=threshold)
        max_score = eval_res.get("max_score", 0.0)
        detected = eval_res.get("wake_detected", False)
        error = eval_res.get("error")

        item = {
            "path": rel_path,
            "category": category,
            "is_positive": is_positive,
            "max_score": max_score,
            "detected": detected,
            "threshold": threshold,
            "error": error,
        }
        clip_results.append(item)

        if category not in category_map:
            category_map[category] = []
        category_map[category].append(item)

        if not error:
            if is_positive:
                pos_scores.append(max_score)
            else:
                neg_scores.append(max_score)

    # Compute category-level metrics
    category_metrics: Dict[str, Any] = {}
    total_pos_clips = 0
    total_pos_detected = 0
    total_neg_clips = 0
    total_neg_false_activations = 0

    for cat, items in category_map.items():
        is_pos = cat.startswith("positive")
        scores = [it["max_score"] for it in items if not it["error"]]
        detected_cnt = sum(1 for it in items if it["detected"])
        total_cnt = len(items)
        stats = compute_summary_stats(scores)

        if is_pos:
            total_pos_clips += total_cnt
            total_pos_detected += detected_cnt
            recall = round(detected_cnt / total_cnt, 4) if total_cnt > 0 else 0.0
            category_metrics[cat] = {
                "total": total_cnt,
                "detected": detected_cnt,
                "recall": recall,
                "recall_pct": round(recall * 100.0, 1),
                **stats,
            }
        else:
            total_neg_clips += total_cnt
            total_neg_false_activations += detected_cnt
            fp_rate = round(detected_cnt / total_cnt, 4) if total_cnt > 0 else 0.0
            category_metrics[cat] = {
                "total": total_cnt,
                "false_activations": detected_cnt,
                "false_positive_rate": fp_rate,
                "false_positive_pct": round(fp_rate * 100.0, 1),
                **stats,
            }

    overall_pos_recall = (
        round(total_pos_detected / total_pos_clips, 4) if total_pos_clips > 0 else 0.0
    )
    overall_fp_rate = (
        round(total_neg_false_activations / total_neg_clips, 4)
        if total_neg_clips > 0
        else 0.0
    )

    pos_stats = compute_summary_stats(pos_scores)
    neg_stats = compute_summary_stats(neg_scores)
    pos_distribution = get_score_distribution(pos_scores)
    neg_distribution = get_score_distribution(neg_scores)

    return {
        "model_path": str(model_path),
        "threshold": threshold,
        "dataset_dir": str(dataset_dir),
        "total_clips": len(clip_results),
        "positive": {
            "total": total_pos_clips,
            "detected": total_pos_detected,
            "recall": overall_pos_recall,
            "recall_pct": round(overall_pos_recall * 100.0, 1),
            "stats": pos_stats,
            "score_distribution": pos_distribution,
        },
        "negative": {
            "total": total_neg_clips,
            "false_activations": total_neg_false_activations,
            "false_positive_rate": overall_fp_rate,
            "false_positive_pct": round(overall_fp_rate * 100.0, 1),
            "stats": neg_stats,
            "score_distribution": neg_distribution,
        },
        "by_category": category_metrics,
        "clips": clip_results,
    }


def format_text_report(results: Dict[str, Any]) -> str:
    """Generate human-readable text and markdown report."""
    lines: List[str] = []
    lines.append("=" * 70)
    lines.append(f"            MAVE Wake Model Benchmark Report")
    lines.append("=" * 70)
    lines.append(f"Model Path : {results['model_path']}")
    lines.append(f"Dataset Dir: {results['dataset_dir']}")
    lines.append(f"Threshold  : {results['threshold']:.2f}")
    lines.append(f"Total Clips: {results['total_clips']}")
    lines.append("-" * 70)

    pos = results["positive"]
    lines.append(f"\n[Positive Recall Summary]")
    lines.append(
        f"  Total Positive Clips  : {pos['total']}\n"
        f"  Detected (>= {results['threshold']:.2f})  : {pos['detected']}\n"
        f"  Overall Recall        : {pos['recall_pct']}%\n"
        f"  Average Score         : {pos['stats']['avg']:.4f}\n"
        f"  Median Score          : {pos['stats']['median']:.4f}\n"
        f"  Min / Max Score       : {pos['stats']['min']:.4f} / {pos['stats']['max']:.4f}"
    )

    neg = results["negative"]
    lines.append(f"\n[Negative False Activation Summary]")
    lines.append(
        f"  Total Negative Clips  : {neg['total']}\n"
        f"  False Activations     : {neg['false_activations']}\n"
        f"  False Activation Rate : {neg['false_positive_pct']}%\n"
        f"  Average Score         : {neg['stats']['avg']:.4f}\n"
        f"  Max Negative Score    : {neg['stats']['max']:.4f}"
    )

    lines.append(f"\n[Category Breakdown]")
    lines.append(
        f"  {'Category':<28} {'Clips':<8} {'Passed/FA':<10} {'Rate':<10} {'Avg':<8} {'Max':<8}"
    )
    lines.append("  " + "-" * 66)
    for cat, m in sorted(results["by_category"].items()):
        if cat.startswith("positive"):
            status_rate = f"{m['recall_pct']}%"
            passed_str = f"{m['detected']}/{m['total']}"
        else:
            status_rate = f"{m['false_positive_pct']}% FA"
            passed_str = f"{m['false_activations']}/{m['total']}"

        lines.append(
            f"  {cat:<28} {m['total']:<8} {passed_str:<10} {status_rate:<10} {m.get('avg', 0.0):<8.4f} {m.get('max', 0.0):<8.4f}"
        )

    lines.append(f"\n[Score Distribution (Histogram)]")
    lines.append(f"  {'Bin':<12} {'Positive Clips':<18} {'Negative Clips':<18}")
    lines.append("  " + "-" * 48)
    pos_dist = pos["score_distribution"]
    neg_dist = neg["score_distribution"]
    for bin_name in pos_dist:
        p_cnt = pos_dist.get(bin_name, 0)
        n_cnt = neg_dist.get(bin_name, 0)
        p_bar = "#" * min(p_cnt, 20)
        n_bar = "x" * min(n_cnt, 20)
        lines.append(f"  {bin_name:<12} {p_cnt:<4} {p_bar:<13} {n_cnt:<4} {n_bar}")

    lines.append("=" * 70)
    return "\n".join(lines)


def main() -> None:
    """CLI entrypoint."""
    parser = argparse.ArgumentParser(description="Evaluate openWakeWord model against benchmark dataset.")
    parser.add_argument("--model", type=str, default="assets/wake/mave.onnx", help="Path to ONNX wake model")
    parser.add_argument("--dataset-dir", type=str, default="data/wake/mave-v2", help="Path to audio dataset directory")
    parser.add_argument("--threshold", type=float, default=0.50, help="Confidence threshold (default: 0.50)")
    parser.add_argument("--output", type=str, default="data/wake/mave-v2/results/v1-benchmark.json", help="Path to output JSON")
    parser.add_argument("--report", type=str, default=None, help="Path to optional output text/markdown report")

    args = parser.parse_args()

    dataset_path = Path(args.dataset_dir)
    model_path = Path(args.model)

    if not dataset_path.exists():
        print(f"Error: dataset directory not found: {dataset_path}", file=sys.stderr)
        print("Tip: Use services/wake/tools/record_dataset.py to record clips first.", file=sys.stderr)
        sys.exit(1)

    if not model_path.is_file():
        print(f"Error: model file not found: {model_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Benchmarking model: {model_path} against {dataset_path} (threshold={args.threshold:.2f})...")
    results = evaluate_dataset(dataset_dir=dataset_path, model_path=model_path, threshold=args.threshold)

    # Save JSON output
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"✓ Saved machine-readable results to: {out_path}")

    # Generate and print text report
    report_text = format_text_report(results)
    print("\n" + report_text)

    # Save report if requested or to default alongside JSON
    report_file = Path(args.report) if args.report else out_path.with_suffix(".md")
    with open(report_file, "w", encoding="utf-8") as f:
        f.write(report_text + "\n")
    print(f"✓ Saved human-readable report to: {report_file}")


if __name__ == "__main__":
    main()

