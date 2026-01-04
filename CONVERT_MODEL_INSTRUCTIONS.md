# Converting H5 Model to TensorFlow.js Format

Since your Python 3.14 doesn't support TensorFlow, use Google Colab to convert the model:

## Option 1: Google Colab (Recommended - Fast & Free)

### Step 1: Upload to Colab
1. Go to https://colab.research.google.com/
2. Create a new notebook
3. Upload your `mobilenet_spiral_tuned.h5` file using the Files panel

### Step 2: Run This Code in Colab

```python
# Install tensorflowjs
!pip install tensorflowjs

# Convert H5 to TensorFlow.js format
import tensorflowjs as tfjs
import tensorflow as tf

# Load the H5 model
model = tf.keras.models.load_model('mobilenet_spiral_tuned.h5')

# Display model info
print(f"Input shape: {model.input_shape}")
print(f"Output shape: {model.output_shape}")
print(f"Parameters: {model.count_params():,}")

# Convert and save
tfjs.converters.save_keras_model(model, './tfjs_model')

print("\n✅ Conversion complete!")
print("Download the 'tfjs_model' folder")
```

### Step 3: Download the Converted Files
1. After running the cell, click the folder icon on the left
2. Find the `tfjs_model` folder
3. Download these files:
   - `model.json`
   - `group1-shard1of1.bin` (or similar weight files)

### Step 4: Copy to Your Project
Copy the downloaded files to:
```
C:\parkinson's_care_app_frontend_3mcbx2_dualiteproject\public\models\spiral\
```

The files should be:
- `public/models/spiral/model.json`
- `public/models/spiral/group1-shard1of1.bin`

---

## Option 2: Use Python 3.9-3.11 Environment

If you have Python 3.9, 3.10, or 3.11 installed:

```powershell
# Create a virtual environment with compatible Python
py -3.10 -m venv tfenv
tfenv\Scripts\activate
pip install tensorflow tensorflowjs
python scripts/convert_model.py
```

---

## Option 3: Use Docker (If you have Docker Desktop)

```powershell
# Run conversion in Docker container
docker run --rm -v ${PWD}:/work tensorflow/tensorflow:latest bash -c "
  pip install tensorflowjs &&
  python -c '
import tensorflowjs as tfjs
import tensorflow as tf
model = tf.keras.models.load_model(\"/work/mobilenet_spiral_tuned.h5\")
tfjs.converters.save_keras_model(model, \"/work/public/models/spiral\")
print(\"✅ Conversion complete!\")
  '
"
```

---

## Verify Conversion

After conversion, your `public/models/spiral/` folder should contain:
- ✅ `model.json` (model architecture)
- ✅ `group1-shard1of1.bin` (or similar - model weights)

Then refresh your browser and the model will load!

---

## Quick Test

Once converted, test at:
- http://localhost:5173/test-model.html
- http://localhost:5173/model-inspector.html

The app will automatically load the converted model! 🎉
