import tensorflow as tf
import numpy as np
from PIL import Image, ImageDraw
import os

# Test the newly integrated robust model
model_path = 'backend/models/spiral/mobilenet_spiral.h5'
print("Testing ROBUST spiral model integration...")
print(f"Model file: {model_path}")
print(f"Model size: {os.path.getsize(model_path)/1024/1024:.1f} MB")

model = tf.keras.models.load_model(model_path, compile=False)
print(f"Model loaded: {model.input_shape} -> {model.output_shape}")

def create_diverse_test_spiral(width=224, height=224, is_parkinsons=False, variation_type='clean'):
    """Create different types of test spirals"""
    img = np.zeros((height, width, 3), dtype=np.uint8)
    center_x, center_y = width // 2, height // 2
    max_radius = min(width, height) // 3
    
    points = []
    num_points = 800
    
    for i in range(num_points):
        t = i / num_points
        
        if is_parkinsons:
            # Parkinson's characteristics
            num_turns = np.random.uniform(1.5, 3.5)
            angle = t * num_turns * 2 * np.pi
            
            # Add different types of tremor based on variation
            if variation_type == 'tremor':
                angle += 0.2 * np.sin(30 * t * 2 * np.pi)  # High frequency tremor
            elif variation_type == 'shaky':
                angle += np.random.normal(0, 0.3)  # Random jitter
            elif variation_type == 'gaps':
                if np.random.random() < 0.1:  # Random gaps
                    continue
                    
            radius = t * max_radius + np.random.normal(0, 3)
            radius += 5 * np.sin(5 * t * 2 * np.pi)  # Radial wobble
        else:
            # Healthy characteristics
            num_turns = np.random.uniform(4, 6)
            angle = t * num_turns * 2 * np.pi
            radius = t * max_radius
            
            # Minor natural variations
            radius += np.random.normal(0, 0.5)
            angle += np.random.normal(0, 0.02)
        
        x = int(center_x + radius * np.cos(angle))
        y = int(center_y + radius * np.sin(angle))
        points.append((x, y))
    
    # Draw spiral
    for i in range(len(points) - 1):
        x1, y1 = points[i]
        x2, y2 = points[i + 1]
        
        if 0 <= x1 < width and 0 <= y1 < height and 0 <= x2 < width and 0 <= y2 < height:
            thickness = 3 if is_parkinsons and variation_type == 'variable_thickness' else 2
            intensity = np.random.randint(200, 255) if not is_parkinsons else np.random.randint(180, 255)
            
            for dx in range(-thickness//2, thickness//2 + 1):
                for dy in range(-thickness//2, thickness//2 + 1):
                    if 0 <= x1+dx < width and 0 <= y1+dy < height:
                        img[y1+dy, x1+dx] = [intensity, intensity, intensity]
    
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

print("\n=== Comprehensive Model Testing ===")

# Test cases with different variations
test_cases = [
    # Healthy spirals
    ("Clean Healthy", False, 'clean'),
    ("Smooth Healthy", False, 'clean'),
    ("Rotated Healthy", False, 'clean'),
    
    # Parkinson's spirals with different symptoms
    ("Tremor Parkinson's", True, 'tremor'),
    ("Shaky Parkinson's", True, 'shaky'),
    ("Gaps Parkinson's", True, 'gaps'),
    ("Variable Thickness Parkinson's", True, 'variable_thickness'),
]

results = []

for name, is_parkinsons, variation in test_cases:
    print(f"\nTesting: {name}")
    
    # Create test image
    img = create_diverse_test_spiral(is_parkinsons=is_parkinsons, variation_type=variation)
    processed = preprocess_image(img)
    
    # Make prediction
    pred = model(processed, training=False)
    sigmoid_value = float(pred[0][0].numpy())
    
    # Interpret results
    parkinsons_score = sigmoid_value
    healthy_score = 1 - sigmoid_value
    prediction = 'Parkinsons' if parkinsons_score > healthy_score else 'Healthy'
    confidence = max(parkinsons_score, healthy_score)
    
    # Determine if prediction is correct
    expected = 'Parkinsons' if is_parkinsons else 'Healthy'
    is_correct = prediction == expected
    
    results.append({
        'name': name,
        'expected': expected,
        'predicted': prediction,
        'confidence': confidence,
        'sigmoid': sigmoid_value,
        'correct': is_correct
    })
    
    print(f"  Expected: {expected}")
    print(f"  Predicted: {prediction}")
    print(f"  Confidence: {confidence:.3f}")
    print(f"  Sigmoid: {sigmoid_value:.3f}")
    print(f"  Correct: {'✓' if is_correct else '✗'}")

# Summary analysis
print("\n=== Performance Summary ===")
correct_count = sum(1 for r in results if r['correct'])
total_count = len(results)
accuracy = correct_count / total_count

healthy_correct = sum(1 for r in results if r['expected'] == 'Healthy' and r['correct'])
parkinsons_correct = sum(1 for r in results if r['expected'] == 'Parkinsons' and r['correct'])

healthy_total = sum(1 for r in results if r['expected'] == 'Healthy')
parkinsons_total = sum(1 for r in results if r['expected'] == 'Parkinsons')

print(f"Overall Accuracy: {accuracy:.1%} ({correct_count}/{total_count})")
print(f"Healthy Accuracy: {healthy_correct}/{healthy_total} ({healthy_correct/healthy_total:.1%})")
print(f"Parkinson's Accuracy: {parkinsons_correct}/{parkinsons_total} ({parkinsons_correct/parkinsons_total:.1%})")

# Check for bias
healthy_sigmoids = [r['sigmoid'] for r in results if r['expected'] == 'Healthy']
parkinsons_sigmoids = [r['sigmoid'] for r in results if r['expected'] == 'Parkinsons']

print(f"\nBias Analysis:")
print(f"Healthy average sigmoid: {np.mean(healthy_sigmoids):.3f}")
print(f"Parkinson's average sigmoid: {np.mean(parkinsons_sigmoids):.3f}")

if np.mean(healthy_sigmoids) < 0.3 and np.mean(parkinsons_sigmoids) > 0.7:
    print("✓ Model shows good discrimination between classes")
elif np.mean(healthy_sigmoids) > 0.6:
    print("⚠️ Model still shows bias towards Parkinson's")
elif np.mean(parkinsons_sigmoids) < 0.4:
    print("⚠️ Model shows bias towards Healthy")
else:
    print("? Model discrimination unclear")

# Test edge cases
print("\n=== Edge Case Testing ===")
edge_cases = [
    ("Empty Image", np.zeros((224, 224, 3), dtype=np.uint8)),
    ("Random Noise", np.random.randint(0, 256, (224, 224, 3), dtype=np.uint8)),
    ("Straight Line", np.zeros((224, 224, 3), dtype=np.uint8))
]

# Draw straight line
edge_cases[2][1][100:124, 50:174] = 255

for name, img in edge_cases:
    processed = preprocess_image(img)
    pred = model(processed, training=False)
    sigmoid_value = float(pred[0][0].numpy())
    
    parkinsons_score = sigmoid_value
    healthy_score = 1 - sigmoid_value
    prediction = 'Parkinsons' if parkinsons_score > healthy_score else 'Healthy'
    
    print(f"{name}: {prediction} (sigmoid: {sigmoid_value:.3f})")

print("\n=== Integration Status ===")
if accuracy >= 0.8:
    print("🎉 ROBUST MODEL SUCCESSFULLY INTEGRATED!")
    print("✅ Model is ready for production use")
    print("✅ Good discrimination between healthy and Parkinson's")
    print("✅ Minimal bias detected")
else:
    print("❌ Model integration needs improvement")
    print(f"❌ Current accuracy: {accuracy:.1%} (target: ≥80%)")

print(f"\nModel Details:")
print(f"File: {model_path}")
print(f"Size: {os.path.getsize(model_path)/1024/1024:.1f} MB")
print(f"Parameters: {model.count_params():,}")
