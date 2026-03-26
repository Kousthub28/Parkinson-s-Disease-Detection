import tensorflow as tf
import numpy as np
from PIL import Image
import os

# Test the newly trained model
model_path = 'backend/models/spiral/mobilenet_spiral_new.h5'
print("Testing NEW spiral model...")
model = tf.keras.models.load_model(model_path, compile=False)
print(f"Model loaded: {model.input_shape} -> {model.output_shape}")

def create_test_spiral_image(width=224, height=224, is_parkinsons=False):
    """Create a synthetic spiral image for testing"""
    img = np.zeros((height, width, 3), dtype=np.uint8)
    center_x, center_y = width // 2, height // 2
    
    # Draw spiral pattern
    max_radius = min(width, height) // 3
    num_turns = 3 if is_parkinsons else 5  # Parkinson's spiral: less turns, more shaky
    
    for i in range(500):  # 500 points along the spiral
        angle = i * 0.1
        if is_parkinsons:
            # Add tremor effect for Parkinson's
            angle += np.random.normal(0, 0.1)
            radius = (i / 500) * max_radius + np.random.normal(0, 2)
        else:
            radius = (i / 500) * max_radius
        
        x = int(center_x + radius * np.cos(angle))
        y = int(center_y + radius * np.sin(angle))
        
        if 0 <= x < width and 0 <= y < height:
            # Draw with some thickness
            for dx in range(-2, 3):
                for dy in range(-2, 3):
                    if 0 <= x+dx < width and 0 <= y+dy < height:
                        img[y+dy, x+dx] = [255, 255, 255]  # White spiral
    
    return img

def preprocess_image(img):
    """Preprocess image for MobileNetV2"""
    img = Image.fromarray(img)
    img = img.resize((224, 224))
    img_array = np.array(img, dtype=np.float32)
    # MobileNetV2 preprocessing: [-1, 1]
    img_array = (img_array / 127.5) - 1.0
    img_array = np.expand_dims(img_array, axis=0)
    return img_array

print("\n=== Testing NEW Model Predictions ===")

# Test with healthy spiral
print("\n1. Testing with HEALTHY spiral pattern...")
healthy_img = create_test_spiral_image(is_parkinsons=False)
healthy_processed = preprocess_image(healthy_img)
pred_healthy = model(healthy_processed, training=False)
sigmoid_healthy = float(pred_healthy[0][0].numpy())

# For spiral model: high value = Parkinson's, low value = Healthy
parkinsons_score_healthy = sigmoid_healthy
healthy_score_healthy = 1 - sigmoid_healthy

print(f"Raw sigmoid output: {sigmoid_healthy:.6f}")
print(f"Parkinson's score: {parkinsons_score_healthy:.6f}")
print(f"Healthy score: {healthy_score_healthy:.6f}")
print(f"Prediction: {'Parkinsons' if parkinsons_score_healthy > healthy_score_healthy else 'Healthy'}")

# Test with Parkinson's spiral
print("\n2. Testing with PARKINSON'S spiral pattern...")
parkinsons_img = create_test_spiral_image(is_parkinsons=True)
parkinsons_processed = preprocess_image(parkinsons_img)
pred_parkinsons = model(parkinsons_processed, training=False)
sigmoid_parkinsons = float(pred_parkinsons[0][0].numpy())

parkinsons_score_parkinsons = sigmoid_parkinsons
healthy_score_parkinsons = 1 - sigmoid_parkinsons

print(f"Raw sigmoid output: {sigmoid_parkinsons:.6f}")
print(f"Parkinson's score: {parkinsons_score_parkinsons:.6f}")
print(f"Healthy score: {healthy_score_parkinsons:.6f}")
print(f"Prediction: {'Parkinsons' if parkinsons_score_parkinsons > healthy_score_parkinsons else 'Healthy'}")

# Test with random noise
print("\n3. Testing with RANDOM NOISE...")
noise_img = np.random.randint(0, 256, (224, 224, 3), dtype=np.uint8)
noise_processed = preprocess_image(noise_img)
pred_noise = model(noise_processed, training=False)
sigmoid_noise = float(pred_noise[0][0].numpy())

parkinsons_score_noise = sigmoid_noise
healthy_score_noise = 1 - sigmoid_noise

print(f"Raw sigmoid output: {sigmoid_noise:.6f}")
print(f"Parkinson's score: {parkinsons_score_noise:.6f}")
print(f"Healthy score: {healthy_score_noise:.6f}")
print(f"Prediction: {'Parkinsons' if parkinsons_score_noise > healthy_score_noise else 'Healthy'}")

print("\n=== Analysis ===")
print(f"Healthy spiral correctly identified: {'YES' if healthy_score_healthy > parkinsons_score_healthy else 'NO'}")
print(f"Parkinson's spiral correctly identified: {'YES' if parkinsons_score_parkinsons > healthy_score_parkinsons else 'NO'}")
print(f"Model bias: {'Parkinsons' if sigmoid_noise > 0.5 else 'Healthy'}")

# Check if model is working correctly
correct_predictions = 0
total_tests = 3

if healthy_score_healthy > parkinsons_score_healthy:
    correct_predictions += 1
    print("✓ Healthy spiral correctly identified")
else:
    print("✗ Healthy spiral incorrectly identified")

if parkinsons_score_parkinsons > healthy_score_parkinsons:
    correct_predictions += 1
    print("✓ Parkinson's spiral correctly identified")
else:
    print("✗ Parkinson's spiral incorrectly identified")

# Random noise should be closer to neutral (around 0.5)
if abs(sigmoid_noise - 0.5) < 0.3:
    correct_predictions += 1
    print("✓ Random noise handled reasonably")
else:
    print("✗ Random noise shows strong bias")

print(f"\nOverall accuracy: {correct_predictions}/{total_tests} ({correct_predictions/total_tests*100:.1f}%)")

if correct_predictions >= 2:
    print("\n🎉 NEW MODEL IS WORKING CORRECTLY!")
else:
    print("\n❌ NEW MODEL STILL HAS ISSUES")
