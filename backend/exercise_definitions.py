"""
Exercise Definitions and Validation Logic
Defines therapy exercises with posture rules, angle ranges, and feedback messages
"""

from typing import Dict, List, Optional, Tuple
from enum import Enum

class ExerciseType(Enum):
    WARM_UP = "warm_up"
    MAIN = "main"
    COOL_DOWN = "cool_down"

class ExerciseStatus(Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    PAUSED = "paused"

class Exercise:
    """Represents a single therapy exercise"""
    
    def __init__(
        self,
        id: str,
        name: str,
        description: str,
        type: ExerciseType,
        duration_seconds: int = 60,
        target_reps: int = 10,
        angle_ranges: Optional[Dict[str, Tuple[float, float]]] = None,
        posture_rules: Optional[List[str]] = None,
        feedback_messages: Optional[Dict[str, str]] = None
    ):
        self.id = id
        self.name = name
        self.description = description
        self.type = type
        self.duration_seconds = duration_seconds
        self.target_reps = target_reps
        self.angle_ranges = angle_ranges or {}
        self.posture_rules = posture_rules or []
        self.feedback_messages = feedback_messages or {}
        self.status = ExerciseStatus.NOT_STARTED
        self.completed_reps = 0
        self.start_time = None
        self.end_time = None

# Exercise Library
EXERCISES = {
    # Warm-up exercises
    'shoulder_rolls': Exercise(
        id='shoulder_rolls',
        name='Shoulder Rolls',
        description='Slowly roll your shoulders forward and backward in circular motions',
        type=ExerciseType.WARM_UP,
        duration_seconds=30,
        target_reps=5,
        angle_ranges={
            'left_shoulder': (30, 150),
            'right_shoulder': (30, 150),
        },
        posture_rules=[
            'Keep your back straight',
            'Move slowly and smoothly',
            'Complete full circular motion'
        ],
        feedback_messages={
            'correct': 'Great! Keep those shoulders moving smoothly',
            'too_fast': 'Slow down, take your time with each roll',
            'incomplete': 'Try to complete the full circle',
            'posture': 'Keep your back straight and shoulders relaxed'
        }
    ),
    
    'arm_raises': Exercise(
        id='arm_raises',
        name='Arm Raises',
        description='Raise both arms slowly to shoulder height, hold for 2 seconds, then lower',
        type=ExerciseType.WARM_UP,
        duration_seconds=45,
        target_reps=8,
        angle_ranges={
            'left_shoulder': (60, 90),
            'right_shoulder': (60, 90),
        },
        posture_rules=[
            'Raise arms to shoulder height',
            'Keep arms parallel to ground',
            'Hold position briefly before lowering'
        ],
        feedback_messages={
            'correct': 'Perfect! Arms at shoulder height',
            'too_low': 'Lift your arms a little higher',
            'too_high': 'Lower your arms slightly to shoulder height',
            'asymmetry': 'Try to keep both arms at the same height',
            'posture': 'Keep your back straight'
        }
    ),
    
    # Main exercises
    'bicep_curls': Exercise(
        id='bicep_curls',
        name='Bicep Curls',
        description='Slowly curl your arms up, bringing hands toward shoulders, then lower',
        type=ExerciseType.MAIN,
        duration_seconds=90,
        target_reps=12,
        angle_ranges={
            'left_elbow': (30, 160),
            'right_elbow': (30, 160),
        },
        posture_rules=[
            'Keep elbows close to body',
            'Full range of motion',
            'Control the movement both up and down'
        ],
        feedback_messages={
            'correct': 'Excellent form! Keep it up',
            'incomplete_up': 'Curl your arms all the way up',
            'incomplete_down': 'Lower your arms completely',
            'too_fast': 'Slow down, control the movement',
            'asymmetry': 'Try to move both arms together',
            'posture': 'Keep your shoulders relaxed and back straight'
        }
    ),
    
    'shoulder_press': Exercise(
        id='shoulder_press',
        name='Shoulder Press',
        description='Press your arms upward overhead, then lower back down',
        type=ExerciseType.MAIN,
        duration_seconds=90,
        target_reps=10,
        angle_ranges={
            'left_shoulder': (150, 180),
            'right_shoulder': (150, 180),
        },
        posture_rules=[
            'Press straight up overhead',
            'Keep core engaged',
            'Full extension at top'
        ],
        feedback_messages={
            'correct': 'Great! Full extension overhead',
            'incomplete': 'Press all the way up',
            'too_low': 'Lift your arms higher',
            'asymmetry': 'Keep both arms moving together',
            'posture': 'Engage your core, keep back straight'
        }
    ),
    
    'leg_raises': Exercise(
        id='leg_raises',
        name='Leg Raises',
        description='Lift one leg up to hip height, hold briefly, then lower. Alternate legs',
        type=ExerciseType.MAIN,
        duration_seconds=120,
        target_reps=8,
        angle_ranges={
            'left_hip': (60, 90),
            'right_hip': (60, 90),
        },
        posture_rules=[
            'Lift leg to hip height',
            'Keep supporting leg straight',
            'Hold position briefly'
        ],
        feedback_messages={
            'correct': 'Perfect! Leg at hip height',
            'too_low': 'Lift your leg a bit higher',
            'too_high': 'Lower your leg slightly',
            'posture': 'Keep your back straight and core engaged',
            'balance': 'Hold onto something if needed for balance'
        }
    ),
    
    'knee_lifts': Exercise(
        id='knee_lifts',
        name='Knee Lifts',
        description='Lift your knee up toward your chest, then lower. Alternate legs',
        type=ExerciseType.MAIN,
        duration_seconds=120,
        target_reps=10,
        angle_ranges={
            'left_knee': (60, 120),
            'right_knee': (60, 120),
        },
        posture_rules=[
            'Lift knee toward chest',
            'Keep upper body upright',
            'Control the movement'
        ],
        feedback_messages={
            'correct': 'Excellent! Knee lifted high',
            'incomplete': 'Lift your knee higher',
            'too_fast': 'Slow down, control the movement',
            'posture': 'Keep your back straight',
            'asymmetry': 'Alternate legs evenly'
        }
    ),
    
    # Cool-down exercises
    'gentle_stretches': Exercise(
        id='gentle_stretches',
        name='Gentle Stretches',
        description='Slowly stretch your arms across your body, hold for 10 seconds',
        type=ExerciseType.COOL_DOWN,
        duration_seconds=60,
        target_reps=4,
        angle_ranges={
            'left_shoulder': (90, 150),
            'right_shoulder': (90, 150),
        },
        posture_rules=[
            'Move slowly into stretch',
            'Hold position',
            'Don\'t bounce'
        ],
        feedback_messages={
            'correct': 'Good stretch, hold that position',
            'too_fast': 'Move slowly into the stretch',
            'posture': 'Keep breathing and relax',
            'hold': 'Hold for a few more seconds'
        }
    ),
    
    'deep_breathing': Exercise(
        id='deep_breathing',
        name='Deep Breathing',
        description='Take slow, deep breaths. Inhale for 4 counts, exhale for 4 counts',
        type=ExerciseType.COOL_DOWN,
        duration_seconds=60,
        target_reps=5,
        angle_ranges={},  # No angle requirements for breathing
        posture_rules=[
            'Sit or stand comfortably',
            'Breathe deeply',
            'Relax your shoulders'
        ],
        feedback_messages={
            'correct': 'Perfect breathing rhythm',
            'posture': 'Relax your shoulders and breathe deeply',
            'encourage': 'You\'re doing great, keep breathing'
        }
    )
}

def get_exercise_by_id(exercise_id: str) -> Optional[Exercise]:
    """Get exercise by ID"""
    return EXERCISES.get(exercise_id)

def get_exercises_by_type(exercise_type: ExerciseType) -> List[Exercise]:
    """Get all exercises of a specific type"""
    return [ex for ex in EXERCISES.values() if ex.type == exercise_type]

def get_default_session_plan() -> List[str]:
    """Get default therapy session plan"""
    return [
        'shoulder_rolls',      # Warm-up
        'arm_raises',          # Warm-up
        'bicep_curls',         # Main
        'shoulder_press',      # Main
        'leg_raises',          # Main
        'gentle_stretches',    # Cool-down
        'deep_breathing'       # Cool-down
    ]

