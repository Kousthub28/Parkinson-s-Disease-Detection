/**
 * Convert Keras H5 model to TensorFlow.js format using tfjs-node
 */
import * as tf from '@tensorflow/tfjs-node';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

async function convertH5ToTfjs() {
  console.log('🔄 Starting H5 to TensorFlow.js conversion...\n');
  
  const h5Path = join(projectRoot, 'mobilenet_spiral_tuned.h5');
  const outputPath = join(projectRoot, 'public', 'models', 'spiral');
  
  console.log(`Input:  ${h5Path}`);
  console.log(`Output: ${outputPath}\n`);
  
  // Check if H5 file exists
  if (!fs.existsSync(h5Path)) {
    console.error(`❌ Error: H5 file not found at ${h5Path}`);
    process.exit(1);
  }
  
  try {
    // Create output directory
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
      console.log(`✓ Created output directory: ${outputPath}\n`);
    }
    
    // Load the H5 model
    console.log('📥 Loading H5 model...');
    const model = await tf.loadLayersModel(`file://${h5Path}`);
    console.log('✓ Model loaded successfully!\n');
    
    // Print model summary
    console.log('📊 Model Summary:');
    console.log(`  Input shape: ${JSON.stringify(model.inputs[0].shape)}`);
    console.log(`  Output shape: ${JSON.stringify(model.outputs[0].shape)}`);
    console.log(`  Total parameters: ${model.countParams().toLocaleString()}\n`);
    
    // Save as TensorFlow.js graph model
    console.log('💾 Saving as TensorFlow.js format...');
    await model.save(`file://${outputPath}`);
    console.log('✓ Model saved successfully!\n');
    
    // List generated files
    const files = fs.readdirSync(outputPath);
    console.log('📁 Generated files:');
    files.forEach(file => {
      const filePath = join(outputPath, file);
      const stats = fs.statSync(filePath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      console.log(`  ✓ ${file} (${sizeKB} KB)`);
    });
    
    console.log('\n✅ Conversion completed successfully!');
    console.log(`\n📝 Model ready for deployment at: public/models/spiral/\n`);
    
  } catch (error) {
    console.error('\n❌ Conversion failed!');
    console.error(`Error: ${error.message}`);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run conversion
convertH5ToTfjs();
