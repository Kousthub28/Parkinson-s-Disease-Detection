# Python 3.10 Setup Instructions

## Step 1: Uninstall Python 3.14
1. Press `Win + X` → Select "Apps and Features"
2. Search for "Python 3.14"
3. Click → Uninstall

## Step 2: Download Python 3.10.11
Download from: https://www.python.org/downloads/release/python-31011/
- Choose: **Windows installer (64-bit)**

## Step 3: Install Python 3.10
- ✅ **IMPORTANT**: Check "Add Python 3.10 to PATH"
- Click "Install Now"
- Wait for installation to complete

## Step 4: Verify Installation
Open new PowerShell terminal:
```powershell
python --version
# Should show: Python 3.10.11
```

## Step 5: Install Required Packages
```powershell
cd "C:\parkinson's_care_app_frontend_3mcbx2_dualiteproject"

# Install TensorFlow and conversion tools
pip install tensorflow==2.13.0 tensorflowjs==4.11.0 h5py numpy pillow

# Verify installation
python -c "import tensorflow as tf; print(f'TensorFlow {tf.__version__} installed')"
```

## Step 6: Convert Your Model
```powershell
# Convert H5 to TensorFlow.js format
tensorflowjs_converter --input_format=keras `
  "public/models/spiral/mobilenet_spiral.h5" `
  "public/models/spiral_new/"

# Replace old files
Remove-Item "public/models/spiral/model.json" -Force
Remove-Item "public/models/spiral/group1-shard1of1.bin" -Force
Move-Item "public/models/spiral_new/*" "public/models/spiral/" -Force
Remove-Item "public/models/spiral_new" -Recurse -Force
```

## Step 7: Test in Browser
1. Refresh browser (Ctrl+Shift+R)
2. Upload spiral image
3. Check prediction accuracy

---

**Quick Command Summary (after Python 3.10 is installed):**
```powershell
pip install tensorflow==2.13.0 tensorflowjs==4.11.0 h5py
tensorflowjs_converter --input_format=keras public/models/spiral/mobilenet_spiral.h5 public/models/spiral_converted/
```
