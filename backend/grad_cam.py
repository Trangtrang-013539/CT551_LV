import tensorflow as tf
import numpy as np
import cv2
import os
import torch
import matplotlib.pyplot as plt

from model_loader import load_model, preprocess_image

# Hàm tính Grad-CAM heatmap
def make_gradcam_heatmap(img_array, model, last_conv_layer_name, pred_index=None):
    if not isinstance(img_array, tf.Tensor):
        img_array = tf.convert_to_tensor(img_array)
    img_array = tf.cast(img_array, tf.float32)

    grad_model = tf.keras.models.Model(
        inputs=model.input,
        outputs=[model.get_layer(last_conv_layer_name).output, model.output]
    )

    with tf.GradientTape() as tape:
        conv_outputs, predictions = grad_model(img_array)
        if pred_index is None:
            pred_index = tf.argmax(predictions[0])
        class_output = predictions[:, pred_index]

    grads = tape.gradient(class_output, conv_outputs)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))

    conv_outputs = conv_outputs[0]
    heatmap = tf.reduce_sum(conv_outputs * pooled_grads, axis=-1)

    heatmap = tf.maximum(heatmap, 0)
    max_val = tf.reduce_max(heatmap)
    if max_val < 1e-10:
        return heatmap.numpy()
    heatmap /= max_val

    return heatmap.numpy()


def make_gradcam_heatmap_torch(model, input_tensor, target_class=None):
    model.eval()
    gradients = []
    activations = []

    def backward_hook(module, grad_input, grad_output):
        gradients.append(grad_output[0])

    def forward_hook(module, input, output):
        activations.append(output)

    # Gán hook vào layer cuối convolution
    target_layer = model.features[21]  # cần điều chỉnh chính xác
    # for i, layer in enumerate(model.features):
    #     print(f"{i}: {layer.__class__.__name__}")

    # print(" Layer đang được gán hook:", target_layer) # InceptionC
    handle_forward = target_layer.register_forward_hook(forward_hook)
    handle_backward = target_layer.register_full_backward_hook(backward_hook)

    output = model(input_tensor)
    if target_class is None:
        target_class = torch.argmax(output)

    model.zero_grad()
    loss = output[0, target_class]
    loss.backward()

    grads = gradients[0].cpu().data.numpy()[0]
    acts = activations[0].cpu().data.numpy()[0]

    pooled_grads = np.mean(grads, axis=(1, 2))
    for i in range(len(pooled_grads)):
        acts[i] *= pooled_grads[i]

    heatmap = np.mean(acts, axis=0)
    heatmap = np.maximum(heatmap, 0)
    heatmap /= np.max(heatmap) if np.max(heatmap) > 0 else 1e-10

    handle_forward.remove()
    handle_backward.remove()
    return heatmap

# Hàm tiền xử lý ảnh
IMAGE_SIZE = (299, 299)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Hàm overlay heatmap lên ảnh gốc và lưu lại
def display_gradcam(img_path, model, model_name, conv_layer_name=None, save_dir="gradcam_outputs"):
    os.makedirs(save_dir, exist_ok=True)  # Tạo thư mục nếu chưa có

    with open(img_path, "rb") as f:
        image_bytes = f.read()

    img_array, raw_img_pil = preprocess_image(image_bytes, model_name)
    raw_img = np.array(raw_img_pil.convert("RGB"))  # để có .shape và đảm bảo RGB

    if 'InceptionV4' in model_name:
        heatmap = make_gradcam_heatmap_torch(model, img_array)
    else:
        heatmap = make_gradcam_heatmap(img_array, model, conv_layer_name)

    # Resize và overlay
    heatmap = cv2.resize(heatmap, (raw_img.shape[1], raw_img.shape[0]))
    heatmap = np.uint8(255 * heatmap)

    heatmap_color = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)
    heatmap_color = cv2.cvtColor(heatmap_color, cv2.COLOR_BGR2RGB)

    superimposed_img = cv2.addWeighted(raw_img.astype(np.uint8), 0.6, heatmap_color, 0.4, 0)

    # Hiển thị
    plt.figure(figsize=(6,6))
    plt.title(f"{model_name}")
    plt.imshow(superimposed_img)
    plt.axis('off')
    plt.show()

    # Lưu ảnh
    img_name = os.path.splitext(os.path.basename(img_path))[0]
    save_path = os.path.join(save_dir, f"{model_name}_gradcam.png")
    cv2.imwrite(save_path, cv2.cvtColor(superimposed_img, cv2.COLOR_RGB2BGR))  # chuyển về BGR để lưu

    return superimposed_img


# Gọi hàm
for model_name, conv_layer in {
    # "InceptionV3": "mixed10",
    # "InceptionResNetV2": "conv_7b_ac",
    # "InceptionV4": None,
    "InceptionV3_Aug": "mixed10",
    "InceptionResNetV2_Aug": "conv_7b_ac",
    "InceptionV4_Aug": None 
}.items():
    model = load_model(model_name)
    display_gradcam(r"E:\LUAN_VAN\DATASET\dataset\Maps\04-BE-VO NAM SON(24-38)004_page_26_img_1.png", model, model_name, conv_layer)
