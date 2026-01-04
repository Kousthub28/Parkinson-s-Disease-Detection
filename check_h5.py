import h5py
import json

# Check H5 file structure
with h5py.File('public/models/spiral/mobilenet_spiral.h5', 'r') as f:
    print("="*60)
    print("H5 File Structure:")
    print("="*60)
    
    # Check model config
    if 'model_config' in f.attrs:
        config = json.loads(f.attrs['model_config'])
        print("\nModel Type:", config['class_name'])
        print("\nLayers:")
        for i, layer in enumerate(config['config']['layers']):
            print(f"  {i}: {layer['class_name']} - {layer['config'].get('name', 'unnamed')}")
    
    # Check weights
    if 'model_weights' in f:
        print("\n" + "="*60)
        print("Weights structure:")
        print("="*60)
        weights = f['model_weights']
        layer_names = weights.attrs.get('layer_names', [])
        print(f"Total layers with weights: {len(layer_names)}")
        for name in layer_names[:5]:
            print(f"  - {name}")
        if len(layer_names) > 5:
            print(f"  ... and {len(layer_names) - 5} more")
