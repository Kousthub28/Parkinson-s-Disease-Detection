"""
Simple H5 to TensorFlow.js converter using subprocess.
Works without needing TensorFlow installed in Python.
"""
import subprocess
import sys
import os

def convert_h5_to_tfjs():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    h5_path = os.path.join(project_root, 'mobilenet_spiral_tuned.h5')
    output_path = os.path.join(project_root, 'public', 'models', 'spiral')
    
    # Create output directory
    os.makedirs(output_path, exist_ok=True)
    
    print(f"Converting H5 model to TensorFlow.js format...")
    print(f"Input: {h5_path}")
    print(f"Output: {output_path}")
    
    # Check if tensorflowjs_converter is available
    try:
        result = subprocess.run(
            ['tensorflowjs_converter', '--help'],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            print("\n✗ tensorflowjs_converter not found!")
            print("\nPlease install: pip install tensorflowjs tensorflow")
            return False
    except FileNotFoundError:
        print("\n✗ tensorflowjs_converter command not found!")
        print("\nPlease install: pip install tensorflowjs tensorflow")
        return False
    
    # Run conversion
    print("\nRunning conversion...")
    result = subprocess.run([
        'tensorflowjs_converter',
        '--input_format', 'keras',
        '--output_format', 'tfjs_graph_model',
        h5_path,
        output_path
    ], capture_output=True, text=True)
    
    if result.returncode == 0:
        print("\n✓ Conversion successful!")
        print(result.stdout)
        
        # List files
        files = os.listdir(output_path)
        print(f"\nGenerated files in {output_path}:")
        for file in files:
            file_path = os.path.join(output_path, file)
            size = os.path.getsize(file_path)
            print(f"  - {file} ({size:,} bytes)")
        return True
    else:
        print("\n✗ Conversion failed!")
        print("STDOUT:", result.stdout)
        print("STDERR:", result.stderr)
        return False

if __name__ == "__main__":
    success = convert_h5_to_tfjs()
    sys.exit(0 if success else 1)
