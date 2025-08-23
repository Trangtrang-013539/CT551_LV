# File: app_similarity.py

from typing import List
from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.responses import FileResponse
from fastapi import HTTPException

import os
import numpy as np
import torch
import joblib
import faiss
from sklearn.decomposition import PCA
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import normalize
from scipy.spatial.distance import euclidean

from config import IMAGE_SIZE, DATASET_DIR, CLASS_INDICES_DIR
from db import connect_db
from feature_extractor import ModelExtractor, extract_feature
from model_loader import preprocess_image  
from app_classify import classify_image
from faiss_index import get_faiss_index

from tensorflow.keras.preprocessing.image import ImageDataGenerator

router = APIRouter()

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Load class indices từ thư mục dataset
def load_class_indices():
    datagen = ImageDataGenerator()
    dataset = datagen.flow_from_directory(
        CLASS_INDICES_DIR,
        target_size=IMAGE_SIZE,
        batch_size=32,
        class_mode='categorical',
        shuffle=False
    )
    return dataset.class_indices

class_indices = load_class_indices()

def search_similar(image_bytes_list, model_name, threshold, base_url="http://localhost:8000"):
    conn = connect_db()
    cursor = conn.cursor()

    model_loader = ModelExtractor()

    # Load PCA nếu tồn tại, load PCA tương ứng model 
    PCA_PATH = os.path.join("pca_models", f"pca_{model_name}.pkl")
    pca_model = None
    if os.path.exists(PCA_PATH):
        pca_model = joblib.load(PCA_PATH)
        print("✅ PCA model loaded.")
    else:
        print("⚠️ Không tìm thấy PCA model.")

    if model_name not in model_loader.extractors:
        raise ValueError(f"Model '{model_name}' không tồn tại trong MODEL_FILES hoặc không load được.")

    model = model_loader.models[model_name]
    extractor = model_loader.extractors[model_name]

    all_results = []

    for idx, image_bytes in enumerate(image_bytes_list):
        print(f"\n Đang xử lý ảnh thứ {idx + 1}...")
        print(f"\n Mô hình: {model_name}")

        # 1. Tiền xử lý ảnh
        processed_img, _ = preprocess_image(image_bytes, model_name)

        # 2. Phân loại ảnh
        top_predictions = classify_image(processed_img, model, model_name)
        predicted_class = top_predictions[0]["class_name"]
        confidence = top_predictions[0]["confidence"]
        print(f"Ảnh thuộc lớp: {predicted_class} - độ tin cậy: {confidence:.2f}%")

        # 3. Trích đặc trưng ảnh input
        query_vector = extract_feature(processed_img, extractor, model_name)
        query_vector = query_vector.reshape(1, -1)

        query_vector = normalize(query_vector, norm='l2')

        if pca_model:
            query_vector = pca_model.transform(query_vector)
            query_vector = normalize(query_vector, norm='l2') 

        # # 4. Truy vấn ảnh tương tự từ DB
        # cursor.execute("""
        #     SELECT f.image_id, f.feature_vector, r.image_field_name, r.doi, r.title, r.caption, r.authors, r.approved_date
        #     FROM feature f
        #     JOIN research r ON f.image_id = r.image_id
        #     WHERE f.model_name = %s AND r.class_name = %s
        # """, (model_name+"_pca", predicted_class))
        # results = cursor.fetchall()

        # similarities = []
        # missing_count = 0

        # for row in results:
        #     image_id, feature_str, image_field_name, doi, title, caption, authors, approved_date = row
        #     feature_str = feature_str.decode('utf-8') if isinstance(feature_str, bytes) else feature_str
        #     feature_vector = np.array([float(x) for x in feature_str.split(',')]).reshape(1, -1)

        #     distance = euclidean(query_vector.flatten(), feature_vector.flatten())  # Với Euclidean distance, giá trị càng nhỏ càng giống => distance <= threshold.
        #     # similarity = cosine_similarity(query_vector, feature_vector)[0][0]    # Với cosine similarity, giá trị càng lớn (gần 1) càng giống => similarity >= threshold.
        #     # if similarity >= threshold:
        #     if distance <= np.sqrt(2 - 2 * threshold):
        #         img_path = os.path.join(DATASET_DIR, predicted_class, image_field_name)
        #         if os.path.exists(img_path):
        #             similarities.append({
        #                 "image_id": image_id,
        #                 "image_name": image_field_name,
        #                 # "similarity": similarity,
        #                 "similarity": 1 - (distance ** 2) / 2,
        #                 "doi": doi,
        #                 "title": title,
        #                 "caption": caption,
        #                 "authors": authors,
        #                 "approved_date": approved_date,
        #                 "image_url": f"{base_url}/images/{predicted_class}/{image_field_name}"
        #             })
        #         else:
        #             print(f"⚠️ Ảnh '{image_field_name}' không tồn tại: {img_path}")
        #             missing_count += 1
        
        # 4. Dùng FAISS để tìm ảnh tương tự trong class tương ứng (dùng FAISS index đã preload)
        result = get_faiss_index(model_name, predicted_class)
        if result is None:
            raise ValueError(f"Không tìm thấy FAISS index cho {(model_name, predicted_class)}.")
        index, id_map = result

        limit_distance = np.sqrt(2 - 2 * threshold)
        lims, distances, indices = index.range_search(query_vector.astype('float32'), limit_distance)

        start, end = lims[0], lims[1]

        similarities = []
        missing_count = 0

        for i in range(start, end):
            distance = distances[i]
            image_id = indices[i]

            if image_id == -1:
                continue
            
            info = id_map.get(image_id)
            if not info:
                continue
            
            # # lọc ảnh cùng class predict
            # if info.get("class_name") != predicted_class:
            #     continue

            similarity = float(1 - (distance ** 2) / 2)

            img_name = info.get("image_name")
            class_name = info.get("class_name", predicted_class)
            img_path = os.path.join(DATASET_DIR, class_name, img_name)

            if os.path.exists(img_path):
                similarities.append({
                    "image_id": int(image_id),
                    "image_name": img_name,
                    "similarity": similarity,
                    "doi": info.get("doi"),
                    "title": info.get("title"),
                    "caption": info.get("caption"),
                    "authors": info.get("authors"),
                    "approved_date": info.get("approved_date"),
                    "image_url": f"{base_url}/images/{class_name}/{img_name}"
                })
            else:
                print(f"⚠️ Ảnh '{img_name}' không tồn tại: {img_path}")
                print(f"Kiểm tra ký tự dư trong img_name: '{img_name}'")
                missing_count += 1

        similar_images = sorted(similarities, key=lambda x: x["similarity"], reverse=True) 
        total_similar = len(similar_images)

        print(f"Tìm được {total_similar} ảnh tương đồng (thiếu: {missing_count})")

        all_results.append({
            "index": idx,
            "predicted_class": predicted_class,
            "confidence": confidence,
            "total": total_similar,
            "similar_images": similar_images
        })

    cursor.close()
    conn.close()
    return all_results

@router.get("/aug-models")
def get_name_aug_model():
    models = [
        {"label": "InceptionV3 Tăng Cường", "value": "InceptionV3_Aug"},
        {"label": "InceptionV4 Tăng Cường", "value": "InceptionV4_Aug"},
        {"label": "InceptionResNetV2 Tăng Cường", "value": "InceptionResNetV2_Aug"},
    ]

    return models

@router.get("/images/{class_name}/{image_name}", name="get_image")
def get_image(class_name: str, image_name: str):
    image_path = os.path.join(DATASET_DIR, class_name, image_name)
    if os.path.exists(image_path):
        return FileResponse(image_path)
    else:
        raise HTTPException(status_code=404, detail="Image not found")

@router.post("/search-similar")
async def search_similarity(images: List[UploadFile] = File(...), model_name: str = Form(...), threshold: float = Form(...)):
    try:
        # Đọc nội dung file ảnh thành bytes
        image_bytes_list = [await image.read() for image in images]

        # Gọi hàm xử lý
        all_results = search_similar(image_bytes_list, model_name, threshold)

        return all_results

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

# Hàm chính để kiểm tra từ terminal
def main():
    input_image_path = r"E:\LUAN_VAN\DATASET\dataset\Animal Samples\06-DI TRUYEN 2-NGUYEN TIEN VINH(45-51)035_page_47_img_2.png"
    model_name = "InceptionV4_Aug"
    threshold = 0.90

    # Đọc nội dung file ảnh thành bytes
    with open(input_image_path, "rb") as f:
        image_bytes = f.read()

    search_similar(image_bytes, model_name, threshold)

# if __name__ == "__main__":
#     uvicorn.run("app_similarity:app", host="0.0.0.0", port=8001, reload=True)

# main()