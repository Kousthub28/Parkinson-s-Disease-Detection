import tensorflowjs as tfjs

# Convert Keras H5 model to TensorFlow.js format
tfjs.converters.convert_keras_h5_to_tfjs_layers_model(
    'public/models/spiral/mobilenet_spiral.h5',
    'public/models/spiral_converted/'
)

print("✓ Conversion complete!")
