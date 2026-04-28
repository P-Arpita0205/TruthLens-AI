import json
import os
import sys

import cv2
import numpy as np


def clamp(value, low=0.0, high=100.0):
    return max(low, min(high, float(value)))


def unavailable(status="not_configured", message="CNN fallback models are not configured."):
    return {
        "available": False,
        "status": status,
        "score": 0,
        "flags": [],
        "summary": message,
        "models_run": [],
        "model_scores": {},
    }


def load_image(image_path):
    image = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if image is None:
        return None

    max_side = max(image.shape[:2])
    if max_side > 960:
        scale = 960.0 / float(max_side)
        new_size = (
            max(1, int(image.shape[1] * scale)),
            max(1, int(image.shape[0] * scale)),
        )
        image = cv2.resize(image, new_size, interpolation=cv2.INTER_AREA)

    return image


def preprocess_image(image, architecture):
    if architecture == "xception":
        target_size = (299, 299)
    else:
        target_size = (224, 224)

    resized = cv2.resize(image, target_size, interpolation=cv2.INTER_AREA)
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0

    if architecture == "xception":
        rgb = (rgb * 2.0) - 1.0

    return np.expand_dims(rgb, axis=0)


def run_keras_model(tf, image, architecture, model_path):
    model = tf.keras.models.load_model(model_path, compile=False)
    inputs = preprocess_image(image, architecture)
    prediction = model.predict(inputs, verbose=0)
    prediction_array = np.array(prediction).astype(np.float32).reshape(-1)

    if prediction_array.size == 0:
        return 0.0

    if prediction_array.size == 1:
        score = float(prediction_array[0])
    else:
        score = float(prediction_array[-1])

    if score < 0.0 or score > 1.0:
        score = 1.0 / (1.0 + np.exp(-score))

    return float(clamp(score * 100.0, 0.0, 100.0))


def analyze_image(image_path):
    image = load_image(image_path)
    if image is None:
        return unavailable(status="decode_failed", message="CNN fallback could not decode the image.")

    model_paths = {
        "efficientnet": os.environ.get("TRUTHLENS_EFFICIENTNET_MODEL", "").strip(),
        "xception": os.environ.get("TRUTHLENS_XCEPTION_MODEL", "").strip(),
    }

    configured_models = {name: path for name, path in model_paths.items() if path}
    if not configured_models:
        return unavailable()

    try:
        import tensorflow as tf
    except Exception as error:
        return unavailable(
            status="tensorflow_unavailable",
            message=f"CNN fallback models are configured, but TensorFlow is unavailable: {error}",
        )

    scores = {}
    models_run = []
    flags = []

    for architecture, model_path in configured_models.items():
        if not os.path.exists(model_path):
            flags.append(f"{architecture} model file could not be found at the configured path.")
            continue

        try:
            score = run_keras_model(tf, image, architecture, model_path)
            scores[architecture] = round(score, 2)
            models_run.append(architecture)
        except Exception as error:
            flags.append(f"{architecture} model failed to run: {error}")

    if not models_run:
        return {
            "available": False,
            "status": "model_execution_failed",
            "score": 0,
            "flags": flags,
            "summary": "Configured CNN fallback models could not be executed.",
            "models_run": [],
            "model_scores": scores,
        }

    mean_score = float(sum(scores.values()) / len(scores))
    max_score = float(max(scores.values()))
    min_score = float(min(scores.values()))
    disagreement = max_score - min_score

    if max_score >= 82:
        flags.append("At least one configured CNN backup model is strongly confident the image is manipulated.")
    elif mean_score >= 68:
        flags.append("Configured CNN backup models lean toward a manipulated classification.")

    if disagreement >= 24:
        flags.append("Configured CNN backup models disagree noticeably, so this signal should be treated cautiously.")

    if mean_score >= 72:
        summary = "Configured CNN backup models found strong manipulated-media evidence."
    elif mean_score >= 52:
        summary = "Configured CNN backup models found moderate manipulated-media evidence."
    else:
        summary = "Configured CNN backup models did not find strong manipulated-media evidence."

    return {
        "available": True,
        "status": "ok",
        "score": round(mean_score, 2),
        "flags": flags,
        "summary": summary,
        "models_run": models_run,
        "model_scores": scores,
    }


if __name__ == "__main__":
    image_path = sys.argv[1] if len(sys.argv) > 1 else None
    if not image_path:
        print(json.dumps(unavailable(status="missing_input", message="No image path provided to CNN fallback.")))
        sys.exit(0)

    print(json.dumps(analyze_image(image_path)))
