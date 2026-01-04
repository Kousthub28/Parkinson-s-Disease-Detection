"""
Test both spiral and wave models with sample images
"""

import requests
from pathlib import Path

API_URL = 'http://localhost:5000/predict'

print("="*60)
print("Testing Multi-Model Backend")
print("="*60)

# Test spiral image
spiral_images = list(Path('spiral/testing/parkinson').glob('*.png'))
if spiral_images:
    spiral_img = spiral_images[0]
    print(f"\n1. Testing SPIRAL image: {spiral_img.name}")
    
    with open(spiral_img, 'rb') as f:
        files = {'image': f}
        data = {'type': 'spiral'}
        response = requests.post(API_URL, files=files, data=data)
    
    if response.ok:
        result = response.json()
        print(f"   ✓ Model: {result['modelInfo']['name']}")
        print(f"   ✓ Type: {result['modelInfo']['type']}")
        print(f"   ✓ Prediction: {result['label']} ({result['confidence']*100:.1f}%)")
    else:
        print(f"   ✗ Error: {response.text}")

# Test wave image
wave_images = list(Path('wave/testing/parkinson').glob('*.png'))
if wave_images:
    wave_img = wave_images[0]
    print(f"\n2. Testing WAVE image: {wave_img.name}")
    
    with open(wave_img, 'rb') as f:
        files = {'image': f}
        data = {'type': 'wave'}
        response = requests.post(API_URL, files=files, data=data)
    
    if response.ok:
        result = response.json()
        print(f"   ✓ Model: {result['modelInfo']['name']}")
        print(f"   ✓ Type: {result['modelInfo']['type']}")
        print(f"   ✓ Prediction: {result['label']} ({result['confidence']*100:.1f}%)")
    else:
        print(f"   ✗ Error: {response.text}")

# Test auto-detection
print(f"\n3. Testing AUTO-DETECTION with wave image")
if wave_images:
    with open(wave_images[0], 'rb') as f:
        files = {'image': f}
        # Don't send type - let backend detect
        response = requests.post(API_URL, files=files)
    
    if response.ok:
        result = response.json()
        print(f"   ✓ Detected: {result['modelInfo']['type']}")
        print(f"   ✓ Model: {result['modelInfo']['name']}")
        print(f"   ✓ Auto-detected: {result['modelInfo'].get('autoDetected', 'N/A')}")

print("\n" + "="*60)
