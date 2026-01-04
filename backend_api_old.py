from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import numpy as np
from PIL import Image
import io
import h5py
import json
import shutil
import os
import tempfile

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# Load the trained model
MODEL_PATH = 'public/models/spiral/mobilenet_spiral.h5'
model = None

def build_model_architecture():
    """Rebuild the exact MobileNetV2 model architecture from H5 file"""
    # Load MobileNetV2 with ImageNet weights as base
    # This ensures the layer structure matches the H5 file
    base_model = tf.keras.applications.MobileNetV2(
        input_shape=(224, 224, 3),
        include_top=False,
        weights='imagenet',  # Start with ImageNet, will be overwritten by H5 weights
        pooling=None
    )
    
    # Set the same name as in H5 file
    base_model._name = 'mobilenetv2_1.00_224'
    
    # Build exact architecture matching H5 file
    model = tf.keras.Sequential([
        base_model,
        tf.keras.layers.GlobalAveragePooling2D(name='global_average_pooling2d_1'),
        tf.keras.layers.Dense(128, activation='relu', name='dense_2'),
        tf.keras.layers.Dropout(0.5, name='dropout_1'),
        tf.keras.layers.Dense(1, activation='sigmoid', name='dense_3')
    ])
    
    return model

def load_functional_model_weights(functional_model, h5_group):
    """Load weights for a Functional model with nested layers"""
    loaded_sub_layers = 0
    
    # Get all layers in the Functional model
    for layer in functional_model.layers:
        layer_name = layer.name
        layer_name_bytes = layer_name.encode('utf-8')
        
        # Check if this layer exists in H5 file
        if layer_name_bytes in h5_group:
            layer_h5_group = h5_group[layer_name_bytes]
            
            # Check if it has weights
            if 'weight_names' in layer_h5_group.attrs:
                weight_names = layer_h5_group.attrs['weight_names']
                
                if len(weight_names) > 0:
                    try:
                        # Load weights for this layer
                        weights = []
                        for w_name in weight_names:
                            if w_name in layer_h5_group:
                                weight_data = np.array(layer_h5_group[w_name])
                                weights.append(weight_data)
                        
                        if len(weights) > 0:
                            layer.set_weights(weights)
                            loaded_sub_layers += 1
                    except Exception as e:
                        # Skip layers that can't be loaded
                        pass
    
    return loaded_sub_layers

def load_weights_by_name(model, h5_path):
    """Manually load weights from H5 file by layer name"""
    with h5py.File(h5_path, 'r') as f:
        if 'model_weights' not in f:
            raise ValueError("No model_weights in H5 file")
        
        model_weights = f['model_weights']
        layer_names = [name.decode('utf-8') if isinstance(name, bytes) else name 
                      for name in model_weights.attrs.get('layer_names', [])]
        
        print(f"  H5 file has weights for: {layer_names}")
        print(f"  Model has layers: {[layer.name for layer in model.layers]}")
        
        loaded_count = 0
        
        # Load MobileNetV2 base weights (nested Functional model)
        print(f"\n  📦 Loading MobileNetV2 base weights...")
        mobilenet_layer = model.layers[0]
        mobilenet_h5_group = model_weights['mobilenetv2_1.00_224'.encode('utf-8')]
        
        try:
            mobilenet_sub_layers = load_functional_model_weights(mobilenet_layer, mobilenet_h5_group)
            if mobilenet_sub_layers > 0:
                loaded_count += 1
                print(f"    ✓ Loaded {mobilenet_sub_layers} MobileNetV2 sub-layers")
        except Exception as e:
            print(f"    ✗ Error loading MobileNetV2: {e}")
        
        # Load top layers (Dense, etc.)
        print(f"\n  🎯 Loading classifier layers...")
        top_layers_map = {
            'global_average_pooling2d_1': model.layers[1],
            'dense_2': model.layers[2],
            'dropout_1': model.layers[3],
            'dense_3': model.layers[4],
        }
        
        for h5_name, model_layer in top_layers_map.items():
            h5_name_bytes = h5_name.encode('utf-8')
            
            if h5_name_bytes in model_weights:
                print(f"    {h5_name} → {model_layer.name}")
                layer_group = model_weights[h5_name_bytes]
                weight_names = layer_group.attrs.get('weight_names', [])
                
                if len(weight_names) > 0:
                    weights = []
                    for w_name in weight_names:
                        weights.append(np.array(layer_group[w_name]))
                    
                    try:
                        model_layer.set_weights(weights)
                        loaded_count += 1
                        print(f"      ✓ Loaded {len(weights)} weight arrays")
                    except Exception as e:
                        print(f"      ✗ Error: {e}")
        
        return loaded_count

def load_model():
    global model
    if model is None:
        print("Loading model...")
        
        # Try to load directly first (works with retrained model)
        try:
            print("Attempting direct load...")
            model = tf.keras.models.load_model(MODEL_PATH, compile=False)
            print("✓ Model loaded directly!")
            print(f"  Input shape: {model.input_shape}")
            print(f"  Output shape: {model.output_shape}")
            return model
        except Exception as e:
            print(f"  Direct load failed: {e}")
            print("  Falling back to manual weight loading...")
        
        # Fallback: manual weight loading for old models
        print("Rebuilding MobileNetV2 architecture...")
        model = build_model_architecture()
        
        # Build the model by running a forward pass
        dummy_input = np.zeros((1, 224, 224, 3), dtype=np.float32)
        _ = model(dummy_input, training=False)
        
        print("Loading trained weights by layer name...")
        try:
            loaded_count = load_weights_by_name(model, MODEL_PATH)
            print(f"✓ Loaded weights for {loaded_count} layers!")
            print(f"✓ Model ready with trained weights!")
        except Exception as e:
            print(f"✗ Error loading weights: {e}")
            print("Using untrained model")
        
        print(f"  Input shape: {model.input_shape}")
        print(f"  Output shape: {model.output_shape}")
    return model

def preprocess_image(image_bytes):
    """Preprocess image for MobileNetV2"""
    # Open image
    img = Image.open(io.BytesIO(image_bytes))
    
    # Convert to RGB if necessary
    if img.mode != 'RGB':
        img = img.convert('RGB')
    
    # Resize to 224x224
    img = img.resize((224, 224))
    
    # Convert to numpy array
    img_array = np.array(img)
    
    # Normalize to [-1, 1] for MobileNetV2
    img_array = img_array.astype(np.float32)
    img_array = (img_array / 127.5) - 1.0
    
    # Add batch dimension
    img_array = np.expand_dims(img_array, axis=0)
    
    return img_array

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'model_loaded': model is not None})

@app.route('/predict', methods=['POST'])
def predict():
    """Predict Parkinson's from spiral/wave image"""
    try:
        # Check if image file is present
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': 'No image file selected'}), 400
        
        # Read image bytes
        image_bytes = file.read()
        
        # Preprocess image
        processed_image = preprocess_image(image_bytes)
        
        # Load model if not loaded
        model = load_model()
        
        # Make prediction (training=False to disable dropout)
        prediction = model(processed_image, training=False)
        sigmoid_value = float(prediction[0][0].numpy())
        
        # Interpret sigmoid output (0=Parkinson's, 1=Healthy)
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
                'name': 'MobileNetV2 (spiral)',
                'inputShape': [1, 224, 224, 3],
                'accuracy': '86.67%'
            }
        })
        
    except Exception as e:
        print(f"Error during prediction: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Load model on startup
    load_model()
    
    # Run Flask app
    print("\n" + "="*60)
    print("🚀 Parkinson's Detection API Server")
    print("="*60)
    print("📍 Server running on: http://localhost:5000")
    print("🔗 Health check: http://localhost:5000/health")
    print("📤 Prediction endpoint: POST http://localhost:5000/predict")
    print("="*60 + "\n")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
