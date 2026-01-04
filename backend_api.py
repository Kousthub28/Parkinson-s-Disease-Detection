"""
Multi-Model Backend API for Parkinson's Detection
Supports both Spiral (MobileNetV2) and Wave (InceptionV3) models
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import numpy as np
from PIL import Image
import io
import os
import cv2

app = Flask(__name__)
CORS(app)

# Model paths
SPIRAL_MODEL_PATH = 'public/models/spiral/mobilenet_spiral.h5'
WAVE_MODEL_PATH = 'public/models/wave/inception_wave_v2.h5'

# Global model cache
models = {
    'spiral': None,
    'wave': None
}

def load_spiral_model():
    """Load MobileNetV2 spiral model"""
    if models['spiral'] is None:
        print("Loading spiral model (MobileNetV2)...")
        try:
            models['spiral'] = tf.keras.models.load_model(SPIRAL_MODEL_PATH, compile=False)
            print(f"  ✓ Spiral model loaded: {models['spiral'].input_shape}")
        except Exception as e:
            print(f"  ✗ Error loading spiral model: {e}")
            return None
    return models['spiral']

def load_wave_model():
    """Load InceptionV3 wave model"""
    if models['wave'] is None:
        print("Loading wave model (InceptionV3)...")
        try:
            models['wave'] = tf.keras.models.load_model(WAVE_MODEL_PATH, compile=False)
            print(f"  ✓ Wave model loaded: {models['wave'].input_shape}")
        except Exception as e:
            print(f"  ✗ Error loading wave model: {e}")
            return None
    return models['wave']

def preprocess_for_spiral(image_bytes):
    """Preprocess image for MobileNetV2 (spiral)"""
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode != 'RGB':
        img = img.convert('RGB')
    img = img.resize((224, 224))
    img_array = np.array(img, dtype=np.float32)
    # MobileNetV2 preprocessing: [-1, 1]
    img_array = (img_array / 127.5) - 1.0
    img_array = np.expand_dims(img_array, axis=0)
    return img_array

def preprocess_for_wave(image_bytes):
    """Preprocess image for InceptionV3 (wave)"""
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode != 'RGB':
        img = img.convert('RGB')
    img = img.resize((224, 224))
    img_array = np.array(img, dtype=np.float32)
    # InceptionV3 preprocessing: [0, 1]
    img_array = img_array / 255.0
    img_array = np.expand_dims(img_array, axis=0)
    return img_array

def validate_drawing_image(image_bytes, expected_type=None):
    """
    Detect if image is spiral or wave based on pattern characteristics
    Returns: (is_valid, error_message, detected_type)
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode != 'RGB':
            img = img.convert('RGB')
        img = img.resize((224, 224))
        img_array = np.array(img, dtype=np.uint8)
        
        # Convert to grayscale
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        
        # Analyze pattern to detect type (no strict validation)
        _, binary = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
        
        # Get content dimensions for type detection
        rows_with_content = np.any(binary, axis=1)
        cols_with_content = np.any(binary, axis=0)
        
        # Default values if no content detected
        if not np.any(rows_with_content) or not np.any(cols_with_content):
            # Just use expected type or default to spiral
            detected_type = expected_type if expected_type else 'spiral'
            return True, None, detected_type
        
        content_height = rows_with_content.sum()
        content_width = cols_with_content.sum()
        aspect_ratio = content_width / (content_height + 1e-6)
        
        # Method 2: Check horizontal vs vertical variance
        horizontal_variance = np.var(gray, axis=1).mean()
        vertical_variance = np.var(gray, axis=0).mean()
        variance_ratio = horizontal_variance / (vertical_variance + 1e-6)
        
        # Method 3: Check for circular patterns (Hough circles for spiral)
        circles = cv2.HoughCircles(gray, cv2.HOUGH_GRADIENT, dp=1, minDist=50,
                                   param1=100, param2=30, minRadius=20, maxRadius=100)
        has_circular_pattern = circles is not None and len(circles[0]) > 0
        
        # Determine type
        wave_score = 0
        spiral_score = 0
        
        # Wave characteristics
        if aspect_ratio > 1.3:  # Wider than tall
            wave_score += 2
        if variance_ratio > 1.2:  # More horizontal variance
            wave_score += 1
        if not has_circular_pattern:  # No circles
            wave_score += 1
        
        # Spiral characteristics
        if has_circular_pattern:  # Has circular patterns
            spiral_score += 3
        if 0.7 < aspect_ratio < 1.3:  # More square-ish
            spiral_score += 2
        
        detected_type = 'wave' if wave_score > spiral_score else 'spiral'
        
        print(f"  Pattern: aspect={aspect_ratio:.2f}, variance={variance_ratio:.2f}, circles={has_circular_pattern}")
        print(f"  Scores: wave={wave_score}, spiral={spiral_score} → detected={detected_type}")
        
        # Use expected type if provided, otherwise use detected type
        final_type = expected_type if expected_type else detected_type
        
        return True, None, final_type
        
    except Exception as e:
        print(f"Validation error: {e}")
        return False, "Failed to validate image. Please ensure you upload a valid image file.", None

def detect_image_type(image_bytes):
    """
    Detect if image is spiral or wave based on image characteristics
    Spiral: More circular patterns, radial symmetry, centered
    Wave: Horizontal wave patterns, more linear, elongated horizontally
    """
    is_valid, error_msg, detected_type = validate_drawing_image(image_bytes)
    if not is_valid:
        return None  # Will be handled by validation check
    return detected_type

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'spiral_model_loaded': models['spiral'] is not None,
        'wave_model_loaded': models['wave'] is not None
    })

@app.route('/predict', methods=['POST'])
def predict():
    """Predict Parkinson's from spiral or wave image"""
    try:
        # Check for image file
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': 'No image file selected'}), 400
        
        # Read image bytes
        image_bytes = file.read()
        
        # Check if type is specified or auto-detect
        image_type = request.form.get('type', None)
        
        # Validate the image first
        print(f"\nValidating uploaded image...")
        is_valid, error_msg, detected_type = validate_drawing_image(image_bytes, image_type)
        
        if not is_valid:
            print(f"  ✗ Validation failed: {error_msg}")
            return jsonify({
                'error': error_msg,
                'validation_failed': True
            }), 400
        
        print(f"  ✓ Image validation passed")
        
        if not image_type:
            # Use detected type from validation
            image_type = detected_type
            print(f"  Auto-detected image type: {image_type}")
        else:
            print(f"  Using specified type: {image_type}")
        
        # Load appropriate model and preprocess
        if image_type == 'spiral':
            model = load_spiral_model()
            if model is None:
                return jsonify({'error': 'Spiral model not available'}), 500
            processed_image = preprocess_for_spiral(image_bytes)
            model_name = 'MobileNetV2 (spiral)'
        elif image_type == 'wave':
            model = load_wave_model()
            if model is None:
                return jsonify({'error': 'Wave model not available'}), 500
            processed_image = preprocess_for_wave(image_bytes)
            model_name = 'InceptionV3 (wave)'
        else:
            return jsonify({'error': f'Invalid image type: {image_type}'}), 400
        
        # Make prediction
        prediction = model(processed_image, training=False)
        sigmoid_value = float(prediction[0][0].numpy())
        
        # Interpret sigmoid output
        # Spiral model has inverted labels: high value = Parkinson's, low value = Healthy
        # Wave model: high value = Healthy, low value = Parkinson's
        if image_type == 'spiral':
            # INVERTED for spiral model
            parkinsons_score = sigmoid_value
            healthy_score = 1 - sigmoid_value
        else:
            # Normal for wave model
            healthy_score = sigmoid_value
            parkinsons_score = 1 - sigmoid_value
        
        # Determine label
        label = 'Parkinsons' if parkinsons_score > healthy_score else 'Healthy'
        confidence = max(parkinsons_score, healthy_score)
        
        return jsonify({
            'label': label,
            'confidence': confidence,
            'probabilities': {
                'Parkinsons': parkinsons_score,
                'Healthy': healthy_score
            },
            'raw_output': sigmoid_value,
            'modelInfo': {
                'name': model_name,
                'type': image_type,
                'inputShape': list(model.input_shape),
                'autoDetected': request.form.get('type', None) is None
            }
        })
        
    except Exception as e:
        print(f"Error during prediction: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Pre-load models on startup
    print("\n" + "="*60)
    print("🚀 Multi-Model Parkinson's Detection API Server")
    print("="*60)
    
    load_spiral_model()
    load_wave_model()
    
    print("\n📍 Server running on: http://localhost:5000")
    print("🔗 Health check: http://localhost:5000/health")
    print("📤 Prediction endpoint: POST http://localhost:5000/predict")
    print("\n  Supported types:")
    print("    - spiral: MobileNetV2 model")
    print("    - wave: InceptionV3 model")
    print("    - auto: Automatic detection")
    print("="*60 + "\n")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
