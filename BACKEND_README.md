# Parkinson's Detection Backend API

## Quick Start

### 1. Install Python dependencies:
```powershell
& "C:\Users\koust\AppData\Local\Programs\Python\Python310\python.exe" -m pip install flask flask-cors pillow
```

### 2. Start the backend server:
```powershell
& "C:\Users\koust\AppData\Local\Programs\Python\Python310\python.exe" backend_api.py
```

### 3. Start the frontend (in another terminal):
```powershell
npm run dev
```

### 4. Test the app:
- Open http://localhost:5173
- Upload a spiral image
- Get real predictions from your trained model!

## API Endpoints

- **GET /health** - Check if server is running
- **POST /predict** - Upload image, get prediction

## How it Works

1. Frontend sends spiral image to backend API
2. Backend loads your trained `mobilenet_spiral.h5` model  
3. Backend preprocesses image and runs inference
4. Backend returns prediction with 86.67% accuracy
5. Frontend displays results to user

## Troubleshooting

**Backend won't start?**
- Make sure port 5000 is available
- Check Python 3.10 is installed
- Install missing dependencies

**CORS errors?**
- Backend has CORS enabled for all origins
- Check backend is running on http://localhost:5000

**Model not loading?**
- Ensure `public/models/spiral/mobilenet_spiral.h5` exists
- Check TensorFlow 2.13 is installed correctly
