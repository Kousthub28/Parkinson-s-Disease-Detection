# Git Push Instructions

## Quick Push

Run the batch file:
```powershell
.\push_to_github.bat
```

## Manual Steps (if batch file doesn't work)

1. **Initialize git (if not already):**
   ```powershell
   git init
   ```

2. **Add remote:**
   ```powershell
   git remote add origin https://github.com/Kousthub28/Parkinson-s-Disease-Detection.git
   ```
   Or if it already exists:
   ```powershell
   git remote set-url origin https://github.com/Kousthub28/Parkinson-s-Disease-Detection.git
   ```

3. **Add all files:**
   ```powershell
   git add .
   ```

4. **Commit:**
   ```powershell
   git commit -m "Update: MongoDB migration, Keras 3 model support, project reorganization"
   ```

5. **Push:**
   ```powershell
   git branch -M main
   git push -u origin main
   ```

## Authentication

If you're prompted for credentials:
- **Username:** Your GitHub username
- **Password:** Use a **Personal Access Token** (not your GitHub password)
  - Go to: https://github.com/settings/tokens
  - Generate new token with `repo` scope
  - Use that token as the password

## What's Excluded

The `.gitignore` excludes:
- Large model files (`.h5`, `.keras`, `.bin`)
- Training/test images
- `node_modules/`, `__pycache__/`
- `.env` files
- Build outputs

## Current Project Structure

```
├── backend/
│   ├── backend_api.py          # Flask API with Keras 3 support
│   ├── mongodb_service.py      # MongoDB operations
│   ├── requirements.txt        # Python dependencies
│   └── models/                 # Model files (excluded from git)
├── frontend/
│   ├── src/                    # React/TypeScript source
│   ├── public/                 # Static assets
│   └── package.json            # Node dependencies
└── .gitignore                  # Git ignore rules
```

