"""Create verified Rec.709 delivery files from the directed V4 render."""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--destination", type=Path, default=root / "out/directed-v4-delivery")
args = parser.parse_args()
args.destination.mkdir(parents=True, exist_ok=True)
source = root / "out/nodemere-v4-directed-4k.mp4"
master = args.destination / "nodemere-v4-4k.mp4"
preview = args.destination / "nodemere-v4-preview.mp4"

def probe(path):
    return json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)
    ], text=True))

source_info = probe(source)
stream = next(s for s in source_info["streams"] if s["codec_type"] == "video")
expected_frames = int(stream["nb_frames"])
expected_seconds = float(stream["duration"])
assert expected_frames > 0 and stream["avg_frame_rate"] == "60/1"
input_matrix = "bt709" if stream.get("color_space") == "bt709" else "bt601"
input_range = "pc" if stream.get("color_range") == "pc" else "tv"
conversion = f"scale=in_range={input_range}:out_range=tv:in_color_matrix={input_matrix}:out_color_matrix=bt709,format=yuv420p"

def encode(source_path, target_path, video_filter, crf):
    subprocess.run([
        "ffmpeg", "-nostdin", "-hide_banner", "-v", "error", "-y", "-i", str(source_path),
        "-map", "0:v:0", "-vf", video_filter, "-an", "-c:v", "libx264", "-preset", "slow",
        "-crf", str(crf), "-pix_fmt", "yuv420p", "-color_range", "tv", "-colorspace", "bt709",
        "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart", str(target_path)
    ], check=True)

print("Preparing standard Rec.709 4K master.", flush=True)
encode(source, master, conversion, 14)
print("Creating matching 1080p preview from the delivery master.", flush=True)
encode(master, preview, "scale=1920:1080:flags=lanczos,format=yuv420p", 16)

metadata = []
for path, width, height in [(master, 3840, 2160), (preview, 1920, 1080)]:
    data = probe(path)
    assert len(data["streams"]) == 1, "Unexpected additional stream"
    video = data["streams"][0]
    assert video["codec_name"] == "h264" and video["codec_type"] == "video"
    assert (video["width"], video["height"]) == (width, height)
    assert video["pix_fmt"] == "yuv420p" and video["color_space"] == "bt709"
    assert video["color_range"] == "tv" and video["avg_frame_rate"] == "60/1"
    assert int(video["nb_frames"]) == expected_frames
    assert abs(float(video["duration"]) - expected_seconds) < 0.001
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-xerror", "-i", str(path),
                    "-map", "0:v:0", "-f", "null", "-"], check=True)
    metadata.append({
        "file": path.name, "width": width, "height": height, "fps": 60,
        "frames": expected_frames, "seconds": expected_seconds, "audio_streams": 0,
        "codec": "H.264 High", "pixel_format": video["pix_fmt"],
        "color_space": video["color_space"], "color_range": video["color_range"],
        "bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "full_decode": "passed"
    })
    print(f"Verified {path.name}: {path.stat().st_size:,} bytes.", flush=True)

(args.destination / "nodemere-v4-export-metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
