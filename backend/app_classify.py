from fastapi import APIRouter, UploadFile, File, Form, HTTPException

import numpy as np
import torch
from tensorflow.keras.preprocessing.image import ImageDataGenerator

from config import IMAGE_SIZE, CLASS_INDICES_DIR
from model_loader import preprocess_image, loaded_models

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

# Phân loại ảnh
def classify_image(preprocessed_img, model, model_name):
    """
    Trả về danh sách top-3 (tên lớp, xác suất %) dựa trên ảnh đã tiền xử lý và model.
    """
    if 'InceptionV4' in model_name:  # PyTorch model
        model.eval()
        with torch.no_grad():
            output = model(preprocessed_img)
            probs = output.cpu().numpy()[0]
    else:  # Keras model
        preds = model.predict(preprocessed_img, verbose=0)
        probs = preds[0]  # 1D array of probabilities

    # Lấy top-3 class index theo xác suất giảm dần
    top_indices = np.argsort(probs)[::-1][:3]

    # Đảo ngược class_indices để lấy tên class
    idx_to_class = {v: k for k, v in class_indices.items()}

    # Trả về danh sách 3 tuple: (tên lớp, xác suất %)
    top_predictions = []
    for idx in top_indices:
        class_name = idx_to_class.get(idx, "unknown")
        confidence = probs[idx] * 100
        top_predictions.append({
            "class_name": str(class_name),
            "confidence": float(round(confidence, 2))
        })

    return top_predictions

@router.get("/models")
def get_name_model():
    models = [
        {"label": "InceptionV3", "value": "InceptionV3"},
        {"label": "InceptionV3 Tăng Cường", "value": "InceptionV3_Aug"},
        {"label": "InceptionV4", "value": "InceptionV4"},
        {"label": "InceptionV4 Tăng Cường", "value": "InceptionV4_Aug"},      
        {"label": "InceptionResNetV2", "value": "InceptionResNetV2"},
        {"label": "InceptionResNetV2 Tăng Cường", "value": "InceptionResNetV2_Aug"},
    ]

    return models

@router.post("/classify")
async def classify(model_name: str = Form(...), image: UploadFile = File(...)):
    try:
        if model_name not in loaded_models:
            raise HTTPException(status_code=400, detail=f"Model {model_name} chưa được load.")

        image_bytes = await image.read()
        
        model = loaded_models[model_name]
        print(f"[DEBUG] Đang xử lý ảnh bằng model: {model_name}")

        processed_img, _ = preprocess_image(image_bytes, model_name)
        print("[DEBUG] Đã tiền xử lý ảnh, chuẩn bị classify.")

        top_predictions = classify_image(processed_img, model, model_name)

        return {
            "model": model_name,
            "filename": image.filename,
            "top_predictions": top_predictions
        }

    except Exception as e:
        import traceback
        traceback.print_exc()  # In lỗi ra console
        raise HTTPException(status_code=500, detail=str(e))

# if __name__ == "__main__":
#     uvicorn.run("app_classify:app", host="0.0.0.0", port=8000, reload=True)
