"""
Pose Detection Service using MediaPipe
Tracks body landmarks and calculates joint angles for therapy exercises
"""

import cv2
import mediapipe as mp
import numpy as np
from typing import Dict, List, Optional, Tuple
import math

class PoseDetector:
    """MediaPipe-based pose detector for therapy exercises"""
    
    def __init__(self):
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
            model_complexity=1  # 0=fast, 1=balanced, 2=accurate
        )
        self.mp_drawing = mp.solutions.drawing_utils
        
    def detect_landmarks(self, image: np.ndarray) -> Optional[Dict]:
        """
        Detect pose landmarks from image
        
        Returns:
            Dict with 'landmarks' (list of x,y,z,visibility) and 'image' (annotated)
        """
        # Convert BGR to RGB
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = self.pose.process(image_rgb)
        
        if not results.pose_landmarks:
            return None
        
        # Extract landmarks
        landmarks = []
        for landmark in results.pose_landmarks.landmark:
            landmarks.append({
                'x': landmark.x,
                'y': landmark.y,
                'z': landmark.z,
                'visibility': landmark.visibility
            })
        
        # Draw landmarks on image
        annotated_image = image.copy()
        self.mp_drawing.draw_landmarks(
            annotated_image,
            results.pose_landmarks,
            self.mp_pose.POSE_CONNECTIONS,
            self.mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=2),
            self.mp_drawing.DrawingSpec(color=(0, 0, 255), thickness=2)
        )
        
        return {
            'landmarks': landmarks,
            'image': annotated_image,
            'raw_landmarks': results.pose_landmarks
        }
    
    def calculate_angle(self, point1: Dict, point2: Dict, point3: Dict) -> float:
        """
        Calculate angle between three points (point2 is the vertex)
        
        Args:
            point1, point2, point3: Dict with 'x', 'y', 'z', 'visibility'
        
        Returns:
            Angle in degrees (0-180)
        """
        # Convert to numpy arrays
        a = np.array([point1['x'], point1['y']])
        b = np.array([point2['x'], point2['y']])
        c = np.array([point3['x'], point3['y']])
        
        # Calculate vectors
        radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(a[1] - b[1], a[0] - b[0])
        angle = np.abs(radians * 180.0 / np.pi)
        
        if angle > 180.0:
            angle = 360 - angle
        
        return angle
    
    def get_landmark_by_name(self, landmarks: List[Dict], name: str) -> Optional[Dict]:
        """Get landmark by MediaPipe pose landmark name"""
        landmark_map = {
            'LEFT_SHOULDER': 11,
            'RIGHT_SHOULDER': 12,
            'LEFT_ELBOW': 13,
            'RIGHT_ELBOW': 14,
            'LEFT_WRIST': 15,
            'RIGHT_WRIST': 16,
            'LEFT_HIP': 23,
            'RIGHT_HIP': 24,
            'LEFT_KNEE': 25,
            'RIGHT_KNEE': 26,
            'LEFT_ANKLE': 27,
            'RIGHT_ANKLE': 28,
            'NOSE': 0,
            'LEFT_EYE': 2,
            'RIGHT_EYE': 5,
        }
        
        idx = landmark_map.get(name)
        if idx is None or idx >= len(landmarks):
            return None
        
        landmark = landmarks[idx]
        if landmark['visibility'] < 0.5:  # Low visibility threshold
            return None
        
        return landmark
    
    def get_joint_angles(self, landmarks: List[Dict]) -> Dict[str, float]:
        """
        Calculate key joint angles for therapy exercises
        
        Returns:
            Dict with angle names and values in degrees
        """
        angles = {}
        
        # Left arm angles
        left_shoulder = self.get_landmark_by_name(landmarks, 'LEFT_SHOULDER')
        left_elbow = self.get_landmark_by_name(landmarks, 'LEFT_ELBOW')
        left_wrist = self.get_landmark_by_name(landmarks, 'LEFT_WRIST')
        left_hip = self.get_landmark_by_name(landmarks, 'LEFT_HIP')
        
        if left_shoulder and left_elbow and left_wrist:
            angles['left_elbow'] = self.calculate_angle(left_shoulder, left_elbow, left_wrist)
        
        if left_shoulder and left_elbow and left_hip:
            angles['left_shoulder'] = self.calculate_angle(left_hip, left_shoulder, left_elbow)
        
        # Right arm angles
        right_shoulder = self.get_landmark_by_name(landmarks, 'RIGHT_SHOULDER')
        right_elbow = self.get_landmark_by_name(landmarks, 'RIGHT_ELBOW')
        right_wrist = self.get_landmark_by_name(landmarks, 'RIGHT_WRIST')
        right_hip = self.get_landmark_by_name(landmarks, 'RIGHT_HIP')
        
        if right_shoulder and right_elbow and right_wrist:
            angles['right_elbow'] = self.calculate_angle(right_shoulder, right_elbow, right_wrist)
        
        if right_shoulder and right_elbow and right_hip:
            angles['right_shoulder'] = self.calculate_angle(right_hip, right_shoulder, right_elbow)
        
        # Left leg angles
        left_knee = self.get_landmark_by_name(landmarks, 'LEFT_KNEE')
        left_ankle = self.get_landmark_by_name(landmarks, 'LEFT_ANKLE')
        
        if left_hip and left_knee and left_ankle:
            angles['left_knee'] = self.calculate_angle(left_hip, left_knee, left_ankle)
        
        if left_shoulder and left_hip and left_knee:
            angles['left_hip'] = self.calculate_angle(left_shoulder, left_hip, left_knee)
        
        # Right leg angles
        right_knee = self.get_landmark_by_name(landmarks, 'RIGHT_KNEE')
        right_ankle = self.get_landmark_by_name(landmarks, 'RIGHT_ANKLE')
        
        if right_hip and right_knee and right_ankle:
            angles['right_knee'] = self.calculate_angle(right_hip, right_knee, right_ankle)
        
        if right_shoulder and right_hip and right_knee:
            angles['right_hip'] = self.calculate_angle(right_shoulder, right_hip, right_knee)
        
        return angles
    
    def detect_tremor(self, landmarks: List[Dict], prev_landmarks: Optional[List[Dict]], 
                     threshold: float = 0.02) -> bool:
        """
        Detect tremor by analyzing landmark movement variance
        
        Args:
            landmarks: Current frame landmarks
            prev_landmarks: Previous frame landmarks
            threshold: Movement threshold for tremor detection
        
        Returns:
            True if tremor detected
        """
        if prev_landmarks is None:
            return False
        
        # Check wrist movement (common tremor location)
        left_wrist = self.get_landmark_by_name(landmarks, 'LEFT_WRIST')
        right_wrist = self.get_landmark_by_name(landmarks, 'RIGHT_WRIST')
        prev_left_wrist = self.get_landmark_by_name(prev_landmarks, 'LEFT_WRIST')
        prev_right_wrist = self.get_landmark_by_name(prev_landmarks, 'RIGHT_WRIST')
        
        tremor_detected = False
        
        if left_wrist and prev_left_wrist:
            dx = abs(left_wrist['x'] - prev_left_wrist['x'])
            dy = abs(left_wrist['y'] - prev_left_wrist['y'])
            if dx > threshold or dy > threshold:
                tremor_detected = True
        
        if right_wrist and prev_right_wrist:
            dx = abs(right_wrist['x'] - prev_right_wrist['x'])
            dy = abs(right_wrist['y'] - prev_right_wrist['y'])
            if dx > threshold or dy > threshold:
                tremor_detected = True
        
        return tremor_detected
    
    def check_visibility(self, landmarks: List[Dict]) -> bool:
        """Check if enough key landmarks are visible"""
        key_points = ['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_HIP', 'RIGHT_HIP']
        visible_count = sum(1 for name in key_points 
                          if self.get_landmark_by_name(landmarks, name) is not None)
        return visible_count >= 3  # At least 3 of 4 key points visible
    
    def release(self):
        """Release MediaPipe resources"""
        if self.pose:
            self.pose.close()

