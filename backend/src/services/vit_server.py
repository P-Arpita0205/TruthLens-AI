import sys
import json
import os
import torch
import cv2
import numpy as np
from transformers import pipeline
from PIL import Image
from flask import Flask, request, jsonify

app = Flask(__name__)

# Initialize the detector once
print("Loading Deepfake Detector model...")
try:
    detector = pipeline("image-classification", model="prithivMLmods/Deep-Fake-Detector-v2-Model")
    print("Model loaded successfully.")
except Exception as e:
    print(f"Failed to load model: {str(e)}")
    sys.exit(1)

def parse_result(res):
    fake_score = 0.0
    real_score = 0.0
    
    for item in res:
        if item['label'].lower() == 'fake':
            fake_score = item['score']
        elif item['label'].lower() == 'real':
            real_score = item['score']
            
    return {
        "visual_score": round(fake_score * 100, 2),
        "ai_generation_score": round(fake_score * 100, 2),
        "authenticity_confidence": round(real_score * 100, 2),
        "label": "MANIPULATED" if fake_score > 0.5 else "AUTHENTIC"
    }

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.get_json()
    path = data.get('path')
    
    if not path or not os.path.exists(path):
        return jsonify({"error": "File not found"}), 404

    ext = os.path.splitext(path)[1].lower()
    is_video = ext in ['.mp4', '.mov', '.avi', '.mkv', '.webm']

    try:
        if not is_video:
            img = Image.open(path).convert("RGB")
            result = detector(img)
            return jsonify(parse_result(result))
        else:
            cap = cv2.VideoCapture(path)
            if not cap.isOpened():
                return jsonify({"error": "Could not open video file"}), 400
                
            fps = cap.get(cv2.CAP_PROP_FPS)
            if fps <= 0: fps = 30
            
            frame_count = 0
            frame_results = []

            while cap.isOpened():
                ret, frame = cap.read()
                if not ret: break

                if frame_count % int(fps) == 0:
                    color_converted = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    pil_img = Image.fromarray(color_converted)
                    res = detector(pil_img)
                    frame_results.append(parse_result(res))

                frame_count += 1
            
            cap.release()

            if not frame_results:
                return jsonify({"error": "No frames analyzed"}), 400

            avg_visual = sum(r['visual_score'] for r in frame_results) / len(frame_results)
            avg_ai = sum(r['ai_generation_score'] for r in frame_results) / len(frame_results)
            avg_conf = sum(r['authenticity_confidence'] for r in frame_results) / len(frame_results)

            return jsonify({
                "visual_score": round(avg_visual, 2),
                "ai_generation_score": round(avg_ai, 2),
                "authenticity_confidence": round(avg_conf, 2),
                "label": "MANIPULATED" if avg_visual > 50 else "AUTHENTIC",
                "frames_analyzed": len(frame_results)
            })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("VIT_PORT", 5001))
    app.run(host='127.0.0.1', port=port)
