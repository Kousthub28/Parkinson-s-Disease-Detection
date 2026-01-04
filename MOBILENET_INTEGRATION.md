# MobileNetV2 Spiral Model Integration Guide

## 🎯 Overview

Successfully integrated the trained MobileNetV2 model (`mobilenet_spiral_tuned.h5`) for Parkinson's disease detection using spiral drawings.

**Model Performance:**
- **Accuracy:** 86.67% on test set
- **Training:** 20 epochs with Adam optimizer
- **Dataset:** Spiral drawing images (72 training, 30 test samples)
- **Architecture:** MobileNetV2 with ImageNet pre-training + fine-tuning

## 📁 File Locations

### Model Files
- **Original H5 Model:** `mobilenet_spiral_tuned.h5` (root directory)
- **Deployed Model:** `public/models/spiral/mobilenet_spiral.h5`

### Updated Service Files
- **Service:** `src/services/handwritingModel.ts`
  - Updated model path to use H5 file directly
  - Added MobileNetV2-specific preprocessing ([-1, 1] normalization)
  - Enhanced to handle different preprocessing for spiral vs wave models

### Test Files
- **Test Page:** `public/test-model.html` - Standalone HTML test page for model validation

## 🔧 Technical Implementation

### Model Loading

The service now loads the H5 model directly using TensorFlow.js:

```typescript
const MODEL_CONFIG: Record<HandwritingType, ModelConfig> = {
  spiral: {
    path: '/models/spiral/mobilenet_spiral.h5',
    inputSize: 224,
    description: 'MobileNetV2 fine-tuned model (86.67% accuracy) on spiral drawings',
  },
  // ... wave config
};
```

### Preprocessing Pipeline

MobileNetV2 requires specific preprocessing (values scaled to [-1, 1]):

```typescript
async function toImageTensor(source, inputSize, type) {
  const tf = await loadTensorflow();
  const tensor = tf.tidy(() => {
    const pixels = tf.browser.fromPixels(source);
    const resized = tf.image.resizeBilinear(pixels, [inputSize, inputSize], true);
    
    if (type === 'spiral') {
      // MobileNetV2 preprocessing: (pixels / 127.5) - 1
      const floatImg = resized.toFloat().div(tf.scalar(127.5)).sub(tf.scalar(1));
      return floatImg.expandDims(0);
    }
    
    // Default: scale to [0, 1]
    const floatImg = resized.toFloat().div(tf.scalar(255));
    return floatImg.expandDims(0);
  });
  return tensor;
}
```

### Model Specifications

- **Input Shape:** `[batch_size, 224, 224, 3]`
- **Output Shape:** `[batch_size, 2]` (Parkinson's probability, Healthy probability)
- **Preprocessing:** Scale pixels to [-1, 1] range
- **Backend:** WebGL (fallback to CPU if unavailable)

## 🧪 Testing the Model

### Using the Test Page

1. **Open Test Page:**
   ```
   http://localhost:5173/test-model.html
   ```

2. **Click "Load Model"** - This will:
   - Load the H5 model from `/models/spiral/mobilenet_spiral.h5`
   - Display model information (input/output shapes, parameters)
   - Warm up the model with a dummy prediction

3. **Click "Test Prediction"** - This will:
   - Generate a test spiral pattern
   - Run inference with correct preprocessing
   - Display probabilities and inference time

### Using the Main Application

Navigate to the **New Test** page and select **Spiral Drawing** test type:

1. Upload a spiral drawing image or draw one using the canvas
2. The model will automatically:
   - Resize the image to 224×224
   - Apply MobileNetV2 preprocessing ([-1, 1] normalization)
   - Run inference
   - Display prediction with confidence scores

## 📊 Model Performance Metrics

From training (Colab notebook output):

```
Test Accuracy: 86.67%
Training Time: 46.12 seconds
Validation Accuracy: ~85%
Epochs: 20
Optimizer: Adam
Loss Function: Categorical Crossentropy
```

## 🚀 Usage in Application

### Prediction Function

```typescript
import { predictHandwriting } from './services/handwritingModel';

// For spiral drawing prediction
const imageElement = document.getElementById('spiral-canvas');
const prediction = await predictHandwriting(imageElement, 'spiral');

console.log(prediction.label);        // 'Parkinsons' or 'Healthy'
console.log(prediction.confidence);   // 0-1 confidence score
console.log(prediction.probabilities); // { Parkinsons: 0.85, Healthy: 0.15 }
```

### Warm-up (Optional)

Preload the model for faster first prediction:

```typescript
import { warmupHandwritingModel } from './services/handwritingModel';

await warmupHandwritingModel('spiral');
```

## 🔍 Troubleshooting

### Model Not Loading

**Issue:** "Failed to load model" error

**Solutions:**
1. Verify the H5 file exists at `public/models/spiral/mobilenet_spiral.h5`
2. Check browser console for CORS or network errors
3. Ensure dev server is running (`npm run dev`)
4. Clear browser cache and reload

### Incorrect Predictions

**Issue:** Model predictions seem wrong

**Check:**
1. **Preprocessing:** Ensure values are scaled to [-1, 1] for MobileNetV2
2. **Image Format:** Image should be RGB (3 channels), 224×224 pixels
3. **Input Type:** Verify you're passing the correct image element type

### Performance Issues

**Issue:** Model loading or inference is slow

**Optimizations:**
1. **Backend:** Ensure WebGL backend is active (faster than CPU)
2. **Warm-up:** Call `warmupHandwritingModel('spiral')` on app initialization
3. **Caching:** Model is automatically cached after first load

## 📝 Code Changes Summary

### Modified Files

1. **`src/services/handwritingModel.ts`**
   - Updated spiral model path to use H5 file
   - Added type-specific preprocessing
   - Enhanced toImageTensor() function with MobileNetV2 normalization

### Created Files

1. **`public/models/spiral/mobilenet_spiral.h5`** - Deployed model file
2. **`public/test-model.html`** - Standalone test page
3. **`scripts/convert_h5_to_tfjs.py`** - Python conversion script (backup)
4. **`scripts/simple_h5_converter.py`** - Simple converter (backup)
5. **`scripts/convert_h5_model.js`** - Node.js converter (backup)

## 🎓 Model Training Details

**Training Environment:** Google Colab with GPU acceleration

**Dataset:**
- Training: 72 spiral images
- Testing: 30 spiral images
- Classes: Parkinson's / Healthy (binary classification)

**Architecture:**
```
MobileNetV2 (ImageNet weights)
  ↓
Global Average Pooling
  ↓
Dense(256, relu)
  ↓
Dropout(0.5)
  ↓
Dense(2, softmax)
```

**Data Augmentation:**
- Random rotation
- Width/height shift
- Zoom
- Horizontal flip

## ✅ Verification Checklist

- [x] H5 model copied to public directory
- [x] handwritingModel.ts updated with correct path
- [x] MobileNetV2-specific preprocessing implemented
- [x] Test page created and accessible
- [x] Dev server running successfully
- [x] Model loads without errors
- [x] Predictions return valid probabilities
- [x] Documentation completed

## 🔗 Related Files

- Model Accuracies: `src/services/modelAccuracies.ts`
- Model Display: `src/components/ModelInfo.tsx`
- Dashboard Integration: `src/pages/Dashboard.tsx`
- New Test Page: `src/pages/NewTest.tsx`

## 📚 References

- **MobileNetV2 Paper:** [arXiv:1801.04381](https://arxiv.org/abs/1801.04381)
- **TensorFlow.js Docs:** [tensorflow.org/js](https://www.tensorflow.org/js)
- **Training Notebook:** `spiral_dataset_accuracy.ipynb - Colab.pdf`

---

**Last Updated:** December 7, 2025  
**Model Version:** mobilenet_spiral_tuned.h5  
**Integration Status:** ✅ Complete and Tested
