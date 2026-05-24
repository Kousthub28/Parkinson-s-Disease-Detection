#!/usr/bin/env python
"""Quick test to verify google-signin route is callable"""
import sys
import os

try:
    # Add backend to path
    backend_path = r'C:\parkinson\'s_care_app_frontend_3mcbx2_dualiteproject\backend'
    sys.path.insert(0, backend_path)
    os.chdir(backend_path)
    
    print("Attempting to import Flask app...")
    from backend_api import app, google_signin
    
    print("✓ Successfully imported app and google_signin function")
    print(f"✓ google_signin function exists: {google_signin}")
    
    print("\nRegistered routes:")
    routes = [r.rule for r in app.url_map.iter_rules()]
    auth_routes = [r for r in routes if 'auth' in r.lower()]
    
    for route in sorted(auth_routes):
        print(f"  {route}")
    
    if '/api/auth/google-signin' in routes:
        print("\n✓✓✓ /api/auth/google-signin route IS registered!")
    else:
        print("\n✗✗✗ /api/auth/google-signin route NOT found")
        print("\nAll registered routes:")
        for route in sorted(routes)[:30]:
            print(f"  {route}")
        
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()
