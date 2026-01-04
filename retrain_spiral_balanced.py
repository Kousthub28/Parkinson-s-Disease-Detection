"""
Retrain Spiral Model - Fixed Version with Proper Class Handling
"""

import tensorflow as tf
import numpy as np
from pathlib import Path
import os
from sklearn.utils import class_weight

print("="*60)
print("Retraining Spiral Model (MobileNetV2) - Class-Balanced")
print("="*60)

# Paths
TRAIN_DIR = 'spiral/training'
TEST_DIR = 'spiral/testing'
OUTPUT_MODEL = 'public/models/spiral/mobilenet_spiral.h5'

# Check dataset
print(f"\nChecking dataset...")
train_parkinson = len(list(Path(TRAIN_DIR).glob('parkinson/*.png')))
train_healthy = len(list(Path(TRAIN_DIR).glob('healthy/*.png')))
test_parkinson = len(list(Path(TEST_DIR).glob('parkinson/*.png')))
test_healthy = len(list(Path(TEST_DIR).glob('healthy/*.png')))

print(f"  Train - Parkinson: {train_parkinson}, Healthy: {train_healthy}")
print(f"  Test - Parkinson: {test_parkinson}, Healthy: {test_healthy}")

# Build simpler but effective MobileNetV2 model
print(f"\nBuilding MobileNetV2 model...")
base_model = tf.keras.applications.MobileNetV2(
    input_shape=(224, 224, 3),
    include_top=False,
    weights='imagenet',
    pooling='avg'  # Use average pooling
)

# Freeze base model initially
base_model.trainable = False
base_model._name = 'mobilenetv2'

model = tf.keras.Sequential([
    base_model,
    tf.keras.layers.Dropout(0.3),
    tf.keras.layers.Dense(128, activation='relu'),
    tf.keras.layers.Dropout(0.2),
    tf.keras.layers.Dense(1, activation='sigmoid')
])

print(f"  Model built: {len(model.layers)} layers")

# Compile
print(f"\nCompiling model...")
model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=0.0001),
    loss='binary_crossentropy',
    metrics=['accuracy', tf.keras.metrics.Precision(name='precision'), tf.keras.metrics.Recall(name='recall')]
)

# Moderate augmentation that preserves spiral structure
print(f"\nSetting up data generators...")
train_datagen = tf.keras.preprocessing.image.ImageDataGenerator(
    preprocessing_function=tf.keras.applications.mobilenet_v2.preprocess_input,
    rotation_range=10,
    width_shift_range=0.08,
    height_shift_range=0.08,
    zoom_range=0.10,
    fill_mode='constant',
    cval=255,
    horizontal_flip=False,
    vertical_flip=False
)

test_datagen = tf.keras.preprocessing.image.ImageDataGenerator(
    preprocessing_function=tf.keras.applications.mobilenet_v2.preprocess_input
)

train_generator = train_datagen.flow_from_directory(
    TRAIN_DIR,
    target_size=(224, 224),
    batch_size=8,
    class_mode='binary',
    shuffle=True,
    seed=42
)

test_generator = test_datagen.flow_from_directory(
    TEST_DIR,
    target_size=(224, 224),
    batch_size=8,
    class_mode='binary',
    shuffle=False
)

print(f"  Training samples: {train_generator.samples}")
print(f"  Test samples: {test_generator.samples}")
print(f"  Class mapping: {train_generator.class_indices}")

# Compute class weights to handle imbalance
class_weights_array = class_weight.compute_class_weight(
    'balanced',
    classes=np.unique(train_generator.classes),
    y=train_generator.classes
)
class_weights_dict = dict(enumerate(class_weights_array))
print(f"  Class weights: {class_weights_dict}")

# Callbacks
callbacks = [
    tf.keras.callbacks.EarlyStopping(
        monitor='val_loss',
        patience=10,
        restore_best_weights=True,
        verbose=1
    ),
    tf.keras.callbacks.ReduceLROnPlateau(
        monitor='val_loss',
        factor=0.5,
        patience=5,
        min_lr=1e-7,
        verbose=1
    )
]

# Phase 1: Train with frozen base
print(f"\nPhase 1: Training with frozen base...")
print(f"  Epochs: 30 (with early stopping)")

history1 = model.fit(
    train_generator,
    epochs=30,
    validation_data=test_generator,
    callbacks=callbacks,
    class_weight=class_weights_dict,
    verbose=1
)

# Phase 2: Fine-tune top layers
print(f"\nPhase 2: Fine-tuning top 20 layers...")
base_model.trainable = True
for layer in base_model.layers[:-20]:
    layer.trainable = False

# Recompile with lower learning rate
model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=0.00001),
    loss='binary_crossentropy',
    metrics=['accuracy', tf.keras.metrics.Precision(name='precision'), tf.keras.metrics.Recall(name='recall')]
)

history2 = model.fit(
    train_generator,
    epochs=20,
    validation_data=test_generator,
    callbacks=callbacks,
    class_weight=class_weights_dict,
    verbose=1
)

# Evaluate
print(f"\nEvaluating model...")
test_loss, test_acc, test_precision, test_recall = model.evaluate(test_generator, verbose=0)
print(f"  Test accuracy: {test_acc*100:.2f}%")
print(f"  Test precision: {test_precision*100:.2f}%")
print(f"  Test recall: {test_recall*100:.2f}%")
print(f"  Test loss: {test_loss:.4f}")

# Save model
print(f"\nSaving model...")
model.save(OUTPUT_MODEL)
file_size = os.path.getsize(OUTPUT_MODEL) / (1024 * 1024)
print(f"  Saved to: {OUTPUT_MODEL}")
print(f"  File size: {file_size:.2f} MB")

# Test predictions
print(f"\n{'='*60}")
print("Testing Predictions")
print(f"{'='*60}")

def test_image(image_path, label):
    img = tf.keras.preprocessing.image.load_img(image_path, target_size=(224, 224))
    img_array = tf.keras.preprocessing.image.img_to_array(img)
    img_array = tf.keras.applications.mobilenet_v2.preprocess_input(img_array)
    img_array = np.expand_dims(img_array, axis=0)
    
    pred = model.predict(img_array, verbose=0)[0][0]
    pred_class = "Parkinsons" if pred < 0.5 else "Healthy"
    confidence = (1 - pred) * 100 if pred < 0.5 else pred * 100
    
    status = "✓" if (label == "Parkinson" and pred < 0.5) or (label == "Healthy" and pred >= 0.5) else "✗"
    print(f"  {status} {Path(image_path).name}: {pred_class} ({confidence:.1f}%) [raw: {pred:.3f}]")

print(f"\nParkinson's Spiral Images:")
parkinson_images = sorted(Path(TEST_DIR).glob('parkinson/*.png'))[:5]
for img_path in parkinson_images:
    test_image(str(img_path), "Parkinson")

print(f"\nHealthy Spiral Images:")
healthy_images = sorted(Path(TEST_DIR).glob('healthy/*.png'))[:5]
for img_path in healthy_images:
    test_image(str(img_path), "Healthy")

print(f"\n{'='*60}")
print("✓ Spiral Model Training Complete!")
print(f"{'='*60}")
