import axios from "axios";
import { React, useState, useEffect } from "react";
import { Upload, Loader2, LoaderCircle, CheckSquare, Square, ArrowLeft } from "lucide-react";

import { useNavigate } from "react-router-dom";

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import imageStore from "../storage";

export default function ExtractPDFPage() {
	const navigate = useNavigate();

	const [pdfUrl, setPdfUrl] = useState(null);
	const [pdfFile, setPdfFile] = useState(null);

	const [dragActive, setDragActive] = useState(false);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(false);

	const [modelNames, setModelNames] = useState([]);
	const [loadingModelNames, setLoadingModelNames] = useState(true);
	const [selectedModel, setSelectedModel] = useState("");
	const [threshold, setThreshold] = useState(95);

	const [imagesExtracted, setImagesExtracted] = useState([]);          // ảnh đã trích được từ PDF
	const [extractedData, setExtractedData] = useState(null); 	// dữ liệu trả về sau khi trích xuất ảnh từ PDF

	const [selectedImages, setSelectedImages] = useState([]); 	// chỉ số ảnh đã chọn trong số ảnh đã trích xuất để tìm tương đồng

	const [similarResults, setSimilarResults] = useState([]); // dữ liệu trả về ds ảnh tương đồng

	useEffect(() => {
		const savedPdfUrl = sessionStorage.getItem("pdfUrl");
		const savedSelectedModel = sessionStorage.getItem("selectedModel");
		const savedThreshold = sessionStorage.getItem("threshold");
		const savedimagesExtracted = sessionStorage.getItem("imagesExtracted");
		const savedExtractedData = sessionStorage.getItem("extractedData");
		const savedSelectedImages = sessionStorage.getItem("selectedImages");

		if (savedPdfUrl) setPdfUrl(savedPdfUrl);
		if (savedSelectedModel) setSelectedModel(savedSelectedModel);
		if (savedThreshold) setThreshold(savedThreshold);
		if (savedimagesExtracted) setImagesExtracted(JSON.parse(savedimagesExtracted));
		if (savedExtractedData) setExtractedData(JSON.parse(savedExtractedData));
		if (savedSelectedImages) setSelectedImages(JSON.parse(savedSelectedImages));
	}, []);

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

	useEffect(() => {
		if (selectedModel) {
			sessionStorage.setItem("selectedModel", selectedModel);
		}
	}, [selectedModel]);

	useEffect(() => {
		sessionStorage.setItem("threshold", threshold);
	}, [threshold]);

	const handleExtractImages = async () => {
		if (!pdfUrl) return;

		const formData = new FormData();
		formData.append("pdf", pdfFile);

		setSimilarResults([]);
		setLoading(true);
		setError(null);

		try {
			const res = await axios.post("http://localhost:8000/extract-images", formData, {
				headers: { "Content-Type": "multipart/form-data" },
			});

			const images = res.data.images || [];

			if (images.length === 0) {
				toast.warning("Không tìm thấy ảnh nào trong tệp PDF.");
			}

			setImagesExtracted(images);
			setExtractedData(res.data);
			console.log("Kết quả ảnh:", images);
		} catch (err) {
			setError("Lỗi khi trích ảnh từ PDF!");
			toast.error("Đã xảy ra lỗi khi trích ảnh từ PDF.");
			console.error(err);
		} finally {
			setLoading(false);
		}
	};

	function base64ToFile(base64Data, filename, mime = "image/png") {
		const byteString = atob(base64Data);
		const arrayBuffer = new ArrayBuffer(byteString.length);
		const intArray = new Uint8Array(arrayBuffer);
		for (let i = 0; i < byteString.length; i++) {
			intArray[i] = byteString.charCodeAt(i);
		}
		const blob = new Blob([intArray], { type: mime });
		return new File([blob], filename, { type: mime });
	}

	const handleFindSimilarImages = async () => {
		if (selectedImages.length === 0) {
			toast.warning("Vui lòng chọn ít nhất 1 ảnh để tìm ảnh tương đồng!");
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const formData = new FormData();

			selectedImages.forEach((idx) => {
				const img = imagesExtracted[idx];
				const file = base64ToFile(img.base64, img.name || `image_${idx + 1}.png`);
				formData.append("images", file);
			});

			formData.append("model_name", selectedModel);
			formData.append("threshold", threshold / 100);

			const res = await axios.post("http://localhost:8000/search-similar-list", formData);

			// Tìm label từ danh sách models
			const selectedModelObj = modelNames.find(m => m.value === selectedModel);
			const selectedModelLabel = selectedModelObj ? selectedModelObj.label : selectedModel;

			// Lưu state vào sessionStorage
			sessionStorage.setItem("pdfUrl", pdfUrl);
			sessionStorage.setItem("selectedModel", selectedModel);
			sessionStorage.setItem("threshold", threshold);

			await imageStore.setItem("imagesExtracted", imagesExtracted);
			await imageStore.setItem("extractedData", extractedData);
			await imageStore.setItem("selectedImages", selectedImages);
			await imageStore.setItem("similarResults", res.data);
			await imageStore.setItem("modelLabel", selectedModelLabel); // lưu thêm label model

			console.log(imagesExtracted, selectedImages, similarResults);

			// Điều hướng qua trang kết quả tương đồng
			navigate("/similar-images-pdf", {
				state: {
					imagesExtracted, 	// ảnh đã trích xuất
					extractedData, 		// thông tin file PDF trích xuất
					selectedImages,		// chỉ số ảnh đã chọn
					similarResults: res.data,	// kết quả tương đồng
					modelLabel: selectedModelLabel, 
					threshold: threshold,
				},
			});

			// setSimilarResults(res.data || []);
			// console.log("Kết quả tìm ảnh tương đồng:", res.data);
		} catch (err) {
			setError("Lỗi khi tìm ảnh tương đồng!");
			console.error(err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const loadData = async () => {
			const storedImages = await imageStore.getItem("imagesExtracted");
			const storedData = await imageStore.getItem("extractedData");
			const storedSelected = await imageStore.getItem("selectedImages");

			if (storedImages) setImagesExtracted(storedImages);
			if (storedData) setExtractedData(storedData);
			if (storedSelected) setSelectedImages(storedSelected);
		};

		loadData();
	}, [])

	const handleReset = () => {
		setPdfUrl(null);
		setImagesExtracted([]);
		setSelectedImages([]);
		setExtractedData(null);
		setSimilarResults([]);
		setError(null);
	};

	const handleFileChange = (e) => {
		const file = e?.target?.files?.[0];
		if (file?.type === "application/pdf") {
			setPdfFile(file); // lưu lại file thật để gửi API
			const url = URL.createObjectURL(file);
			setPdfUrl(url);
		} else {
			toast.warning("Hệ thống chỉ hỗ trợ tệp PDF!");
		}
	};

	return (
		<div className="h-screen overflow-hidden flex flex-col px-4 bg-gradient-to-br from-white to-slate-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100">
			<div className="flex items-center justify-between mb-4 my-6">
				<button
					onClick={() => navigate("/")}
					className="flex items-center gap-2 w-max px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 font-medium"
				>
					<ArrowLeft className="w-5 h-5" />
					Quay lại
				</button>

				<h1 className="text-2xl font-bold text-center flex-1">Tìm Ảnh Tương Đồng Từ File PDF</h1>

				<div className="w-[120px]" />
			</div>

			<div className="mb-3 w-full mx-auto bg-white border border-gray-300 dark:border-gray-600 dark:bg-gray-900 p-2 rounded-xl shadow flex flex-col md:flex-row gap-8 flex-1 overflow-y-auto">
				{/* Cột trái */}
				<div className="md:w-4/12 flex flex-col h-full min-h-[500px] gap-4 rounded-xl p-4 border border-gray-200 dark:border-gray-700">

					{/* Preview hoặc Upload Box */}
					<div className="flex-1 min-h-[220px] transition-all duration-300 rounded-lg overflow-hidden flex justify-center items-center relative bg-white dark:bg-gray-900">
						{pdfUrl ? (
							<div className="relative w-full h-full max-w-full overflow-hidden">
								<iframe
									src={pdfUrl}
									title="Xem PDF"
									className="w-full h-full max-h-[500px] border rounded"
								/>
								<button
									onClick={handleReset}
									className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-red-600 shadow"
									title="Xoá file"
								>
									✕
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
									const file = e.dataTransfer.files?.[0];
									if (!file) return;
									if (file.type !== "application/pdf") {
										toast.warning("Hệ thống chỉ hỗ trợ tệp PDF!");
										return;
									}
									handleFileChange({ target: { files: [file] } });
								}}
								className={`w-full h-full border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition duration-200
        							${dragActive
										? "border-blue-500 bg-blue-50 dark:bg-blue-900"
										: "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
									}`}
							>
								<input
									type="file"
									accept="application/pdf"
									onChange={handleFileChange}
									className="hidden"
									id="upload-pdf"
								/>
								<label
									htmlFor="upload-pdf"
									className="flex flex-col items-center gap-2 h-full justify-center"
								>
									<Upload className="w-6 h-6" />
									<span className="text-base font-medium">
										Kéo thả hoặc bấm để chọn file PDF
									</span>
								</label>
							</div>
						)}
					</div>

					<div className="flex flex-col gap-3">
						{imagesExtracted.length === 0 ? (
							// === Chưa có file hoặc chưa trích xuất hình ===
							<div>
								<button
									onClick={imagesExtracted.length === 0 ? handleExtractImages : handleFindSimilarImages}
									disabled={!pdfUrl || loading}
									className={`w-full px-6 py-2 rounded-lg font-semibold text-white transition
          								${!pdfUrl || loading
											? "bg-gray-400 cursor-not-allowed"
											: "bg-green-600 hover:bg-green-700"
										}`}
								>
									{loading ? (
										<div className="flex items-center justify-center gap-2">
											{imagesExtracted.length === 0 ? "Đang trích xuất..." : "Đang tìm ảnh..."}
										</div>
									) : (
										imagesExtracted.length === 0 ? "Trích xuất hình ảnh" : "Tìm ảnh tương đồng"
									)}
								</button>
							</div>
						) : (
							// === Đã trích xuất hình thành công ===
							<div className="flex flex-col gap-3">
								<div className="flex gap-4">
									<div className="flex flex-col w-3/5">
										<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chọn mô hình</label>
										<select
											value={selectedModel}
											onChange={(e) => setSelectedModel(e.target.value)}
											className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 text-sm"
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

									<div className="flex flex-col w-2/5">
										<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ngưỡng tương đồng (%)</label>
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
											title="Ngưỡng độ tương đồng (%)"
										/>
									</div>
								</div>

								{/* Nút Tìm ảnh */}
								<div>
									<button
										onClick={imagesExtracted.length === 0 ? handleExtractImages : handleFindSimilarImages}
										disabled={!pdfUrl || loading}
										className={`w-full px-6 py-2 rounded-lg font-semibold text-white transition
            								${!pdfUrl || loading
												? "bg-gray-400 cursor-not-allowed"
												: "bg-green-600 hover:bg-green-700"
											}`}
									>
										{loading ? (
											<div className="flex items-center justify-center gap-2">
												<Loader2 className="w-4 h-4 animate-spin" />
												Đang xử lý...
											</div>
										) : (
											"Tìm ảnh tương đồng"
										)}
									</button>
								</div>
							</div>
						)}
					</div>
				</div>


				{/* Cột phải */}
				<div
					className={`md:w-8/12 flex flex-col h-full pr-2 rounded-xl px-4 ${pdfUrl && imagesExtracted.length !== 0 ? 'border border-gray-200 dark:border-gray-700' : ''
						}`}
				>
					{/* Nếu có lỗi: Hiển thị thông báo */}
					{error && pdfUrl && imagesExtracted.length === 0 ? (
						<span className="text-red-500 dark:text-red-400 font-semibold mt-2">{error}</span>
					) : (
						<>
							{imagesExtracted.length > 0 && (
								<div className="sticky top-0 z-10 bg-white dark:bg-gray-900 pt-3 pb-2 shadow-md">
									{/* THÔNG TIN PDF */}
									<div className="space-y-1 text-[15px] text-gray-700 dark:text-gray-300">
										<p><span className="font-semibold">Tiêu đề:</span> {extractedData.title}</p>
										<p><span className="font-semibold">Tác giả:</span> {extractedData.authors}</p>
										<p><span className="font-semibold">Ngày duyệt:</span> {extractedData.approved_date}</p>
										{extractedData.doi && (
											<p className="text-gray-500 dark:text-gray-400">
												<span className="font-semibold">DOI: </span>
												{extractedData.doi.toLowerCase().includes("no doi") ? (
													extractedData.doi
												) : (
													<a
														href={`https://doi.org/${extractedData.doi}`}
														target="_blank"
														rel="noopener noreferrer"
														className="underline"
													>
														{extractedData.doi}
													</a>
												)}
											</p>
										)}
									</div>

									<div className="border-t border-gray-300 dark:border-gray-600 my-2" />

									{/* THANH CÔNG CỤ */}
									<div className="flex justify-between items-center mb-2">
										<p className="text-[14px] font-medium text-gray-700 dark:text-gray-300">
											Tổng số ảnh: {imagesExtracted.length} — Đã chọn: {selectedImages.length}
										</p>

										<button
											onClick={() => {
												if (selectedImages.length === imagesExtracted.length) {
													setSelectedImages([]);
												} else {
													setSelectedImages(imagesExtracted.map((_, idx) => idx));
												}
											}}
											className="flex items-center gap-2 px-4 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600"
										>
											{selectedImages.length === imagesExtracted.length ? (
												<>
													<CheckSquare className="w-4 h-4" />
													Bỏ chọn hết
												</>
											) : (
												<>
													<Square className="w-4 h-4" />
													Chọn tất cả
												</>
											)}
										</button>
									</div>
								</div>
							)}

							{/* DANH SÁCH ẢNH */}
							<div className="overflow-y-auto max-h-[calc(100vh-250px)] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pb-4 px-2">
								{imagesExtracted.map((img, index) => {
									const isSelected = selectedImages.includes(index);
									const selectionOrder = selectedImages.indexOf(index) + 1;

									return (
										<div
											key={index}
											className={`relative p-2 cursor-pointer transition rounded-lg shadow-sm 
												${isSelected
													? 'border border-blue-500 ring-1 ring-blue-300 dark:ring-blue-500'
													: 'border border-transparent hover:border-gray-300 dark:hover:border-gray-600'
												}`}
											onClick={() => {
												setSelectedImages((prev) =>
													prev.includes(index)
														? prev.filter((i) => i !== index)
														: [...prev, index]
												);
											}}
										>
											{isSelected && (
												<div className="absolute top-1 right-1 bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow">
													{selectionOrder}
												</div>
											)}

											<img
												src={`data:image/png;base64,${img.base64}`}
												alt={img.name || `Ảnh ${index + 1}`}
												className="w-full h-48 object-contain rounded"
											/>
										</div>
									);
								})}
							</div>
						</>
					)}
				</div>

			</div>
			<ToastContainer
				position="top-right"
				autoClose={4000}
				hideProgressBar
				closeOnClick
				pauseOnHover
				draggable
				toastClassName={() =>
					"flex items-center bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-lg shadow-md px-4 py-5 gap-2"
				}
				bodyClassName="text-sm font-medium m-0 p-0"
			/>
		</div>
	);
}
