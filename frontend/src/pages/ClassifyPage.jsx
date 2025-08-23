import axios from "axios";
import { useState, useEffect } from "react";
import { Upload, Loader2, AlertTriangle, Trash2, ArrowLeft, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ClassifyPage() {
  const navigate = useNavigate();

  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modelNames, setModelNames] = useState([]);
  const [loadingModelNames, setLoadingModelNames] = useState(true);
  const [selectedModel, setSelectedModel] = useState("");

  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const res = await axios.get("http://localhost:8000/models");

        if (res.data.length > 0) {
          setModelNames(res.data);

          setLoadingModelNames(false); // Dừng trạng thái loading
          clearInterval(intervalId);   // Dừng polling
        }
      } catch (err) {
        console.error("Lỗi khi polling models:", err);
      }
    }, 2000); // gọi mỗi 2s

    return () => clearInterval(intervalId); // dọn dẹp khi component bị unmount
  }, []);

  useEffect(() => {
    if (modelNames.length > 0 && !selectedModel) {
      setSelectedModel(modelNames[0].value);
    }
  }, [modelNames]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImage(file);
    setResult([]);
    setError(null);

    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!image) return;

    const formData = new FormData();
    formData.append("image", image);
    formData.append("model_name", selectedModel);

    setResult([]);
    setLoading(true);
    setError(null);

    try {
      const res = await axios.post("http://localhost:8000/classify", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
    } catch (err) {
      setError("Lỗi khi phân loại ảnh!");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-white to-slate-100 dark:from-gray-900 dark:to-gray-800 px-4 flex flex-col items-center text-gray-900 dark:text-gray-100 transition overflow-hidden">
      <div className="flex items-center justify-between mb-4 my-4 w-full">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 font-medium"
        >
          <ArrowLeft className="w-5 h-5" />
          Quay lại
        </button>

        <h1 className="text-2xl font-bold text-center flex-1">Phân Loại Ảnh</h1>

        {/* Chiếm cùng kích thước với button để cân đối */}
        <div className="w-[120px]" />
      </div>

      <div className="w-full max-w-screen-2xl bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl p-6 flex flex-col md:flex-row gap-8 md:h-[600px] overflow-y-auto">
        {/* Cột 1: Upload & Preview ảnh */}
        <div className="md:w-1/2 h-full flex flex-col gap-4">
          {/* Nếu chưa có ảnh thì chỉ hiển thị khu kéo thả */}
          {!image ? (
            <div className="flex-1 flex flex-col">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleImageChange({ target: { files: e.dataTransfer.files } });
                  }
                }}
                className={`flex-1 cursor-pointer border-2 border-dashed rounded-lg p-6 text-center transition duration-200
                  ${dragActive
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900"
                    : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id="upload-input"
                />
                <label htmlFor="upload-input" className="flex flex-col items-center gap-2 h-full justify-center">
                  <Upload size={28} />
                  <span className="text-base font-medium">Kéo ảnh vào đây hoặc bấm để chọn</span>
                </label>
              </div>
            </div>
          ) : (
            <>
              {/* Nếu đã có ảnh thì hiển thị preview */}
              <div className="flex-1 rounded-lg overflow-hidden bg-white dark:bg-gray-900 relative">
                {/* Tên ảnh */}
                <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                  <strong>Ảnh: </strong>{image.name}
                </p>

                {/* Khung ảnh cố định */}
                <div className="relative w-full h-[500px] overflow-hidden bg-white dark:bg-gray-900 p-2">
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />

                  {/* Nút X luôn ở góc khung */}
                  <button
                    onClick={() => {
                      setImage(null);
                      setPreview(null);
                      setResult(null);
                      setError(null);
                    }}
                    className="absolute top-2 right-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm p-1 rounded-full hover:bg-red-600 hover:text-white text-red-600 transition z-10 shadow"
                    title="Xóa ảnh"
                  >
                    <X className="w-8 h-8 stroke-[2.5]" />
                  </button>
                </div>
              </div>

            </>
          )}
        </div>

        <div className="hidden md:block w-[1px] bg-gray-300 dark:bg-gray-700 self-stretch" />

        {/* Cột 2: Chọn model + Button + Kết quả */}
        <div className="md:w-1/2 flex flex-col justify-start gap-6">
          {/* Select */}
          <div>
            <label className="block text-sm font-medium mb-1">Chọn mô hình:</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              {loadingModelNames ? (
                <option>Đang tải danh sách mô hình ...</option>
              ) : (
                modelNames.map((model, index) => (
                  <option key={index} value={model.value}>{model.label}</option>
                ))
              )}
            </select>
          </div>

          {/* Button */}
          <button
            onClick={handleSubmit}
            disabled={!image || loading || modelNames.length === 0}
            className={`w-full py-3 rounded-lg font-semibold text-lg transition flex items-center justify-center
              ${(!image || modelNames.length === 0 || loading)
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'}
            `}
          >
            {loading ? (
              <>
                Đang phân loại ...
              </>
            ) : loadingModelNames ? (
              "Đang tải mô hình ..."
            ) : (
              "Phân loại"
            )}
          </button>

          {error && <p className="flex items-center justify-center text-red-600 font-semibold text-center gap-2">
            <AlertTriangle className="w-5 h-5" />{error}</p>}

          {/* Kết quả */}
          <div className="mt-10 flex-1 flex flex-col">
            <div className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl p-4 flex-1 flex flex-col">
              <h2 className="flex items-center justify-center text-xl font-bold mb-10 text-center">Kết quả phân loại</h2>

              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-600 dark:text-gray-300">
                  <Loader2 className="animate-spin w-10 h-10 text-blue-500 mb-3" />
                  <span className="text-base font-medium">Đang phân loại ảnh...</span>
                </div>
              ) : result?.top_predictions ? (
                <div className="flex flex-col gap-6">
                  {result.top_predictions.map((item, index) => (
                    <div key={index} className="flex flex-col gap-1">
                      <p className="text-base font-semibold">
                        {index === 0 ? (
                          <span className="text-gray-800 dark:text-gray-200">Kết quả chính:</span>
                        ) : (
                          <span className="text-gray-700 dark:text-gray-300">Gợi ý {index + 1}:</span>
                        )}
                        <span className="ml-2 text-blue-600 dark:text-blue-400">{item.class_name}</span>
                      </p>

                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded h-3">
                        <div
                          className="bg-green-500 h-3 rounded"
                          style={{ width: `${item.confidence.toFixed(2)}%` }}
                        />
                      </div>

                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Độ tin cậy: {item.confidence.toFixed(2)}%
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center -translate-y-4 text-sm text-gray-500 dark:text-gray-400 italic">
                  Chưa có kết quả. Vui lòng tải ảnh lên và nhấn "Phân loại".
                </div>
              )}
            </div>
          </div>
        </div>
        {/* end cột 2 */}

      </div>
    </div>

  );
}
