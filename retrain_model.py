"""
Retrain MobileNetV2 model for Parkinson's detection
This will create a compatible H5 file that can be loaded properly
"""

import tensorflow as tf
from tensorflow import keras
import numpy as np
import os
from pathlib import Path
from PIL import Image
import json

print("="*60)
print("Retraining MobileNetV2 for Parkinson's Detection")
print("="*60)

# Configuration
IMG_SIZE = 224
BATCH_SIZE = 32
EPOCHS = 10  # Adjust based on your dataset size
MODEL_SAVE_PATH = 'public/models/spiral/mobilenet_spiral_retrained.h5'

# Dataset paths - adjust these to match your dataset structure
DATASET_PATH = 'dataset'  # Change this to your dataset folder
TRAIN_PATH = os.path.join(DATASET_PATH, 'train')
VAL_PATH = os.path.join(DATASET_PATH, 'validation')
TEST_PATH = os.path.join(DATASET_PATH, 'test')

def check_dataset():
    """Check if dataset exists and show structure"""
    print("\nChecking dataset structure...")
    
    if not os.path.exists(DATASET_PATH):
        print(f"✗ Dataset not found at: {DATASET_PATH}")
        print("\nExpected structure:")
        print("  dataset/")
        print("    train/")
        print("      healthy/")
        print("      parkinsons/")
        print("    validation/")
        print("      healthy/")
        print("      parkinsons/")
        print("    test/")
        print("      healthy/")
        print("      parkinsons/")
        return False
    
    for split in ['train', 'validation', 'test']:
        path = os.path.join(DATASET_PATH, split)
        if os.path.exists(path):
            healthy = len(list(Path(path).glob('healthy/*')))
            parkinsons = len(list(Path(path).glob('parkinsons/*')))
            print(f"  {split}: {healthy} healthy, {parkinsons} parkinsons")
        else:
            print(f"  {split}: NOT FOUND")
    
    return True

def create_data_generators():
    """Create data generators with augmentation"""
    
    # Data augmentation for training
    train_datagen = keras.preprocessing.image.ImageDataGenerator(
        preprocessing_function=keras.applications.mobilenet_v2.preprocess_input,
        rotation_range=15,
        width_shift_range=0.1,
        height_shift_range=0.1,
        zoom_range=0.1,
        horizontal_flip=True,
        fill_mode='nearest'
    )
    
    # Only preprocessing for validation/test
    val_datagen = keras.preprocessing.image.ImageDataGenerator(
        preprocessing_function=keras.applications.mobilenet_v2.preprocess_input
    )
    
    # Create generators
    train_generator = train_datagen.flow_from_directory(
        TRAIN_PATH,
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode='binary',
        shuffle=True
    )
    
    val_generator = val_datagen.flow_from_directory(
        VAL_PATH,
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode='binary',
        shuffle=False
    )
    
    test_generator = val_datagen.flow_from_directory(
        TEST_PATH,
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode='binary',
        shuffle=False
    )
    
    return train_generator, val_generator, test_generator

def build_model():
    """Build MobileNetV2 model"""
    print("\nBuilding model architecture...")
    
    # Load MobileNetV2 base
    base_model = keras.applications.MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights='imagenet'  # Start with ImageNet weights
    )
    
    # Freeze base model initially
    base_model.trainable = False
    
    # Build model
    model = keras.Sequential([
        keras.layers.Input(shape=(IMG_SIZE, IMG_SIZE, 3)),
        base_model,
        keras.layers.GlobalAveragePooling2D(),
        keras.layers.Dense(128, activation='relu'),
        keras.layers.Dropout(0.5),
        keras.layers.Dense(1, activation='sigmoid')
    ])
    
    # Compile
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='binary_crossentropy',
        metrics=['accuracy']
    )
    
    print("✓ Model built")
    model.summary()
    
    return model

def train_model(model, train_gen, val_gen):
    """Train the model"""
    print("\nTraining model...")
    
    callbacks = [
        keras.callbacks.ModelCheckpoint(
            'best_model_temp.h5',
            monitor='val_accuracy',
            save_best_only=True,
            verbose=1
        ),
        keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=5,
            restore_best_weights=True,
            verbose=1
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=3,
            verbose=1
        )
    ]
    
    # Train
    history = model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=EPOCHS,
        callbacks=callbacks,
        verbose=1
    )
    
    return history

def fine_tune_model(model, train_gen, val_gen):
    """Fine-tune the model by unfreezing some layers"""
    print("\nFine-tuning model...")
    
    # Unfreeze the top layers of base model
    base_model = model.layers[1]  # MobileNetV2
    base_model.trainable = True
    
    # Freeze all layers except the last 30
    for layer in base_model.layers[:-30]:
        layer.trainable = False
    
    # Recompile with lower learning rate
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.0001),
        loss='binary_crossentropy',
        metrics=['accuracy']
    )
    
    # Train more epochs
    history = model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=10,
        verbose=1
    )
    
    return history

def evaluate_model(model, test_gen):
    """Evaluate on test set"""
    print("\nEvaluating on test set...")
    
    results = model.evaluate(test_gen, verbose=1)
    print(f"\n✓ Test Loss: {results[0]:.4f}")
    print(f"✓ Test Accuracy: {results[1]*100:.2f}%")
    
    return results

def save_model(model):
    """Save model in compatible format"""
    print(f"\nSaving model to: {MODEL_SAVE_PATH}")
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(MODEL_SAVE_PATH), exist_ok=True)
    
    # Save in HDF5 format (compatible with current backend)
    model.save(MODEL_SAVE_PATH, save_format='h5')
    
    print(f"✓ Model saved successfully!")
    print(f"  File size: {os.path.getsize(MODEL_SAVE_PATH) / (1024*1024):.2f} MB")
    
    # Also save as backup
    backup_path = MODEL_SAVE_PATH.replace('.h5', '_backup.h5')
    model.save(backup_path, save_format='h5')
    print(f"✓ Backup saved to: {backup_path}")

def main():
    """Main training pipeline"""
    
    # Check dataset
    if not check_dataset():
        print("\n" + "="*60)
        print("Please organize your dataset first!")
        print("="*60)
        return
    
    # Create data generators
    print("\nLoading dataset...")
    train_gen, val_gen, test_gen = create_data_generators()
    
    # Build model
    model = build_model()
    
    # Train
    print("\n" + "="*60)
    print("Starting Training Phase 1: Transfer Learning")
    print("="*60)
    train_model(model, train_gen, val_gen)
    
    # Fine-tune
    print("\n" + "="*60)
    print("Starting Training Phase 2: Fine-Tuning")
    print("="*60)
    fine_tune_model(model, train_gen, val_gen)
    
    # Evaluate
    print("\n" + "="*60)
    print("Final Evaluation")
    print("="*60)
    evaluate_model(model, test_gen)
    
    # Save
    save_model(model)
    
    print("\n" + "="*60)
    print("Training Complete!")
    print("="*60)
    print("\nNext steps:")
    print("1. Rename old model: mobilenet_spiral.h5 → mobilenet_spiral_old.h5")
    print("2. Rename new model: mobilenet_spiral_retrained.h5 → mobilenet_spiral.h5")
    print("3. Restart backend server")
    print("4. Test predictions!")

if __name__ == '__main__':
    main()
