"""
Convert H5 model to TensorFlow.js format using Python TensorFlow
This script works without needing TensorFlow installed in the same environment
"""
import subprocess
import sys
import os

def check_and_install_packages():
    """Check if required packages are installed, install if needed"""
    required_packages = {
        'tensorflow': 'tensorflow',
        'tensorflowjs': 'tensorflowjs'
    }
    
    missing_packages = []
    
    for package, pip_name in required_packages.items():
        try:
            __import__(package)
            print(f"✓ {package} is installed")
        except ImportError:
            print(f"✗ {package} is not installed")
            missing_packages.append(pip_name)
    
    if missing_packages:
        print(f"\n📦 Installing missing packages: {', '.join(missing_packages)}")
        for package in missing_packages:
            print(f"Installing {package}...")
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', package, '--quiet'])
        print("✓ All packages installed\n")

def convert_h5_to_tfjs():
    """Convert H5 model to TensorFlow.js format"""
    
    # Get paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    h5_path = os.path.join(project_root, 'mobilenet_spiral_tuned.h5')
    output_dir = os.path.join(project_root, 'public', 'models', 'spiral')
    
    print("=" * 60)
    print("MobileNetV2 H5 to TensorFlow.js Converter")
    print("=" * 60)
    print(f"\n📁 Input:  {h5_path}")
    print(f"📁 Output: {output_dir}\n")
    
    # Check if H5 file exists
    if not os.path.exists(h5_path):
        print(f"❌ ERROR: H5 file not found at: {h5_path}")
        return False
    
    # Check and install packages
    check_and_install_packages()
    
    # Now import the packages
    try:
        import tensorflow as tf
        import tensorflowjs as tfjs
        print(f"✓ TensorFlow version: {tf.__version__}")
        print(f"✓ TensorFlow.js converter version: {tfjs.__version__}\n")
    except ImportError as e:
        print(f"❌ ERROR: Failed to import required packages: {e}")
        return False
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    try:
        # Load the H5 model
        print("🔄 Loading H5 model...")
        model = tf.keras.models.load_model(h5_path)
        print("✓ Model loaded successfully!")
        
        # Print model info
        print(f"\n📊 Model Information:")
        print(f"   Input shape:  {model.input_shape}")
        print(f"   Output shape: {model.output_shape}")
        print(f"   Parameters:   {model.count_params():,}")
        
        # Convert to TensorFlow.js format
        print(f"\n🔄 Converting to TensorFlow.js format...")
        print(f"   Output directory: {output_dir}")
        
        tfjs.converters.save_keras_model(model, output_dir)
        
        print("\n✅ Conversion completed successfully!")
        
        # List generated files
        files = os.listdir(output_dir)
        print(f"\n📂 Generated files:")
        total_size = 0
        for filename in sorted(files):
            filepath = os.path.join(output_dir, filename)
            size = os.path.getsize(filepath)
            total_size += size
            size_mb = size / (1024 * 1024)
            print(f"   ✓ {filename:<30} ({size_mb:.2f} MB)")
        
        print(f"\n📊 Total size: {total_size / (1024 * 1024):.2f} MB")
        print(f"\n🎉 Model is ready to use in your web application!")
        print(f"   Load it using: tf.loadLayersModel('/models/spiral/model.json')")
        
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR during conversion: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = convert_h5_to_tfjs()
    sys.exit(0 if success else 1)
