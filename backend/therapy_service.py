"""
Therapy Session Management Service
Handles therapy sessions, progress tracking, and milestone detection
"""

from typing import Dict, List, Optional
from datetime import datetime, timedelta
from exercise_definitions import Exercise, ExerciseType, ExerciseStatus, get_exercise_by_id, get_default_session_plan
from exercise_validator import ExerciseValidator
from pose_detection import PoseDetector
import json

class TherapySession:
    """Represents an active therapy session"""
    
    def __init__(self, user_id: str, session_id: str):
        self.user_id = user_id
        self.session_id = session_id
        self.start_time = datetime.now()
        self.end_time = None
        self.exercises: List[Exercise] = []
        self.current_exercise_index = 0
        self.status = 'active'  # 'active', 'completed', 'paused'
        self.total_reps = 0
        self.total_duration_seconds = 0
        self.accuracy_score = 0.0
        self.feedback_count = {'correct': 0, 'needs_correction': 0}
        self.validator = ExerciseValidator()
        self._pose_detector = None  # Lazy initialization
    
    def initialize_session(self, exercise_ids: Optional[List[str]] = None):
        """Initialize session with exercises"""
        if exercise_ids is None:
            exercise_ids = get_default_session_plan()
        
        self.exercises = []
        for ex_id in exercise_ids:
            exercise = get_exercise_by_id(ex_id)
            if exercise:
                # Create a copy for this session
                new_ex = Exercise(
                    id=exercise.id,
                    name=exercise.name,
                    description=exercise.description,
                    type=exercise.type,
                    duration_seconds=exercise.duration_seconds,
                    target_reps=exercise.target_reps,
                    angle_ranges=exercise.angle_ranges,
                    posture_rules=exercise.posture_rules,
                    feedback_messages=exercise.feedback_messages
                )
                self.exercises.append(new_ex)
        
        if self.exercises:
            self.exercises[0].status = ExerciseStatus.IN_PROGRESS
            self.exercises[0].start_time = datetime.now()
            self.validator.set_exercise(self.exercises[0])
    
    @property
    def pose_detector(self):
        """Lazy initialization of pose detector"""
        if self._pose_detector is None:
            self._pose_detector = PoseDetector()
        return self._pose_detector
    
    def get_current_exercise(self) -> Optional[Exercise]:
        """Get current active exercise"""
        if 0 <= self.current_exercise_index < len(self.exercises):
            return self.exercises[self.current_exercise_index]
        return None
    
    def move_to_next_exercise(self) -> bool:
        """Move to next exercise in session"""
        current = self.get_current_exercise()
        if current:
            current.status = ExerciseStatus.COMPLETED
            current.end_time = datetime.now()
        
        self.current_exercise_index += 1
        
        if self.current_exercise_index < len(self.exercises):
            self.exercises[self.current_exercise_index].status = ExerciseStatus.IN_PROGRESS
            self.exercises[self.current_exercise_index].start_time = datetime.now()
            self.validator.set_exercise(self.exercises[self.current_exercise_index])
            return True
        
        # Session complete
        self.complete_session()
        return False
    
    def complete_session(self):
        """Mark session as completed and calculate metrics"""
        self.status = 'completed'
        self.end_time = datetime.now()
        self.total_duration_seconds = (self.end_time - self.start_time).total_seconds()
        
        # Calculate total reps
        self.total_reps = sum(ex.completed_reps for ex in self.exercises)
        
        # Calculate accuracy score
        total_feedback = self.feedback_count['correct'] + self.feedback_count['needs_correction']
        if total_feedback > 0:
            self.accuracy_score = (self.feedback_count['correct'] / total_feedback) * 100
    
    def to_dict(self) -> Dict:
        """Convert session to dictionary for storage"""
        return {
            'session_id': self.session_id,
            'user_id': self.user_id,
            'start_time': self.start_time.isoformat(),
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'status': self.status,
            'exercises': [
                {
                    'id': ex.id,
                    'name': ex.name,
                    'completed_reps': ex.completed_reps,
                    'target_reps': ex.target_reps,
                    'status': ex.status.value,
                    'start_time': ex.start_time.isoformat() if ex.start_time else None,
                    'end_time': ex.end_time.isoformat() if ex.end_time else None,
                }
                for ex in self.exercises
            ],
            'total_reps': self.total_reps,
            'total_duration_seconds': self.total_duration_seconds,
            'accuracy_score': self.accuracy_score,
            'feedback_count': self.feedback_count
        }

class TherapyService:
    """Service for managing therapy sessions"""
    
    def __init__(self):
        self.active_sessions: Dict[str, TherapySession] = {}
    
    def create_session(self, user_id: str, exercise_ids: Optional[List[str]] = None) -> TherapySession:
        """Create a new therapy session"""
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{user_id}"
        session = TherapySession(user_id, session_id)
        session.initialize_session(exercise_ids)
        self.active_sessions[session_id] = session
        return session
    
    def get_session(self, session_id: str) -> Optional[TherapySession]:
        """Get active session by ID"""
        return self.active_sessions.get(session_id)
    
    def end_session(self, session_id: str):
        """End and remove a session"""
        session = self.active_sessions.get(session_id)
        if session:
            session.complete_session()
            # Keep in active_sessions for a short time, then remove
            # In production, save to database here
            del self.active_sessions[session_id]
        return session
    
    def detect_milestones(self, user_id: str, session: TherapySession) -> List[Dict]:
        """Detect milestones achieved in this session"""
        milestones = []
        
        # First session milestone
        # (In production, check database for previous sessions)
        if session.total_duration_seconds >= 600:  # 10 minutes
            milestones.append({
                'id': 'first_10_min',
                'title': 'First 10-Minute Session',
                'description': 'Completed your first 10-minute therapy session!',
                'icon': '🎉'
            })
        
        # Perfect accuracy milestone
        if session.accuracy_score >= 95:
            milestones.append({
                'id': 'perfect_form',
                'title': 'Perfect Form',
                'description': 'Achieved 95%+ accuracy in your session!',
                'icon': '⭐'
            })
        
        # Completed all reps milestone
        if all(ex.completed_reps >= ex.target_reps for ex in session.exercises):
            milestones.append({
                'id': 'all_reps',
                'title': 'All Reps Completed',
                'description': 'Completed all target repetitions!',
                'icon': '💪'
            })
        
        return milestones

# Global service instance
therapy_service = TherapyService()

