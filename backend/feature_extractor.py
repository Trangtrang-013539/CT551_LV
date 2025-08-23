# File: feature_extractor.py

import os
from tqdm import tqdm
import mysql.connector

import torch

from sklearn.preprocessing import normalize
from tensorflow.keras.models import Model

from sklearn.decomposition import PCA

from config import DATASET_DIR, MODEL_FILES
from db import connect_db
from model_loader import load_model, preprocess_image

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

class InceptionV4Extractor(torch.nn.Module):
    def __init__(self, base_model):
        super(InceptionV4Extractor, self).__init__()
        self.base_model = base_model
        self.pooling = torch.nn.AdaptiveAvgPool2d((1, 1))

    def forward(self, x):
        features = self.base_model.forward_features(x)
        pooled = self.pooling(features)
        pooled = pooled.view(pooled.size(0), -1)
        return pooled

class ModelExtractor:
    def __init__(self):
        self.models = {}
        self.extractors = {}

        for model_name, model_path in MODEL_FILES.items():
            if not os.path.exists(model_path):
                print(f"Không tìm thấy model: {model_path}")
                continue
            if model_name in ['InceptionV4', 'InceptionV4_Aug']:
                model = load_model(model_name)
                extractor = InceptionV4Extractor(model)
                extractor.eval()
                self.models[model_name] = model
                self.extractors[model_name] = extractor 
            else:
                model = load_model(model_name)
                extractor = Model(
                    inputs=model.input,
                    outputs=model.get_layer("global_average_pooling2d").output
                )
                self.models[model_name] = model
                self.extractors[model_name] = extractor
                
model_loader = ModelExtractor()

# Trích xuất đặc trưng
def extract_feature(processed_img, extractor, model_name):
    if 'InceptionV3' in model_name or 'InceptionResNetV2' in model_name:
        features = extractor.predict(processed_img, verbose=0)
        flattened = features.flatten()
        print(f"Số đặc trưng trích xuất: {flattened.shape[0]}")
        return flattened

    elif 'InceptionV4' in model_name:
        with torch.no_grad():
            output = extractor(processed_img)
            if isinstance(output, torch.Tensor):
                feature_vector = output.cpu().numpy().flatten()
                print(f"Số đặc trưng trích xuất: {feature_vector.shape[0]}")
                return feature_vector
            else:
                raise ValueError("Output của model PyTorch không phải tensor.")

import joblib
import numpy as np

model_name = 'InceptionResNetV2_Aug'

# Tham số PCA
PCA_DIM = 256  # Số chiều sau khi giảm
PCA_PATH = os.path.join("pca_models", f"pca_{model_name}.pkl")  # Đường dẫn lưu PCA

def train_or_load_pca(all_features):
    if os.path.exists(PCA_PATH):
        print(f"Đang load PCA từ {PCA_PATH}...")
        pca = joblib.load(PCA_PATH)
    else:
        print(f"Huấn luyện PCA với {PCA_DIM} chiều...")
        pca = PCA(n_components=PCA_DIM)
        pca.fit(all_features)
        joblib.dump(pca, PCA_PATH)
        print(f"✅ Đã lưu PCA vào {PCA_PATH}")
    return pca

def main():
    conn = connect_db()
    cursor = conn.cursor()

    if model_name not in model_loader.extractors:
        raise ValueError(f"Model '{model_name}' không tồn tại trong MODEL_FILES hoặc không load được.")
    
    extractor = model_loader.extractors[model_name]

    all_features = []
    image_info = []  # [(img_file, image_id)]

    # === 1. Trích xuất toàn bộ đặc trưng 
    for class_folder in os.listdir(DATASET_DIR):
        class_path = os.path.join(DATASET_DIR, class_folder)
        if not os.path.isdir(class_path):
            continue

        for img_file in tqdm(os.listdir(class_path), desc=f"Processing {class_folder}"):
            img_path = os.path.join(class_path, img_file)

            try:
                with open(img_path, "rb") as f:
                    image_bytes = f.read()

                processed_img, _ = preprocess_image(image_bytes, model_name)
                feature = extract_feature(processed_img, extractor, model_name)
                feature = feature.reshape(1, -1)  

                cursor.execute(
                    "SELECT image_id FROM research WHERE image_field_name = %s LIMIT 1",
                    (img_file,)
                )
                result = cursor.fetchone()
                if result:
                    image_id = result[0]
                    all_features.append(feature[0])
                    image_info.append((img_file, image_id))
                else:
                    print(f"⚠️ Không tìm thấy image_id cho {img_file}")

            except Exception as e:
                print(f"❌ Lỗi xử lý {img_file}: {e}")

    if not all_features:
        print("❌ Không thu được đặc trưng nào, dừng chương trình.")
        return

    all_features_np = np.array(all_features)  
    
    # Chuẩn hóa đặc trưng gốc trước khi lưu (l2 normalization)
    normalized_features = normalize(all_features_np, norm='l2')

    # === 2. Ghi đặc trưng đã chuẩn hóa
    for (img_file, image_id), vector in zip(image_info, normalized_features):
        try:
            feature_str = ','.join(map(str, vector))
            cursor.execute(
                "INSERT INTO feature (model_name, feature_vector, image_id) VALUES (%s, %s, %s)",
                (model_name, feature_str, image_id)
            )
            print(f"✅ Đã lưu đặc trưng GỐC cho {img_file} (image_id={image_id})")
        except mysql.connector.Error as db_err:
            print(f"❌ Lỗi DB (raw) với {img_file} (image_id={image_id}): {db_err}")

    print("✅ Hoàn tất trích xuất và lưu đặc trưng GỐC.")

    # === 3. PCA trên đặc trưng đã chuẩn hoá (L2) TRƯỚC PCA
    # Huấn luyện hoặc load PCA trên đặc trưng đã chuẩn hóa
    pca = train_or_load_pca(normalized_features)

    # Áp dụng PCA lên đặc trưng đã chuẩn hóa
    reduced_features = pca.transform(normalized_features)

    # Chuẩn hóa lại đặc trưng PCA
    normalized_reduced_features = normalize(reduced_features, norm='l2')

    # === 4. Ghi đặc trưng PCA vào DB (model_name + "_pca")
    for (img_file, image_id), vector in zip(image_info, normalized_reduced_features):
        try:
            feature_str = ','.join(map(str, vector))
            cursor.execute(
                "INSERT INTO feature (model_name, feature_vector, image_id) VALUES (%s, %s, %s)",
                (model_name + "_pca", feature_str, image_id)
            )
            print(f"✅ Đã lưu PCA vector cho {img_file} (image_id={image_id})")
        except mysql.connector.Error as db_err:
            print(f"❌ Lỗi DB (pca) với {img_file} (image_id={image_id}): {db_err}")

    print("✅ Hoàn tất trích xuất và lưu đặc trưng PCA.")

    conn.commit()
    cursor.close()
    conn.close()

    print("✅ Hoàn tất trích xuất và lưu đặc trưng.")
    print(f"Kích thước đặc trưng ban đầu: {all_features_np.shape}")
    print(f"Kích thước sau PCA: {reduced_features.shape}")
    print(f"Phương sai giữ lại: {np.sum(pca.explained_variance_ratio_):.4f}")

if __name__ == "__main__":
    main()
