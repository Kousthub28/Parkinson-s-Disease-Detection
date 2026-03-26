import requests
import numpy as np
from PIL import Image, ImageDraw
import io
import base64

def create_test_spiral_image(width=224, height=224, is_parkinsons=False):
    """Create a synthetic spiral image for testing"""
    img = Image.new('RGB', (width, height), (0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    center_x, center_y = width // 2, height // 2
    
    # Draw spiral pattern
    max_radius = min(width, height) // 3
    num_turns = 3 if is_parkinsons else 5  # Parkinson's spiral: less turns, more shaky
    
    for i in range(500):  # 500 points along the spiral
        angle = i * 0.1
        if is_parkinsons:
            # Add tremor effect for Parkinson's
            angle += np.random.normal(0, 0.1)
            radius = (i / 500) * max_radius + np.random.normal(0, 2)
        else:
            radius = (i / 500) * max_radius
        
        x = int(center_x + radius * np.cos(angle))
        y = int(center_y + radius * np.sin(angle))
        
        if 0 <= x < width and 0 <= y < height:
            # Draw with some thickness
            for dx in range(-2, 3):
                for dy in range(-2, 3):
                    if 0 <= x+dx < width and 0 <= y+dy < height:
                        draw.point((x+dx, y+dy), fill=(255, 255, 255))
    
    return img

def image_to_bytes(img):
    """Convert PIL Image to bytes"""
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')
    return img_bytes.getvalue()

def test_api_endpoint():
    """Test the API with the new model"""
    base_url = "http://localhost:5000"
    
    print("=== Testing API Integration ===")
    print(f"Base URL: {base_url}")
    
    # Test health endpoint first
    try:
        response = requests.get(f"{base_url}/health")
        if response.status_code == 200:
            health_data = response.json()
            print(f"✓ Health check: {health_data}")
            print(f"  Spiral model loaded: {health_data.get('spiral_model_loaded', 'Unknown')}")
        else:
            print(f"✗ Health check failed: {response.status_code}")
            return
    except requests.exceptions.ConnectionError:
        print("✗ Cannot connect to backend. Please ensure the backend is running on localhost:5000")
        return
    
    # Test with healthy spiral
    print("\n1. Testing with HEALTHY spiral...")
    healthy_img = create_test_spiral_image(is_parkinsons=False)
    healthy_bytes = image_to_bytes(healthy_img)
    
    files = {'image': ('healthy_spiral.png', healthy_bytes, 'image/png')}
    data = {'type': 'spiral'}
    
    try:
        response = requests.post(f"{base_url}/predict", files=files, data=data)
        if response.status_code == 200:
            result = response.json()
            print(f"✓ API Response: {result['label']}")
            print(f"  Confidence: {result['confidence']:.6f}")
            print(f"  Parkinson's: {result['probabilities']['Parkinsons']:.6f}")
            print(f"  Healthy: {result['probabilities']['Healthy']:.6f}")
            print(f"  Raw output: {result['raw_output']:.6f}")
        else:
            print(f"✗ API Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"✗ Request failed: {e}")
    
    # Test with Parkinson's spiral
    print("\n2. Testing with PARKINSON'S spiral...")
    parkinsons_img = create_test_spiral_image(is_parkinsons=True)
    parkinsons_bytes = image_to_bytes(parkinsons_img)
    
    files = {'image': ('parkinsons_spiral.png', parkinsons_bytes, 'image/png')}
    data = {'type': 'spiral'}
    
    try:
        response = requests.post(f"{base_url}/predict", files=files, data=data)
        if response.status_code == 200:
            result = response.json()
            print(f"✓ API Response: {result['label']}")
            print(f"  Confidence: {result['confidence']:.6f}")
            print(f"  Parkinson's: {result['probabilities']['Parkinsons']:.6f}")
            print(f"  Healthy: {result['probabilities']['Healthy']:.6f}")
            print(f"  Raw output: {result['raw_output']:.6f}")
        else:
            print(f"✗ API Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"✗ Request failed: {e}")
    
    # Test auto-detection
    print("\n3. Testing auto-detection...")
    files = {'image': ('auto_spiral.png', healthy_bytes, 'image/png')}
    # Don't specify type - let API auto-detect
    
    try:
        response = requests.post(f"{base_url}/predict", files=files)
        if response.status_code == 200:
            result = response.json()
            print(f"✓ Auto-detected as: {result['modelInfo']['type']}")
            print(f"  Prediction: {result['label']}")
            print(f"  Auto-detected: {result['modelInfo']['autoDetected']}")
        else:
            print(f"✗ API Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"✗ Request failed: {e}")
    
    print("\n=== API Integration Test Complete ===")

if __name__ == "__main__":
    test_api_endpoint()
