# Quick Retrain Script - Uses Existing Dataset

This script retrains the MobileNetV2 model using your existing dataset.

## Option 1: If you have the dataset

```powershell
# Run the training script
& "C:\Users\koust\AppData\Local\Programs\Python\Python310\python.exe" retrain_model.py
```

## Option 2: If you don't have the dataset locally

The original model was likely trained on a dataset. You need to either:

1. **Download the dataset** from where you originally got it
2. **Use Google Colab** to retrain with GPU acceleration
3. **Load the old model directly** using an older TensorFlow version

## Expected Dataset Structure:

```
dataset/
  train/
    healthy/
      image1.jpg
      image2.jpg
      ...
    parkinsons/
      image1.jpg
      image2.jpg
      ...
  validation/
    healthy/
      ...
    parkinsons/
      ...
  test/
    healthy/
      ...
    parkinsons/
      ...
```

## After Training:

1. Replace the old model:
```powershell
Move-Item "public/models/spiral/mobilenet_spiral.h5" "public/models/spiral/mobilenet_spiral_old.h5"
Move-Item "public/models/spiral/mobilenet_spiral_retrained.h5" "public/models/spiral/mobilenet_spiral.h5"
```

2. Backend will automatically load the new model on next request

## Alternative: Use the Original Model on Google Colab

If you don't have the dataset, you can:
1. Upload your H5 file to Google Colab
2. Use TensorFlow 2.10 which is compatible
3. Convert to TensorFlow.js there
4. Download the converted files

Would you like me to create a Colab notebook for this?
