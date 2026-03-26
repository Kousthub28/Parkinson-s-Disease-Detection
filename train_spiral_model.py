"""
Improved Spiral Model Training Script
Fixes the bias issue by using proper data augmentation and balanced training
"""

import tensorflow as tf
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance
import os
import random
from sklearn.model_selection import train_test_split
from sklearn.utils import class_weight
import cv2

class SpiralDataGenerator:
    """Generate synthetic spiral training data with realistic variations"""
    
    def __init__(self, img_size=224):
        self.img_size = img_size
        
    def create_spiral(self, is_parkinsons=False, variations=True):
        """Create a spiral image with optional variations"""
        img = Image.new('RGB', (self.img_size, self.img_size), (0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        center_x, center_y = self.img_size // 2, self.img_size // 2
        
        # Spiral parameters
        max_radius = self.img_size // 3
        num_turns = random.uniform(2.5, 3.5) if is_parkinsons else random.uniform(4, 6)
        line_width = random.uniform(2, 4) if is_parkinsons else random.uniform(3, 5)
        
        # Generate spiral points
        points = []
        num_points = 800
        
        for i in range(num_points):
            t = i / num_points
            angle = t * num_turns * 2 * np.pi
            
            if is_parkinsons:
                # Add tremor and irregularities for Parkinson's
                angle += np.random.normal(0, 0.15)
                radius = t * max_radius + np.random.normal(0, 3)
                # Add shaky movements
                if i % 10 == 0:
                    radius += np.random.normal(0, 5)
            else:
                radius = t * max_radius
                # Minor natural variations
                radius += np.random.normal(0, 0.5)
            
            x = center_x + radius * np.cos(angle)
            y = center_y + radius * np.sin(angle)
            points.append((x, y))
        
        # Draw the spiral
        for i in range(len(points) - 1):
            draw.line([points[i], points[i+1]], fill=(255, 255, 255), width=int(line_width))
        
        # Add variations if requested
        if variations:
            # Random rotation
            angle = random.uniform(-15, 15)
            img = img.rotate(angle, fillcolor=(0, 0, 0))
            
            # Random brightness/contrast
            if random.random() > 0.5:
                enhancer = ImageEnhance.Brightness(img)
                img = enhancer.enhance(random.uniform(0.8, 1.2))
            
            if random.random() > 0.5:
                enhancer = ImageEnhance.Contrast(img)
                img = enhancer.enhance(random.uniform(0.8, 1.2))
            
            # Add slight noise
            if random.random() > 0.7:
                img_array = np.array(img)
                noise = np.random.normal(0, 10, img_array.shape)
                img_array = np.clip(img_array + noise, 0, 255).astype(np.uint8)
                img = Image.fromarray(img_array)
        
        return img
    
    def generate_dataset(self, num_samples_per_class=1000):
        """Generate balanced dataset"""
        X = []
        y = []
        
        print(f"Generating {num_samples_per_class} samples per class...")
        
        # Generate healthy spirals
        for i in range(num_samples_per_class):
            img = self.create_spiral(is_parkinsons=False)
            X.append(np.array(img))
            y.append(0)  # 0 for healthy
            if (i + 1) % 100 == 0:
                print(f"  Healthy samples: {i + 1}/{num_samples_per_class}")
        
        # Generate Parkinson's spirals
        for i in range(num_samples_per_class):
            img = self.create_spiral(is_parkinsons=True)
            X.append(np.array(img))
            y.append(1)  # 1 for Parkinson's
            if (i + 1) % 100 == 0:
                print(f"  Parkinson's samples: {i + 1}/{num_samples_per_class}")
        
        return np.array(X), np.array(y)

def create_improved_model(input_shape=(224, 224, 3)):
    """Create improved MobileNetV2 model with better architecture"""
    
    # Load MobileNetV2 base
    base_model = tf.keras.applications.MobileNetV2(
        input_shape=input_shape,
        include_top=False,
        weights='imagenet'
    )
    
    # Freeze early layers
    for layer in base_model.layers[:100]:
        layer.trainable = False
    
    # Build improved classification head
    x = base_model.output
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    
    # Add dense layers with better regularization
    x = tf.keras.layers.Dense(256, activation='relu')(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Dropout(0.4)(x)
    
    x = tf.keras.layers.Dense(128, activation='relu')(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    
    # Output layer - sigmoid for binary classification
    output = tf.keras.layers.Dense(1, activation='sigmoid')(x)
    
    model = tf.keras.Model(inputs=base_model.input, outputs=output)
    
    return model

def train_model():
    """Train the improved spiral model"""
    
    print("=== Training Improved Spiral Model ===")
    
    # Generate training data
    generator = SpiralDataGenerator()
    X, y = generator.generate_dataset(num_samples_per_class=2000)
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"Training data shape: {X_train.shape}")
    print(f"Test data shape: {X_test.shape}")
    print(f"Class distribution - Train: {np.bincount(y_train)}")
    print(f"Class distribution - Test: {np.bincount(y_test)}")
    
    # Calculate class weights for balanced training
    class_weights = class_weight.compute_class_weight(
        'balanced', classes=np.unique(y_train), y=y_train
    )
    class_weight_dict = dict(enumerate(class_weights))
    print(f"Class weights: {class_weight_dict}")
    
    # Create model
    model = create_improved_model()
    model.summary()
    
    # Compile with appropriate metrics
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-4),
        loss='binary_crossentropy',
        metrics=['accuracy', 'AUC', 'Precision', 'Recall']
    )
    
    # Data preprocessing function
    def preprocess_mobilenetv2(X):
        """Preprocess for MobileNetV2: scale to [-1, 1]"""
        return (X.astype(np.float32) / 127.5) - 1.0
    
    # Preprocess data
    X_train_processed = preprocess_mobilenetv2(X_train)
    X_test_processed = preprocess_mobilenetv2(X_test)
    
    # Data augmentation
    datagen = tf.keras.preprocessing.image.ImageDataGenerator(
        rotation_range=15,
        width_shift_range=0.1,
        height_shift_range=0.1,
        zoom_range=0.1,
        horizontal_flip=False,  # Don't flip spirals
        fill_mode='constant',
        cval=0
    )
    
    # Callbacks
    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor='val_loss', patience=10, restore_best_weights=True
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss', factor=0.5, patience=5, min_lr=1e-7
        ),
        tf.keras.callbacks.ModelCheckpoint(
            'best_spiral_model.h5', monitor='val_loss', save_best_only=True
        )
    ]
    
    # Train model
    print("\n=== Training Model ===")
    history = model.fit(
        datagen.flow(X_train_processed, y_train, batch_size=32),
        epochs=50,
        validation_data=(X_test_processed, y_test),
        class_weight=class_weight_dict,
        callbacks=callbacks,
        verbose=1
    )
    
    # Evaluate model
    print("\n=== Evaluating Model ===")
    y_pred = model.predict(X_test_processed, verbose=0)
    y_pred_classes = (y_pred > 0.5).astype(int).flatten()
    
    from sklearn.metrics import classification_report, confusion_matrix
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred_classes, target_names=['Healthy', 'Parkinsons']))
    
    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, y_pred_classes))
    
    # Test with specific examples
    print("\n=== Testing Specific Examples ===")
    
    # Test healthy spiral
    healthy_img = generator.create_spiral(is_parkinsons=False, variations=False)
    healthy_array = preprocess_mobilenetv2(np.expand_dims(np.array(healthy_img), axis=0))
    healthy_pred = model.predict(healthy_array, verbose=0)[0][0]
    print(f"Healthy spiral prediction: {healthy_pred:.6f} ({'Parkinsons' if healthy_pred > 0.5 else 'Healthy'})")
    
    # Test Parkinson's spiral
    parkinsons_img = generator.create_spiral(is_parkinsons=True, variations=False)
    parkinsons_array = preprocess_mobilenetv2(np.expand_dims(np.array(parkinsons_img), axis=0))
    parkinsons_pred = model.predict(parkinsons_array, verbose=0)[0][0]
    print(f"Parkinson's spiral prediction: {parkinsons_pred:.6f} ({'Parkinsons' if parkinsons_pred > 0.5 else 'Healthy'})")
    
    # Save the improved model
    model.save('backend/models/spiral/mobilenet_spiral_improved.h5')
    print("\n✓ Improved model saved to: backend/models/spiral/mobilenet_spiral_improved.h5")
    
    return model, history

if __name__ == "__main__":
    # Set random seeds for reproducibility
    tf.random.set_seed(42)
    np.random.seed(42)
    random.seed(42)
    
    model, history = train_model()
