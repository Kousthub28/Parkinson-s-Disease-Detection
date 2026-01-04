"""
Try to load the H5 file directly with TensorFlow 2.11
"""

import tensorflow as tf
import numpy as np
from PIL import Image
import os

H5_PATH = 'public/models/spiral/mobilenet_spiral.h5'

print("="*60)
print("Loading H5 File with TensorFlow 2.11")
print("="*60)

print(f"\nTensorFlow version: {tf.__version__}")
print(f"File exists: {os.path.exists(H5_PATH)}")
print(f"File size: {os.path.getsize(H5_PATH) / (1024*1024):.2f} MB")

try:
    # Try loading directly with compile=False
    print("\nAttempting to load model...")
    model = tf.keras.models.load_model(H5_PATH, compile=False)
    
    print("\nSUCCESS! Model loaded!")
    print(f"  Input shape: {model.input_shape}")
    print(f"  Output shape: {model.output_shape}")
    print(f"  Total layers: {len(model.layers)}")
    
    # Test prediction
    print("\nTesting prediction with random image...")
    test_input = np.random.rand(1, 224, 224, 3).astype(np.float32)
    test_input = (test_input / 127.5) - 1.0  # MobileNetV2 preprocessing
    
    prediction = model.predict(test_input, verbose=0)
    print(f"  Prediction output: {prediction[0][0]:.6f}")
    print(f"  Output shape: {prediction.shape}")
    
    print("\nModel loaded successfully! We can use it directly!")
    
except Exception as e:
    print(f"\nFAILED to load: {e}")
    print("\nTrying with custom_objects...")
    
    try:
        custom_objects = {
            'DepthwiseConv2D': tf.keras.layers.DepthwiseConv2D,
        }
        model = tf.keras.models.load_model(H5_PATH, compile=False, custom_objects=custom_objects)
        print("\nSUCCESS with custom_objects!")
    except Exception as e2:
        print(f"\nStill failed: {e2}")

print("\n" + "="*60)
