"""
Check wave model and retrain if needed
"""

import tensorflow as tf
import os
from pathlib import Path

WAVE_MODEL_PATH = 'inception_wave_best.keras'
WAVE_TRAIN_DIR = 'wave/training'
WAVE_TEST_DIR = 'wave/testing'

print("="*60)
print("Wave Model Analysis")
print("="*60)

# Check if model exists
print(f"\nModel file: {WAVE_MODEL_PATH}")
print(f"  Exists: {os.path.exists(WAVE_MODEL_PATH)}")
if os.path.exists(WAVE_MODEL_PATH):
    print(f"  Size: {os.path.getsize(WAVE_MODEL_PATH) / (1024*1024):.2f} MB")

# Check dataset
train_parkinson = len(list(Path(WAVE_TRAIN_DIR).glob('parkinson/*.png')))
train_healthy = len(list(Path(WAVE_TRAIN_DIR).glob('healthy/*.png')))
test_parkinson = len(list(Path(WAVE_TEST_DIR).glob('parkinson/*.png')))
test_healthy = len(list(Path(WAVE_TEST_DIR).glob('healthy/*.png')))

print(f"\nWave Dataset:")
print(f"  Train - Parkinson: {train_parkinson}, Healthy: {train_healthy}")
print(f"  Test - Parkinson: {test_parkinson}, Healthy: {test_healthy}")

# Try to load model
print(f"\nAttempting to load wave model...")
try:
    model = tf.keras.models.load_model(WAVE_MODEL_PATH, compile=False)
    print("✓ Model loaded successfully!")
    print(f"  Input shape: {model.input_shape}")
    print(f"  Output shape: {model.output_shape}")
    print(f"  Total layers: {len(model.layers)}")
    print(f"  Model type: {type(model).__name__}")
    
    # Test prediction
    import numpy as np
    test_input = np.random.rand(1, model.input_shape[1], model.input_shape[2], 3).astype(np.float32)
    prediction = model.predict(test_input, verbose=0)
    print(f"\n  Test prediction shape: {prediction.shape}")
    print(f"  Test prediction value: {prediction[0]}")
    
except Exception as e:
    print(f"✗ Failed to load: {e}")
    print("\nModel needs retraining!")

print("\n" + "="*60)
