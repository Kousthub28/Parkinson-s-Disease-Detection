import tensorflow as tf
import numpy as np
from PIL import Image, ImageDraw
import os

# Test current wave model
model_path = 'backend/models/wave/inception_wave_v2.h5'
print("Testing current wave model...")
print(f"Model file: {model_path}")
print(f"Model exists: {os.path.exists(model_path)}")

if os.path.exists(model_path):
    model = tf.keras.models.load_model(model_path, compile=False)
    print(f"Model loaded: {model.input_shape} -> {model.output_shape}")
    print(f"Model size: {os.path.getsize(model_path)/1024/1024:.1f} MB")
else:
    print("Model file not found!")
    exit()

def create_test_wave_image(width=224, height=224, is_parkinsons=False):
    """Create a synthetic wave image for testing"""
    img = np.zeros((height, width, 3), dtype=np.uint8)
    
    # Wave parameters
    center_y = height // 2
    amplitude = 40 if not is_parkinsons else 35  # Parkinson's: smaller amplitude
    frequency = 4 if not is_parkinsons else 3     # Parkinson's: fewer oscillations
    phase_shift = np.random.uniform(0, 2*np.pi)
    
    # Add tremor for Parkinson's
    tremor_amplitude = 0 if not is_parkinsons else 5
    
    points = []
    for x in range(width):
        if is_parkinsons:
            # Parkinson's wave: irregular, shaky
            y = center_y + amplitude * np.sin(frequency * (x/width) * 2 * np.pi + phase_shift)
            y += np.random.normal(0, tremor_amplitude)  # Add tremor
            y += 2 * np.sin(20 * (x/width) * 2 * np.pi)  # High frequency noise
        else:
            # Healthy wave: smooth, regular
            y = center_y + amplitude * np.sin(frequency * (x/width) * 2 * np.pi + phase_shift)
            y += np.random.normal(0, 1)  # Minor natural variation
        
        y = int(np.clip(y, 10, height-10))
        points.append((x, y))
    
    # Draw the wave
    for i in range(len(points) - 1):
        x1, y1 = points[i]
        x2, y2 = points[i + 1]
        
        # Draw with thickness
        thickness = 3 if not is_parkinsons else 2
        for dy in range(-thickness//2, thickness//2 + 1):
            if 0 <= y1+dy < height and 0 <= y2+dy < height:
                img[y1+dy, x1:x2+1] = [255, 255, 255]
    
    return img

def preprocess_for_inception(img):
    """Preprocess image for InceptionV3"""
    img = Image.fromarray(img)
    img = img.resize((224, 224))  # InceptionV3 typically uses 299x299, but we'll use 224 for consistency
    img_array = np.array(img, dtype=np.float32)
    # InceptionV3 preprocessing: [0, 1]
    img_array = img_array / 255.0
    img_array = np.expand_dims(img_array, axis=0)
    return img_array

print("\n=== Testing Current Wave Model ===")

# Test with healthy wave
print("\n1. Testing with HEALTHY wave...")
healthy_img = create_test_wave_image(is_parkinsons=False)
healthy_processed = preprocess_for_inception(healthy_img)
pred_healthy = model(healthy_processed, training=False)
sigmoid_healthy = float(pred_healthy[0][0].numpy())

# Wave model: high value = Healthy, low value = Parkinson's
healthy_score_healthy = sigmoid_healthy
parkinsons_score_healthy = 1 - sigmoid_healthy

print(f"Raw sigmoid output: {sigmoid_healthy:.6f}")
print(f"Healthy score: {healthy_score_healthy:.6f}")
print(f"Parkinson's score: {parkinsons_score_healthy:.6f}")
print(f"Prediction: {'Parkinsons' if parkinsons_score_healthy > healthy_score_healthy else 'Healthy'}")

# Test with Parkinson's wave
print("\n2. Testing with PARKINSON'S wave...")
parkinsons_img = create_test_wave_image(is_parkinsons=True)
parkinsons_processed = preprocess_for_inception(parkinsons_img)
pred_parkinsons = model(parkinsons_processed, training=False)
sigmoid_parkinsons = float(pred_parkinsons[0][0].numpy())

healthy_score_parkinsons = sigmoid_parkinsons
parkinsons_score_parkinsons = 1 - sigmoid_parkinsons

print(f"Raw sigmoid output: {sigmoid_parkinsons:.6f}")
print(f"Healthy score: {healthy_score_parkinsons:.6f}")
print(f"Parkinson's score: {parkinsons_score_parkinsons:.6f}")
print(f"Prediction: {'Parkinsons' if parkinsons_score_parkinsons > healthy_score_parkinsons else 'Healthy'}")

# Test with random noise
print("\n3. Testing with RANDOM NOISE...")
noise_img = np.random.randint(0, 256, (224, 224, 3), dtype=np.uint8)
noise_processed = preprocess_for_inception(noise_img)
pred_noise = model(noise_processed, training=False)
sigmoid_noise = float(pred_noise[0][0].numpy())

healthy_score_noise = sigmoid_noise
parkinsons_score_noise = 1 - sigmoid_noise

print(f"Raw sigmoid output: {sigmoid_noise:.6f}")
print(f"Healthy score: {healthy_score_noise:.6f}")
print(f"Parkinson's score: {parkinsons_score_noise:.6f}")
print(f"Prediction: {'Parkinsons' if parkinsons_score_noise > healthy_score_noise else 'Healthy'}")

print("\n=== Analysis ===")
print(f"Healthy wave correctly identified: {'YES' if healthy_score_healthy > parkinsons_score_healthy else 'NO'}")
print(f"Parkinson's wave correctly identified: {'YES' if parkinsons_score_parkinsons > healthy_score_parkinsons else 'NO'}")
print(f"Model bias: {'Healthy' if sigmoid_noise > 0.5 else 'Parkinsons'}")

# Check model bias
all_sigmoids = [sigmoid_healthy, sigmoid_parkinsons, sigmoid_noise]
print(f"\nModel bias analysis:")
print(f"Sigmoid range: {min(all_sigmoids):.3f} - {max(all_sigmoids):.3f}")
print(f"Average sigmoid: {np.mean(all_sigmoids):.3f}")

if np.mean(all_sigmoids) > 0.7:
    print("⚠️ Model shows bias towards Healthy")
elif np.mean(all_sigmoids) < 0.3:
    print("⚠️ Model shows bias towards Parkinson's")
else:
    print("✓ Model appears balanced")

print("\n=== Model Information ===")
print(f"Model layers: {len(model.layers)}")
print(f"Total parameters: {model.count_params():,}")

# Show last few layers
print("\nLast 5 layers:")
for layer in model.layers[-5:]:
    print(f"  {layer.name}: {layer.__class__.__name__}")
