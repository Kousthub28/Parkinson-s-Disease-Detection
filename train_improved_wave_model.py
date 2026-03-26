"""
Improved Wave Model Training Script using InceptionV3
Enhanced training methodology for better wave pattern detection
"""

import tensorflow as tf
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance
import os
import random
from sklearn.model_selection import train_test_split
from sklearn.utils import class_weight
import cv2

class RealisticWaveGenerator:
    """Generate highly realistic and diverse wave data"""
    
    def __init__(self, img_size=224):
        self.img_size = img_size
        
    def create_diverse_wave(self, is_parkinsons=False, seed=None):
        """Create highly diverse wave with realistic variations"""
        if seed is not None:
            np.random.seed(seed)
            random.seed(seed)
        
        # Create black background
        img = np.zeros((self.img_size, self.img_size, 3), dtype=np.uint8)
        
        # Wave parameters with high diversity
        center_y = self.img_size // 2 + np.random.randint(-30, 30)
        
        if is_parkinsons:
            # Parkinson's characteristics:
            # - Smaller amplitude
            # - Irregular frequency
            # - Tremor and shakiness
            # - Variable line continuity
            amplitude = np.random.randint(20, 40)
            base_frequency = np.random.uniform(2, 4)
            tremor_amplitude = np.random.uniform(3, 8)
            tremor_frequency = np.random.uniform(15, 25)
            
            # Irregular gaps
            gap_probability = np.random.uniform(0.05, 0.15)
            
        else:
            # Healthy characteristics:
            # - Larger amplitude
            # - Consistent frequency
            # - Smooth, continuous
            amplitude = np.random.randint(35, 60)
            base_frequency = np.random.uniform(3, 6)
            tremor_amplitude = np.random.uniform(0.5, 2)
            tremor_frequency = np.random.uniform(8, 15)
            gap_probability = np.random.uniform(0, 0.02)
        
        # Generate wave points
        points = []
        phase_shift = np.random.uniform(0, 2*np.pi)
        
        for x in range(self.img_size):
            # Skip some points for gaps (Parkinson's)
            if np.random.random() < gap_probability:
                continue
            
            # Calculate base wave
            y_base = center_y + amplitude * np.sin(base_frequency * (x/self.img_size) * 2 * np.pi + phase_shift)
            
            # Add tremor
            y_tremor = tremor_amplitude * np.sin(tremor_frequency * (x/self.img_size) * 2 * np.pi)
            
            # Add random noise
            y_noise = np.random.normal(0, 1 if not is_parkinsons else 3)
            
            y = int(y_base + y_tremor + y_noise)
            y = np.clip(y, 20, self.img_size - 20)
            
            points.append((x, y))
        
        # Draw wave with realistic characteristics
        for i in range(len(points) - 1):
            if np.random.random() < 0.1:  # Occasional micro-gaps
                continue
                
            x1, y1 = points[i]
            x2, y2 = points[i + 1]
            
            if 0 <= x1 < self.img_size and 0 <= y1 < self.img_size and 0 <= x2 < self.img_size and 0 <= y2 < self.img_size:
                # Variable thickness based on condition
                if is_parkinsons:
                    thickness = np.random.choice([1, 2, 3], p=[0.4, 0.4, 0.2])
                    intensity = np.random.randint(180, 255)
                else:
                    thickness = np.random.choice([2, 3, 4], p=[0.2, 0.6, 0.2])
                    intensity = np.random.randint(200, 255)
                
                # Draw line segment
                cv2.line(img, (x1, y1), (x2, y2), (intensity, intensity, intensity), thickness)
        
        return img
    
    def add_realistic_effects(self, img):
        """Add realistic image effects and noise"""
        # Convert to PIL for easier manipulation
        pil_img = Image.fromarray(img)
        
        # Random transformations
        if random.random() > 0.5:
            # Rotation
            angle = random.uniform(-10, 10)
            pil_img = pil_img.rotate(angle, fillcolor=(0, 0, 0))
        
        if random.random() > 0.5:
            # Scale/zoom
            scale = random.uniform(0.8, 1.2)
            w, h = pil_img.size
            new_w, new_h = int(w * scale), int(h * scale)
            pil_img = pil_img.resize((new_w, new_h))
            # Crop back to original size
            left = (new_w - w) // 2
            top = (new_h - h) // 2
            pil_img = pil_img.crop((left, top, left + w, top + h))
        
        if random.random() > 0.5:
            # Brightness/contrast
            enhancer = ImageEnhance.Brightness(pil_img)
            pil_img = enhancer.enhance(random.uniform(0.6, 1.4))
            
            enhancer = ImageEnhance.Contrast(pil_img)
            pil_img = enhancer.enhance(random.uniform(0.7, 1.3))
        
        # Convert back to numpy
        img_array = np.array(pil_img)
        
        # Add various types of noise
        if random.random() > 0.3:
            # Gaussian noise
            noise = np.random.normal(0, random.uniform(3, 15), img_array.shape)
            img_array = np.clip(img_array + noise, 0, 255).astype(np.uint8)
        
        if random.random() > 0.5:
            # Salt and pepper noise
            mask = np.random.random(img_array.shape[:2]) > 0.98
            img_array[mask] = np.random.choice([0, 255], size=img_array[mask].shape)
        
        # Simulate scanning artifacts
        if random.random() > 0.7:
            # Slight blur
            img_array = cv2.GaussianBlur(img_array, (3, 3), 0)
        
        return img_array
    
    def generate_balanced_dataset(self, num_per_class=3000):
        """Generate large, balanced dataset with extreme diversity"""
        X = []
        y = []
        
        print(f"Generating {num_per_class} diverse wave samples per class...")
        
        # Generate healthy waves with maximum diversity
        for i in range(num_per_class):
            # Use different seeds for maximum diversity
            seed = i * 2
            img = self.create_diverse_wave(is_parkinsons=False, seed=seed)
            img = self.add_realistic_effects(img)
            X.append(img)
            y.append(0)  # 0 for healthy
            
            if (i + 1) % 500 == 0:
                print(f"  Healthy samples: {i + 1}/{num_per_class}")
        
        # Generate Parkinson's waves with maximum diversity
        for i in range(num_per_class):
            seed = i * 2 + 1  # Different seeds
            img = self.create_diverse_wave(is_parkinsons=True, seed=seed)
            img = self.add_realistic_effects(img)
            X.append(img)
            y.append(1)  # 1 for Parkinson's
            
            if (i + 1) % 500 == 0:
                print(f"  Parkinson's samples: {i + 1}/{num_per_class}")
        
        return np.array(X), np.array(y)

def create_improved_inception_model(input_shape=(224, 224, 3)):
    """Create improved InceptionV3 model architecture"""
    
    # Use InceptionV3 as base model
    base_model = tf.keras.applications.InceptionV3(
        input_shape=input_shape,
        include_top=False,
        weights='imagenet'
    )
    
    # Freeze early layers
    for layer in base_model.layers[:-50]:  # Freeze early layers
        layer.trainable = False
    
    # Build sophisticated classification head
    x = base_model.output
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Dropout(0.5)(x)
    
    # Multiple dense layers with regularization
    x = tf.keras.layers.Dense(512, activation='relu',
                           kernel_regularizer=tf.keras.regularizers.l2(0.01))(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Dropout(0.4)(x)
    
    x = tf.keras.layers.Dense(256, activation='relu',
                           kernel_regularizer=tf.keras.regularizers.l2(0.01))(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    
    x = tf.keras.layers.Dense(128, activation='relu',
                           kernel_regularizer=tf.keras.regularizers.l2(0.01))(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Dropout(0.2)(x)
    
    # Final output layer
    output = tf.keras.layers.Dense(1, activation='sigmoid')(x)
    
    model = tf.keras.Model(inputs=base_model.input, outputs=output)
    
    return model

def train_improved_wave_model():
    """Train improved wave model with robust methodology"""
    
    print("=== Training Improved Wave Model (InceptionV3) ===")
    
    # Generate diverse training data
    generator = RealisticWaveGenerator()
    X, y = generator.generate_balanced_dataset(num_per_class=3000)
    
    # Split data with stratification
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"\nDataset Info:")
    print(f"Training: {X_train.shape}, Labels: {np.bincount(y_train)}")
    print(f"Testing: {X_test.shape}, Labels: {np.bincount(y_test)}")
    
    # Create model
    model = create_improved_inception_model()
    model.summary()
    
    # Compile with appropriate learning rate and metrics
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=5e-5),
        loss='binary_crossentropy',
        metrics=[
            'accuracy',
            tf.keras.metrics.AUC(name='auc'),
            tf.keras.metrics.Precision(name='precision'),
            tf.keras.metrics.Recall(name='recall')
        ]
    )
    
    # Preprocessing function for InceptionV3
    def preprocess_inception(X):
        """Preprocess for InceptionV3: scale to [0, 1]"""
        return X.astype(np.float32) / 255.0
    
    X_train_processed = preprocess_inception(X_train)
    X_test_processed = preprocess_inception(X_test)
    
    # Enhanced data augmentation
    datagen = tf.keras.preprocessing.image.ImageDataGenerator(
        rotation_range=15,
        width_shift_range=0.1,
        height_shift_range=0.1,
        zoom_range=0.15,
        shear_range=0.1,
        brightness_range=[0.7, 1.3],
        horizontal_flip=False,  # Don't flip waves
        fill_mode='constant',
        cval=0
    )
    
    # Better callbacks
    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor='val_loss', patience=15, restore_best_weights=True, verbose=1
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss', factor=0.5, patience=8, min_lr=1e-7, verbose=1
        ),
        tf.keras.callbacks.ModelCheckpoint(
            'improved_wave_model.h5', monitor='val_loss', save_best_only=True, verbose=1
        )
    ]
    
    # Train with balanced class weights
    class_weights = {0: 1.0, 1: 1.0}
    
    print("\n=== Training Model ===")
    history = model.fit(
        datagen.flow(X_train_processed, y_train, batch_size=32),
        epochs=100,
        validation_data=(X_test_processed, y_test),
        class_weight=class_weights,
        callbacks=callbacks,
        verbose=1
    )
    
    # Comprehensive evaluation
    print("\n=== Comprehensive Evaluation ===")
    y_pred = model.predict(X_test_processed, verbose=0)
    y_pred_classes = (y_pred > 0.5).astype(int).flatten()
    
    from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred_classes, target_names=['Healthy', 'Parkinsons']))
    
    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, y_pred_classes))
    
    print(f"\nROC AUC Score: {roc_auc_score(y_test, y_pred):.4f}")
    
    # Test with diverse examples
    print("\n=== Testing with Diverse Examples ===")
    
    test_cases = [
        ("Clean Healthy", False, 42),
        ("Clean Parkinson's", True, 43),
        ("Noisy Healthy", False, 44),
        ("Noisy Parkinson's", True, 45),
        ("Rotated Healthy", False, 46),
        ("Rotated Parkinson's", True, 47)
    ]
    
    for name, is_parkinsons, seed in test_cases:
        img = generator.create_diverse_wave(is_parkinsons=is_parkinsons, seed=seed)
        img = generator.add_realistic_effects(img)
        
        processed = preprocess_inception(np.expand_dims(img, axis=0))
        pred = model.predict(processed, verbose=0)[0][0]
        
        # Wave model: high value = Healthy, low value = Parkinson's
        healthy_score = pred
        parkinsons_score = 1 - pred
        prediction = 'Parkinsons' if parkinsons_score > healthy_score else 'Healthy'
        confidence = max(pred, 1-pred)
        
        print(f"{name}: {prediction} ({confidence:.3f}, sigmoid: {pred:.3f})")
    
    # Save final model
    model.save('backend/models/wave/inception_wave_improved.h5')
    print("\n✓ Improved wave model saved to: backend/models/wave/inception_wave_improved.h5")
    
    return model, history

if __name__ == "__main__":
    # Set seeds for reproducibility
    tf.random.set_seed(42)
    np.random.seed(42)
    random.seed(42)
    
    model, history = train_improved_wave_model()
