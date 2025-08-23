import axios from "axios";
import { React, useState, useEffect } from "react";
import { Upload, Loader2, LoaderCircle, ArrowLeft, X } from "lucide-react";

import { useNavigate } from "react-router-dom";

export default function SimilarPage() {
  const navigate = useNavigate();

  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [results, setResults] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modelNames, setModelNames] = useState([]);
  const [loadingModelNames, setLoadingModelNames] = useState(true);
  const [selectedModel, setSelectedModel] = useState("");
  const [threshold, setThreshold] = useState(95);
  const [dragActive, setDragActive] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const res = await axios.get("http://localhost:8000/aug-models");

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
    setResults([]);
    setPrediction(null);
    setError(null);

    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!image) return;

    const formData = new FormData();
    formData.append("images", image);
    formData.append("model_name", selectedModel);
    formData.append("threshold", parseFloat(threshold) / 100);

    setResults([]);
    setPrediction(null);
    setLoading(true);
    setError(null);

    try {
      const res = await axios.post("http://localhost:8000/search-similar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResults(res.data[0].similar_images);
      setPrediction({
        predicted_class: res.data[0].predicted_class,
        confidence: res.data[0].confidence,
        total: res.data[0].total
      });
      // console.log("API response:", res.data);
    } catch (err) {
      setError("Lỗi khi tìm ảnh tương đồng!");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setImage(null);
    setPreview(null);
    setResults([]);
    setPrediction(null);
    setSearchTerm("");
  };

  // const normalize = (str) =>
  //   str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

  // const filteredResults = results.filter((item) => {
  //   const term = normalize(searchTerm);
  //   return (
  //     normalize(item.title).includes(term) ||
  //     normalize(item.authors).includes(term) ||
  //     normalize(item.doi).includes(term) ||
  //     normalize(item.caption).includes(term)
  //   );
  // });

  // const highlightText = (text, keyword) => {
  //   if (!keyword) return text;

  //   const norm = (s) =>
  //     s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  //   const normalizedText = norm(text);
  //   const normalizedKeyword = norm(keyword);

  //   const index = normalizedText.indexOf(normalizedKeyword);
  //   if (index === -1) return text;

  //   // Ánh xạ từng ký tự gốc theo index của chuỗi normalize
  //   let map = [];
  //   let i = 0;
  //   for (let j = 0; j < text.length; j++) {
  //     const char = text[j];
  //     const normChar = norm(char);
  //     for (let k = 0; k < normChar.length; k++) {
  //       map[i] = j;
  //       i++;
  //     }
  //   }

  //   const startIdx = map[index];
  //   const endIdx = map[index + normalizedKeyword.length - 1] + 1;

  //   const start = text.slice(0, startIdx);
  //   const match = text.slice(startIdx, endIdx);
  //   const end = text.slice(endIdx);

  //   return (
  //     <>
  //       {start}
  //       <mark className="bg-yellow-300 text-black px-1">{match}</mark>
  //       {end}
  //     </>
  //   );
  // };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-white to-slate-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100">
      {/* Header cố định */}
      <div className="flex items-center justify-between h-[72px] px-4 py-2">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 font-medium"
        >
          <ArrowLeft className="w-5 h-5" />
          Quay lại
        </button>
        <h1 className="text-2xl font-bold text-center flex-1">Tìm Ảnh Tương Đồng</h1>
        <div className="w-[120px]" />
      </div>

      {/* Nội dung chính */}
      {/* Content có thể scroll riêng */}
      <div className="flex-1 overflow-y-auto px-4">
        <div className="mb-2 w-full max-w-screen-2xl mx-auto bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 rounded-xl flex flex-col md:flex-row gap-8 md:min-h-[calc(100vh-150px)]">
          <div className="w-full mx-auto bg-transparent md:bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-3 rounded-xl shadow flex flex-col md:flex-row gap-8">
            {/* Cột trái */}
            <div className="md:w-4/12 flex flex-col gap-1">
              <div className="flex flex-col items-center gap-1 w-full">
                {/* Luôn hiển thị vùng tên ảnh cố định, kể cả khi chưa có ảnh */}
                <div className="h-5 w-full text-sm text-center text-gray-600 dark:text-gray-400 truncate">
                  {image && (
                    <>
                      <strong>Ảnh:</strong> {image.name}
                    </>
                  )}
                </div>

                {/* Khung ảnh hoặc drop zone */}
                {image ? (
                  <div className="relative w-full aspect-[4/2.8] h-[335px] border-2 border-dashed rounded-lg bg-white dark:bg-gray-900 overflow-hidden border-gray-300 dark:border-gray-600">
                    <img
                      src={preview}
                      alt="Preview"
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                    <button
                      onClick={handleReset}
                      className="absolute top-0 right-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm p-1.5 rounded-full text-red-600 hover:bg-red-600 hover:text-white transition z-10 shadow"
                      title="Xoá ảnh"
                    >
                      <X className="w-6 h-6 stroke-[2.5]" />
                    </button>
                  </div>
                ) : (
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
                    className={`w-full aspect-[4/2.8] h-[335px] border-2 border-dashed rounded-lg text-center cursor-pointer transition duration-200 flex items-center justify-center
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
                    <label htmlFor="upload-input" className="flex flex-col items-center gap-2">
                      <Upload className="w-6 h-6" />
                      <span className="text-base font-medium">
                        Kéo ảnh vào đây hoặc bấm để chọn ảnh
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* Form chọn model + ngưỡng + submit */}
              <div className="flex flex-col gap-4 mt-2">
                <div className="flex gap-4">
                  <div className="flex flex-col flex-1">
                    <label className="text-sm font-medium mb-1">Mô hình</label>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      {loadingModelNames ? (
                        <option>Đang tải mô hình...</option>
                      ) : (
                        modelNames.map((model, idx) => (
                          <option key={idx} value={model.value}>
                            {model.label}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="flex flex-col w-36">
                    <label className="text-sm font-medium mb-1">Ngưỡng (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={threshold}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || (/^\d{1,3}$/.test(val) && Number(val) <= 100)) {
                          setThreshold(val);
                        }
                      }}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={handleSubmit}
                    disabled={!image || loading}
                    className={`w-full px-6 py-2 rounded-lg font-semibold text-white transition
                      ${!image || loading
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700"
                      }`}
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        Đang tìm...
                      </div>
                    ) : (
                      "Tìm ảnh"
                    )}
                  </button>
                </div>
              </div>

              {/* Thông tin dự đoán */}
              <div className="mt-5 min-h-[70px]">
                {prediction ? (
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-3 text-sm border border-gray-200 dark:border-gray-700">
                    <p className="mb-1">
                      <b>Lớp dự đoán:</b>{" "}
                      <span className="text-indigo-600 dark:text-indigo-400">
                        {prediction.predicted_class}
                      </span>
                    </p>
                    <p className="mb-1">
                      <b>Độ tin cậy:</b> {prediction.confidence.toFixed(2)}%
                    </p>
                  </div>
                ) : (
                  <div className="h-full" />
                )}
              </div>
            </div>

            {/* Divider dọc */}
            {/* <div className="hidden md:block border-l border-gray-200 dark:border-gray-700 self-stretch" /> */}

            {/* Cột phải: tìm kiếm + danh sách */}
            <div
              className={`w-full md:w-8/12 flex flex-col rounded-xl px-4
                ${image && prediction ? 'border border-gray-200 dark:border-gray-700' : ''}
                bg-gray-100 dark:bg-gray-800 
              `}
            >
              <div className="flex flex-col overflow-y-auto" style={{ maxHeight: "calc(100vh - 120px)" }}>
                {/* Sticky */}
                {results.length > 0 && (
                  <div className="flex items-center gap-2 sticky top-0 z-20 bg-gray-100 dark:bg-gray-800 py-2 px-1">
                    <p className="text-sm text-gray-600 dark:text-gray-300"><b>Số ảnh tương đồng: {prediction.total}</b></p>
                    {/* <label className="text-sm font-medium whitespace-nowrap mr-5">Tìm kiếm:</label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Tiêu đề, chú thích, tác giả, DOI"
                      className="w-7/8 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-sm"
                    /> */}
                  </div>
                )}

                {/* Danh sách kết quả cuộn riêng */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-1 m">
                  {loading ? (
                    <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-220px)] text-gray-600 dark:text-gray-300">
                      <div className="flex flex-col items-center">
                        <Loader2 className="animate-spin w-10 h-10 text-blue-500 mb-3" />
                        <span className="text-base font-medium">Đang tìm ảnh tương đồng...</span>
                      </div>
                    </div>
                    // ) : filteredResults.length > 0 ? (
                    //   filteredResults.map((item, index) => (
                  ) : results.length > 0 ? (
                    results.map((item, index) => (
                      <div key={item.image_id || index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex gap-4 bg-white dark:bg-gray-900">
                        <div className="w-80 max-h-[300px] flex items-center justify-center overflow-hidden">
                          <img
                            src={item.image_url}
                            alt=""
                            className="object-contain w-full h-auto max-h-[300px]"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-col space-y-2">
                            <p className="font-semibold text-indigo-600 dark:text-indigo-400">
                              {item.title}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <b>Chú thích: </b>{item.caption}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <b>Tác giả: </b>{item.authors}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <b>Ngày duyệt:</b> {item.approved_date}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              <b>DOI: </b>
                              {item.doi.toLowerCase().includes("no doi") ? (
                                item.doi
                              ) : (
                                <a
                                  href={`https://doi.org/${item.doi}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline text-sm text-green-500 dark:text-green-400"
                                >
                                  {item.doi}
                                </a>
                              )}
                            </p>
                            <p className="mt-1 text-sm italic text-gray-600 dark:text-gray-400">
                              <b>Độ tương đồng: </b>{(item.similarity * 100).toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-sm italic mt-10">
                      {error ? (
                        <span className="text-red-500 dark:text-red-400 font-semibold not-italic">{error}</span>
                      ) : !image ? (
                        <span className="text-gray-500 dark:text-gray-400">
                          Vui lòng tải ảnh lên để tìm kiếm ảnh tương đồng.
                        </span>
                      ) : !prediction && results.length === 0 && !loading ? (
                        <span className="text-gray-500 dark:text-gray-400">
                          Vui lòng chọn mô hình, ngưỡng tương đồng và nhấn "Tìm ảnh".
                        </span>
                      ) : prediction && results.length === 0 && !loading ? (
                        <span className="text-gray-500 dark:text-gray-400">
                          Không tìm thấy kết quả phù hợp.
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}