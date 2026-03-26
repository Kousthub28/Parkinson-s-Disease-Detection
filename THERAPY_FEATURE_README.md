# AI Therapy Coach Feature

## Overview

The AI Therapy Coach is a real-time physical therapy application that uses computer vision and AI to guide users through exercises with live feedback. Built specifically for Parkinson's disease and motor rehabilitation.

## Features

### 🎥 Real-Time Pose Detection
- Uses **MediaPipe** for accurate body landmark detection
- Tracks key joints: shoulders, elbows, hips, knees, ankles
- Calculates joint angles in real-time
- Detects tremor and movement quality

### 🏋️ Exercise Library
- **Warm-up exercises**: Shoulder rolls, arm raises
- **Main exercises**: Bicep curls, shoulder press, leg raises, knee lifts
- **Cool-down**: Gentle stretches, deep breathing
- Each exercise has:
  - Target repetitions
  - Duration goals
  - Angle range requirements
  - Posture validation rules

### 💬 Real-Time Feedback
- **Visual feedback**: Overlay on video showing posture corrections
- **Voice feedback**: Text-to-speech guidance and encouragement
- **Corrective feedback**: Immediate alerts for incorrect posture
- **Positive reinforcement**: Encouragement for correct movements

### 📊 Progress Tracking
- Repetition counting (only counts valid reps)
- Accuracy scoring
- Session duration tracking
- Milestone detection:
  - First 10-minute session
  - Perfect form (95%+ accuracy)
  - All reps completed

### 🤖 AI Agent Behavior
- Supportive and encouraging tone
- Natural voice using Web Speech API
- Adaptive difficulty based on performance
- Clear exercise instructions

## Architecture

### Backend Components

#### `pose_detection.py`
- **PoseDetector** class: MediaPipe wrapper for pose detection
- Methods:
  - `detect_landmarks()`: Extract body landmarks from image
  - `calculate_angle()`: Compute joint angles
  - `get_joint_angles()`: Get all key joint angles
  - `detect_tremor()`: Analyze tremor patterns
  - `check_visibility()`: Ensure enough landmarks visible

#### `exercise_definitions.py`
- **Exercise** class: Exercise data structure
- **ExerciseType** enum: Warm-up, Main, Cool-down
- **EXERCISES** dictionary: Exercise library
- Pre-configured exercises with:
  - Angle ranges for validation
  - Posture rules
  - Feedback messages

#### `exercise_validator.py`
- **ExerciseValidator** class: Validates movements
- Methods:
  - `validate_posture()`: Check angles against requirements
  - `check_rep_completion()`: Detect valid repetitions
  - `get_feedback()`: Generate comprehensive feedback
  - Detects asymmetry, incomplete movements

#### `therapy_service.py`
- **TherapySession** class: Manages active sessions
- **TherapyService** class: Session lifecycle management
- Handles:
  - Session creation
  - Exercise progression
  - Progress calculation
  - Milestone detection

### Frontend Components

#### `Therapy.tsx`
Main therapy page with:
- Camera integration (WebRTC)
- Real-time video feed
- Pose visualization overlay
- Exercise progress display
- Session controls
- Voice feedback toggle
- Session summary screen

### API Endpoints

```
POST /api/therapy/session/start
  - Start new therapy session
  - Returns: session_id, current_exercise

POST /api/therapy/session/{session_id}/analyze
  - Analyze pose from video frame
  - Body: { image: base64_image }
  - Returns: feedback, annotated_image, angles, progress

POST /api/therapy/session/{session_id}/next
  - Move to next exercise
  - Returns: has_next, current_exercise

POST /api/therapy/session/{session_id}/end
  - End session and get summary
  - Returns: session_data, milestones, summary

GET /api/therapy/exercises
  - Get all available exercises
  - Query param: ?type=warm_up|main|cool_down
```

## Setup Instructions

### Backend Setup

1. **Install dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Required packages** (already in requirements.txt):
   - `mediapipe==0.10.8`
   - `opencv-python==4.8.1.78`
   - `numpy==1.24.3`
   - `scipy==1.11.4`

3. **Start backend**:
   ```bash
   python backend_api.py
   ```

### Frontend Setup

1. **Install dependencies** (if not already):
   ```bash
   cd frontend
   npm install
   ```

2. **Start frontend**:
   ```bash
   npm run dev
   ```

3. **Access therapy page**:
   - Navigate to `/therapy` in the app
   - Or use sidebar: "AI Therapy Coach"

## Usage

### Starting a Session

1. Click "Start Therapy Session"
2. Allow camera permissions when prompted
3. Position yourself in front of camera
4. Wait for pose detection (green landmarks should appear)

### During Session

- **Real-time feedback**: Overlay shows corrections in real-time
- **Voice guidance**: AI coach speaks instructions and corrections
- **Rep counting**: Only valid repetitions are counted
- **Exercise progression**: Automatically moves to next exercise when complete

### Exercise Completion

Exercises complete when:
- Target repetitions reached, OR
- Duration time exceeded

### Session Summary

After completing all exercises:
- View session statistics
- See milestones achieved
- Review accuracy score
- Start new session

## Technical Details

### Pose Detection

- **Model**: MediaPipe Pose (BlazePose)
- **Key landmarks tracked**:
  - Shoulders (11, 12)
  - Elbows (13, 14)
  - Wrists (15, 16)
  - Hips (23, 24)
  - Knees (25, 26)
  - Ankles (27, 28)

### Angle Calculation

Uses three-point angle calculation:
```
angle = arccos((vector1 · vector2) / (|vector1| × |vector2|))
```

### Rep Detection

A repetition is counted when:
1. User moves from "down" position to "up" position
2. User returns to "down" position
3. Movement covers at least 50% of full range
4. All angles within valid ranges during movement

### Feedback System

- **Correct**: Positive reinforcement (spoken occasionally)
- **Needs correction**: Immediate voice feedback
- **Rep completed**: Celebration message
- **Cooldown**: 2 seconds between voice messages

## Extending the System

### Adding New Exercises

Edit `backend/exercise_definitions.py`:

```python
'my_exercise': Exercise(
    id='my_exercise',
    name='My Exercise',
    description='Description here',
    type=ExerciseType.MAIN,
    duration_seconds=90,
    target_reps=10,
    angle_ranges={
        'left_elbow': (30, 160),
        'right_elbow': (30, 160),
    },
    posture_rules=[
        'Keep back straight',
        'Control the movement'
    ],
    feedback_messages={
        'correct': 'Great job!',
        'too_low': 'Lift higher',
        'too_high': 'Lower slightly',
    }
)
```

### Custom Session Plans

Create custom exercise sequences:

```python
custom_plan = [
    'shoulder_rolls',
    'my_custom_exercise',
    'gentle_stretches'
]

# Start session with custom plan
POST /api/therapy/session/start
Body: { "exercise_ids": custom_plan }
```

## Troubleshooting

### Camera Not Working
- Check browser permissions
- Ensure HTTPS (required for getUserMedia)
- Try different browser

### Pose Detection Failing
- Ensure good lighting
- Stand 2-3 meters from camera
- Ensure full body visible
- Remove background clutter

### Voice Feedback Not Working
- Check browser supports SpeechSynthesis
- Enable voice toggle in UI
- Check browser console for errors

### Backend Errors
- Ensure MediaPipe is installed: `pip install mediapipe`
- Check OpenCV version compatibility
- Verify MongoDB connection (for session storage)

## Future Enhancements

- [ ] Database storage for session history
- [ ] Progress graphs and analytics
- [ ] Custom exercise creator UI
- [ ] Multi-user support with profiles
- [ ] Integration with wearable devices
- [ ] Advanced tremor analysis
- [ ] 3D avatar visualization
- [ ] Exercise difficulty adaptation
- [ ] Social features (share progress)

## License

Part of the Parkinson's Care Assistant application.

