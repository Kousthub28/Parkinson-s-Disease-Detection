"""
Retrain Wave Model with InceptionV3
"""

import tensorflow as tf
import numpy as np
from pathlib import Path
import os

print("="*60)
print("Training Wave Model (InceptionV3)")
print("="*60)

# Paths
TRAIN_DIR = 'wave/training'
TEST_DIR = 'wave/testing'
OUTPUT_MODEL = 'public/models/wave/inception_wave.h5'

# Check dataset
print(f"\nChecking dataset...")
train_parkinson = len(list(Path(TRAIN_DIR).glob('parkinson/*.png')))
train_healthy = len(list(Path(TRAIN_DIR).glob('healthy/*.png')))
test_parkinson = len(list(Path(TEST_DIR).glob('parkinson/*.png')))
test_healthy = len(list(Path(TEST_DIR).glob('healthy/*.png')))

print(f"  Train - Parkinson: {train_parkinson}, Healthy: {train_healthy}")
print(f"  Test - Parkinson: {test_parkinson}, Healthy: {test_healthy}")

if train_parkinson == 0 or train_healthy == 0:
    print("\nERROR: No training data found!")
    exit(1)

# Build InceptionV3 model
print(f"\nBuilding InceptionV3 model...")
base_model = tf.keras.applications.InceptionV3(
    input_shape=(224, 224, 3),
    include_top=False,
    weights='imagenet',
    pooling=None
)
base_model.trainable = False  # Freeze base
base_model._name = 'inceptionv3'

model = tf.keras.Sequential([
    base_model,
    tf.keras.layers.GlobalAveragePooling2D(name='global_avg_pool'),
    tf.keras.layers.Dense(128, activation='relu', name='dense_128'),
    tf.keras.layers.Dropout(0.5, name='dropout'),
    tf.keras.layers.Dense(1, activation='sigmoid', name='output')
])

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
    loss='binary_crossentropy',
    metrics=['accuracy']
)

print(f"  Model built: {len(model.layers)} layers")

# Data generators
print(f"\nSetting up data generators...")
train_datagen = tf.keras.preprocessing.image.ImageDataGenerator(
    rescale=1./255.0,  # InceptionV3 uses [0,1] normalization
    rotation_range=20,
    width_shift_range=0.2,
    height_shift_range=0.2,
    horizontal_flip=True,
    zoom_range=0.2,
    fill_mode='nearest'
)

test_datagen = tf.keras.preprocessing.image.ImageDataGenerator(
    rescale=1./255.0
)

train_generator = train_datagen.flow_from_directory(
    TRAIN_DIR,
    target_size=(224, 224),
    batch_size=16,
    class_mode='binary',
    classes=['parkinson', 'healthy'],
    shuffle=True
)

test_generator = test_datagen.flow_from_directory(
    TEST_DIR,
    target_size=(224, 224),
    batch_size=16,
    class_mode='binary',
    classes=['parkinson', 'healthy'],
    shuffle=False
)

print(f"  Training samples: {train_generator.n}")
print(f"  Test samples: {test_generator.n}")

# Train
print(f"\nTraining wave model...")
print(f"  Epochs: 20")

history = model.fit(
    train_generator,
    epochs=20,
    validation_data=test_generator,
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

# Test prediction
print(f"\nTesting prediction...")
test_img_path = list(Path(TEST_DIR).glob('parkinson/*.png'))[0]
print(f"  Image: {test_img_path}")

img = tf.keras.preprocessing.image.load_img(test_img_path, target_size=(224, 224))
img_array = tf.keras.preprocessing.image.img_to_array(img)
img_array = img_array / 255.0
img_array = np.expand_dims(img_array, axis=0)

prediction = model.predict(img_array, verbose=0)
sigmoid_value = prediction[0][0]
label = 'Healthy' if sigmoid_value > 0.5 else 'Parkinsons'
confidence = max(sigmoid_value, 1 - sigmoid_value)

print(f"  Prediction: {label} ({confidence*100:.1f}% confidence)")
print(f"  Raw output: {sigmoid_value:.4f}")

print("\n" + "="*60)
print("✓ Wave Model Training Complete!")
print("="*60)
