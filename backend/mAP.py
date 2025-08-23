import numpy as np
import matplotlib.pyplot as plt
import mysql.connector
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from scipy.spatial.distance import cdist
from sklearn.metrics import average_precision_score
from app_similarity import *
import os
import faiss
import joblib
import numpy as np
import numpy as np
import time
import numpy as np
import json
import matplotlib.ticker as ticker
import matplotlib.pyplot as plt


import json
import matplotlib.pyplot as plt
import os

# --------- Cấu hình DB -------------
db_config = {
    'user': 'trang',
    'password': 'root',
    'host': 'localhost',
    'database': 'ct551',
}

# --------- Hàm kết nối và lấy dữ liệu feature và nhãn ---------
def load_features_and_labels(model_name='InceptionV4_Aug'):
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()

    query = f"""
    SELECT f.image_id, f.feature_vector, r.class_name
    FROM feature f
    JOIN research r ON f.image_id = r.image_id
    WHERE f.model_name = %s 
    """
    cursor.execute(query, (model_name + "_pca",))

    image_ids = []
    features = []
    labels = []
    for image_id, feature_blob, class_name in cursor:

        feat_str = feature_blob.decode('utf-8')  # chuyển bytes -> string
        feature_vec = np.array(list(map(float, feat_str.split(','))), dtype=np.float32)  # string -> float array

        image_ids.append(image_id)
        features.append(feature_vec)
        labels.append(class_name)

    cursor.close()
    conn.close()

    features = np.vstack(features)
    return image_ids, features, labels


RAW_DATASET =  "E:/LUAN_VAN/DATASET/split-raw/train"
class_names = [folder for folder in os.listdir(RAW_DATASET) if os.path.isdir(os.path.join(RAW_DATASET, folder))]

from sklearn.metrics.pairwise import euclidean_distances

def compute_similarity(query_vec, db_features, metric=''):
    """
    Hàm tính similarity giữa query_vec và toàn bộ db_features.
    metric: 'cosine' hoặc 'euclidean'
    Trả về mảng similarity hoặc khoảng cách.
    """
    if metric == 'cosine':
        # Chuẩn hóa vector
        q = query_vec / np.linalg.norm(query_vec)
        db_norm = db_features / np.linalg.norm(db_features, axis=1, keepdims=True)
        sims = np.dot(db_norm, q)
        return sims
    elif metric == 'euclidean':
        # Khoảng cách Euclidean
        diff = db_features - query_vec
        dists = np.linalg.norm(diff, axis=1)
        # dists = euclidean_distances(features_db, query_feat.reshape(1, -1)).flatten()
        return dists
    else:
        raise ValueError("Metric phải là 'cosine' hoặc 'euclidean'")

def load_test_images_from_folder(test_root):
    test_images = []
    # Duyệt từng thư mục con (tên thư mục = label)
    for class_name in os.listdir(test_root):
        class_dir = os.path.join(test_root, class_name)
        if not os.path.isdir(class_dir):
            continue
        # Duyệt các ảnh trong thư mục này
        for filename in os.listdir(class_dir):
            if filename.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp')):
                img_path = os.path.join(class_dir, filename)
                test_images.append((img_path, class_name))
    return test_images
# Ví dụ gọi
test_root = r'E:\NghienCuuKhoaHoc\DATASET\split_dataset\test'
test_images = load_test_images_from_folder(test_root)
print(f"Tổng số ảnh test: {len(test_images)}") 


import numpy as np

def average_precision(y_true):
    """
    Tính Average Precision cho danh sách nhãn y_true (1 - relevant, 0 - non-relevant),
    theo thứ tự đã sắp xếp (tương tự sklearn.metrics.average_precision_score).
    """
    y_true = np.array(y_true)
    relevant = y_true == 1
    if relevant.sum() == 0:
        return 0.0

    precisions = []
    num_relevant = 0
    for i, rel in enumerate(relevant, start=1):
        if rel:
            num_relevant += 1
            precisions.append(num_relevant / i)

    return np.mean(precisions)


import time
import numpy as np

def minmax_euclidean_to_similarity(dists):
    dists = np.array(dists)
    d_min = dists.min()
    d_max = dists.max()
    normalized = (dists - d_min) / (d_max - d_min + 1e-8)  # tránh chia 0
    similarity = 1 - normalized
    return similarity

# def compute_map_with_threshold(test_features, test_labels, db_features, db_labels, thresholds, metric='', model_name=''):
#     best_map = 0
#     best_threshold = None

#     results_dict = {
#         'thresholds': [],
#         'maps': [],
#         'precisions': [],
#         'recalls': [],
#         'f1s': [],
#         'times': [],
#         'model': model_name
#     }

#     for t in thresholds:
#         aps = []
#         precisions = []
#         recalls = []
#         f1s = []
#         total_query_time = 0

#         for query_vec, query_label in zip(test_features, test_labels):
#             start_time = time.time()

#             sims = compute_similarity(query_vec, db_features, metric)

#             if metric == 'euclidean':
#                 # filtered_indices = [i for i, s in enumerate(sims) if s <= t]
#                         # Chuyển distance thành similarity

#                 gamma = 1.0  # bạn có thể chỉnh giá trị này để tối ưu kết quả

#                 sims = np.exp(-gamma * (np.array(sims) ** 2))

#                 filtered_indices = [i for i, s in enumerate(sims) if s >= t]

#             else:
#                 filtered_indices = [i for i, s in enumerate(sims) if s >= t]

#             if not filtered_indices:
#                 aps.append(0)
#                 precisions.append(1.0)  # Không chọn ảnh nào, precision = 1
#                 recalls.append(0.0)
#                 f1s.append(0.0)
#                 total_query_time += time.time() - start_time
#                 continue

#             filtered_labels = [db_labels[i] for i in filtered_indices]
#             filtered_sims = [sims[i] for i in filtered_indices]

#             if metric == 'euclidean':
#                 # sorted_idx = np.argsort(filtered_sims)  # tăng dần
#                 sorted_idx = np.argsort([-s for s in filtered_sims])  # luôn giảm dần

#             else:
#                 sorted_idx = np.argsort([-s for s in filtered_sims])  # giảm dần

#             sorted_labels = [filtered_labels[i] for i in sorted_idx]
#             y_true = [1 if lbl == query_label else 0 for lbl in sorted_labels]

#             ap = average_precision(y_true)
#             aps.append(ap)

#             tp = sum(y_true)
#             total_relevant = sum(lbl == query_label for lbl in db_labels)
#             precision = tp / len(y_true) if len(y_true) > 0 else 1.0
#             recall = tp / total_relevant if total_relevant > 0 else 0.0
#             f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

#             precisions.append(precision)
#             recalls.append(recall)
#             f1s.append(f1)

#             total_query_time += time.time() - start_time

#         mean_ap = np.mean(aps)
#         mean_precision = np.mean(precisions)
#         mean_recall = np.mean(recalls)
#         mean_f1 = np.mean(f1s)
#         avg_query_time = total_query_time / len(test_features)

#         print(f"Ngưỡng {t:.2f} => mAP: {mean_ap:.4f}, Precision: {mean_precision:.4f}, "
#               f"Recall: {mean_recall:.4f}, F1: {mean_f1:.4f}, Avg Time: {avg_query_time:.4f}s")

#         results_dict['thresholds'].append(t)
#         results_dict['maps'].append(mean_ap)
#         results_dict['precisions'].append(mean_precision)
#         results_dict['recalls'].append(mean_recall)
#         results_dict['f1s'].append(mean_f1)
#         results_dict['times'].append(avg_query_time)

#         if mean_ap > best_map:
#             best_map = mean_ap
#             best_threshold = t

#     print(f"\nNgưỡng tốt nhất theo mAP: {best_threshold:.2f} với mAP = {best_map:.4f}")

#     # Lưu kết quả ra file JSON
#     output_dir = "mAP_outputs"
#     os.makedirs(output_dir, exist_ok=True)

#     output_path = os.path.join(output_dir, f"{model_name}_faiss_mAP_results.json")
#     with open(output_path, "w") as f:
#         json.dump(results_dict, f, indent=2)
#     print(f"Đã lưu file JSON tại: {output_path}")

#     return best_threshold, best_map

import os
import json
import time
import numpy as np
import faiss

def compute_map_with_threshold(test_features, test_labels, db_features, db_labels,
                                thresholds, metric='', model_name='', use_faiss=False):
    best_map = 0
    best_threshold = None

    results_dict = {
        'thresholds': [],
        'maps': [],
        'precisions': [],
        'recalls': [],
        'f1s': [],
        'times': [],
        'model': model_name,
        'use_faiss': use_faiss
    }

    if use_faiss:
        index = faiss.IndexFlatL2(db_features.shape[1])
        index.add(db_features.astype('float32'))

    for t in thresholds:
        aps = []
        precisions = []
        recalls = []
        f1s = []
        total_query_time = 0

        for query_vec, query_label in zip(test_features, test_labels):
            start_time = time.time()

            if use_faiss:
                query_vec = query_vec.reshape(1, -1).astype('float32')
                D, I = index.search(query_vec, index.ntotal)  # lấy hết ảnh trong index

                similarities = np.exp(-1.0 * D[0])  # biến khoảng cách -> độ tương đồng
                filtered_indices = [i for i, s in enumerate(similarities) if s >= t]

                if not filtered_indices:
                    aps.append(0)
                    precisions.append(1.0)
                    recalls.append(0.0)
                    f1s.append(0.0)
                    total_query_time += time.time() - start_time
                    continue

                filtered_ids = I[0][filtered_indices]
                filtered_sims = similarities[filtered_indices]
                filtered_labels = [db_labels[i] for i in filtered_ids]

                sorted_idx = np.argsort([-s for s in filtered_sims])
                sorted_labels = [filtered_labels[i] for i in sorted_idx]

            else:
                sims = compute_similarity(query_vec, db_features, metric)

                if metric == 'euclidean':
                    gamma = 1.0
                    sims = np.exp(-gamma * (np.array(sims) ** 2))

                filtered_indices = [i for i, s in enumerate(sims) if s >= t]

                if not filtered_indices:
                    aps.append(0)
                    precisions.append(1.0)
                    recalls.append(0.0)
                    f1s.append(0.0)
                    total_query_time += time.time() - start_time
                    continue

                filtered_labels = [db_labels[i] for i in filtered_indices]
                filtered_sims = [sims[i] for i in filtered_indices]
                sorted_idx = np.argsort([-s for s in filtered_sims])
                sorted_labels = [filtered_labels[i] for i in sorted_idx]

            y_true = [1 if lbl == query_label else 0 for lbl in sorted_labels]

            ap = average_precision(y_true)
            aps.append(ap)

            tp = sum(y_true)
            total_relevant = sum(lbl == query_label for lbl in db_labels)
            precision = tp / len(y_true) if len(y_true) > 0 else 1.0
            recall = tp / total_relevant if total_relevant > 0 else 0.0
            f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

            precisions.append(precision)
            recalls.append(recall)
            f1s.append(f1)
            total_query_time += time.time() - start_time

        mean_ap = np.mean(aps)
        mean_precision = np.mean(precisions)
        mean_recall = np.mean(recalls)
        mean_f1 = np.mean(f1s)
        avg_query_time = total_query_time / len(test_features)

        print(f"Ngưỡng {t:.2f} => mAP: {mean_ap:.4f}, Precision: {mean_precision:.4f}, "
              f"Recall: {mean_recall:.4f}, F1: {mean_f1:.4f}, Avg Time: {avg_query_time:.4f}s")

        results_dict['thresholds'].append(t)
        results_dict['maps'].append(mean_ap)
        results_dict['precisions'].append(mean_precision)
        results_dict['recalls'].append(mean_recall)
        results_dict['f1s'].append(mean_f1)
        results_dict['times'].append(avg_query_time)

        if mean_ap > best_map:
            best_map = mean_ap
            best_threshold = t

    print(f"\nNgưỡng tốt nhất theo mAP: {best_threshold:.2f} với mAP = {best_map:.4f}")

    # Lưu file kết quả
    output_dir = "mAP_outputs"
    os.makedirs(output_dir, exist_ok=True)

    method_name = "faiss" if use_faiss else "nofaiss"
    output_path = os.path.join(output_dir, f"{model_name}_{method_name}_mAP_results.json")

    with open(output_path, "w") as f:
        json.dump(results_dict, f, indent=2)

    print(f"Đã lưu file JSON tại: {output_path}")
    return best_threshold, best_map



def euclidean_to_similarity(dists, gamma=1.0):
    return np.exp(-gamma * (np.array(dists) ** 2))


# Hoặc load 
def load_index_and_ids(model_name='InceptionV4_Aug', class_names=class_names):
    all_image_ids = []
    all_labels = []
    all_features = []

    for class_name in class_names:
        index_path = os.path.join("faiss_indexes", model_name, class_name, "index.index")
        ids_path = os.path.join("faiss_indexes", model_name, class_name, "id_map.npy")

        # Load FAISS index
        index = faiss.read_index(index_path)

        # Load ID map (dict)
        id_map = np.load(ids_path, allow_pickle=True).item()
        image_ids = list(id_map.keys())
        
        vectors_path = os.path.join("faiss_indexes", model_name, class_name, "original_vectors.npy")
        if not os.path.exists(vectors_path):
            print(f"❌ Thiếu file original_vectors.npy cho lớp '{class_name}', bỏ qua.")
            continue

        vectors = np.load(vectors_path)

        # Gộp vào danh sách tổng
        all_image_ids.extend(image_ids)
        all_labels.extend([class_name] * len(image_ids))
        all_features.append(vectors)

        print(f"✅ Loaded {len(image_ids)} vectors for class: {class_name}")

    # Nối tất cả vectors lại thành 1 mảng
    features = np.vstack(all_features)

    return all_image_ids, features, all_labels

from sklearn.preprocessing import normalize
from feature_extractor import model_loader, extract_feature

def load_pca_model(model_name, pca_dir="pca_models"):
    pca_path = os.path.join(pca_dir, f"pca_{model_name}.pkl")
    if not os.path.exists(pca_path):
        raise FileNotFoundError(f"[ERROR] Không tìm thấy PCA model tại: {pca_path}")
    with open(pca_path, "rb") as f:
        pca_model = joblib.load(f)
    print(f"[INFO] Đã load PCA model từ {pca_path}")
    return pca_model


def plot_results_from_files(model_names):
    results = {}

    for model_name in model_names:
        file_path = os.path.join("mAP_outputs", f"{model_name}_faiss_mAP_results.json")
        with open(file_path, "r") as f:
            results[model_name] = json.load(f)

    markers = ['o', 's', '^', 'D', 'v', 'P', '*', 'X']
    base_thresholds = results[model_names[0]]['thresholds']

    def clean_name(name):
        return name.replace("_Aug", "")

    # Biểu đồ mAP
    plt.figure(figsize=(8, 5))
    for i, (model_name, data) in enumerate(results.items()):
        thresholds = data['thresholds']
        maps = data['maps']
        marker = markers[i % len(markers)]
        plt.plot(thresholds, maps, marker=marker, label=clean_name(model_name))
    plt.title('mAP theo ngưỡng')
    plt.xlabel('Ngưỡng')
    plt.ylabel('mAP')
    plt.legend()
    ax = plt.gca()
    ax.yaxis.set_major_formatter(ticker.FormatStrFormatter('%.4f'))
    plt.xticks(base_thresholds)
    plt.grid(True)
    plt.show()

    # Biểu đồ thời gian
    plt.figure(figsize=(8, 5))
    for i, (model_name, data) in enumerate(results.items()):
        thresholds = data['thresholds']
        times_ms = [t * 1000 for t in data['times']]
        marker = markers[i % len(markers)]
        plt.plot(thresholds, times_ms, marker=marker, label=clean_name(model_name))
    plt.title('Thời gian truy vấn trung bình theo ngưỡng')
    plt.xlabel('Ngưỡng')
    plt.ylabel('Thời gian (ms)')
    plt.legend()
    plt.xticks(base_thresholds)
    plt.grid(True)
    plt.show()

    # Biểu đồ F1-score
    plt.figure(figsize=(8, 5))
    for i, (model_name, data) in enumerate(results.items()):
        thresholds = data['thresholds']
        f1s = data['f1s']
        marker = markers[i % len(markers)]
        plt.plot(thresholds, f1s, marker=marker, label=clean_name(model_name))
    plt.title('F1-score theo ngưỡng')
    plt.xlabel('Ngưỡng')
    plt.ylabel('F1-score')
    plt.legend()
    plt.xticks(base_thresholds)
    plt.grid(True)
    plt.show()


import os
import json
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
def plot_overview_with_pca(model_names):
    results = {}

    for model_name in model_names:
        no_pca_path = os.path.join("mAP_outputs", f"{model_name}_nofaiss_noPCA_mAP_results.json")
        pca_path = os.path.join("mAP_outputs", f"{model_name}_faiss_mAP_results.json")

        results[model_name] = {}
        if os.path.exists(no_pca_path):
            with open(no_pca_path, "r") as f:
                results[model_name][""] = json.load(f)
        if os.path.exists(pca_path):
            with open(pca_path, "r") as f:
                results[model_name]["PCA + FAISS"] = json.load(f)

    colors = ['tab:blue', 'tab:orange', 'tab:green']  # mỗi model 1 màu
    linestyles = {
        "": "solid",
        "PCA + FAISS": (0, (5, 3))  # nét đứt rõ hơn
    }
    markers = {"": "o", "PCA + FAISS": "s"}

    base_thresholds = list(results.values())[0]['']['thresholds']

    def plot_metric(metric_key, title, ylabel, is_time=False):
        plt.figure(figsize=(8, 5))
        for c_idx, (model_name, variants) in enumerate(results.items()):
            for variant, data in variants.items():
                y_data = data[metric_key]
                if is_time:
                    y_data = [t * 1000 for t in y_data]  # đổi giây -> ms
                label = model_name.replace('_Aug', '')
                if variant:  # chỉ thêm nếu có nội dung variant
                    label += f" - {variant}"

                plt.plot(
                    data['thresholds'], y_data,
                    color=colors[c_idx],
                    linestyle=linestyles[variant],
                    marker=markers[variant],
                    markersize=5,
                    label=label
                )
                plt.grid(True, linestyle="--", alpha=0.5)

        plt.title(title)
        plt.xlabel("Ngưỡng")
        plt.ylabel(ylabel)
        plt.xticks(base_thresholds)
        plt.legend(fontsize=9, loc="best", bbox_to_anchor=(1, 0.5), handlelength=3)
        if not is_time:
            ax = plt.gca()
            ax.yaxis.set_major_formatter(ticker.FormatStrFormatter('%.4f'))
        plt.tight_layout()
        plt.show()


    # mAP
    plot_metric("maps", "mAP theo ngưỡng", "mAP")

    # F1-score
    plot_metric("recalls", "Recall theo ngưỡng", "Recall")

    # Thời gian
    plot_metric("times", "Thời gian truy vấn trung bình theo ngưỡng", "Thời gian (ms)", is_time=True)

# Ví dụ gọi
plot_overview_with_pca(['InceptionV3_Aug', 'InceptionV4_Aug', 'InceptionResNetV2_Aug'])

# if __name__ == "__main__":
#     model_name = 'InceptionV3_Aug'
#     metric = 'euclidean'  # hoặc 'cosine'

#     # image_ids_db, features_db, labels_db = load_index_and_ids(model_name=model_name)

#     image_ids_db, features_db, labels_db = load_features_and_labels(model_name=model_name)
#     extractor = model_loader.extractors[model_name]
#     # features_db = normalize(features_db, norm='l2')

#     test_features = []
#     test_labels = []
#     for img_path, true_label in test_images:
#         # Đọc nội dung file ảnh thành bytes
#         with open(img_path, "rb") as f:
#             image_bytes = f.read()
            
#         processed_img, _ = preprocess_image(image_bytes, model_name) 
            
#         query_feat = extract_feature(processed_img, extractor, model_name)
#         query_feat = normalize(query_feat.reshape(1, -1), norm='l2')[0]
        
#         if query_feat.ndim == 1:
#             query_feat = query_feat.reshape(1, -1)

#         pca_model = load_pca_model(model_name)
#         query_feat = pca_model.transform(query_feat)
#         query_feat = normalize(query_feat, norm='l2')[0]  

#         test_features.append(query_feat)
#         test_labels.append(true_label)
        
#     thresholds = [0.5, 0.6, 0.7, 0.8, 0.9]
#     best_threshold, best_map = compute_map_with_threshold(
#         test_features, test_labels, features_db, labels_db, thresholds, metric=metric, model_name=model_name, use_faiss=False
#     )

# plot_results_from_files(['InceptionV3_Aug', 'InceptionV4_Aug', 'InceptionResNetV2_Aug'])
