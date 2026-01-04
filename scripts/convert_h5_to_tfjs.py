"""
Convert Keras H5 model to TensorFlow.js format for web deployment.
"""
import sys
import os

# Add the project root to the path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

def convert_model():
    try:
        import tensorflow as tf
        print(f"TensorFlow version: {tf.__version__}")
        
        # Load the H5 model
        model_path = os.path.join(project_root, 'mobilenet_spiral_tuned.h5')
        print(f"Loading model from: {model_path}")
        
        if not os.path.exists(model_path):
            print(f"ERROR: Model file not found at {model_path}")
            return False
        
        model = tf.keras.models.load_model(model_path)
        print(f"Model loaded successfully!")
        print(f"Model input shape: {model.input_shape}")
        print(f"Model output shape: {model.output_shape}")
        
        # Save in SavedModel format first
        saved_model_path = os.path.join(project_root, 'temp_saved_model')
        print(f"\nSaving as SavedModel to: {saved_model_path}")
        model.save(saved_model_path, save_format='tf')
        print("SavedModel saved successfully!")
        
        # Convert to TensorFlow.js format
        output_path = os.path.join(project_root, 'public', 'models', 'spiral')
        os.makedirs(output_path, exist_ok=True)
        
        print(f"\nConverting to TensorFlow.js format...")
        print(f"Output directory: {output_path}")
        
        # Use tensorflowjs converter
        import subprocess
        result = subprocess.run([
            sys.executable, '-m', 'tensorflowjs.converters.converter',
            '--input_format', 'keras_saved_model',
            '--output_format', 'tfjs_graph_model',
            saved_model_path,
            output_path
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            print("\n✓ Model converted successfully!")
            print(f"✓ Output files saved to: {output_path}")
            
            # List generated files
            files = os.listdir(output_path)
            print(f"\nGenerated files:")
            for file in files:
                file_path = os.path.join(output_path, file)
                size = os.path.getsize(file_path)
                print(f"  - {file} ({size:,} bytes)")
            
            # Clean up temporary SavedModel
            import shutil
            shutil.rmtree(saved_model_path)
            print("\n✓ Cleanup completed!")
            
            return True
        else:
            print(f"\n✗ Conversion failed!")
            print(f"Error: {result.stderr}")
            return False
            
    except ImportError as e:
        print(f"\n✗ Import error: {e}")
        print("\nPlease install required packages:")
        print("  pip install tensorflow tensorflowjs")
        return False
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = convert_model()
    sys.exit(0 if success else 1)
