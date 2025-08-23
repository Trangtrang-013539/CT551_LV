# File: model_loader.py

import os
import numpy as np
import timm
import torch
from torchvision import transforms
from PIL import Image
from io import BytesIO

from tensorflow.keras.preprocessing.image import img_to_array
from tensorflow.keras.applications.inception_v3 import preprocess_input as preprocess_incv3
from tensorflow.keras.applications.inception_resnet_v2 import preprocess_input as preprocess_resnet
from tensorflow.keras.models import load_model as keras_load_model

from config import IMAGE_SIZE, MODEL_FILES

def build_model_InceptionV4(dropout_gap, dropout_dense, dense_units, unfreeze_layers):
    base_model = timm.create_model('inception_v4', pretrained=True)

    base_model.reset_classifier(num_classes=0, global_pool='avg')
    in_feats = base_model.num_features

    # Freeze toàn bộ backbone
    for param in base_model.parameters():
        param.requires_grad = False

    if unfreeze_layers == 'all':
        for param in base_model.parameters():
            param.requires_grad = True
    else:
        params = list(base_model.parameters())
        for p in params[-unfreeze_layers:]:
            p.requires_grad = True

    # Xây classifier mới dùng list + for
    layers = [torch.nn.Dropout(dropout_gap)]  # GAP dropout đầu tiên

    last_units = in_feats
    for units in dense_units:
        layers.append(torch.nn.Linear(last_units, units, bias=False))
        layers.append(torch.nn.BatchNorm1d(units))
        layers.append(torch.nn.ReLU(inplace=True))
        layers.append(torch.nn.Dropout(dropout_dense))
        last_units = units

    layers.append(torch.nn.Linear(last_units, 11))  # output layer
    layers.append(torch.nn.Softmax(dim=1))
    base_model.last_linear = torch.nn.Sequential(*layers)

    return base_model

def load_model(model_name):
    model_path = MODEL_FILES.get(model_name)
    if model_path is None or not os.path.exists(model_path):
        raise ValueError(f"Không tìm thấy file model cho {model_name} tại {model_path}")

    if model_name == 'InceptionV4':
        model = build_model_InceptionV4(dropout_gap=0.278, dropout_dense=0.354, dense_units=[256], unfreeze_layers='all')
        # Load trọng số từ file .pth
        state_dict = torch.load(model_path, map_location=device)
        model.load_state_dict(state_dict, strict=False)
        model.to(device)
        model.eval()
        return model
    
    elif model_name == 'InceptionV4_Aug':
        model = build_model_InceptionV4(dropout_gap=0.263, dropout_dense=0.402, dense_units=[256], unfreeze_layers=150)
        # Load trọng số từ file .pth
        state_dict = torch.load(model_path, map_location=device)
        model.load_state_dict(state_dict, strict=False)
        model.to(device)
        model.eval()
        return model
    
    elif 'InceptionV3' in model_name or 'InceptionResNetV2' in model_name:
        # Load trực tiếp cả model .keras
        model = keras_load_model(model_path)
        return model
    
    else:
        raise ValueError(f"Model '{model_name}' không hợp lệ")
    
    
IMAGE_SIZE = (299, 299)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
# Tiền xử lý ảnh đầu vào
def preprocess_image(image_bytes, model_name):
    if 'InceptionV3' in model_name or 'InceptionResNetV2' in model_name:
        img = Image.open(BytesIO(image_bytes)).convert("RGB")
        img = img.resize(IMAGE_SIZE)
        img_array = img_to_array(img)

        if 'InceptionV3' in model_name:
            img_array = preprocess_incv3(img_array)
        elif 'InceptionResNetV2' in model_name:
            img_array = preprocess_resnet(img_array)

        img_array = np.expand_dims(img_array, axis=0)
        return img_array, img  # numpy array

    elif 'InceptionV4' in model_name:
        preprocess = transforms.Compose([
            transforms.Resize((299, 299)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406],
                                 std=[0.229, 0.224, 0.225]),
        ])
        img = Image.open(BytesIO(image_bytes)).convert("RGB")
        input_tensor = preprocess(img).unsqueeze(0).to(device)
        return input_tensor, img  # torch 
    
# khởi tạo model 
loaded_models = {}
def preload_models():
    print("[LIFESPAN] Preloading models...")
    for name, path in MODEL_FILES.items():
        if path:
            try:
                print(f"[INFO] Loading model {name} from {path}")
                loaded_models[name] = load_model(name)
                print(f"[OK] {name} loaded")
            except Exception as e:
                print(f"[ERROR] Failed to load {name}: {e}")

def get_model(name):
    return loaded_models.get(name)
