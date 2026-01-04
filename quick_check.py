import h5py
import json

with h5py.File('public/models/spiral/mobilenet_spiral.h5', 'r') as f:
    config = json.loads(f.attrs['model_config'])
    print('Model type:', config['class_name'])
    print('Total layers:', len(config['config']['layers']))
    print('\nFirst 10 layers:')
    for i, layer in enumerate(config['config']['layers'][:10]):
        print(f"  {i}: {layer['class_name']} - {layer['config'].get('name', 'unnamed')}")
