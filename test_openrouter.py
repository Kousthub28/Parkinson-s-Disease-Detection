import urllib.request
import json
import ssl

url = 'https://openrouter.ai/api/v1/models'
req = urllib.request.Request(url)

try:
    context = ssl._create_unverified_context()
    with urllib.request.urlopen(req, context=context) as response:
        data = json.loads(response.read().decode('utf-8'))
        free_models = [m['id'] for m in data['data'] if m.get('pricing', {}).get('prompt') == '0' or 'free' in m['id']]
        print('Free models:')
        for m in free_models[:30]:
            print(m)
except Exception as e:
    print('Exception:', str(e))
