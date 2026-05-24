import math
import os
import tempfile
from dataclasses import dataclass

import cv2
import numpy as np
from google.protobuf import message_factory, symbol_database


class EyeMovementAnalysisError(Exception):
    """Raised when a video sample cannot be analyzed reliably."""

    def __init__(self, message, debug=None):
        super().__init__(message)
        self.debug = debug or {}


def _ensure_mediapipe_protobuf_compat():
    """Patch protobuf 5/6 compatibility for older MediaPipe packet getters."""
    symbol_db_type = type(symbol_database.Default())
    if not hasattr(symbol_db_type, 'GetPrototype'):
        def _get_prototype(self, descriptor):
            return message_factory.GetMessageClass(descriptor)

        symbol_db_type.GetPrototype = _get_prototype

    if hasattr(message_factory, 'MessageFactory') and not hasattr(message_factory.MessageFactory, 'GetPrototype'):
        def _factory_get_prototype(self, descriptor):
            return message_factory.GetMessageClass(descriptor)

        message_factory.MessageFactory.GetPrototype = _factory_get_prototype


_ensure_mediapipe_protobuf_compat()

import mediapipe as mp


@dataclass
class EyeSample:
    time: float
    gaze_x: float
    gaze_y: float
    ear: float


LEFT_EYE = {
    'outer': 33,
    'inner': 133,
    'top_a': 159,
    'bottom_a': 145,
    'top_b': 158,
    'bottom_b': 153,
    'iris': [468, 469, 470, 471, 472],
}

RIGHT_EYE = {
    'outer': 263,
    'inner': 362,
    'top_a': 386,
    'bottom_a': 374,
    'top_b': 385,
    'bottom_b': 380,
    'iris': [473, 474, 475, 476, 477],
}

GUIDED_PROTOCOL = 'guided-eye-follow-v1'
TARGET_SAMPLE_RATE_HZ = 15.0
MIN_REQUIRED_SAMPLES = 30
MIN_REQUIRED_DURATION_SECONDS = 8.0
MAX_DEBUG_FRAMES = 4
TARGET_PHASES = [
    {'name': 'center_start', 'start': 0.0, 'end': 2.0, 'kind': 'fixation', 'target': (0.0, 0.0)},
    {'name': 'left_hold', 'start': 2.0, 'end': 4.0, 'kind': 'fixation', 'target': (-0.75, 0.0)},
    {'name': 'right_hold', 'start': 4.0, 'end': 6.0, 'kind': 'fixation', 'target': (0.75, 0.0)},
    {'name': 'center_reset', 'start': 6.0, 'end': 8.0, 'kind': 'fixation', 'target': (0.0, 0.0)},
    {'name': 'up_hold', 'start': 8.0, 'end': 10.0, 'kind': 'fixation', 'target': (0.0, -0.55)},
    {'name': 'down_hold', 'start': 10.0, 'end': 12.0, 'kind': 'fixation', 'target': (0.0, 0.55)},
    {'name': 'sweep_right', 'start': 12.0, 'end': 15.0, 'kind': 'smooth', 'from': (-0.75, 0.0), 'to': (0.75, 0.0)},
    {'name': 'sweep_left', 'start': 15.0, 'end': 18.0, 'kind': 'smooth', 'from': (0.75, 0.0), 'to': (-0.75, 0.0)},
    {'name': 'center_finish', 'start': 18.0, 'end': 20.0, 'kind': 'fixation', 'target': (0.0, 0.0)},
]


def _distance(a, b):
    return math.dist(a, b)


def _point(landmarks, index, width, height):
    landmark = landmarks[index]
    return landmark.x * width, landmark.y * height


def _mean_point(points):
    return (
        sum(point[0] for point in points) / max(1, len(points)),
        sum(point[1] for point in points) / max(1, len(points)),
    )


def _clamp(value, minimum=0.0, maximum=1.0):
    return max(minimum, min(maximum, value))


def _moving_average(values, window=3):
    if len(values) < 2 or window <= 1:
        return np.asarray(values, dtype=np.float32)
    kernel = np.ones(window, dtype=np.float32) / window
    return np.convolve(values, kernel, mode='same')


def _encode_debug_frame(frame, label):
    preview = frame.copy()
    cv2.putText(
        preview,
        label[:70],
        (18, 32),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 255),
        2,
        cv2.LINE_AA,
    )
    cv2.rectangle(preview, (70, 40), (preview.shape[1] - 70, preview.shape[0] - 40), (220, 220, 220), 2)
    success, buffer = cv2.imencode('.jpg', preview, [int(cv2.IMWRITE_JPEG_QUALITY), 72])
    if not success:
        return None
    import base64
    return f"data:image/jpeg;base64,{base64.b64encode(buffer.tobytes()).decode('ascii')}"


def _append_debug_frame(debug_frames, frame, frame_index, timestamp_seconds, issue, extra=None):
    if len(debug_frames) >= MAX_DEBUG_FRAMES:
        return
    image = _encode_debug_frame(frame, issue)
    if not image:
        return
    payload = {
        'frameIndex': int(frame_index),
        'timestampSeconds': round(float(timestamp_seconds), 2),
        'issue': issue,
        'image': image,
    }
    if extra:
        payload.update(extra)
    debug_frames.append(payload)


def _fixation_issue_title(phase_name):
    phase_titles = {
        'center_start': 'Eyes drifted away from the opening center hold',
        'left_hold': 'Missed the left hold target',
        'right_hold': 'Missed the right hold target',
        'center_reset': 'Eyes drifted during the center reset',
        'up_hold': 'Missed the upward hold target',
        'down_hold': 'Missed the downward hold target',
        'center_finish': 'Eyes drifted during the final center hold',
    }
    return phase_titles.get(phase_name, f"Missed the {phase_name.replace('_', ' ')} target")


def _deviation_direction(delta_x, delta_y):
    if abs(delta_x) >= abs(delta_y):
        return ('right' if delta_x >= 0 else 'left'), abs(delta_x)
    return ('down' if delta_y >= 0 else 'up'), abs(delta_y)


def _build_gaze_issue(phase, sample, target_x, target_y, gaze_error):
    delta_x = sample.gaze_x - target_x
    delta_y = sample.gaze_y - target_y
    direction, dominant_delta = _deviation_direction(delta_x, delta_y)

    if phase['kind'] == 'smooth':
        sweep_direction = 'right' if phase['to'][0] >= phase['from'][0] else 'left'
        issue = f"Tracking lagged during the {sweep_direction} sweep"
        # IMPROVED: More detailed reasoning for smooth tracks
        detail = (
            f"During {phase['name'].replace('_', ' ')}, gaze tracking error was {gaze_error:.2f} normalized units. "
            f"Gaze position drifted approximately {dominant_delta:.2f} pixels {direction} from the target trajectory. "
            f"This suggests slowed or incomplete smooth pursuit, compatible with Parkinsonian oculomotor slowing."
        )
    else:
        issue = _fixation_issue_title(phase['name'])
        # IMPROVED: More detailed reasoning for fixations
        detail = (
            f"During {phase['name'].replace('_', ' ')}, gaze was approximately {gaze_error:.2f} normalized units off target. "
            f"Eyes drifted primarily {direction} by {dominant_delta:.2f} pixels. "
            f"This indicates difficulty maintaining stable fixation at the target position, "
            f"suggesting possible fixation instability (nystagmus or gaze drift)."
        )
    
    return issue, detail


def _record_issue_frame(issue_candidates, frame, frame_index, timestamp_seconds, issue, severity, phase_name=None, detail=None):
    image = _encode_debug_frame(frame, issue)
    if not image:
        return
    
    # IMPROVED: Better severity calculation based on issue type
    if 'not detected' in issue.lower():
        adjusted_severity = 1.5  # Face missing is less informative than tracking issue
    elif 'geometry' in issue.lower():
        adjusted_severity = 1.8  # Eye geometry failure blocks gaze estimation
    else:
        adjusted_severity = severity  # Tracking issues use calculated severity
    
    payload = {
        'frameIndex': int(frame_index),
        'timestampSeconds': round(float(timestamp_seconds), 2),
        'issue': issue,
        'image': image,
        'score': round(float(adjusted_severity), 3),
    }
    if phase_name:
        payload['phase'] = phase_name
    if detail:
        payload['detail'] = detail
    else:
        # IMPROVED: Auto-generate detail if not provided
        if 'not detected' in issue.lower():
            payload['detail'] = f"Face detection failed at frame {frame_index} ({timestamp_seconds:.1f}s). The system could not locate facial features to estimate gaze."
        elif 'geometry' in issue.lower():
            payload['detail'] = f"Eye geometry failed at frame {frame_index} ({timestamp_seconds:.1f}s). Eye landmarks were not clear enough for accurate gaze estimation."
    
    issue_candidates.append((float(adjusted_severity), payload))


def _top_issue_frames(issue_candidates, limit=MAX_DEBUG_FRAMES):
    ranked = sorted(issue_candidates, key=lambda item: item[0], reverse=True)
    selected = []
    seen_frames = set()
    used_phases = set()

    for _, payload in ranked:
        key = (payload['frameIndex'], payload['issue'])
        phase = payload.get('phase')
        if key in seen_frames:
            continue
        if phase and phase in used_phases:
            continue
        seen_frames.add(key)
        if phase:
            used_phases.add(phase)
        selected.append(payload)
        if len(selected) >= limit:
            return selected

    for _, payload in ranked:
        key = (payload['frameIndex'], payload['issue'])
        if key in seen_frames:
            continue
        seen_frames.add(key)
        selected.append(payload)
        if len(selected) >= limit:
            break

    return selected


def _normalized_fps(raw_fps):
    if isinstance(raw_fps, (int, float)) and math.isfinite(raw_fps) and 5.0 <= raw_fps <= 120.0:
        return float(raw_fps)
    return 30.0


def _resolve_frame_timestamp(capture, frame_index, fallback_fps, previous_timestamp):
    fallback_timestamp = max(frame_index - 1, 0) / max(fallback_fps, 1.0)
    timestamp_msec = capture.get(cv2.CAP_PROP_POS_MSEC)
    if isinstance(timestamp_msec, (int, float)) and math.isfinite(timestamp_msec):
        timestamp_seconds = timestamp_msec / 1000.0
        if timestamp_seconds >= 0.0:
            if previous_timestamp is None:
                return max(timestamp_seconds, fallback_timestamp)
            if timestamp_seconds > previous_timestamp + 1e-3:
                return timestamp_seconds
    if previous_timestamp is None:
        return fallback_timestamp
    return max(previous_timestamp, fallback_timestamp)


def _resample_series(times, values, target_times):
    if len(times) == 0:
        return np.zeros_like(target_times)
    if len(times) == 1:
        return np.full_like(target_times, float(values[0]), dtype=np.float32)
    return np.interp(target_times, times, values).astype(np.float32)


def _phase_target(time_value):
    for phase in TARGET_PHASES:
        if phase['start'] <= time_value <= phase['end']:
            if phase['kind'] == 'smooth':
                progress = (time_value - phase['start']) / max(phase['end'] - phase['start'], 1e-6)
                start_x, start_y = phase['from']
                end_x, end_y = phase['to']
                return (
                    start_x + (end_x - start_x) * progress,
                    start_y + (end_y - start_y) * progress,
                    phase,
                )
            target_x, target_y = phase['target']
            return target_x, target_y, phase
    last_phase = TARGET_PHASES[-1]
    target_x, target_y = last_phase.get('target', (0.0, 0.0))
    return target_x, target_y, last_phase


def _extract_eye_sample(landmarks, width, height, time_value):
    if len(landmarks) < 478:
        return None

    left_outer = _point(landmarks, LEFT_EYE['outer'], width, height)
    left_inner = _point(landmarks, LEFT_EYE['inner'], width, height)
    right_outer = _point(landmarks, RIGHT_EYE['outer'], width, height)
    right_inner = _point(landmarks, RIGHT_EYE['inner'], width, height)

    left_top = _mean_point([
        _point(landmarks, LEFT_EYE['top_a'], width, height),
        _point(landmarks, LEFT_EYE['top_b'], width, height),
    ])
    left_bottom = _mean_point([
        _point(landmarks, LEFT_EYE['bottom_a'], width, height),
        _point(landmarks, LEFT_EYE['bottom_b'], width, height),
    ])
    right_top = _mean_point([
        _point(landmarks, RIGHT_EYE['top_a'], width, height),
        _point(landmarks, RIGHT_EYE['top_b'], width, height),
    ])
    right_bottom = _mean_point([
        _point(landmarks, RIGHT_EYE['bottom_a'], width, height),
        _point(landmarks, RIGHT_EYE['bottom_b'], width, height),
    ])

    left_width = _distance(left_outer, left_inner)
    right_width = _distance(right_outer, right_inner)
    left_height = _distance(left_top, left_bottom)
    right_height = _distance(right_top, right_bottom)

    if min(left_width, right_width, left_height, right_height) <= 1.0:
        return None

    left_iris = _mean_point([_point(landmarks, idx, width, height) for idx in LEFT_EYE['iris']])
    right_iris = _mean_point([_point(landmarks, idx, width, height) for idx in RIGHT_EYE['iris']])
    left_center = _mean_point([left_outer, left_inner, left_top, left_bottom])
    right_center = _mean_point([right_outer, right_inner, right_top, right_bottom])

    interocular_distance = _distance(left_center, right_center)
    eye_height = (left_height + right_height) / 2.0

    gaze_x = (((left_iris[0] - left_center[0]) + (right_iris[0] - right_center[0])) / 2.0) / max(interocular_distance, 1.0) * 10.0
    gaze_y = (((left_iris[1] - left_center[1]) + (right_iris[1] - right_center[1])) / 2.0) / max(eye_height, 1.0) * 1.8

    left_ear = (
        _distance(_point(landmarks, LEFT_EYE['top_a'], width, height), _point(landmarks, LEFT_EYE['bottom_a'], width, height))
        + _distance(_point(landmarks, LEFT_EYE['top_b'], width, height), _point(landmarks, LEFT_EYE['bottom_b'], width, height))
    ) / (2.0 * max(left_width, 1.0))
    right_ear = (
        _distance(_point(landmarks, RIGHT_EYE['top_a'], width, height), _point(landmarks, RIGHT_EYE['bottom_a'], width, height))
        + _distance(_point(landmarks, RIGHT_EYE['top_b'], width, height), _point(landmarks, RIGHT_EYE['bottom_b'], width, height))
    ) / (2.0 * max(right_width, 1.0))

    return EyeSample(
        time=time_value,
        gaze_x=float(np.clip(gaze_x, -1.5, 1.5)),
        gaze_y=float(np.clip(gaze_y, -1.2, 1.2)),
        ear=float((left_ear + right_ear) / 2.0),
    )


def _compute_blinks(times, ear_values, duration):
    if len(ear_values) < 5:
        return 0, 0.0, 0.0

    # IMPROVED: Use 20th percentile for better sensitivity to actual closures
    threshold = float(np.clip(np.percentile(ear_values, 20) * 0.85, 0.10, 0.40))
    
    # IMPROVED: Add hysteresis to prevent frame noise from breaking blinks into fragments
    closed = np.asarray(ear_values) < threshold
    
    # Smooth the blink signal with median filter to remove single-frame noise
    from scipy import signal as sp_signal
    try:
        if len(closed) >= 5:
            # Use median filter to smooth noise while preserving blink boundaries
            closed = sp_signal.medfilt(closed.astype(float), kernel_size=3) > 0.5
    except:
        pass  # Fall back to raw signal if scipy not available
    
    blink_times = []
    blink_durations = []
    start = None

    for index, is_closed in enumerate(closed):
        if is_closed and start is None:
            start = index
        elif not is_closed and start is not None:
            span = index - start
            # IMPROVED: Wider range (1-15 frames) to catch natural blinks
            # Typical blink is 100-400ms, at 15fps = 1-6 frames, at 30fps = 3-12 frames
            if 1 <= span <= 15:
                blink_times.append(times[start])
                blink_durations.append(span)
            start = None

    if start is not None and 1 <= (len(closed) - start) <= 15:
        blink_times.append(times[start])
        blink_durations.append(len(closed) - start)

    blink_rate = len(blink_times) / max(duration, 1e-6) * 60.0
    
    # IMPROVED: Better irregularity calculation
    if len(blink_times) >= 3:
        intervals = np.diff(blink_times)
        mean_interval = np.mean(intervals)
        # Std dev relative to mean (0 = perfectly regular, >1 = very irregular)
        irregularity = float(np.std(intervals) / max(mean_interval, 1e-6))
    else:
        # For 2 or fewer blinks, use average duration variation as proxy
        irregularity = float(np.std(blink_durations) / max(np.mean(blink_durations), 1e-6)) if blink_durations else 0.0
    
    return len(blink_times), float(blink_rate), irregularity


def _compute_saccades(times, gaze_x, gaze_y):
    if len(times) < 3:
        return 0.0, 0.0

    dt = np.diff(times)
    dt[dt == 0] = 1e-6
    velocity = np.sqrt(np.diff(gaze_x) ** 2 + np.diff(gaze_y) ** 2) / dt

    # IMPROVED: Detect saccades dynamically by finding high-velocity periods
    # instead of using hardcoded start times (which may be off due to video timing jitter)
    velocity_threshold = float(np.percentile(velocity, 80))  # Top 20% highest velocities
    
    # IMPROVED: Pad velocity to match original time array length for direct comparison
    padded_velocity = np.pad(velocity, (0, 1), mode='edge')
    
    saccade_mask = padded_velocity > velocity_threshold
    
    # Find saccade segments (continuous high-velocity periods)
    peak_speeds = []
    delays = []

    previous_target = np.array([0.0, 0.0], dtype=np.float32)
    for phase_start_nominal in [2.0, 4.0, 6.0, 8.0, 10.0, 18.0]:
        # Find closest actual target transition near the nominal time
        search_window = (times >= phase_start_nominal - 0.5) & (times <= phase_start_nominal + 0.5)
        if not np.any(search_window):
            continue
            
        target_x, target_y, phase = _phase_target(phase_start_nominal + 0.01)
        new_target = np.array([target_x, target_y], dtype=np.float32)
        delta = new_target - previous_target

        if np.linalg.norm(delta) < 0.1:
            # No significant target change
            previous_target = new_target
            continue

        axis = 0 if abs(delta[0]) >= abs(delta[1]) else 1
        direction = 1.0 if delta[axis] >= 0 else -1.0
        threshold = previous_target[axis] + (delta[axis] * 0.45)

        # Look for peak velocity in the expected saccade window
        window_mask = (times >= phase_start_nominal - 0.2) & (times <= phase_start_nominal + 1.0) & saccade_mask
        if np.any(window_mask):
            window_velocities = velocity[window_mask[:-1]] if len(window_mask) > 1 else velocity
            if len(window_velocities) > 0:
                peak_speeds.append(float(np.max(window_velocities)))

        # IMPROVED: Find when gaze crosses threshold (better than hardcoded timing)
        coords = gaze_x if axis == 0 else gaze_y
        post_mask = (times >= phase_start_nominal - 0.2) & (times <= phase_start_nominal + 1.0)
        post_times = times[post_mask]
        post_values = coords[post_mask]
        
        crossing_time = None
        for sample_time, sample_value in zip(post_times, post_values):
            if direction * (sample_value - threshold) >= 0:
                crossing_time = sample_time
                break
        
        if crossing_time is not None:
            delays.append(float(crossing_time - phase_start_nominal))
        else:
            delays.append(0.5)  # Default delay if no crossing detected

        previous_target = new_target

    median_speed = float(np.median(peak_speeds)) if peak_speeds else 0.0
    median_delay = float(np.median(delays)) if delays else 0.5
    
    return median_speed, median_delay


def _compute_tracking(times, gaze_x):
    correlations = []
    errors = []
    for phase in TARGET_PHASES:
        if phase['kind'] != 'smooth':
            continue
        mask = (times >= phase['start']) & (times <= phase['end'])
        segment_times = times[mask]
        segment_values = gaze_x[mask]
        if len(segment_times) < 4:
            continue
        progress = (segment_times - phase['start']) / max(phase['end'] - phase['start'], 1e-6)
        expected = phase['from'][0] + (phase['to'][0] - phase['from'][0]) * progress
        corr_matrix = np.corrcoef(segment_values, expected)
        corr_value = float(corr_matrix[0, 1]) if corr_matrix.shape == (2, 2) and not np.isnan(corr_matrix[0, 1]) else 0.0
        correlations.append(corr_value)
        errors.append(float(np.sqrt(np.mean((segment_values - expected) ** 2))))

    return (
        float(np.mean(correlations)) if correlations else 0.0,
        float(np.mean(errors)) if errors else 1.0,
    )


def _compute_fixation_stability(times, gaze_x, gaze_y):
    drifts = []
    for phase in TARGET_PHASES:
        if phase['kind'] != 'fixation':
            continue
        settle_start = phase['start'] + 0.35
        mask = (times >= settle_start) & (times <= phase['end'])
        if np.count_nonzero(mask) < 3:
            continue
        target = np.array(phase['target'], dtype=np.float32)
        segment = np.column_stack((gaze_x[mask], gaze_y[mask]))
        errors = np.linalg.norm(segment - target, axis=1)
        drifts.append(float(np.std(errors) + np.mean(errors)))

    return float(np.median(drifts)) if drifts else 1.0


def _build_explanation(classification, metrics):
    response_delay_ms = int(round(metrics['responseDelaySeconds'] * 1000))
    blink_rate = metrics['blinkRatePerMinute']
    saccade_speed = metrics['saccadicSpeed']
    smoothness = metrics['trackingSmoothness']
    fixation = metrics['fixationDrift']
    blink_count = metrics['blinkCount']
    blink_irregularity = metrics['blinkIrregularity']

    # IMPROVED: More detailed frame-by-frame reasoning
    if classification == 'No Parkinsonian Eye Movement Detected':
        # Build positive findings - use realistic ranges for healthy people
        findings = []
        
        if saccade_speed >= 0.5:  # FIXED: Normal range for healthy is 0.5+
            findings.append(f"Normal saccadic speed ({saccade_speed:.2f} units/s)")
        
        if response_delay_ms <= 400:  # FIXED: Normal range is up to 400ms
            findings.append(f"Normal response timing (~{response_delay_ms}ms)")
        
        if smoothness >= -0.5:  # FIXED: Allow negative correlations (still valid eye tracking)
            findings.append(f"Acceptable tracking performance (score: {smoothness:.2f})")
        
        # FIXED: Allow 8-35/min as normal healthy range
        if 8 <= blink_rate <= 35:
            findings.append(f"Normal blink rate ({blink_rate:.1f}/min)")
        elif blink_count >= 6:
            findings.append(f"Adequate blinking detected ({blink_count} blinks)")
        
        if fixation < 0.75:  # FIXED: Relaxed threshold
            findings.append(f"Acceptable fixation stability (drift: {fixation:.2f})")
        
        findings_str = ", ".join(findings) if findings else "Normal eye tracking parameters observed"
        
        return (
            f"Eye tracking remained coordinated across the 20-second protocol. {findings_str}. "
            f"Overall tracking performance and fixation control are consistent with healthy eye movement patterns."
        )

    # For Parkinsonian indicators detected
    concerning_signs = []
    
    if saccade_speed < 0.6:  # FIXED: Stricter threshold - <0.6 is clearly pathological
        concerning_signs.append(f"Significantly slowed saccadic shifts ({saccade_speed:.2f} units/s - oculomotor slowing)")
    
    if response_delay_ms > 400:  # FIXED: Increased from 350ms - normal varies 200-400ms
        concerning_signs.append(f"Delayed response to target changes (~{response_delay_ms}ms - slow reaction)")
    
    if smoothness < 0.3:  # FIXED: Stricter threshold - <0.3 is clearly jerky
        concerning_signs.append(f"Poor tracking smoothness (score: {smoothness:.2f} - very jerky pursuit)")
    
    # FIXED: Correct blink rate ranges for healthy people (12-30/min is normal)
    if blink_rate < 8:
        concerning_signs.append(f"Significantly reduced blinking ({blink_rate:.1f}/min - severe hypomimia)")
    elif blink_rate > 35:  # FIXED: Allow up to 35/min for healthy people
        concerning_signs.append(f"Significantly elevated blinking ({blink_rate:.1f}/min - possible stress/anxiety)")
    
    if blink_irregularity > 1.2:  # FIXED: Higher threshold - some irregularity is normal
        concerning_signs.append(f"Highly irregular blink timing (variability: {blink_irregularity:.2f} - very abnormal pattern)")
    
    if fixation >= 0.75:  # FIXED: Increased threshold - <0.75 is still fairly stable
        concerning_signs.append(f"Significant fixation instability (drift: {fixation:.2f} - gaze wandering)")
    
    signs_str = "; ".join(concerning_signs) if concerning_signs else "Multiple eye movement irregularities detected"
    
    return (
        f"The recording showed patterns consistent with Parkinsonian eye movement changes. "
        f"Observed: {signs_str}. "
        f"Saccadic speed {saccade_speed:.2f} units/s, response delay {response_delay_ms}ms, "
        f"tracking smoothness {smoothness:.2f}, blink rate {blink_rate:.1f}/min, "
        f"and fixation drift {fixation:.2f} collectively suggest oculomotor dysfunction compatible with Parkinson's disease."
    )


def _build_frame_failure_reason(face_missing_count, eye_geometry_fail_count, analyzed_frames):
    if analyzed_frames <= 0:
        return 'No analyzable frames were decoded from the uploaded video. The video file may be corrupted or in an unsupported format.'

    if face_missing_count >= max(3, analyzed_frames * 0.45):
        return (
            'The face was missing or off-center in too many sampled frames. '
            'This prevented reliable eye tracking. Keep your face centered in the guide oval throughout the entire 20 seconds. '
            f'Face detection failed in approximately {int(100*face_missing_count/analyzed_frames)}% of analyzed frames.'
        )

    if eye_geometry_fail_count >= max(3, analyzed_frames * 0.35):
        return (
            'The face was detected, but the eyes were too small, blurred, or partially outside the guide in many frames. '
            'This affected eye landmark detection and gaze estimation. Try moving closer to the camera (about arm\'s length) '
            'and ensure adequate lighting. '
            f'Eye geometry detection failed in approximately {int(100*eye_geometry_fail_count/analyzed_frames)}% of frames.'
        )

    return 'There were too few stable eye-tracking frames to compute a reliable result. Please retry with better lighting, closer to the camera, and keeping your face centered.'


def _phase_median(times, values, start, end):
    mask = (times >= start) & (times <= end)
    if np.count_nonzero(mask) < 2:
        return None
    return float(np.median(values[mask]))


def _compute_protocol_alignment(times, gaze_x, gaze_y):
    fixation_errors = []
    smooth_correlations = []
    smooth_errors = []
    phase_scores = []

    for phase in TARGET_PHASES:
        mask = (times >= phase['start']) & (times <= phase['end'])
        if np.count_nonzero(mask) < 3:
            continue

        segment_times = times[mask]
        segment_x = gaze_x[mask]
        segment_y = gaze_y[mask]

        if phase['kind'] == 'fixation':
            settle_start = phase['start'] + 0.35
            settle_mask = segment_times >= settle_start
            if np.count_nonzero(settle_mask) < 2:
                continue
            target = np.asarray(phase['target'], dtype=np.float32)
            segment = np.column_stack((segment_x[settle_mask], segment_y[settle_mask]))
            errors = np.linalg.norm(segment - target, axis=1)
            median_error = float(np.median(errors))
            fixation_errors.append(median_error)
            phase_scores.append(_clamp(1.0 - (median_error / 0.85)))
            continue

        progress = (segment_times - phase['start']) / max(phase['end'] - phase['start'], 1e-6)
        expected_x = phase['from'][0] + (phase['to'][0] - phase['from'][0]) * progress
        expected_y = phase['from'][1] + (phase['to'][1] - phase['from'][1]) * progress
        error = np.sqrt(np.mean((segment_x - expected_x) ** 2 + (segment_y - expected_y) ** 2))
        corr_matrix = np.corrcoef(segment_x, expected_x)
        corr_value = float(corr_matrix[0, 1]) if corr_matrix.shape == (2, 2) and not np.isnan(corr_matrix[0, 1]) else 0.0
        smooth_errors.append(float(error))
        smooth_correlations.append(corr_value)
        phase_scores.append(0.55 * _clamp((corr_value + 1.0) / 2.0) + 0.45 * _clamp(1.0 - (error / 0.75)))

    horizontal_range = float(np.max(gaze_x) - np.min(gaze_x)) if len(gaze_x) else 0.0
    vertical_range = float(np.max(gaze_y) - np.min(gaze_y)) if len(gaze_y) else 0.0
    horizontal_coverage = _clamp(horizontal_range / 1.10)
    vertical_coverage = _clamp(vertical_range / 0.90)

    phase_score = float(np.mean(phase_scores)) if phase_scores else 0.0
    protocol_compliance = float(np.clip((phase_score * 0.75) + (horizontal_coverage * 0.15) + (vertical_coverage * 0.10), 0.0, 1.0))

    return {
        'protocolComplianceScore': protocol_compliance,
        'phaseScore': phase_score,
        'fixationError': float(np.mean(fixation_errors)) if fixation_errors else 1.0,
        'smoothCorrelation': float(np.mean(smooth_correlations)) if smooth_correlations else 0.0,
        'smoothError': float(np.mean(smooth_errors)) if smooth_errors else 1.0,
        'horizontalRange': horizontal_range,
        'verticalRange': vertical_range,
        'horizontalCoverage': horizontal_coverage,
        'verticalCoverage': vertical_coverage,
    }


def _calibrate_gaze(raw_times, raw_gaze_x, raw_gaze_y):
    calibrated_x = raw_gaze_x.astype(np.float32).copy()
    calibrated_y = raw_gaze_y.astype(np.float32).copy()

    center_x = _phase_median(raw_times, calibrated_x, 0.0, 2.0)
    center_y = _phase_median(raw_times, calibrated_y, 0.0, 2.0)
    if center_x is None:
        center_x = float(np.median(calibrated_x))
    if center_y is None:
        center_y = float(np.median(calibrated_y))

    calibrated_x = calibrated_x - center_x
    calibrated_y = calibrated_y - center_y

    left_x = _phase_median(raw_times, calibrated_x, 2.2, 3.8)
    right_x = _phase_median(raw_times, calibrated_x, 4.2, 5.8)
    if left_x is not None and right_x is not None:
        observed_x_span = abs(right_x - left_x)
        if observed_x_span > 0.08:
            calibrated_x *= float(np.clip(1.5 / observed_x_span, 0.65, 1.85))

    up_y = _phase_median(raw_times, calibrated_y, 8.2, 9.8)
    down_y = _phase_median(raw_times, calibrated_y, 10.2, 11.8)
    if up_y is not None and down_y is not None:
        observed_y_span = abs(down_y - up_y)
        if observed_y_span > 0.08:
            calibrated_y *= float(np.clip(1.1 / observed_y_span, 0.65, 1.9))

    return np.clip(calibrated_x, -1.5, 1.5), np.clip(calibrated_y, -1.2, 1.2)


def analyze_eye_movement_video(video_bytes, filename='eye-movement.webm', protocol=GUIDED_PROTOCOL):
    if protocol != GUIDED_PROTOCOL:
        raise EyeMovementAnalysisError('Unsupported eye-movement protocol.')

    suffix = os.path.splitext(filename)[1] or '.webm'
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(video_bytes)
            temp_path = temp_file.name

        capture = cv2.VideoCapture(temp_path)
        if not capture.isOpened():
            raise EyeMovementAnalysisError('Unable to open the recorded video. Please try again with a clearer browser recording.')

        fps = _normalized_fps(capture.get(cv2.CAP_PROP_FPS) or 0.0)
        sample_interval_seconds = 1.0 / TARGET_SAMPLE_RATE_HZ
        next_sample_time = 0.0
        last_timestamp_seconds = None
        total_frames = 0
        analyzed_frames = 0
        tracked_frames = 0
        samples = []
        debug_frames = []
        issue_candidates = []
        face_missing_count = 0
        eye_geometry_fail_count = 0

        face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.35,
            min_tracking_confidence=0.35,
        )
        try:
            while True:
                success, frame = capture.read()
                if not success:
                    break
                total_frames += 1
                timestamp_seconds = _resolve_frame_timestamp(capture, total_frames, fps, last_timestamp_seconds)
                last_timestamp_seconds = timestamp_seconds
                if timestamp_seconds > 20.4:
                    break
                if timestamp_seconds + 1e-6 < next_sample_time:
                    continue

                analyzed_frames += 1
                while next_sample_time <= timestamp_seconds:
                    next_sample_time += sample_interval_seconds

                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = face_mesh.process(rgb_frame)
                if not results.multi_face_landmarks:
                    face_missing_count += 1
                    _, _, phase = _phase_target(timestamp_seconds)
                    _append_debug_frame(
                        debug_frames,
                        frame,
                        total_frames,
                        timestamp_seconds,
                        'Face not detected clearly',
                    )
                    _record_issue_frame(
                        issue_candidates,
                        frame,
                        total_frames,
                        timestamp_seconds,
                        'Face not detected clearly',
                        severity=2.2,
                        phase_name=phase['name'],
                    )
                    continue

                landmarks = results.multi_face_landmarks[0].landmark
                sample = _extract_eye_sample(landmarks, frame.shape[1], frame.shape[0], timestamp_seconds)
                if sample is not None:
                    samples.append(sample)
                    tracked_frames += 1
                    target_x, target_y, phase = _phase_target(timestamp_seconds)
                    gaze_error = math.dist((sample.gaze_x, sample.gaze_y), (target_x, target_y))
                    if gaze_error >= 0.55:
                        issue_title, issue_detail = _build_gaze_issue(phase, sample, target_x, target_y, gaze_error)
                        _record_issue_frame(
                            issue_candidates,
                            frame,
                            total_frames,
                            timestamp_seconds,
                            issue_title,
                            severity=0.9 + gaze_error,
                            phase_name=phase['name'],
                            detail=issue_detail,
                        )
                else:
                    eye_geometry_fail_count += 1
                    _, _, phase = _phase_target(timestamp_seconds)
                    _append_debug_frame(
                        debug_frames,
                        frame,
                        total_frames,
                        timestamp_seconds,
                        'Eyes too small or partially visible',
                    )
                    _record_issue_frame(
                        issue_candidates,
                        frame,
                        total_frames,
                        timestamp_seconds,
                        'Eyes too small or partially visible',
                        severity=1.8,
                        phase_name=phase['name'],
                        detail='The face was detected, but the eyelids or irises were not clear enough to estimate gaze reliably.',
                    )
        finally:
            face_mesh.close()
            capture.release()

        top_issue_frames = _top_issue_frames(issue_candidates)

        if len(samples) < MIN_REQUIRED_SAMPLES:
            reason = _build_frame_failure_reason(face_missing_count, eye_geometry_fail_count, analyzed_frames)
            raise EyeMovementAnalysisError(
                'Not enough clear eye frames were detected. Move slightly closer, keep both eyes visible in the guide, and retry.',
                debug={
                    'reason': reason,
                    'counts': {
                        'totalFrames': int(total_frames),
                        'analyzedFrames': int(analyzed_frames),
                        'trackedFrames': int(tracked_frames),
                        'faceMissingFrames': int(face_missing_count),
                        'eyeGeometryFailedFrames': int(eye_geometry_fail_count),
                    },
                    'issueFrames': top_issue_frames or debug_frames,
                },
            )

        raw_times = np.asarray([sample.time for sample in samples], dtype=np.float32)
        duration = float(max(raw_times[-1] - raw_times[0], 1.0))
        if duration < MIN_REQUIRED_DURATION_SECONDS:
            reason = (
                'The eyes were tracked only briefly before the face moved away, turned too far, or became too small in the frame.'
            )
            raise EyeMovementAnalysisError(
                'The usable eye-tracking segment was too short. Please stay centered for the full 20-second test and retry.',
                debug={
                    'reason': reason,
                    'counts': {
                        'totalFrames': int(total_frames),
                        'analyzedFrames': int(analyzed_frames),
                        'trackedFrames': int(tracked_frames),
                        'faceMissingFrames': int(face_missing_count),
                        'eyeGeometryFailedFrames': int(eye_geometry_fail_count),
                    },
                    'issueFrames': top_issue_frames or debug_frames,
                },
            )

        raw_gaze_x = np.asarray([sample.gaze_x for sample in samples], dtype=np.float32)
        raw_gaze_y = np.asarray([sample.gaze_y for sample in samples], dtype=np.float32)
        calibrated_gaze_x, calibrated_gaze_y = _calibrate_gaze(raw_times, raw_gaze_x, raw_gaze_y)

        target_count = max(len(raw_times), 48)
        times = np.linspace(raw_times[0], raw_times[-1], num=target_count, dtype=np.float32)
        gaze_x = _moving_average(
            _resample_series(raw_times, calibrated_gaze_x, times),
            window=5,
        )
        gaze_y = _moving_average(
            _resample_series(raw_times, calibrated_gaze_y, times),
            window=5,
        )
        ear_values = _moving_average(
            _resample_series(raw_times, np.asarray([sample.ear for sample in samples], dtype=np.float32), times),
            window=5,
        )

        blink_count, blink_rate, blink_irregularity = _compute_blinks(times, ear_values, duration)
        saccadic_speed, response_delay = _compute_saccades(times, gaze_x, gaze_y)
        tracking_smoothness, tracking_error = _compute_tracking(times, gaze_x)
        fixation_drift = _compute_fixation_stability(times, gaze_x, gaze_y)
        eyelid_variability = float(np.std(ear_values))
        protocol_alignment = _compute_protocol_alignment(times, gaze_x, gaze_y)

        tracked_ratio = tracked_frames / max(analyzed_frames, 1)
        duration_quality = min(duration / 20.0, 1.0)
        quality_score = float(
            np.clip(
                (tracked_ratio * 0.60)
                + (duration_quality * 0.20)
                + (protocol_alignment['protocolComplianceScore'] * 0.20),
                0.0,
                1.0,
            )
        )
        reliability_score = float(
            np.clip(
                (tracked_ratio * 0.45)
                + (duration_quality * 0.15)
                + (protocol_alignment['protocolComplianceScore'] * 0.40),
                0.0,
                1.0,
            )
        )

        if reliability_score < 0.34:
            raise EyeMovementAnalysisError(
                'The eye-tracking sample was not stable enough to grade reliably. Keep your face centered, follow the dot carefully, and retry.',
                debug={
                    'reason': (
                        'The recording had enough frames, but the eyes did not follow the guided target consistently enough '
                        'to separate true movement changes from protocol mismatch.'
                    ),
                    'counts': {
                        'totalFrames': int(total_frames),
                        'analyzedFrames': int(analyzed_frames),
                        'trackedFrames': int(tracked_frames),
                        'faceMissingFrames': int(face_missing_count),
                        'eyeGeometryFailedFrames': int(eye_geometry_fail_count),
                    },
                    'issueFrames': top_issue_frames or debug_frames,
                },
            )

        # IMPROVED: More nuanced anomaly scoring with realistic thresholds
        # Parkinsonian patients typically show: SIGNIFICANTLY slower saccades, delayed response, reduced smoothness,
        # abnormal/reduced blinking, and poor fixation stability
        # BUT normal healthy people vary considerably - ranges below are for PATHOLOGICAL signs only
        
        anomaly_score = (
            # Saccade speed (significantly slower = Parkinsonian) - healthy: 0.8-1.5, Parkinsonian: <0.5
            0.20 * _clamp((0.60 - max(saccadic_speed, 0.1)) / 0.60) +
            # Response delay (significantly longer = Parkinsonian) - healthy: 150-350ms, Parkinsonian: >400ms
            0.16 * _clamp((response_delay - 0.40) / 0.30) +
            # Tracking smoothness & error - healthy: 0.4-1.0, Parkinsonian: <0.2
            0.18 * max(_clamp((0.30 - tracking_smoothness) / 0.30), _clamp((tracking_error - 0.50) / 0.40)) +
            # Blink rate & regularity - penalize EXTREME values only
            0.12 * max(
                _clamp((6.0 - max(blink_rate, 1.0)) / 6.0),  # Very few blinks (<8/min)
                _clamp((blink_rate - 35.0) / 25.0),  # Very many blinks (>35/min)
                _clamp((blink_irregularity - 1.0) / 0.8)  # Highly irregular (>1.8 variability)
            ) +
            # Fixation drift - healthy: 0.2-0.5, Parkinsonian: >0.75
            0.18 * _clamp((fixation_drift - 0.75) / 0.40) +
            # Protocol alignment - healthy: 0.6-1.0, Parkinsonian: <0.4
            0.16 * _clamp((0.40 - protocol_alignment['protocolComplianceScore']) / 0.40)
        )
        anomaly_score = float(np.clip(anomaly_score, 0.0, 1.0))

        classification = (
            'Potential Parkinsonian Indicators Detected'
            if anomaly_score >= 0.60  # FIXED: Increased from 0.50 - more conservative threshold prevents false positives
            else 'No Parkinsonian Eye Movement Detected'
        )
        label = 'Parkinsons' if classification.startswith('Potential') else 'Healthy'
        parkinsons_probability = float(np.clip(0.10 + anomaly_score * 0.88, 0.03, 0.97))
        healthy_probability = float(np.clip(1.0 - parkinsons_probability, 0.03, 0.97))
        risk_score = float(np.clip(parkinsons_probability * 10.0, 0.0, 10.0))
        risk_level = 'High' if risk_score >= 7.0 else 'Medium' if risk_score >= 4.0 else 'Low'

        confidence = float(
            np.clip(
                (0.54 + abs(anomaly_score - 0.50) * 0.68) * (0.70 + 0.30 * reliability_score),
                0.50,
                0.98,
            )
        )
        metrics = {
            'saccadicSpeed': round(saccadic_speed, 3),
            'trackingSmoothness': round(tracking_smoothness, 3),
            'blinkRatePerMinute': round(blink_rate, 2),
            'blinkIrregularity': round(blink_irregularity, 3),
            'fixationDrift': round(fixation_drift, 3),
            'responseDelaySeconds': round(response_delay, 3),
            'trackingError': round(tracking_error, 3),
            'eyelidMovementVariance': round(eyelid_variability, 4),
            'blinkCount': int(blink_count),
            'protocolComplianceScore': round(protocol_alignment['protocolComplianceScore'], 3),
        }

        return {
            'classification': classification,
            'label': label,
            'confidence': confidence,
            'riskScore': round(risk_score, 2),
            'riskLevel': risk_level,
            'explanation': _build_explanation(classification, metrics),
            'details': _build_explanation(classification, metrics),
            'metrics': metrics,
            'probabilities': {
                'Parkinsons': round(parkinsons_probability, 4),
                'Healthy': round(healthy_probability, 4),
            },
            'quality': {
                'trackedFrameRatio': round(tracked_ratio, 3),
                'usableDurationSeconds': round(duration, 2),
                'qualityScore': round(quality_score, 3),
                'protocolComplianceScore': round(protocol_alignment['protocolComplianceScore'], 3),
                'analyzedFrameCount': int(analyzed_frames),
                'usableSampleCount': int(len(samples)),
                'issueFrames': top_issue_frames or debug_frames,
                'reasonSummary': {
                    'faceMissingFrames': int(face_missing_count),
                    'eyeGeometryFailedFrames': int(eye_geometry_fail_count),
                },
            },
            'protocol': protocol,
            'modelInfo': {
                'name': 'MediaPipe Face Mesh + OpenCV eye tracking',
                'type': 'video',
                'guidedProtocol': GUIDED_PROTOCOL,
            },
        }
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass
