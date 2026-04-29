import sys
import json
import os
import torch
import cv2
import numpy as np
from transformers import pipeline
from PIL import Image

# Initialize the detector
# This will download the model (~400MB) on first run
try:
    detector = pipeline("image-classification", model="prithivMLmods/Deep-Fake-Detector-v2-Model")
except Exception as e:
    print(json.dumps({"error": f"Failed to load model: {str(e)}"}))
    sys.exit(1)

def parse_result(res):
    # The model returns a list of dicts: [{'label': 'fake', 'score': 0.98}, {'label': 'real', 'score': 0.02}]
    # We find the 'fake' score directly
    fake_score = 0.0
    real_score = 0.0
    
    for item in res:
        if item['label'].lower() == 'fake':
            fake_score = item['score']
        elif item['label'].lower() == 'real':
            real_score = item['score']
            
    # TruthLens uses 0-100 scale
    return {
        "visual_score": round(fake_score * 100, 2),
        "ai_generation_score": round(fake_score * 100, 2),
        "authenticity_confidence": round(real_score * 100, 2),
        "label": "MANIPULATED" if fake_score > 0.5 else "AUTHENTIC"
    }

def analyze(path):
    if not os.path.exists(path):
        return {"error": "File not found"}

    # Check if it's a video by extension
    ext = os.path.splitext(path)[1].lower()
    is_video = ext in ['.mp4', '.mov', '.avi', '.mkv', '.webm']

    try:
        if not is_video:
            # Photo Check
            img = Image.open(path).convert("RGB")
            result = detector(img)
            return parse_result(result)
        else:
            # Video Check (Sample 1 frame per second)
            cap = cv2.VideoCapture(path)
            if not cap.isOpened():
                return {"error": "Could not open video file"}
                
            fps = cap.get(cv2.CAP_PROP_FPS)
            if fps <= 0: fps = 30 # Fallback
            
            frame_count = 0
            frame_results = []

            while cap.isOpened():
                ret, frame = cap.read()
                if not ret: break

                # Sample every 1 second of video
                if frame_count % int(fps) == 0:
                    # Convert BGR to RGB
                    color_converted = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    pil_img = Image.fromarray(color_converted)
                    res = detector(pil_img)
                    frame_results.append(parse_result(res))

                frame_count += 1
            
            cap.release()

            if not frame_results:
                return {"error": "No frames analyzed"}

            # Average the scores
            avg_visual = sum(r['visual_score'] for r in frame_results) / len(frame_results)
            avg_ai = sum(r['ai_generation_score'] for r in frame_results) / len(frame_results)
            avg_conf = sum(r['authenticity_confidence'] for r in frame_results) / len(frame_results)

            return {
                "visual_score": round(avg_visual, 2),
                "ai_generation_score": round(avg_ai, 2),
                "authenticity_confidence": round(avg_conf, 2),
                "label": "MANIPULATED" if avg_visual > 50 else "AUTHENTIC",
                "frames_analyzed": len(frame_results)
            }
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input path provided"}))
        sys.exit(1)
        
    input_path = sys.argv[1]
    output = analyze(input_path)
    print(json.dumps(output))
