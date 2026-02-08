@echo off
echo ========================================
echo Pushing code to GitHub
echo ========================================
echo.

REM Check if git is initialized
if not exist .git (
    echo Initializing git repository...
    git init
    echo.
)

REM Check if remote exists
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo Adding remote origin...
    git remote add origin https://github.com/Kousthub28/Parkinson-s-Disease-Detection.git
    echo.
) else (
    echo Updating remote origin...
    git remote set-url origin https://github.com/Kousthub28/Parkinson-s-Disease-Detection.git
    echo.
)

echo Adding all files...
git add .

echo.
echo Current status:
git status --short

echo.
echo Committing changes...
git commit -m "Update: MongoDB migration, Keras 3 model support, project reorganization

- Migrated from Supabase to MongoDB
- Added Keras 3.0 model loading support for spiral detection
- Reorganized project into frontend/ and backend/ directories
- Updated backend API with improved model loading
- Cleaned up unwanted files and scripts
- Fixed weight loading for Keras 3 format (layers/<name>/vars/)"

echo.
echo Pushing to GitHub...
git branch -M main
git push -u origin main

echo.
echo ========================================
echo Done! Check GitHub: https://github.com/Kousthub28/Parkinson-s-Disease-Detection
echo ========================================
pause

