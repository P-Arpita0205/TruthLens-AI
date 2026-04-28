import json
import sys

import cv2
import numpy as np


FACE_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
FACE_CASCADE_ALT = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_alt2.xml")
PROFILE_FACE_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_profileface.xml")
EYE_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye_tree_eyeglasses.xml")


def clamp(value, low=0.0, high=100.0):
    return max(low, min(high, float(value)))


def resize_if_needed(image):
    height, width = image.shape[:2]
    max_side = max(height, width)
    if max_side <= 960:
        return image

    scale = 960.0 / float(max_side)
    new_size = (max(1, int(width * scale)), max(1, int(height * scale)))
    return cv2.resize(image, new_size, interpolation=cv2.INTER_AREA)


def safe_mean(region):
    return float(region.mean()) if region.size else 0.0


def safe_std(region):
    return float(region.std()) if region.size else 0.0


def safe_edge_density(region):
    return float(np.mean(region > 0)) if region.size else 0.0


def boundary_blockiness(gray):
    gray = gray.astype(np.float32)
    height, width = gray.shape
    values = []

    if width > 16:
        internal = np.abs(np.diff(gray, axis=1))
        boundary = internal[:, 7::8]
        non_boundary = np.delete(internal, np.arange(7, internal.shape[1], 8), axis=1)
        if boundary.size and non_boundary.size:
            values.append(float(boundary.mean() - non_boundary.mean()))

    if height > 16:
        internal = np.abs(np.diff(gray, axis=0))
        boundary = internal[7::8, :]
        non_boundary = np.delete(internal, np.arange(7, internal.shape[0], 8), axis=0)
        if boundary.size and non_boundary.size:
            values.append(float(boundary.mean() - non_boundary.mean()))

    if not values:
        return 0.0

    return max(values)


def fourier_artifact_metrics(gray):
    gray_f = gray.astype(np.float32)
    magnitude = np.log1p(np.abs(np.fft.fftshift(np.fft.fft2(gray_f))))
    height, width = magnitude.shape
    cy, cx = height // 2, width // 2
    yy, xx = np.ogrid[:height, :width]
    distance = np.sqrt((yy - cy) ** 2 + (xx - cx) ** 2)
    max_radius = max(1.0, float(min(height, width)) / 2.0)

    total_mean = float(magnitude.mean()) if magnitude.size else 0.0
    low_mask = distance <= max_radius * 0.12
    high_mask = distance >= max_radius * 0.35
    ring_mask = (distance >= max_radius * 0.18) & (distance <= max_radius * 0.48)
    diagonal_mask = np.abs(np.abs(yy - cy) - np.abs(xx - cx)) <= 2

    high_mean = float(magnitude[high_mask].mean()) if np.any(high_mask) else 0.0
    low_mean = float(magnitude[low_mask].mean()) if np.any(low_mask) else 0.0
    ring_values = magnitude[ring_mask]
    ring_std = float(ring_values.std()) if ring_values.size else 0.0
    ring_percentile_99 = float(np.percentile(ring_values, 99.6)) if ring_values.size else 0.0
    ring_percentile_92 = float(np.percentile(ring_values, 92.0)) if ring_values.size else 0.0
    periodic_raw = max(0.0, ring_percentile_99 - ring_percentile_92)

    vertical_strip = magnitude[:, max(0, cx - 2):min(width, cx + 3)]
    horizontal_strip = magnitude[max(0, cy - 2):min(height, cy + 3), :]
    axis_energy = 0.0
    if vertical_strip.size and horizontal_strip.size:
        axis_energy = float((vertical_strip.mean() + horizontal_strip.mean()) / 2.0)
    diagonal_energy = float(magnitude[diagonal_mask].mean()) if np.any(diagonal_mask) else 0.0

    high_frequency_ratio = high_mean / max(total_mean, 1e-4)
    low_frequency_ratio = low_mean / max(total_mean, 1e-4)
    periodic_spike_score = clamp(periodic_raw / max(ring_std * 6.5, 1e-4), 0.0, 1.0)
    grid_artifact_score = clamp(max(0.0, axis_energy - diagonal_energy) / max(total_mean * 0.75, 1e-4), 0.0, 1.0)

    return {
        "fft_high_frequency_ratio": float(high_frequency_ratio),
        "fft_low_frequency_ratio": float(low_frequency_ratio),
        "fft_periodic_spike_score": float(periodic_spike_score),
        "fft_grid_artifact_score": float(grid_artifact_score),
    }


def mirror_symmetry_score(face_gray):
    height, width = face_gray.shape
    if width < 20 or height < 20:
        return 1.0

    midpoint = width // 2
    left = face_gray[:, :midpoint]
    right = face_gray[:, width - midpoint:]
    mirrored_right = np.fliplr(right)
    usable_width = min(left.shape[1], mirrored_right.shape[1])
    if usable_width == 0:
        return 1.0

    diff = np.abs(left[:, :usable_width].astype(np.float32) - mirrored_right[:, :usable_width].astype(np.float32))
    return float(diff.mean() / 255.0)


def clip_rect(x, y, w, h, width, height):
    x = max(0, min(int(x), width))
    y = max(0, min(int(y), height))
    w = max(0, min(int(w), width - x))
    h = max(0, min(int(h), height - y))
    return x, y, w, h


def rect_iou(rect_a, rect_b):
    ax, ay, aw, ah = rect_a
    bx, by, bw, bh = rect_b
    ax2, ay2 = ax + aw, ay + ah
    bx2, by2 = bx + bw, by + bh

    inter_x1 = max(ax, bx)
    inter_y1 = max(ay, by)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    if inter_x2 <= inter_x1 or inter_y2 <= inter_y1:
        return 0.0

    intersection = float((inter_x2 - inter_x1) * (inter_y2 - inter_y1))
    union = float((aw * ah) + (bw * bh) - intersection)
    return intersection / union if union > 0 else 0.0


def select_faces(faces, image_area, max_count=3):
    if len(faces) == 0:
        return []

    sorted_faces = sorted(faces, key=lambda rect: rect[2] * rect[3], reverse=True)
    selected = []
    for rect in sorted_faces:
        x, y, w, h = [int(value) for value in rect]
        area_ratio = (w * h) / max(image_area, 1.0)
        if area_ratio < 0.008:
            continue
        if any(rect_iou((x, y, w, h), existing) > 0.28 for existing in selected):
            continue
        selected.append((x, y, w, h))
        if len(selected) >= max_count:
            break

    return selected


def detect_faces(gray):
    detections = []

    for cascade, scale_factor, min_neighbors, min_size in [
        (FACE_CASCADE, 1.08, 4, (36, 36)),
        (FACE_CASCADE_ALT, 1.05, 4, (32, 32)),
    ]:
        faces = cascade.detectMultiScale(
            gray,
            scaleFactor=scale_factor,
            minNeighbors=min_neighbors,
            minSize=min_size,
        )
        detections.extend([(int(x), int(y), int(w), int(h)) for x, y, w, h in faces])

    profile_faces = PROFILE_FACE_CASCADE.detectMultiScale(
        gray,
        scaleFactor=1.05,
        minNeighbors=3,
        minSize=(32, 32),
    )
    detections.extend([(int(x), int(y), int(w), int(h)) for x, y, w, h in profile_faces])

    flipped = cv2.flip(gray, 1)
    flipped_faces = PROFILE_FACE_CASCADE.detectMultiScale(
        flipped,
        scaleFactor=1.05,
        minNeighbors=3,
        minSize=(32, 32),
    )
    width = gray.shape[1]
    for x, y, w, h in flipped_faces:
        detections.append((int(width - x - w), int(y), int(w), int(h)))

    return detections


def expanded_ring(gray, x, y, w, h):
    height, width = gray.shape
    pad_x = max(6, int(w * 0.18))
    pad_y = max(6, int(h * 0.18))
    ex, ey, ew, eh = clip_rect(x - pad_x, y - pad_y, w + (pad_x * 2), h + (pad_y * 2), width, height)
    expanded = gray[ey:ey + eh, ex:ex + ew]
    if expanded.size == 0:
        return np.empty((0, 0), dtype=np.uint8)

    mask = np.ones(expanded.shape[:2], dtype=np.uint8)
    inner_x = x - ex
    inner_y = y - ey
    mask[inner_y:inner_y + h, inner_x:inner_x + w] = 0
    ring = expanded[mask > 0]
    return ring


def detect_eyes(face_gray):
    upper_half = face_gray[: max(1, face_gray.shape[0] // 2), :]
    eyes = EYE_CASCADE.detectMultiScale(upper_half, scaleFactor=1.08, minNeighbors=4, minSize=(12, 12))
    if len(eyes) == 0:
        return []

    sorted_eyes = sorted(eyes, key=lambda rect: rect[2] * rect[3], reverse=True)
    sorted_eyes = sorted(sorted_eyes[:2], key=lambda rect: rect[0])
    return sorted_eyes


def eye_metrics(face_gray):
    eyes = detect_eyes(face_gray)
    if len(eyes) < 2:
        return {
            "eye_count": len(eyes),
            "eye_openness_ratio": 0.0,
            "eye_highlight_asymmetry": 0.0,
            "eye_reflection_strength": 0.0,
        }

    openness = []
    highlight_ratios = []
    reflection_strength = []

    for ex, ey, ew, eh in eyes:
        eye_region = face_gray[ey:ey + eh, ex:ex + ew]
        if eye_region.size == 0:
            continue

        openness.append(float(eh / max(ew, 1)))
        bright_ratio = float(np.mean(eye_region >= 242))
        highlight_ratios.append(bright_ratio)
        reflection_strength.append(float(np.percentile(eye_region, 98) - np.percentile(eye_region, 70)))

    if len(openness) < 2:
        return {
            "eye_count": len(eyes),
            "eye_openness_ratio": 0.0,
            "eye_highlight_asymmetry": 0.0,
            "eye_reflection_strength": 0.0,
        }

    return {
        "eye_count": len(eyes),
        "eye_openness_ratio": float(sum(openness) / len(openness)),
        "eye_highlight_asymmetry": float(abs(highlight_ratios[0] - highlight_ratios[1])),
        "eye_reflection_strength": float(sum(reflection_strength) / len(reflection_strength)),
    }


def mouth_metrics(face_gray, face_edges):
    height, width = face_gray.shape
    x0 = int(width * 0.22)
    x1 = int(width * 0.78)
    y0 = int(height * 0.60)
    y1 = int(height * 0.90)
    mouth_gray = face_gray[y0:y1, x0:x1]
    mouth_edges = face_edges[y0:y1, x0:x1]

    if mouth_gray.size == 0:
        return {
            "mouth_edge_density": 0.0,
            "mouth_asymmetry": 0.0,
            "mouth_open_ratio": 0.0,
            "teeth_bright_ratio": 0.0,
            "teeth_uniformity": 0.0,
        }

    midpoint = mouth_gray.shape[1] // 2
    left = mouth_gray[:, :midpoint]
    right = mouth_gray[:, mouth_gray.shape[1] - midpoint:]
    mirrored_right = np.fliplr(right)
    usable_width = min(left.shape[1], mirrored_right.shape[1])
    asymmetry = 0.0
    if usable_width > 0:
      diff = np.abs(left[:, :usable_width].astype(np.float32) - mirrored_right[:, :usable_width].astype(np.float32))
      asymmetry = float(diff.mean() / 255.0)

    bright_ratio = float(np.mean(mouth_gray >= 210))
    dark_threshold = max(28.0, float(np.percentile(face_gray, 18)))
    mouth_open_ratio = float(np.mean(mouth_gray <= dark_threshold))
    uniformity = 1.0 - min(1.0, safe_std(mouth_gray) / 64.0)

    return {
        "mouth_edge_density": safe_edge_density(mouth_edges),
        "mouth_asymmetry": asymmetry,
        "mouth_open_ratio": mouth_open_ratio,
        "teeth_bright_ratio": bright_ratio,
        "teeth_uniformity": float(uniformity),
    }


def jaw_metrics(face_gray, face_edges):
    height, width = face_gray.shape
    y0 = int(height * 0.62)
    y1 = int(height * 0.98)
    jaw_gray = face_gray[y0:y1, :]
    jaw_edges = face_edges[y0:y1, :]

    if jaw_gray.size == 0:
        return {
            "jaw_edge_density": 0.0,
            "jaw_asymmetry": 0.0,
            "jaw_width_ratio": 0.0,
            "jaw_center_offset": 0.0,
        }

    midpoint = jaw_gray.shape[1] // 2
    left = jaw_gray[:, :midpoint]
    right = jaw_gray[:, jaw_gray.shape[1] - midpoint:]
    mirrored_right = np.fliplr(right)
    usable_width = min(left.shape[1], mirrored_right.shape[1])
    asymmetry = 0.0
    if usable_width > 0:
        diff = np.abs(left[:, :usable_width].astype(np.float32) - mirrored_right[:, :usable_width].astype(np.float32))
        asymmetry = float(diff.mean() / 255.0)

    row_widths = []
    row_centers = []
    for row_index in range(jaw_edges.shape[0]):
        positions = np.where(jaw_edges[row_index] > 0)[0]
        if positions.size < 2:
            continue
        width_ratio = float((positions[-1] - positions[0] + 1) / max(jaw_edges.shape[1], 1))
        if width_ratio < 0.16:
            continue
        row_widths.append(width_ratio)
        row_centers.append(float(((positions[-1] + positions[0]) / 2.0) / max(jaw_edges.shape[1], 1)))

    jaw_width_ratio = float(np.mean(row_widths)) if row_widths else 0.0
    jaw_center_offset = float(abs(np.mean(row_centers) - 0.5) * 2.0) if row_centers else 0.0

    return {
        "jaw_edge_density": safe_edge_density(jaw_edges),
        "jaw_asymmetry": asymmetry,
        "jaw_width_ratio": jaw_width_ratio,
        "jaw_center_offset": jaw_center_offset,
    }


def skin_metrics(face_bgr):
    if face_bgr.size == 0:
        return {
            "skin_pixel_ratio": 0.0,
            "skin_luma_mean": 0.0,
            "skin_luma_std": 0.0,
            "skin_hue_std": 0.0,
            "skin_chroma_std": 0.0,
            "skin_tone_flatness": 0.0,
            "skin_green_red_ratio": 0.0,
            "skin_red_mean": 0.0,
            "skin_green_mean": 0.0,
            "skin_blue_mean": 0.0,
        }

    ycrcb = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2YCrCb)
    hsv = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(ycrcb, np.array([0, 135, 85], dtype=np.uint8), np.array([255, 180, 135], dtype=np.uint8))
    skin_pixel_ratio = float(np.mean(mask > 0))

    if skin_pixel_ratio <= 0.0:
        return {
            "skin_pixel_ratio": 0.0,
            "skin_luma_mean": 0.0,
            "skin_luma_std": 0.0,
            "skin_hue_std": 0.0,
            "skin_chroma_std": 0.0,
            "skin_tone_flatness": 0.0,
            "skin_green_red_ratio": 0.0,
            "skin_red_mean": 0.0,
            "skin_green_mean": 0.0,
            "skin_blue_mean": 0.0,
        }

    skin_pixels = face_bgr[mask > 0]
    skin_ycrcb = ycrcb[mask > 0]
    skin_hsv = hsv[mask > 0]

    blue_mean = float(np.mean(skin_pixels[:, 0])) if skin_pixels.size else 0.0
    green_mean = float(np.mean(skin_pixels[:, 1])) if skin_pixels.size else 0.0
    red_mean = float(np.mean(skin_pixels[:, 2])) if skin_pixels.size else 0.0
    luma_mean = float(np.mean(skin_ycrcb[:, 0])) if skin_ycrcb.size else 0.0
    luma_std = float(np.std(skin_ycrcb[:, 0])) if skin_ycrcb.size else 0.0
    hue_std = float(np.std(skin_hsv[:, 0])) if skin_hsv.size else 0.0
    chroma_std = float(np.std(skin_ycrcb[:, 1]) + np.std(skin_ycrcb[:, 2])) if skin_ycrcb.size else 0.0
    tone_flatness = 1.0 - min(1.0, chroma_std / 40.0)
    green_red_ratio = green_mean / max(red_mean, 1.0)

    return {
        "skin_pixel_ratio": skin_pixel_ratio,
        "skin_luma_mean": luma_mean,
        "skin_luma_std": luma_std,
        "skin_hue_std": hue_std,
        "skin_chroma_std": chroma_std,
        "skin_tone_flatness": float(tone_flatness),
        "skin_green_red_ratio": float(green_red_ratio),
        "skin_red_mean": red_mean,
        "skin_green_mean": green_mean,
        "skin_blue_mean": blue_mean,
    }


def single_face_metrics(image, gray, edge_map, rect):
    x, y, w, h = rect
    face_bgr = image[y:y + h, x:x + w]
    face_gray = gray[y:y + h, x:x + w]
    face_edges = edge_map[y:y + h, x:x + w]
    total_area = float(gray.shape[0] * gray.shape[1])
    global_edge_density = safe_edge_density(edge_map)
    face_edge_density = safe_edge_density(face_edges)
    ring = expanded_ring(gray, x, y, w, h)
    ring_mean = safe_mean(ring)
    ring_std = safe_std(ring)
    face_mean = safe_mean(face_gray)
    face_std = safe_std(face_gray)

    expanded_edge_ring = expanded_ring(edge_map, x, y, w, h)
    seam_delta = max(0.0, safe_edge_density(expanded_edge_ring) - face_edge_density)
    luma_delta = abs(face_mean - ring_mean) / 255.0 if ring.size else 0.0

    eye = eye_metrics(face_gray)
    mouth = mouth_metrics(face_gray, face_edges)
    jaw = jaw_metrics(face_gray, face_edges)
    skin = skin_metrics(face_bgr)

    return {
        "face_detected": True,
        "face_bbox": [int(x), int(y), int(w), int(h)],
        "face_area_ratio": clamp((w * h) / total_area, 0.0, 1.0),
        "face_center_x": clamp((x + (w / 2.0)) / gray.shape[1], 0.0, 1.0),
        "face_center_y": clamp((y + (h / 2.0)) / gray.shape[0], 0.0, 1.0),
        "face_width_ratio": clamp(w / float(gray.shape[1]), 0.0, 1.0),
        "face_height_ratio": clamp(h / float(gray.shape[0]), 0.0, 1.0),
        "face_laplacian_var": float(cv2.Laplacian(face_gray, cv2.CV_64F).var()),
        "face_edge_density": face_edge_density,
        "face_edge_ratio": float(face_edge_density / max(global_edge_density, 1e-4)),
        "face_symmetry": mirror_symmetry_score(face_gray),
        "face_luma_mean": face_mean,
        "face_luma_std": face_std,
        "face_background_luma_delta": luma_delta,
        "face_background_sat_delta": float(abs(face_std - ring_std) / 255.0 if ring.size else 0.0),
        "boundary_seam_score": seam_delta,
        "eye_count": eye["eye_count"],
        "eye_openness_ratio": eye["eye_openness_ratio"],
        "eye_highlight_asymmetry": eye["eye_highlight_asymmetry"],
        "eye_reflection_strength": eye["eye_reflection_strength"],
        "mouth_edge_density": mouth["mouth_edge_density"],
        "mouth_asymmetry": mouth["mouth_asymmetry"],
        "mouth_open_ratio": mouth["mouth_open_ratio"],
        "teeth_bright_ratio": mouth["teeth_bright_ratio"],
        "teeth_uniformity": mouth["teeth_uniformity"],
        "jaw_edge_density": jaw["jaw_edge_density"],
        "jaw_asymmetry": jaw["jaw_asymmetry"],
        "jaw_width_ratio": jaw["jaw_width_ratio"],
        "jaw_center_offset": jaw["jaw_center_offset"],
        "skin_pixel_ratio": skin["skin_pixel_ratio"],
        "skin_luma_mean": skin["skin_luma_mean"],
        "skin_luma_std": skin["skin_luma_std"],
        "skin_hue_std": skin["skin_hue_std"],
        "skin_chroma_std": skin["skin_chroma_std"],
        "skin_tone_flatness": skin["skin_tone_flatness"],
        "skin_green_red_ratio": skin["skin_green_red_ratio"],
        "skin_red_mean": skin["skin_red_mean"],
        "skin_green_mean": skin["skin_green_mean"],
        "skin_blue_mean": skin["skin_blue_mean"],
    }


def face_metrics(image, gray, edge_map):
    faces = detect_faces(gray)
    selected_faces = select_faces(faces, float(gray.shape[0] * gray.shape[1]))
    if len(selected_faces) == 0:
        return {
            "face_detected": False,
            "face_count": 0,
            "face_bbox": [0, 0, 0, 0],
            "face_area_ratio": 0.0,
            "face_center_x": 0.0,
            "face_center_y": 0.0,
            "face_width_ratio": 0.0,
            "face_height_ratio": 0.0,
            "face_laplacian_var": 0.0,
            "face_edge_density": 0.0,
            "face_edge_ratio": 1.0,
            "face_symmetry": 1.0,
            "face_luma_mean": 0.0,
            "face_luma_std": 0.0,
            "face_background_luma_delta": 0.0,
            "face_background_sat_delta": 0.0,
            "boundary_seam_score": 0.0,
            "eye_count": 0,
            "eye_openness_ratio": 0.0,
            "eye_highlight_asymmetry": 0.0,
            "eye_reflection_strength": 0.0,
            "mouth_edge_density": 0.0,
            "mouth_asymmetry": 0.0,
            "mouth_open_ratio": 0.0,
            "teeth_bright_ratio": 0.0,
            "teeth_uniformity": 0.0,
            "jaw_edge_density": 0.0,
            "jaw_asymmetry": 0.0,
            "jaw_width_ratio": 0.0,
            "jaw_center_offset": 0.0,
            "skin_pixel_ratio": 0.0,
            "skin_luma_mean": 0.0,
            "skin_luma_std": 0.0,
            "skin_hue_std": 0.0,
            "skin_chroma_std": 0.0,
            "skin_tone_flatness": 0.0,
            "skin_green_red_ratio": 0.0,
            "skin_red_mean": 0.0,
            "skin_green_mean": 0.0,
            "skin_blue_mean": 0.0,
            "multi_face_soft_count": 0,
            "multi_face_max_mouth_asymmetry": 0.0,
            "multi_face_max_boundary_seam": 0.0,
            "multi_face_max_eye_asymmetry": 0.0,
            "multi_face_max_luma_delta": 0.0,
        }

    per_face_metrics = [single_face_metrics(image, gray, edge_map, rect) for rect in selected_faces]
    primary = per_face_metrics[0]
    multi_face_soft_count = sum(
        1 for metrics in per_face_metrics
        if metrics["face_laplacian_var"] < 190 and metrics["face_edge_density"] < 0.10
    )

    return {
        **primary,
        "face_count": len(per_face_metrics),
        "multi_face_soft_count": int(multi_face_soft_count),
        "multi_face_max_mouth_asymmetry": float(max(metrics["mouth_asymmetry"] for metrics in per_face_metrics)),
        "multi_face_max_boundary_seam": float(max(metrics["boundary_seam_score"] for metrics in per_face_metrics)),
        "multi_face_max_eye_asymmetry": float(max(metrics["eye_highlight_asymmetry"] for metrics in per_face_metrics)),
        "multi_face_max_luma_delta": float(max(metrics["face_background_luma_delta"] for metrics in per_face_metrics)),
    }


def analyze_image(image_path):
    image = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if image is None:
        return {
            "available": False,
            "score": 0,
            "flags": [],
            "summary": "OpenCV could not decode the frame.",
            "metrics": {},
            "face_detected": False,
        }

    image = resize_if_needed(image)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    edge_map = cv2.Canny(gray, 80, 160)

    lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    edge_density = safe_edge_density(edge_map)
    luma_std = safe_std(gray)
    saturation_std = float(hsv[:, :, 1].std())
    highlight_ratio = float(np.mean(gray >= 245))
    shadow_ratio = float(np.mean(gray <= 10))
    blockiness = boundary_blockiness(gray)
    fft_metrics = fourier_artifact_metrics(gray)

    face = face_metrics(image, gray, edge_map)

    flags = []
    score = 0.0

    if face["face_detected"]:
        if face["face_area_ratio"] >= 0.06 and face["face_laplacian_var"] < 150 and face["face_edge_density"] < 0.08:
            score += 16
            flags.append("Detected face skin looks blurry or over-smoothed and lacks natural pore-level detail.")
        elif face["face_area_ratio"] >= 0.06 and face["face_laplacian_var"] < 190 and face["face_edge_density"] < 0.1:
            score += 8
            flags.append("Detected face region is softer than expected for a natural capture.")

        if face["face_area_ratio"] >= 0.3 and face["face_laplacian_var"] < 70 and face["face_edge_density"] < 0.04:
            score += 10
            flags.append("Large detected face region remains unnaturally smooth across most of the face.")

        if face["eye_count"] >= 2 and face["eye_highlight_asymmetry"] > 0.018:
            score += 10
            flags.append("Eye reflections differ unusually between both eyes, which is a common fake-image cue.")

        if face["eye_count"] >= 2 and face["eye_reflection_strength"] > 54 and face["eye_highlight_asymmetry"] > 0.012:
            score += 4

        if face["teeth_bright_ratio"] > 0.16 and face["teeth_uniformity"] > 0.68 and face["mouth_edge_density"] < 0.05:
            score += 9
            flags.append("Mouth and teeth region looks unnaturally uniform or distorted.")
        elif face["mouth_asymmetry"] > 0.12 and face["mouth_edge_density"] > 0.16:
            score += 6
            flags.append("Mouth region shows asymmetry or edge distortion consistent with expression glitches.")
        elif face["mouth_asymmetry"] > 0.14 and face["face_laplacian_var"] < 90:
            score += 5
            flags.append("Mouth region geometry looks slightly distorted relative to the rest of the face.")

        if face["jaw_asymmetry"] > 0.15 and face["jaw_width_ratio"] > 0.28:
            score += 8
            flags.append("Jawline shape looks unusually asymmetrical compared with the rest of the face.")
        elif face["jaw_asymmetry"] > 0.11 and face["jaw_width_ratio"] > 0.24:
            score += 4

        if face["jaw_width_ratio"] > 0.86 or (0.0 < face["jaw_width_ratio"] < 0.34):
            score += 5
            flags.append("Jaw area size looks unusual relative to the rest of the face.")

        if face["jaw_center_offset"] > 0.14 and face["jaw_edge_density"] > 0.05:
            score += 4
            flags.append("Jawline sits off-center in a way that looks unnatural.")

        if face["face_count"] >= 2 and face["multi_face_soft_count"] >= 2:
            score += 12
            flags.append("Multiple detected faces appear unusually smooth for a natural multi-person photo.")

        if face["face_count"] >= 2 and face["multi_face_max_mouth_asymmetry"] > 0.16:
            score += 8
            flags.append("At least one detected face shows mouth geometry that looks slightly inconsistent.")

        if face["face_count"] >= 2 and face["multi_face_max_boundary_seam"] > 0.045:
            score += 8
            flags.append("At least one detected face shows a soft boundary seam relative to nearby pixels.")

        if face["face_count"] >= 2 and face["multi_face_max_eye_asymmetry"] > 0.012:
            score += 6
            flags.append("Eye highlights differ unusually across one or more detected faces.")

        if face["face_background_luma_delta"] > 0.22 and face["face_luma_std"] < 48:
            score += 9
            flags.append("Lighting on the face does not match the surrounding scene well.")
        elif face["face_background_luma_delta"] > 0.16 and face["face_luma_std"] < 42:
            score += 5

        if face["boundary_seam_score"] > 0.12:
            score += 12
            flags.append("Boundary artifacts around the face suggest possible face-swap blending.")
        elif face["boundary_seam_score"] > 0.08:
            score += 6

        if face["face_edge_ratio"] < 0.62 and face["face_area_ratio"] >= 0.08:
            score += 8
            flags.append("Face texture is much softer than nearby regions, which can indicate synthetic blending.")

        if face["face_symmetry"] < 0.082 and face["face_area_ratio"] >= 0.08:
            score += 5
            flags.append("Face appears unusually symmetric after mirroring, which is less common in real footage.")

        if face["skin_pixel_ratio"] >= 0.08 and face["skin_tone_flatness"] > 0.80 and face["skin_chroma_std"] < 8.5:
            score += 10
            flags.append("Detected facial skin-tone variation looks unusually flat for a natural human face.")
        elif face["skin_pixel_ratio"] >= 0.08 and face["skin_tone_flatness"] > 0.72 and face["skin_chroma_std"] < 11.0:
            score += 5
            flags.append("Detected facial skin variation is flatter than expected in natural footage.")

        if face["skin_pixel_ratio"] >= 0.08 and (face["skin_green_red_ratio"] < 0.74 or face["skin_green_red_ratio"] > 1.18):
            score += 3

    if lap_var < 75 and edge_density < 0.045:
        score += 6
        flags.append("Frame lacks the natural fine detail expected in camera-captured media.")
    elif lap_var < 110 and edge_density < 0.06:
        score += 3

    if saturation_std < 16 and luma_std < 34:
        score += 4
        flags.append("Color variation is flatter than most natural captures.")

    if highlight_ratio > 0.12 and luma_std < 45:
        score += 4
        flags.append("Highlights appear unusually clipped relative to the rest of the image.")

    if highlight_ratio > 0.08 and shadow_ratio > 0.08 and luma_std < 52:
        score += 3
        flags.append("Highlights and shadows are clipped more than expected in natural footage.")

    if blockiness > 7.5:
        score += 4
        flags.append("Frame shows elevated block-boundary artifacts relative to nearby texture.")

    if fft_metrics["fft_periodic_spike_score"] > 0.26 or fft_metrics["fft_grid_artifact_score"] > 0.18:
        score += 12
        flags.append("Fourier-domain analysis found periodic frequency spikes or grid artifacts consistent with generative synthesis.")
    elif fft_metrics["fft_periodic_spike_score"] > 0.18 or fft_metrics["fft_grid_artifact_score"] > 0.12:
        score += 6
        flags.append("Fourier-domain analysis found moderate periodic structure uncommon in natural media.")

    if fft_metrics["fft_high_frequency_ratio"] > 0.82 or fft_metrics["fft_high_frequency_ratio"] < 0.34:
        score += 4
        flags.append("Frequency energy distribution is unusual for a natural camera capture.")

    score = clamp(score, 0, 58)

    if score >= 32:
        summary = "Local fallback found multiple face-level and scene-level manipulation cues."
    elif score >= 18:
        summary = "Local fallback found moderate manipulation cues that should be treated cautiously."
    else:
        summary = "Local fallback did not find strong manipulation cues."

    return {
        "available": True,
        "score": score,
        "flags": flags,
        "summary": summary,
        "metrics": {
            "laplacian_variance": round(lap_var, 2),
            "edge_density": round(edge_density, 4),
            "luma_std": round(luma_std, 2),
            "saturation_std": round(saturation_std, 2),
            "highlight_ratio": round(highlight_ratio, 4),
            "shadow_ratio": round(shadow_ratio, 4),
            "blockiness": round(blockiness, 2),
            "fft_high_frequency_ratio": round(fft_metrics["fft_high_frequency_ratio"], 4),
            "fft_low_frequency_ratio": round(fft_metrics["fft_low_frequency_ratio"], 4),
            "fft_periodic_spike_score": round(fft_metrics["fft_periodic_spike_score"], 4),
            "fft_grid_artifact_score": round(fft_metrics["fft_grid_artifact_score"], 4),
            "face_bbox": face["face_bbox"],
            "face_count": int(face["face_count"]),
            "face_area_ratio": round(face["face_area_ratio"], 4),
            "face_center_x": round(face["face_center_x"], 4),
            "face_center_y": round(face["face_center_y"], 4),
            "face_width_ratio": round(face["face_width_ratio"], 4),
            "face_height_ratio": round(face["face_height_ratio"], 4),
            "face_laplacian_variance": round(face["face_laplacian_var"], 2),
            "face_edge_density": round(face["face_edge_density"], 4),
            "face_edge_ratio": round(face["face_edge_ratio"], 4),
            "face_symmetry": round(face["face_symmetry"], 4),
            "face_luma_mean": round(face["face_luma_mean"], 2),
            "face_luma_std": round(face["face_luma_std"], 2),
            "face_background_luma_delta": round(face["face_background_luma_delta"], 4),
            "face_background_sat_delta": round(face["face_background_sat_delta"], 4),
            "boundary_seam_score": round(face["boundary_seam_score"], 4),
            "eye_count": int(face["eye_count"]),
            "eye_openness_ratio": round(face["eye_openness_ratio"], 4),
            "eye_highlight_asymmetry": round(face["eye_highlight_asymmetry"], 4),
            "eye_reflection_strength": round(face["eye_reflection_strength"], 2),
            "mouth_edge_density": round(face["mouth_edge_density"], 4),
            "mouth_asymmetry": round(face["mouth_asymmetry"], 4),
            "mouth_open_ratio": round(face["mouth_open_ratio"], 4),
            "teeth_bright_ratio": round(face["teeth_bright_ratio"], 4),
            "teeth_uniformity": round(face["teeth_uniformity"], 4),
            "jaw_edge_density": round(face["jaw_edge_density"], 4),
            "jaw_asymmetry": round(face["jaw_asymmetry"], 4),
            "jaw_width_ratio": round(face["jaw_width_ratio"], 4),
            "jaw_center_offset": round(face["jaw_center_offset"], 4),
            "skin_pixel_ratio": round(face["skin_pixel_ratio"], 4),
            "skin_luma_mean": round(face["skin_luma_mean"], 2),
            "skin_luma_std": round(face["skin_luma_std"], 2),
            "skin_hue_std": round(face["skin_hue_std"], 2),
            "skin_chroma_std": round(face["skin_chroma_std"], 2),
            "skin_tone_flatness": round(face["skin_tone_flatness"], 4),
            "skin_green_red_ratio": round(face["skin_green_red_ratio"], 4),
            "skin_red_mean": round(face["skin_red_mean"], 2),
            "skin_green_mean": round(face["skin_green_mean"], 2),
            "skin_blue_mean": round(face["skin_blue_mean"], 2),
            "multi_face_soft_count": int(face["multi_face_soft_count"]),
            "multi_face_max_mouth_asymmetry": round(face["multi_face_max_mouth_asymmetry"], 4),
            "multi_face_max_boundary_seam": round(face["multi_face_max_boundary_seam"], 4),
            "multi_face_max_eye_asymmetry": round(face["multi_face_max_eye_asymmetry"], 4),
            "multi_face_max_luma_delta": round(face["multi_face_max_luma_delta"], 4),
        },
        "face_detected": face["face_detected"],
    }


if __name__ == "__main__":
    image_path = sys.argv[1] if len(sys.argv) > 1 else None
    if not image_path:
        print(json.dumps({
            "available": False,
            "score": 0,
            "flags": [],
            "summary": "No image path provided.",
            "metrics": {},
            "face_detected": False,
        }))
        sys.exit(0)

    result = analyze_image(image_path)
    print(json.dumps(result))
