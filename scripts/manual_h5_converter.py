"""
Manual H5 to JSON converter - reads Keras H5 and creates TensorFlow.js compatible files
This works without TensorFlow by directly reading the H5 file structure
"""
import h5py
import json
import numpy as np
import os

def convert_h5_to_tfjs_manual(h5_path, output_dir):
    """Convert H5 model to TensorFlow.js format manually"""
    
    print("=" * 60)
    print("Manual H5 to TensorFlow.js Converter")
    print("=" * 60)
    print(f"\n📁 Input:  {h5_path}")
    print(f"📁 Output: {output_dir}\n")
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Open H5 file
    print("🔄 Reading H5 file...")
    with h5py.File(h5_path, 'r') as f:
        # Get model config
        if 'model_config' in f.attrs:
            model_config_str = f.attrs['model_config']
            if isinstance(model_config_str, bytes):
                model_config_str = model_config_str.decode('utf-8')
            model_config = json.loads(model_config_str)
            print(f"✓ Found model configuration")
        else:
            print("❌ No model_config found in H5 file")
            return False
        
        # Extract weights
        print("🔄 Extracting weights...")
        weights_group = f['model_weights']

        all_weights = []
        weight_names = []

        # Preserve the exact Keras weight order to match layer expectations
        layer_names = weights_group.attrs.get('layer_names', [])
        for raw_layer_name in layer_names:
            layer_name = raw_layer_name.decode('utf-8') if isinstance(raw_layer_name, bytes) else raw_layer_name
            layer_group = weights_group[layer_name]
            w_names = layer_group.attrs.get('weight_names', [])
            for raw_w_name in w_names:
                w_name = raw_w_name.decode('utf-8') if isinstance(raw_w_name, bytes) else raw_w_name
                dataset = layer_group[w_name]
                weight_data = dataset[:]
                all_weights.append(weight_data)
                weight_names.append(f"{layer_name}/{w_name}")
                print(f"  ✓ {layer_name}/{w_name}: {weight_data.shape}")

        print(f"\n✓ Extracted {len(all_weights)} weight tensors (ordered)")
        
        # Save weights as binary
        print("\n🔄 Saving weights...")
        weights_file = os.path.join(output_dir, 'group1-shard1of1.bin')
        
        # Concatenate all weights into single binary file
        with open(weights_file, 'wb') as wf:
            for weight in all_weights:
                # Convert to float32 and write
                weight_float32 = weight.astype(np.float32)
                wf.write(weight_float32.tobytes())
        
        weights_size = os.path.getsize(weights_file)
        print(f"✓ Saved weights: {weights_size / (1024*1024):.2f} MB")
        
        # Create model.json
        print("\n🔄 Creating model.json...")
        
        # Build weight manifest
        weight_specs = []
        offset = 0
        for i, (name, weight) in enumerate(zip(weight_names, all_weights)):
            shape = list(weight.shape)
            size = np.prod(shape)
            weight_specs.append({
                "name": name,
                "shape": shape,
                "dtype": "float32"
            })
            offset += size * 4  # 4 bytes per float32
        
        # Fix every InputLayer to include batch_input_shape (tfjs requires it)
        def fix_input_layers(node):
            if not isinstance(node, dict):
                return

            # If this node is an InputLayer, ensure shapes are set
            if node.get('class_name') in ['InputLayer', 'Input']:
                cfg = node.get('config', {})
                if 'batch_input_shape' not in cfg:
                    if 'batch_shape' in cfg:
                        cfg['batch_input_shape'] = cfg['batch_shape']
                    elif 'shape' in cfg:
                        cfg['batch_input_shape'] = [None] + list(cfg['shape'])
                    else:
                        cfg['batch_input_shape'] = [None, 224, 224, 3]
                    print(f"  ✓ Added batch_input_shape to {cfg.get('name', 'input_layer')}: {cfg['batch_input_shape']}")
                # Mirror batch_shape if missing to keep both fields consistent
                if 'batch_shape' not in cfg and 'batch_input_shape' in cfg:
                    cfg['batch_shape'] = cfg['batch_input_shape']

            # Recurse through nested config structures
            cfg = node.get('config')
            if isinstance(cfg, dict):
                for val in cfg.values():
                    if isinstance(val, list):
                        for item in val:
                            fix_input_layers(item)
                    elif isinstance(val, dict):
                        fix_input_layers(val)

        fix_input_layers(model_config)

        # Normalize inbound_nodes structure for tfjs (expects array-of-arrays)
        def fix_inbound_nodes(node):
            if isinstance(node, dict):
                if 'inbound_nodes' in node and isinstance(node['inbound_nodes'], list):
                    inbound = node['inbound_nodes']
                    if len(inbound) > 0 and isinstance(inbound[0], dict):
                        normalized = []
                        for entry in inbound:
                            if isinstance(entry, dict):
                                keras_history = None
                                args = entry.get('args')
                                if isinstance(args, list) and len(args) > 0 and isinstance(args[0], dict):
                                    keras_history = args[0].get('config', {}).get('keras_history')
                                if keras_history and len(keras_history) == 3:
                                    normalized.append([[keras_history[0], keras_history[1], keras_history[2], {}]])
                                else:
                                    normalized.append([])
                            else:
                                normalized.append(entry)
                        node['inbound_nodes'] = normalized
                # Recurse
                for v in node.values():
                    fix_inbound_nodes(v)
            elif isinstance(node, list):
                for item in node:
                    fix_inbound_nodes(item)

        fix_inbound_nodes(model_config)
        
        # Create TensorFlow.js model JSON
        tfjs_model = {
            "format": "layers-model",
            "generatedBy": "manual-h5-converter",
            "convertedBy": "Python H5 manual converter v2",
            "modelTopology": model_config,
            "weightsManifest": [{
                "paths": ["group1-shard1of1.bin"],
                "weights": weight_specs
            }]
        }
        
        model_json_path = os.path.join(output_dir, 'model.json')
        with open(model_json_path, 'w') as mf:
            json.dump(tfjs_model, mf, indent=2)
        
        print(f"✓ Saved model.json")
        
        # List all files
        print("\n📂 Generated files:")
        for filename in os.listdir(output_dir):
            filepath = os.path.join(output_dir, filename)
            size_mb = os.path.getsize(filepath) / (1024 * 1024)
            print(f"  ✓ {filename:<30} ({size_mb:.2f} MB)")
        
        print("\n✅ Conversion completed successfully!")
        print("🎉 Model is ready to use in your web application!")
        print("   Load it using: tf.loadLayersModel('/models/spiral/model.json')")
        print("\n💡 Refresh your browser to see it in action!\n")
        
        return True

if __name__ == "__main__":
    import sys
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    h5_path = os.path.join(project_root, 'mobilenet_spiral_tuned.h5')
    output_dir = os.path.join(project_root, 'public', 'models', 'spiral')
    
    if not os.path.exists(h5_path):
        print(f"❌ ERROR: H5 file not found at: {h5_path}")
        sys.exit(1)
    
    success = convert_h5_to_tfjs_manual(h5_path, output_dir)
    sys.exit(0 if success else 1)
