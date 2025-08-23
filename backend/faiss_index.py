import faiss
import numpy as np
import joblib
import os
from collections import defaultdict
from db import connect_db

def build_faiss_index(model_name: str, save_dir="faiss_indexes"):
    conn = connect_db()
    cursor = conn.cursor()

    # Load PCA model
    pca_path = os.path.join("pca_models", f"pca_{model_name}.pkl")
    if not os.path.exists(pca_path):
        raise FileNotFoundError(f"Không tìm thấy PCA model tại {pca_path}")
    pca_model = joblib.load(pca_path)
    print("✅ PCA model loaded.")
    
    # Truy vấn dữ liệu
    cursor.execute("""
        SELECT f.image_id, f.feature_vector, r.image_field_name, r.doi, r.title, r.caption, r.authors, r.approved_date, r.class_name
        FROM feature f
        JOIN research r ON f.image_id = r.image_id
        WHERE f.model_name = %s 
    """, (model_name + "_pca",))
    rows = cursor.fetchall()

    # Gom theo class
    features_by_class = defaultdict(list)
    ids_by_class = defaultdict(list)
    id_map_dict_by_class = defaultdict(dict)

    for row in rows:
        image_id, feature_str, image_field_name, doi, title, caption, authors, approved_date, class_name = row
        if isinstance(feature_str, bytes):
            feature_str = feature_str.decode('utf-8')

        vector = np.array([float(x) for x in feature_str.split(',')], dtype='float32')
        vector = vector.flatten()

        features_by_class[class_name].append(vector)
        ids_by_class[class_name].append(image_id)

        id_map_dict_by_class[class_name][image_id] = {
            "image_id": image_id,
            "image_name": image_field_name,
            "doi": doi,
            "title": title,
            "caption": caption,
            "authors": authors,
            "approved_date": approved_date,
            "class_name": class_name,
        }

    # Với mỗi class
    for class_name in features_by_class:
        features = np.array(features_by_class[class_name], dtype='float32')
        ids = np.array(ids_by_class[class_name], dtype='int64')

        if features.size == 0:
            print(f"⚠️ Bỏ qua class '{class_name}' vì không có dữ liệu.")
            continue

        dim = features.shape[1]
        index = faiss.IndexFlatL2(dim)
        id_map = faiss.IndexIDMap(index)
        id_map.add_with_ids(features, ids)

        # Đường dẫn: faiss_indexes/<model_name>/<class_name>/
        class_dir = os.path.join(save_dir, model_name, class_name)
        os.makedirs(class_dir, exist_ok=True)

        index_path = os.path.join(class_dir, "index.index")
        id_map_path = os.path.join(class_dir, "id_map.npy")

        faiss.write_index(id_map, index_path)
        np.save(id_map_path, id_map_dict_by_class[class_name])

        print(f"✅ FAISS index saved: {index_path}")
        print(f"✅ ID map saved: {id_map_path}")
        
        original_feat_path = os.path.join(class_dir, "original_vectors.npy")
        np.save(original_feat_path, features)
        print(f"✅ Original feature vectors saved: {original_feat_path}")

    cursor.close()
    conn.close()

if __name__ == "__main__":
    build_faiss_index("InceptionResNetV2_Aug")
    

# Preload index vào RAM
# Biến toàn cục để lưu các index đã load
faiss_indexes = {}  # {(model_name, class_name): (index, id_map)}

def load_faiss_index(model_name: str, class_name: str):
    index_path = os.path.join("faiss_indexes", model_name, class_name, "index.index")
    id_map_path = os.path.join("faiss_indexes", model_name, class_name, "id_map.npy")

    if not os.path.exists(index_path) or not os.path.exists(id_map_path):
        raise ValueError(f"Không tìm thấy index hoặc id_map cho {model_name} - {class_name}")

    index = faiss.read_index(index_path)
    id_map = np.load(id_map_path, allow_pickle=True).item()

    faiss_indexes[(model_name, class_name)] = (index, id_map)
    print(f"✅ FAISS index loaded for {model_name} - {class_name}")

def get_faiss_index(model_name: str, class_name: str):
    return faiss_indexes.get((model_name, class_name))

