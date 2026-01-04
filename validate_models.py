"""
Quick validation script to test model predictions and fix class label issues
"""

import tensorflow as tf
import numpy as np
from pathlib import Path
from PIL import Image

print("="*60)
print("Model Validation & Class Label Fix")
print("="*60)

# Paths
SPIRAL_MODEL = 'public/models/spiral/mobilenet_spiral.h5'
WAVE_MODEL = 'public/models/wave/inception_wave_v2.h5'
SPIRAL_TEST = 'spiral/testing'
WAVE_TEST = 'wave/testing'

def test_model(model_path, test_dir, preprocess_fn, model_name):
    """Test a model and check if class labels need inversion"""
    print(f"\n{model_name} Model:")
    print("-" * 40)
    
    # Load model
    model = tf.keras.models.load_model(model_path, compile=False)
    print(f"✓ Model loaded: {model.input_shape}")
    
    # Test on some Parkinson's images
    parkinson_images = list(Path(test_dir).glob('parkinson/*.png'))[:5]
    healthy_images = list(Path(test_dir).glob('healthy/*.png'))[:5]
    
    parkinson_correct = 0
    healthy_correct = 0
    
    print("\nParkinson's Images:")
    for img_path in parkinson_images:
        img = Image.open(img_path)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        img = img.resize((224, 224))
        img_array = np.array(img, dtype=np.float32)
        img_array = preprocess_fn(img_array)
        img_array = np.expand_dims(img_array, axis=0)
        
        pred = model.predict(img_array, verbose=0)[0][0]
        pred_class = "Parkinsons" if pred < 0.5 else "Healthy"
        confidence = (1 - pred) * 100 if pred < 0.5 else pred * 100
        
        correct = pred < 0.5
        if correct:
            parkinson_correct += 1
        status = "✓" if correct else "✗"
        
        print(f"  {status} {img_path.name}: {pred_class} ({confidence:.1f}%) [raw: {pred:.3f}]")
    
    print(f"\nHealthy Images:")
    for img_path in healthy_images:
        img = Image.open(img_path)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        img = img.resize((224, 224))
        img_array = np.array(img, dtype=np.float32)
        img_array = preprocess_fn(img_array)
        img_array = np.expand_dims(img_array, axis=0)
        
        pred = model.predict(img_array, verbose=0)[0][0]
        pred_class = "Parkinsons" if pred < 0.5 else "Healthy"
        confidence = (1 - pred) * 100 if pred < 0.5 else pred * 100
        
        correct = pred >= 0.5
        if correct:
            healthy_correct += 1
        status = "✓" if correct else "✗"
        
        print(f"  {status} {img_path.name}: {pred_class} ({confidence:.1f}%) [raw: {pred:.3f}]")
    
    accuracy = (parkinson_correct + healthy_correct) / (len(parkinson_images) + len(healthy_images)) * 100
    print(f"\nAccuracy: {accuracy:.1f}% ({parkinson_correct}/{len(parkinson_images)} Parkinson's, {healthy_correct}/{len(healthy_images)} Healthy)")
    
    # Check if labels might be inverted
    if parkinson_correct < len(parkinson_images) / 2 and healthy_correct < len(healthy_images) / 2:
        print("⚠️  WARNING: Model appears to have inverted class labels!")
        print("   Solution: Backend should interpret: 0=Healthy, 1=Parkinson's OR invert during training")
    
    return accuracy

# Test Spiral Model
def preprocess_spiral(img_array):
    return (img_array / 127.5) - 1.0  # MobileNetV2: [-1, 1]

# Test Wave Model
def preprocess_wave(img_array):
    return img_array / 255.0  # InceptionV3: [0, 1]

spiral_acc = test_model(SPIRAL_MODEL, SPIRAL_TEST, preprocess_spiral, "Spiral (MobileNetV2)")
wave_acc = test_model(WAVE_MODEL, WAVE_TEST, preprocess_wave, "Wave (InceptionV3)")

print("\n" + "="*60)
print("Summary")
print("="*60)
print(f"Spiral Model: {spiral_acc:.1f}% accuracy")
print(f"Wave Model: {wave_acc:.1f}% accuracy")
print("\nRecommendation:")
if spiral_acc < 70 or wave_acc < 70:
    print("  Models need retraining with proper class labels and better data augmentation")
else:
    print("  Models are performing well!")
