import tensorflow as tf
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance
import os
import cv2

# Load the current model
model_path = 'backend/models/spiral/mobilenet_spiral.h5'
print("Debugging current model performance...")
model = tf.keras.models.load_model(model_path, compile=False)
print(f"Model loaded: {model.input_shape} -> {model.output_shape}")

def create_realistic_spiral(width=224, height=224, is_parkinsons=False):
    """Create more realistic spiral images"""
    # Create black background
    img = np.zeros((height, width, 3), dtype=np.uint8)
    
    center_x, center_y = width // 2, height // 2
    max_radius = min(width, height) // 3
    
    # Draw spiral with more realistic characteristics
    points = []
    num_points = 800
    
    for i in range(num_points):
        t = i / num_points
        
        if is_parkinsons:
            # Parkinson's characteristics:
            # - Fewer spiral turns
            # - Irregular spacing
            # - Tremor/shaking
            # - Variable line thickness
            num_turns = np.random.uniform(2, 3.5)
            angle = t * num_turns * 2 * np.pi
            
            # Add tremor
            tremor_freq = np.random.uniform(10, 20)
            tremor_amp = np.random.uniform(2, 5)
            angle += tremor_amp * np.sin(tremor_freq * t * 2 * np.pi) * 0.1
            
            # Irregular radius progression
            radius = t * max_radius + np.random.normal(0, 3)
            if i % 50 == 0:  # Sudden jumps
                radius += np.random.normal(0, 8)
        else:
            # Healthy characteristics:
            # - More complete turns
            # - Smooth progression
            # - Consistent spacing
            num_turns = np.random.uniform(4, 6)
            angle = t * num_turns * 2 * np.pi
            radius = t * max_radius + np.random.normal(0, 0.5)
        
        x = int(center_x + radius * np.cos(angle))
        y = int(center_y + radius * np.sin(angle))
        points.append((x, y))
    
    # Draw the spiral with variable line thickness
    for i in range(len(points) - 1):
        if is_parkinsons:
            # Variable thickness for Parkinson's
            thickness = np.random.randint(1, 4)
        else:
            # Consistent thickness for healthy
            thickness = 2
            
        x1, y1 = points[i]
        x2, y2 = points[i + 1]
        
        if 0 <= x1 < width and 0 <= y1 < height and 0 <= x2 < width and 0 <= y2 < height:
            # Draw line with thickness
            cv2.line(img, (x1, y1), (x2, y2), (255, 255, 255), thickness)
    
    return img

def add_realistic_variations(img):
    """Add realistic image variations"""
    # Convert to PIL for easier manipulation
    pil_img = Image.fromarray(img)
    
    # Random rotation
    angle = np.random.uniform(-10, 10)
    pil_img = pil_img.rotate(angle, fillcolor=(0, 0, 0))
    
    # Random brightness/contrast
    if np.random.random() > 0.5:
        enhancer = ImageEnhance.Brightness(pil_img)
        pil_img = enhancer.enhance(np.random.uniform(0.7, 1.3))
    
    if np.random.random() > 0.5:
        enhancer = ImageEnhance.Contrast(pil_img)
        pil_img = enhancer.enhance(np.random.uniform(0.8, 1.2))
    
    # Add noise
    img_array = np.array(pil_img)
    noise = np.random.normal(0, 5, img_array.shape)
    img_array = np.clip(img_array + noise, 0, 255).astype(np.uint8)
    
    # Simulate pen pressure variations
    if np.random.random() > 0.3:
        # Make some parts lighter/darker
        mask = np.random.random(img_array.shape[:2]) > 0.8
        img_array[mask] = np.clip(img_array[mask] * np.random.uniform(0.5, 1.5), 0, 255).astype(np.uint8)
    
    return img_array

def preprocess_image(img):
    """Preprocess image for MobileNetV2"""
    img = Image.fromarray(img)
    img = img.resize((224, 224))
    img_array = np.array(img, dtype=np.float32)
    # MobileNetV2 preprocessing: [-1, 1]
    img_array = (img_array / 127.5) - 1.0
    img_array = np.expand_dims(img_array, axis=0)
    return img_array

print("\n=== Testing with More Realistic Spirals ===")

# Test multiple variations
results = {'healthy': [], 'parkinsons': []}

for label, is_parkinsons in [('healthy', False), ('parkinsons', True)]:
    print(f"\nTesting {label} spirals (10 variations)...")
    
    for i in range(10):
        # Create base spiral
        base_img = create_realistic_spiral(is_parkinsons=is_parkinsons)
        
        # Add variations
        varied_img = add_realistic_variations(base_img)
        
        # Preprocess and predict
        processed = preprocess_image(varied_img)
        pred = model(processed, training=False)
        sigmoid_value = float(pred[0][0].numpy())
        
        # Interpret results
        parkinsons_score = sigmoid_value
        healthy_score = 1 - sigmoid_value
        prediction = 'Parkinsons' if parkinsons_score > healthy_score else 'Healthy'
        confidence = max(parkinsons_score, healthy_score)
        
        results[label].append({
            'sigmoid': sigmoid_value,
            'prediction': prediction,
            'confidence': confidence,
            'parkinsons_score': parkinsons_score,
            'healthy_score': healthy_score
        })
        
        print(f"  Test {i+1}: {prediction} (confidence: {confidence:.3f}, sigmoid: {sigmoid_value:.3f})")

# Analyze results
print("\n=== Performance Analysis ===")

for label in ['healthy', 'parkinsons']:
    predictions = [r['prediction'] for r in results[label]]
    confidences = [r['confidence'] for r in results[label]]
    sigmoid_values = [r['sigmoid'] for r in results[label]]
    
    correct_count = sum(1 for p in predictions if p.lower() == label)
    accuracy = correct_count / len(predictions)
    avg_confidence = np.mean(confidences)
    avg_sigmoid = np.mean(sigmoid_values)
    
    print(f"\n{label.upper()} Spirals:")
    print(f"  Accuracy: {accuracy:.1%} ({correct_count}/10)")
    print(f"  Average confidence: {avg_confidence:.3f}")
    print(f"  Average sigmoid: {avg_sigmoid:.3f}")
    print(f"  Predictions: {predictions}")

# Check model bias
all_sigmoids = results['healthy'] + results['parkinsons']
all_sigmoid_values = [r['sigmoid'] for r in all_sigmoids]
print(f"\nModel Bias Analysis:")
print(f"  Overall sigmoid range: {min(all_sigmoid_values):.3f} - {max(all_sigmoid_values):.3f}")
print(f"  Average sigmoid: {np.mean(all_sigmoid_values):.3f}")
print(f"  Sigmoid std: {np.std(all_sigmoid_values):.3f}")

if np.mean(all_sigmoid_values) > 0.6:
    print("  ⚠️  Model shows bias towards Parkinson's")
elif np.mean(all_sigmoid_values) < 0.4:
    print("  ⚠️  Model shows bias towards Healthy")
else:
    print("  ✓ Model appears balanced")

# Test with edge cases
print("\n=== Edge Case Testing ===")

edge_cases = [
    ("Empty image", np.zeros((224, 224, 3), dtype=np.uint8)),
    ("Random noise", np.random.randint(0, 256, (224, 224, 3), dtype=np.uint8)),
    ("Straight line", np.zeros((224, 224, 3), dtype=np.uint8))
]

# Draw a straight line
cv2.line(edge_cases[2][1], (50, 112), (174, 112), (255, 255, 255), 3)

for name, img in edge_cases:
    processed = preprocess_image(img)
    pred = model(processed, training=False)
    sigmoid_value = float(pred[0][0].numpy())
    
    parkinsons_score = sigmoid_value
    healthy_score = 1 - sigmoid_value
    prediction = 'Parkinsons' if parkinsons_score > healthy_score else 'Healthy'
    
    print(f"  {name}: {prediction} (sigmoid: {sigmoid_value:.3f})")

print("\n=== Diagnosis Complete ===")
print("If model performance is poor, the issue may be:")
print("1. Training data doesn't match real test conditions")
print("2. Model architecture needs improvement")
print("3. Need more diverse training data")
print("4. Preprocessing mismatch between training and inference")
