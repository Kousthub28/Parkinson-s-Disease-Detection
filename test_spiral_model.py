import tensorflow as tf
import h5py
import numpy as np
import json
import os

# Check if model files exist
keras_path = 'backend/parkinsons_spiral_mobilenetv2_final.keras'
h5_path = 'backend/models/spiral/mobilenet_spiral.h5'

print('=== Model Files Check ===')
print(f'Keras dir exists: {os.path.exists(keras_path)}')
print(f'H5 file exists: {os.path.exists(h5_path)}')

if os.path.exists(keras_path):
    config_path = os.path.join(keras_path, 'config.json')
    weights_path = os.path.join(keras_path, 'model.weights.h5')
    print(f'Config exists: {os.path.exists(config_path)}')
    print(f'Weights exists: {os.path.exists(weights_path)}')
    
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            config = json.load(f)
        layers = config.get('config', {}).get('layers', [])
        if layers:
            first_layer_config = layers[0].get('config', {})
            input_shape = first_layer_config.get('batch_shape', 'Unknown')
            print(f'Model input shape: {input_shape}')
        print(f'Total layers: {len(layers)}')

# Try to load both models and compare
print('\n=== Model Loading Test ===')
try:
    # Try H5 model first
    if os.path.exists(h5_path):
        h5_model = tf.keras.models.load_model(h5_path, compile=False)
        print('H5 Model loaded successfully')
        print(f'Input shape: {h5_model.input_shape}')
        print(f'Output shape: {h5_model.output_shape}')
        print(f'Number of layers: {len(h5_model.layers)}')
        
        # Test prediction with dummy data
        dummy_input = np.random.random((1, 224, 224, 3)).astype(np.float32)
        dummy_input = (dummy_input / 127.5) - 1.0  # MobileNetV2 preprocessing
        pred = h5_model(dummy_input, training=False)
        print(f'H5 Model prediction shape: {pred.shape}')
        print(f'H5 Model raw output: {pred[0][0].numpy():.6f}')
        
        # Check model summary
        print("\n=== Model Architecture ===")
        for i, layer in enumerate(h5_model.layers[-10:]):  # Show last 10 layers
            print(f"Layer {i}: {layer.name} - {layer.__class__.__name__}")
        
except Exception as e:
    print(f'H5 Model loading failed: {e}')
    import traceback
    traceback.print_exc()
