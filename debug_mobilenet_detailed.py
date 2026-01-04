"""
Detailed analysis of MobileNetV2 layer structure
"""

import h5py
import tensorflow as tf

H5_PATH = 'public/models/spiral/mobilenet_spiral.h5'

print("="*60)
print("MobileNetV2 Layer Comparison")
print("="*60)

# Build the model to get layer names
base_model = tf.keras.applications.MobileNetV2(
    input_shape=(224, 224, 3),
    include_top=False,
    weights='imagenet',
    pooling=None
)
base_model._name = 'mobilenetv2_1.00_224'

print(f"\n📋 Model MobileNetV2 has {len(base_model.layers)} layers")
print("\nFirst 20 layer names in MODEL:")
for i, layer in enumerate(base_model.layers[:20]):
    print(f"  {i}: {layer.name} ({layer.__class__.__name__})")

# Now check H5 file
print("\n" + "="*60)
print("H5 File Structure")
print("="*60)

with h5py.File(H5_PATH, 'r') as f:
    model_weights = f['model_weights']
    mobilenet_group = model_weights['mobilenetv2_1.00_224'.encode('utf-8')]
    
    # Get all keys (layer names) in H5 file
    h5_keys = list(mobilenet_group.keys())
    print(f"\n📋 H5 MobileNetV2 has {len(h5_keys)} sub-groups")
    print("\nFirst 20 layer names in H5:")
    for i, key in enumerate(h5_keys[:20]):
        key_str = key.decode('utf-8') if isinstance(key, bytes) else key
        print(f"  {i}: {key_str}")
    
    # Check if any names match
    print("\n" + "="*60)
    print("Matching Analysis")
    print("="*60)
    
    model_names = set([layer.name for layer in base_model.layers])
    h5_names = set([k.decode('utf-8') if isinstance(k, bytes) else k for k in h5_keys])
    
    matches = model_names.intersection(h5_names)
    print(f"\n✓ {len(matches)} exact name matches found!")
    
    if len(matches) > 0:
        print("\nMatching names (first 10):")
        for name in list(matches)[:10]:
            print(f"  - {name}")
    
    model_only = model_names - h5_names
    h5_only = h5_names - model_names
    
    if len(model_only) > 0:
        print(f"\n⚠️  {len(model_only)} names only in MODEL (first 5):")
        for name in list(model_only)[:5]:
            print(f"  - {name}")
    
    if len(h5_only) > 0:
        print(f"\n⚠️  {len(h5_only)} names only in H5 (first 5):")
        for name in list(h5_only)[:5]:
            print(f"  - {name}")

print("\n" + "="*60)
