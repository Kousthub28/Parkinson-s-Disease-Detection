"""
Debug script to understand MobileNetV2 weight structure in H5 file
"""

import h5py
import numpy as np

H5_PATH = 'public/models/spiral/mobilenet_spiral.h5'

print("="*60)
print("Analyzing MobileNetV2 Weights in H5 File")
print("="*60)

with h5py.File(H5_PATH, 'r') as f:
    model_weights = f['model_weights']
    
    # Get mobilenetv2 group
    mobilenet_name = 'mobilenetv2_1.00_224'
    if mobilenet_name.encode('utf-8') in model_weights:
        mobilenet_group = model_weights[mobilenet_name.encode('utf-8')]
        
        print(f"\n📦 {mobilenet_name} group found!")
        print(f"  Type: {type(mobilenet_group)}")
        
        # Check if it has weight_names attribute
        if 'weight_names' in mobilenet_group.attrs:
            weight_names = mobilenet_group.attrs['weight_names']
            print(f"\n  ✓ Has {len(weight_names)} weight arrays")
            
            # Show first few weights
            print("\n  First 10 weight arrays:")
            for i, w_name in enumerate(list(weight_names)[:10]):
                w_name_str = w_name.decode('utf-8') if isinstance(w_name, bytes) else w_name
                if w_name in mobilenet_group:
                    weight_data = mobilenet_group[w_name]
                    print(f"    {i}: {w_name_str} - shape: {weight_data.shape}, dtype: {weight_data.dtype}")
        else:
            print(f"\n  ✗ No weight_names attribute")
        
        # Check for nested layers (Functional model)
        print(f"\n  Keys in group: {list(mobilenet_group.keys())[:10]}")
        
        # Try to list all nested groups
        print("\n  Nested structure:")
        for key in list(mobilenet_group.keys())[:20]:
            item = mobilenet_group[key]
            if hasattr(item, 'keys'):  # It's a group
                print(f"    📁 {key.decode('utf-8') if isinstance(key, bytes) else key}")
                # Check if it has weight_names
                if 'weight_names' in item.attrs:
                    nested_weights = item.attrs['weight_names']
                    print(f"       └─ {len(nested_weights)} weights")
            else:  # It's a dataset
                print(f"    📄 {key.decode('utf-8') if isinstance(key, bytes) else key} - shape: {item.shape}")
    
    else:
        print(f"\n✗ {mobilenet_name} not found in H5 file")
        print(f"  Available layers: {list(model_weights.keys())}")

print("\n" + "="*60)
