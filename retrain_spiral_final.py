"""
Retrain Spiral Model (MobileNetV2) - Final Optimized Version
Addresses issues with false positives/negatives
"""

import tensorflow as tf
import numpy as np
from pathlib import Path
import os

print("="*60)
print("Retraining Spiral Model (MobileNetV2) - Final Optimized")
print("="*60)

# Paths
TRAIN_DIR = 'spiral/training'
TEST_DIR = 'spiral/testing'
OUTPUT_MODEL = 'public/models/spiral/mobilenet_spiral_final.h5'

# Check dataset
print(f"\nChecking dataset...")
train_parkinson = len(list(Path(TRAIN_DIR).glob('parkinson/*.png')))
train_healthy = len(list(Path(TRAIN_DIR).glob('healthy/*.png')))
test_parkinson = len(list(Path(TEST_DIR).glob('parkinson/*.png')))
test_healthy = len(list(Path(TEST_DIR).glob('healthy/*.png')))

print(f"  Train - Parkinson: {train_parkinson}, Healthy: {train_healthy}")
print(f"  Test - Parkinson: {test_parkinson}, Healthy: {test_healthy}")

# Build MobileNetV2 model with improved architecture
print(f"\nBuilding MobileNetV2 model...")
base_model = tf.keras.applications.MobileNetV2(
    input_shape=(224, 224, 3),
    include_top=False,
    weights='imagenet',
    pooling=None
)

# Fine-tune last 30 layers
for layer in base_model.layers[:-30]:
    layer.trainable = False
for layer in base_model.layers[-30:]:
    layer.trainable = True

base_model._name = 'mobilenetv2'

model = tf.keras.Sequential([
    base_model,
    tf.keras.layers.GlobalAveragePooling2D(name='global_avg_pool'),
    tf.keras.layers.BatchNormalization(name='bn1'),
    tf.keras.layers.Dense(512, activation='relu', kernel_regularizer=tf.keras.regularizers.l2(0.01), name='dense_512'),
    tf.keras.layers.Dropout(0.5, name='dropout1'),
    tf.keras.layers.Dense(256, activation='relu', kernel_regularizer=tf.keras.regularizers.l2(0.01), name='dense_256'),
    tf.keras.layers.Dropout(0.4, name='dropout2'),
    tf.keras.layers.Dense(128, activation='relu', name='dense_128'),
    tf.keras.layers.Dropout(0.3, name='dropout3'),
    tf.keras.layers.Dense(1, activation='sigmoid', name='output')
])

print(f"  Model built: {len(model.layers)} layers")
print(f"  Trainable parameters: {sum([tf.keras.backend.count_params(w) for w in model.trainable_weights])}")

# Compile with optimized settings
print(f"\nCompiling model...")
model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=0.00005),  # Lower learning rate
    loss='binary_crossentropy',
    metrics=['accuracy', tf.keras.metrics.Precision(), tf.keras.metrics.Recall()]
)

# Data augmentation for spiral images - careful to preserve spiral patterns
print(f"\nSetting up data generators...")
train_datagen = tf.keras.preprocessing.image.ImageDataGenerator(
    preprocessing_function=tf.keras.applications.mobilenet_v2.preprocess_input,
    rotation_range=15,  # Moderate rotation
    width_shift_range=0.1,
    height_shift_range=0.1,
    zoom_range=0.15,
    brightness_range=[0.8, 1.2],
    fill_mode='constant',
    cval=255,  # White background
    horizontal_flip=False,  # Don't flip spirals
    vertical_flip=False
)

test_datagen = tf.keras.preprocessing.image.ImageDataGenerator(
    preprocessing_function=tf.keras.applications.mobilenet_v2.preprocess_input
)

train_generator = train_datagen.flow_from_directory(
    TRAIN_DIR,
    target_size=(224, 224),
    batch_size=16,  # Smaller batch for better generalization
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

# Callbacks for better training
callbacks = [
    tf.keras.callbacks.EarlyStopping(
        monitor='val_loss',
        patience=8,
        restore_best_weights=True,
        verbose=1
    ),
    tf.keras.callbacks.ReduceLROnPlateau(
        monitor='val_loss',
        factor=0.5,
        patience=4,
        min_lr=1e-7,
        verbose=1
    ),
    tf.keras.callbacks.ModelCheckpoint(
        OUTPUT_MODEL.replace('.h5', '_checkpoint.h5'),
        monitor='val_accuracy',
        save_best_only=True,
        verbose=1
    )
]

# Train the model
print(f"\nTraining spiral model...")
print(f"  Epochs: 50 (with early stopping)")
print(f"  Learning rate: 0.00005")

history = model.fit(
    train_generator,
    epochs=50,
    validation_data=test_generator,
    callbacks=callbacks,
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

# Test predictions on sample images
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
parkinson_images = sorted(Path(TEST_DIR).glob('parkinson/*.png'))[:3]
for img_path in parkinson_images:
    test_image(str(img_path), "Parkinson")

print(f"\nHealthy Spiral Images:")
healthy_images = sorted(Path(TEST_DIR).glob('healthy/*.png'))[:3]
for img_path in healthy_images:
    test_image(str(img_path), "Healthy")

print(f"\n{'='*60}")
print("✓ Spiral Model Training Complete!")
print(f"{'='*60}")
print(f"\nTo use this model, update backend_api.py:")
print(f"  SPIRAL_MODEL_PATH = '{OUTPUT_MODEL}'")
