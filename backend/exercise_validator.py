"""
Exercise Validation Engine
Validates user movements against exercise requirements and provides feedback
"""

from typing import Dict, List, Optional, Tuple
from exercise_definitions import Exercise, ExerciseStatus
from pose_detection import PoseDetector

class ExerciseValidator:
    """Validates exercise performance and provides feedback"""
    
    def __init__(self):
        self.current_exercise: Optional[Exercise] = None
        self.rep_state = 'down'  # 'down', 'up', 'holding'
        self.last_angles: Optional[Dict[str, float]] = None
        self.rep_start_angles: Optional[Dict[str, float]] = None
        self.feedback_history: List[Dict] = []
    
    def set_exercise(self, exercise: Exercise):
        """Set the current exercise to validate"""
        self.current_exercise = exercise
        self.rep_state = 'down'
        self.last_angles = None
        self.rep_start_angles = None
        self.feedback_history = []
    
    def validate_posture(
        self, 
        angles: Dict[str, float], 
        landmarks: List[Dict]
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Validate current posture against exercise requirements
        
        Returns:
            (is_valid, feedback_type, feedback_message)
        """
        if not self.current_exercise:
            return False, None, None
        
        feedback_type = None
        feedback_message = None
        is_valid = True
        
        # Check angle ranges
        for angle_name, (min_angle, max_angle) in self.current_exercise.angle_ranges.items():
            if angle_name in angles:
                current_angle = angles[angle_name]
                
                if current_angle < min_angle:
                    is_valid = False
                    feedback_type = 'too_low'
                    feedback_message = self.current_exercise.feedback_messages.get(
                        'too_low', 
                        f'Lift your {angle_name.replace("_", " ")} higher'
                    )
                    break
                
                elif current_angle > max_angle:
                    is_valid = False
                    feedback_type = 'too_high'
                    feedback_message = self.current_exercise.feedback_messages.get(
                        'too_high',
                        f'Lower your {angle_name.replace("_", " ")} slightly'
                    )
                    break
        
        # Check for asymmetry (if both left and right angles exist)
        if is_valid:
            left_right_pairs = [
                ('left_elbow', 'right_elbow'),
                ('left_shoulder', 'right_shoulder'),
                ('left_hip', 'right_hip'),
                ('left_knee', 'right_knee'),
            ]
            
            for left_key, right_key in left_right_pairs:
                if left_key in angles and right_key in angles:
                    diff = abs(angles[left_key] - angles[right_key])
                    if diff > 20:  # More than 20 degrees difference
                        is_valid = False
                        feedback_type = 'asymmetry'
                        feedback_message = self.current_exercise.feedback_messages.get(
                            'asymmetry',
                            'Try to keep both sides even'
                        )
                        break
        
        # If valid, provide positive feedback
        if is_valid:
            feedback_type = 'correct'
            feedback_message = self.current_exercise.feedback_messages.get(
                'correct',
                'Great job! Keep it up'
            )
        
        return is_valid, feedback_type, feedback_message
    
    def check_rep_completion(
        self,
        angles: Dict[str, float],
        prev_angles: Optional[Dict[str, float]]
    ) -> Tuple[bool, bool]:
        """
        Check if a repetition has been completed
        
        Returns:
            (rep_completed, is_valid_rep)
        """
        if not self.current_exercise or not prev_angles:
            return False, False
        
        # Determine which angles to track based on exercise
        tracked_angles = []
        for angle_name in self.current_exercise.angle_ranges.keys():
            if angle_name in angles and angle_name in prev_angles:
                tracked_angles.append(angle_name)
        
        if not tracked_angles:
            return False, False
        
        # Check if we're in the "up" position (angles near max)
        # or "down" position (angles near min)
        all_near_max = True
        all_near_min = True
        
        for angle_name in tracked_angles:
            min_angle, max_angle = self.current_exercise.angle_ranges[angle_name]
            current = angles[angle_name]
            prev = prev_angles[angle_name]
            
            # Check if near max (within 15 degrees)
            if current < (max_angle - 15):
                all_near_max = False
            
            # Check if near min (within 15 degrees)
            if current > (min_angle + 15):
                all_near_min = False
        
        # Rep completion logic
        rep_completed = False
        is_valid_rep = False
        
        if self.rep_state == 'down':
            # Moving from down to up
            if all_near_max:
                self.rep_state = 'up'
                self.rep_start_angles = prev_angles.copy()
        
        elif self.rep_state == 'up':
            # Moving from up back to down
            if all_near_min:
                # Check if we completed full range of motion
                if self.rep_start_angles:
                    full_range = True
                    for angle_name in tracked_angles:
                        min_angle, max_angle = self.current_exercise.angle_ranges[angle_name]
                        start = self.rep_start_angles[angle_name]
                        end = angles[angle_name]
                        
                        # Check if we moved through significant range
                        range_covered = abs(start - end)
                        if range_covered < (max_angle - min_angle) * 0.5:  # At least 50% of range
                            full_range = False
                            break
                    
                    if full_range:
                        rep_completed = True
                        is_valid_rep = True
                        self.current_exercise.completed_reps += 1
                
                self.rep_state = 'down'
                self.rep_start_angles = None
        
        return rep_completed, is_valid_rep
    
    def get_feedback(
        self,
        angles: Dict[str, float],
        landmarks: List[Dict],
        prev_angles: Optional[Dict[str, float]] = None
    ) -> Dict:
        """
        Get comprehensive feedback for current movement
        
        Returns:
            Dict with feedback information
        """
        is_valid, feedback_type, feedback_message = self.validate_posture(angles, landmarks)
        
        rep_completed = False
        is_valid_rep = False
        
        if prev_angles:
            rep_completed, is_valid_rep = self.check_rep_completion(angles, prev_angles)
        
        # Determine overall status
        if rep_completed and is_valid_rep:
            status = 'rep_completed'
            message = f'Excellent! Rep {self.current_exercise.completed_reps} completed'
        elif is_valid:
            status = 'correct'
            message = feedback_message or 'Good form!'
        else:
            status = 'needs_correction'
            message = feedback_message or 'Adjust your posture'
        
        feedback = {
            'status': status,
            'message': message,
            'feedback_type': feedback_type,
            'is_valid': is_valid,
            'rep_completed': rep_completed,
            'current_reps': self.current_exercise.completed_reps if self.current_exercise else 0,
            'target_reps': self.current_exercise.target_reps if self.current_exercise else 0,
            'angles': angles,
            'timestamp': None  # Will be set by caller
        }
        
        # Store in history
        self.feedback_history.append(feedback)
        
        return feedback
    
    def get_progress(self) -> Dict:
        """Get current exercise progress"""
        if not self.current_exercise:
            return {
                'completed_reps': 0,
                'target_reps': 0,
                'progress_percent': 0,
                'status': 'no_exercise'
            }
        
        progress_percent = (self.current_exercise.completed_reps / self.current_exercise.target_reps) * 100
        
        return {
            'completed_reps': self.current_exercise.completed_reps,
            'target_reps': self.current_exercise.target_reps,
            'progress_percent': min(progress_percent, 100),
            'status': self.current_exercise.status.value
        }

