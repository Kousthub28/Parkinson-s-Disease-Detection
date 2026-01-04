"""
Retrain Wave Model with Better Configuration
"""

import tensorflow as tf
import numpy as np
from pathlib import Path
import os

print("="*60)
print("Retraining Wave Model (InceptionV3) - Improved")
print("="*60)

# Paths
TRAIN_DIR = 'wave/training'
TEST_DIR = 'wave/testing'
OUTPUT_MODEL = 'public/models/wave/inception_wave_v2.h5'

# Check dataset
print(f"\nChecking dataset...")
train_parkinson = len(list(Path(TRAIN_DIR).glob('parkinson/*.png')))
train_healthy = len(list(Path(TRAIN_DIR).glob('healthy/*.png')))
test_parkinson = len(list(Path(TEST_DIR).glob('parkinson/*.png')))
test_healthy = len(list(Path(TEST_DIR).glob('healthy/*.png')))

print(f"  Train - Parkinson: {train_parkinson}, Healthy: {train_healthy}")
print(f"  Test - Parkinson: {test_parkinson}, Healthy: {test_healthy}")

# Build InceptionV3 model with better architecture
print(f"\nBuilding InceptionV3 model...")
base_model = tf.keras.applications.InceptionV3(
    input_shape=(224, 224, 3),
    include_top=False,
    weights='imagenet',
    pooling=None
)
base_model.trainable = False
base_model._name = 'inceptionv3'

model = tf.keras.Sequential([
    base_model,
    tf.keras.layers.GlobalAveragePooling2D(name='global_avg_pool'),
    tf.keras.layers.BatchNormalization(name='bn1'),
    tf.keras.layers.Dense(256, activation='relu', name='dense_256'),
    tf.keras.layers.Dropout(0.5, name='dropout1'),
    tf.keras.layers.Dense(128, activation='relu', name='dense_128'),
    tf.keras.layers.Dropout(0.3, name='dropout2'),
    tf.keras.layers.Dense(1, activation='sigmoid', name='output')
])

# Use lower learning rate
model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=0.0001),
    loss='binary_crossentropy',
    metrics=['accuracy']
)

print(f"  Model built: {len(model.layers)} layers")

# Data generators - NO horizontal flip for wave (important!)
print(f"\nSetting up data generators...")
train_datagen = tf.keras.preprocessing.image.ImageDataGenerator(
    rescale=1./255.0,
    rotation_range=10,
    width_shift_range=0.1,
    height_shift_range=0.1,
    horizontal_flip=False,  # Wave patterns are directional!
    zoom_range=0.1,
    fill_mode='nearest'
)

test_datagen = tf.keras.preprocessing.image.ImageDataGenerator(
    rescale=1./255.0
)

train_generator = train_datagen.flow_from_directory(
    TRAIN_DIR,
    target_size=(224, 224),
    batch_size=8,  # Smaller batch for better gradients
    class_mode='binary',
    classes=['parkinson', 'healthy'],  # 0=Parkinson, 1=Healthy
    shuffle=True
)

test_generator = test_datagen.flow_from_directory(
    TEST_DIR,
    target_size=(224, 224),
    batch_size=8,
    class_mode='binary',
    classes=['parkinson', 'healthy'],
    shuffle=False
)

print(f"  Training samples: {train_generator.n}")
print(f"  Test samples: {test_generator.n}")
print(f"  Class mapping: {train_generator.class_indices}")

# Early stopping and checkpointing
callbacks = [
    tf.keras.callbacks.EarlyStopping(
        monitor='val_accuracy',
        patience=5,
        restore_best_weights=True,
        verbose=1
    ),
    tf.keras.callbacks.ReduceLROnPlateau(
        monitor='val_loss',
        factor=0.5,
        patience=3,
        min_lr=1e-7,
        verbose=1
    )
]

# Train
print(f"\nTraining wave model...")
print(f"  Epochs: 30 (with early stopping)")
print(f"  Learning rate: 0.0001")

history = model.fit(
    train_generator,
    epochs=30,
    validation_data=test_generator,
    callbacks=callbacks,
    verbose=1
)

# Evaluate
print(f"\nEvaluating model...")
test_loss, test_acc = model.evaluate(test_generator, verbose=0)
print(f"  Test accuracy: {test_acc*100:.2f}%")
print(f"  Test loss: {test_loss:.4f}")

# Save model
print(f"\nSaving model...")
os.makedirs(os.path.dirname(OUTPUT_MODEL), exist_ok=True)
model.save(OUTPUT_MODEL)
print(f"  Saved to: {OUTPUT_MODEL}")
print(f"  File size: {os.path.getsize(OUTPUT_MODEL) / (1024*1024):.2f} MB")

# Test with multiple images
print(f"\n" + "="*60)
print("Testing Predictions")
print("="*60)

# Test Parkinson's images
print("\nParkinson's Wave Images:")
for i, img_path in enumerate(list(Path(TEST_DIR).glob('parkinson/*.png'))[:3]):
    img = tf.keras.preprocessing.image.load_img(img_path, target_size=(224, 224))
    img_array = tf.keras.preprocessing.image.img_to_array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)
    
    prediction = model.predict(img_array, verbose=0)[0][0]
    label = 'Healthy' if prediction > 0.5 else 'Parkinsons'
    confidence = max(prediction, 1 - prediction)
    
    print(f"  {i+1}. {img_path.name}: {label} ({confidence*100:.1f}%) [raw: {prediction:.3f}]")

# Test Healthy images
print("\nHealthy Wave Images:")
for i, img_path in enumerate(list(Path(TEST_DIR).glob('healthy/*.png'))[:3]):
    img = tf.keras.preprocessing.image.load_img(img_path, target_size=(224, 224))
    img_array = tf.keras.preprocessing.image.img_to_array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)
    
    prediction = model.predict(img_array, verbose=0)[0][0]
    label = 'Healthy' if prediction > 0.5 else 'Parkinsons'
    confidence = max(prediction, 1 - prediction)
    
    print(f"  {i+1}. {img_path.name}: {label} ({confidence*100:.1f}%) [raw: {prediction:.3f}]")

print("\n" + "="*60)
print("✓ Wave Model Training Complete!")
print("="*60)
print("\nIf predictions still look wrong, the class order might be inverted.")
print("Backend will automatically handle this.")
