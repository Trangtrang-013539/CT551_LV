import os
import torch
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image
import io
from tensorflow.keras.models import Model
from model_loader import load_model, preprocess_image


device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

def extract_gap_and_fmap(model, image_bytes, model_name):
    input_tensor, _ = preprocess_image(image_bytes, model_name)

    # Đọc ảnh gốc để hiển thị
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    if "InceptionV4" in model_name:  # PyTorch
        input_tensor = input_tensor.to(device)
        with torch.no_grad():
            fmap = model.forward_features(input_tensor)
            gap_vec = torch.nn.functional.adaptive_avg_pool2d(fmap, (1, 1))
            gap_vec = gap_vec.view(gap_vec.size(0), -1).squeeze().cpu().numpy()
            fmap = fmap.squeeze().cpu().numpy()  # (C, H, W)

    else:  # Keras (InceptionV3, InceptionResNetV2)
        # Xác định lớp feature map cuối (trước GAP)
        if "InceptionV3" in model_name:
            feature_layer = model.get_layer("mixed10").output  # (8x8x2048)
        elif "InceptionResNetV2" in model_name:
            feature_layer = model.get_layer("conv_7b_ac").output  # (8x8x1536)
        else:
            raise ValueError("Không rõ model_name cho Keras")

        intermediate_model = Model(inputs=model.input, outputs=feature_layer)
        fmap = intermediate_model.predict(input_tensor)[0]  # (H, W, C)
        gap_vec = np.mean(fmap, axis=(0, 1))  # GAP theo channel
        fmap = np.transpose(fmap, (2, 0, 1))  # (C, H, W)

    return gap_vec, fmap, img

def save_feature_visualization(fig, model_name, output_dir="feature_visual_outputs"):
    os.makedirs(output_dir, exist_ok=True)
    save_path = os.path.join(output_dir, f"{model_name}.png")
    fig.savefig(save_path, bbox_inches="tight")
    print(f"✅ Đã lưu hình ảnh: {save_path}")

def visualize_top5_gap_channels(gap_vector, fmap, img, model_name):
    top5_idx = np.argsort(-np.abs(gap_vector))[:5]
    fig, axs = plt.subplots(1, 6, figsize=(18, 4))
    
    axs[0].imshow(img)
    axs[0].axis('off')
    axs[0].set_title('Ảnh gốc', fontsize=14)

    for i, idx in enumerate(top5_idx):
        channel_map = fmap[idx]
        channel_map_norm = (channel_map - channel_map.min()) / (channel_map.max() - channel_map.min() + 1e-10)
        axs[i + 1].imshow(channel_map_norm, cmap='viridis')
        axs[i + 1].axis('off')
        axs[i + 1].set_title(f'Ch {idx}\nGAP={gap_vector[idx]:.3f}', fontsize=10)

    plt.tight_layout()
    plt.subplots_adjust(top=0.85)
    
    save_feature_visualization(fig, model_name)
    plt.show()

if __name__ == "__main__":
    model_name = "InceptionResNetV2_Aug"  # hoặc "InceptionV3_Aug", "InceptionV4_Aug"
    img_path = r"E:\LUAN_VAN\DATASET\dataset\Maps\04-BE-VO NAM SON(24-38)004_page_26_img_1.png"

    model = load_model(model_name)
    with open(img_path, "rb") as f:
        image_bytes = f.read()

    gap_vector, fmap, img = extract_gap_and_fmap(model, image_bytes, model_name)
    visualize_top5_gap_channels(gap_vector, fmap, img, model_name)
