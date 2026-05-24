#!/usr/bin/env python
"""Test script to verify routes are registered"""
import sys
sys.path.insert(0, '.')

try:
    from backend_api import app
    
    print("=" * 60)
    print("REGISTERED ROUTES:")
    print("=" * 60)
    
    routes = []
    for rule in app.url_map.iter_rules():
        routes.append(str(rule))
    
    routes.sort()
    
    # Filter for auth routes
    auth_routes = [r for r in routes if 'auth' in r.lower()]
    
    print("\nAUTH ROUTES:")
    for route in auth_routes:
        print(f"  {route}")
    
    print("\nGOOGLE SIGNIN ROUTE FOUND:", any('google-signin' in r.lower() for r in routes))
    
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
