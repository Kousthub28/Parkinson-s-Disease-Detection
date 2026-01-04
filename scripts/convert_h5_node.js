/**
 * Convert H5 Keras model to TensorFlow.js format using Node.js
 * This bypasses Python version issues by using tfjs-node
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function convertModel() {
  console.log('='.repeat(60));
  console.log('MobileNetV2 H5 to TensorFlow.js Converter (Node.js)');
  console.log('='.repeat(60));
  
  const projectRoot = path.join(__dirname, '..');
  const h5Path = path.join(projectRoot, 'mobilenet_spiral_tuned.h5');
  const outputPath = path.join(projectRoot, 'public', 'models', 'spiral');
  
  console.log(`\n📁 Input:  ${h5Path}`);
  console.log(`📁 Output: ${outputPath}\n`);
  
  // Check if H5 file exists
  if (!fs.existsSync(h5Path)) {
    console.error(`❌ ERROR: H5 file not found at: ${h5Path}`);
    process.exit(1);
  }
  
  try {
    // Import TensorFlow.js Node
    console.log('📦 Loading TensorFlow.js Node...');
    const tf = await import('@tensorflow/tfjs-node');
    console.log(`✓ TensorFlow.js version: ${tf.version.tfjs}`);
    console.log(`✓ TensorFlow backend: ${tf.getBackend()}\n`);
    
    // Load the H5 model
    console.log('🔄 Loading H5 model...');
    const model = await tf.loadLayersModel(`file://${h5Path}`);
    console.log('✓ Model loaded successfully!');
    
    // Print model information
    console.log('\n📊 Model Information:');
    console.log(`   Input shape:  ${JSON.stringify(model.inputs[0].shape)}`);
    console.log(`   Output shape: ${JSON.stringify(model.outputs[0].shape)}`);
    console.log(`   Parameters:   ${model.countParams().toLocaleString()}`);
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
      console.log(`\n✓ Created output directory: ${outputPath}`);
    }
    
    // Save as TensorFlow.js format
    console.log('\n🔄 Converting to TensorFlow.js format...');
    await model.save(`file://${outputPath}`);
    console.log('✓ Model saved successfully!');
    
    // List generated files
    const files = fs.readdirSync(outputPath);
    console.log('\n📂 Generated files:');
    let totalSize = 0;
    files.forEach(filename => {
      const filepath = path.join(outputPath, filename);
      const stats = fs.statSync(filepath);
      totalSize += stats.size;
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`   ✓ ${filename.padEnd(35)} (${sizeMB} MB)`);
    });
    
    console.log(`\n📊 Total size: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log('\n✅ Conversion completed successfully!');
    console.log('🎉 Model is ready to use in your web application!');
    console.log(`   Load it using: tf.loadLayersModel('/models/spiral/model.json')`);
    console.log('\n💡 Refresh your browser to see it in action!\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERROR during conversion:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run conversion
convertModel();
