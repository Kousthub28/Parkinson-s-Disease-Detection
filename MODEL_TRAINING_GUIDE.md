# Model Training & Validation Guide

## Current Status

### Models Trained
- **Wave Model (InceptionV3)**: ✅ 90% accuracy - Working well!
- **Spiral Model (MobileNetV2)**: ⚠️ 73% accuracy - Needs improvement

### Features Implemented
1. ✅ **Image Validation**: Backend now validates that uploaded images contain actual spiral/wave drawings
2. ✅ **Separate Upload Buttons**: Frontend has distinct "Upload Spiral" and "Upload Wave" buttons
3. ✅ **Error Handling**: User-friendly error messages when invalid images are uploaded
4. ✅ **Type Detection**: Auto-detection of spiral vs wave patterns as fallback

## What Was Fixed

### Problem 1: Models Predicting Everything as Parkinson's
**Root Cause**: Models were overfitting or had incorrect class label interpretation

**Solution**:
- Retrained both models with better data augmentation
- Added class balancing using `class_weight` parameter
- Implemented two-phase training (frozen base → fine-tuning)
- Wave model now achieves 90% accuracy!
- Spiral model improved to 73% (was 50%)

### Problem 2: Accepting Invalid Images
**Root Cause**: No validation on uploaded images

**Solution implemented in `backend_api.py`**:
- Added `validate_drawing_image()` function that checks:
  1. **Contrast check**: Image must have sufficient contrast (not blank)
  2. **Content check**: Must have 5-60% drawn pixels (on white background)
  3. **Edge detection**: Must have continuous lines/patterns
  4. **Pattern detection**: Validates spiral vs wave characteristics using:
     - Aspect ratio (waves are wider)
     - Horizontal/vertical variance
     - Circular pattern detection (spirals have circles)

**Error Messages**:
- "Image appears to be blank or has insufficient contrast"
- "No drawing detected. Please upload an image with a clear spiral or wave pattern"
- "Image is too dark or cluttered. Please upload a clear spiral or wave drawing on white background"
- "This appears to be a {detected_type} drawing, but you selected '{expected_type}'. Please use the correct upload button."

## How to Use

### 1. Start the Backend
```powershell
python backend_api.py
```

Backend will:
- Load both models on startup
- Run on http://localhost:5000
- Display validation messages in console

### 2. Frontend - Upload Images
- Click **"Upload Spiral"** button for spiral drawings
- Click **"Upload Wave"** button for wave drawings
- Select appropriate image file
- If image is invalid, you'll see clear error message

### 3. Valid Image Requirements
✅ **Good images**:
- Clear spiral or wave drawing
- White/light background
- Dark pen/pencil marks
- Single continuous pattern
- Not too cluttered

❌ **Invalid images will be rejected**:
- Blank/white images
- Photos of faces, landscapes, etc.
- Text documents
- Random scribbles
- Too dark or cluttered images

## Model Training Scripts

### Spiral Model
**Script**: `retrain_spiral_balanced.py`

```bash
python retrain_spiral_balanced.py
```

**Configuration**:
- Architecture: MobileNetV2 + custom head (Dropout 0.3 → Dense 128 → Dropout 0.2 → Dense 1)
- Augmentation: Rotation ±10°, shifts 8%, zoom 10%
- Two-phase training: Frozen base (30 epochs) → Fine-tune top 20 layers (20 epochs)
- Class balancing: Automatic via `class_weight`
- Learning rate: 0.0001 → 0.00001 (with ReduceLROnPlateau)

**Current Results**:
- Test accuracy: 73.33%
- Test precision: 88.89%
- Test recall: 53.33%

**Note**: Spiral model still needs improvement. Consider:
- Collecting more training data
- Better data cleaning (some images may be mislabeled)
- Different architecture (try EfficientNet or Vision Transformer)

### Wave Model
**Script**: `retrain_wave_final.py`

```bash
python retrain_wave_final.py
```

**Configuration**:
- Architecture: InceptionV3 + custom head (Dense 512 → Dropout 0.5 → Dense 256 → Dropout 0.4 → Dense 128 → Dropout 0.3 → Dense 1)
- Augmentation: Rotation ±10°, shifts 10%, zoom 15%, NO horizontal flip
- Fine-tuning: Top 50 layers trainable
- Learning rate: 0.00005
- Batch size: 12

**Current Results**:
- Test accuracy: 90.0%
- Working very well! ✅

## Validation Script

To quickly test both models:
```bash
python validate_models.py
```

This script:
- Tests 5 Parkinson's + 5 Healthy images for each model
- Shows prediction accuracy
- Identifies if class labels are inverted
- Recommends next steps

## Backend API Details

### Endpoints

**Health Check**:
```
GET http://localhost:5000/health
```

**Prediction**:
```
POST http://localhost:5000/predict
Form Data:
  - image: File (required)
  - type: 'spiral' or 'wave' (optional, will auto-detect if not provided)
```

**Response** (Success):
```json
{
  "label": "Healthy" or "Parkinsons",
  "confidence": 0.85,
  "probabilities": {
    "Parkinsons": 0.15,
    "Healthy": 0.85
  },
  "raw_output": 0.85,
  "modelInfo": {
    "name": "MobileNetV2 (spiral)" or "InceptionV3 (wave)",
    "type": "spiral" or "wave",
    "inputShape": [null, 224, 224, 3],
    "autoDetected": false
  }
}
```

**Response** (Validation Error):
```json
{
  "error": "No drawing detected. Please upload an image with a clear spiral or wave pattern.",
  "validation_failed": true
}
```

## Next Steps to Improve Spiral Model

### Option 1: Collect More Data
- Current: 36 training + 15 test images per class
- Recommended: 200+ training images per class
- Can use data augmentation to generate variations

### Option 2: Data Cleaning
- Manually review training images
- Remove ambiguous or mislabeled samples
- Ensure clear distinction between Parkinson's and Healthy spirals

### Option 3: Try Different Architecture
Create new script with:
```python
# EfficientNetB0 - smaller, more efficient
base_model = tf.keras.applications.EfficientNetB0(
    input_shape=(224, 224, 3),
    include_top=False,
    weights='imagenet',
    pooling='avg'
)
```

### Option 4: Ensemble Approach
- Train multiple models with different architectures
- Combine predictions (voting or averaging)
- Often improves overall accuracy

## Troubleshooting

### Issue: "Backend API error"
**Solution**: Make sure backend is running:
```bash
python backend_api.py
```

### Issue: "Validation failed" errors
**Solution**: Ensure uploaded image:
- Is a drawing (not photo)
- Has white/light background
- Has dark pen marks
- Is not blank or too cluttered

### Issue: Wrong model being used
**Solution**: Use the correct upload button:
- "Upload Spiral" for spiral drawings
- "Upload Wave" for wave drawings

### Issue: All predictions show Parkinson's
**Solution**: 
1. Check if model needs retraining
2. Run `validate_models.py` to test current models
3. If class labels inverted, retrain model

## Files Created/Modified

### New Files:
- `retrain_spiral_balanced.py` - Improved spiral model training
- `retrain_spiral_final.py` - Alternative spiral training script
- `retrain_wave_final.py` - Improved wave model training
- `validate_models.py` - Quick model validation tool
- `MODEL_TRAINING_GUIDE.md` - This document

### Modified Files:
- `backend_api.py` - Added image validation with OpenCV
- `src/services/handwritingModel.ts` - Better error handling for validation failures
- `backend_requirements.txt` - Added opencv-python and scikit-learn

### Model Files:
- `public/models/spiral/mobilenet_spiral.h5` - Updated spiral model (73% accuracy)
- `public/models/wave/inception_wave_v2.h5` - Wave model (90% accuracy) ✅

## Summary

✅ **Working Well**:
- Wave model: 90% accuracy
- Image validation: Rejects invalid uploads
- Separate upload buttons: Clear user experience
- Error messages: User-friendly

⚠️ **Needs Improvement**:
- Spiral model: 73% accuracy (acceptable but can be better)
- Consider collecting more training data
- May need data cleaning or different architecture

🎯 **Recommendation**:
The system is functional and ready for testing! The wave model works great. For production use, improve the spiral model by collecting more high-quality training data and potentially trying different architectures like EfficientNet.
