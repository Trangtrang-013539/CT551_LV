import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import imageStore from "../storage";

export default function ResultsPage() {
	const location = useLocation();
	const navigate = useNavigate();

	const [imagesExtracted, setImagesExtracted] = useState([]);
	const [extractedData, setExtractedData] = useState(null);
	const [selectedImages, setSelectedImages] = useState([]);
	const [similarResults, setSimilarResults] = useState([]);

	const [modelLabel, setModelLabel] = useState("");  
	const [threshold, setThreshold] = useState("");

	useEffect(() => {
		const fromState = location.state;
		if (fromState?.imagesExtracted && fromState?.selectedImages && fromState?.similarResults) {
			setImagesExtracted(fromState.imagesExtracted || []);
			setExtractedData(fromState.extractedData || null);
			setSelectedImages(fromState.selectedImages || []);
			setSimilarResults(fromState.similarResults);

			setModelLabel(fromState.modelLabel || "");
			setThreshold(fromState.threshold || "");
		} else {
			const storedModelName = sessionStorage.getItem("selectedModel");
			const storedThreshold = sessionStorage.getItem("threshold");

			if (imagesExtracted && selectedImages && similarResults) {
				setImagesExtracted(JSON.parse(imagesExtracted || "[]"));
				setExtractedData(JSON.parse(extractedData || "{}"));
				setSelectedImages(JSON.parse(selectedImages || "[]"));
				setSimilarResults(JSON.parse(similarResults || "[]"));
			}
			if (storedModelName) setModelName(storedModelName);
			if (storedThreshold) setThreshold(storedThreshold);

			// lấy label từ localforage (imageStore)
			imageStore.getItem("modelLabel").then((label) => {
				if (label) setModelLabel(label);
			});
		}
	}, []);

	useEffect(() => {
		const loadData = async () => {
			const imagesExtracted = await imageStore.getItem("imagesExtracted");
			const extractedData = await imageStore.getItem("extractedData");
			const selectedImages = await imageStore.getItem("selectedImages");
			const similarResults = await imageStore.getItem("similarResults");

			if (imagesExtracted) setImagesExtracted(imagesExtracted);
			if (extractedData) setExtractedData(extractedData);
			if (selectedImages) setSelectedImages(selectedImages);
			if (similarResults) setSimilarResults(similarResults);
		};

		loadData();
	}, []);

	return (
		<div className="h-screen overflow-hidden flex flex-col px-4 bg-gradient-to-br from-white to-slate-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100">
			<h1 className="text-3xl font-bold text-center py-2 my-4">
				Kết quả tìm ảnh tương đồng
			</h1>
			<div className="relative flex items-center justify-between mb-4">
				<button
					onClick={() => navigate("/extract-images-pdf")}
					className="flex items-center gap-2 px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 font-medium"
				>
					<ArrowLeft className="w-5 h-5" />
					Quay lại
				</button>

				<div className="absolute left-1/2 transform -translate-x-1/2">
					<p className="text-center text-gray-400 text-base">
						Model: <span className="font-semibold text-blue-500">{modelLabel}</span> &nbsp;|&nbsp;
						Ngưỡng: <span className="font-semibold text-blue-500">{threshold}%</span>
					</p>
				</div>
			</div>

			<div className="mb-4 w-full mx-auto bg-gray-100 dark:bg-gray-900 p-6 rounded-xl shadow flex flex-col gap-6 flex-1 overflow-y-auto">
				{/* Thông tin bài báo */}
				{extractedData && (
					<div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
						<p className="text-sm text-gray-600 dark:text-gray-300">
							<b>Tiêu đề: </b>{extractedData.title}
						</p>
						<p className="text-sm text-gray-600 dark:text-gray-300">
							<b>Tác giả: </b>{extractedData.authors}
						</p>
						<p className="text-sm text-gray-600 dark:text-gray-300">
							<b>Ngày duyệt: </b>{extractedData.approved_date}
						</p>
						{extractedData.doi && (
							<p>
								<b>DOI: </b>
								{extractedData.doi.toLowerCase().includes("no doi") ? (
									extractedData.doi
								) : (
									<a
										href={`https://doi.org/${extractedData.doi}`}
										target="_blank"
										rel="noopener noreferrer"
										className="underline text-gray-500 dark:text-gray-400"
									>
										{extractedData.doi}
									</a>
								)}
							</p>
						)}
					</div>
				)}

				{/* Danh sách ảnh gốc + tương đồng */}
				<div className="space-y-10">
					{selectedImages.map((idx, i) => {
						const img = imagesExtracted[idx];
						const result = similarResults[i] || {};
						const similar = result.similar_images || [];

						return (
							<div key={i} className="space-y-4 p-4 bg-gray-200 dark:bg-gray-800 rounded-xl shadow">
								<div className="flex flex-col md:flex-row gap-6 items-stretch">
									{/* Ảnh gốc */}
									<div className="w-full md:basis-2/7 h-full flex flex-col space-y-2">
										<p className="text-sm font-medium text-gray-600 dark:text-gray-300">
											Ảnh gốc #{i + 1}
										</p>
										<div className="flex-1 flex flex-col justify-between border rounded-xl shadow p-3 bg-white dark:bg-gray-900">
											<div className="flex justify-center items-center h-60">

												<img
													src={`data:image/png;base64,${img.base64}`}
													alt={`Ảnh ${idx + 1}`}
													className="max-h-full object-contain"
												/>
											</div>
											<div className="mt-3 text-sm text-center text-gray-700 dark:text-gray-300 space-y-1">
												<p><span className="font-medium">Nhãn dự đoán:</span>
													<span className="font-semibold text-blue-700 dark:text-blue-300 ml-1">
														{result.predicted_class || "Không xác định"}
													</span>
												</p>
												<p><span className="font-medium">Độ tin cậy:</span>
													<span className="font-semibold text-blue-700 dark:text-blue-300 ml-1">
														{(result.confidence || 0).toFixed(2)}%
													</span>
												</p>
											</div>
										</div>
									</div>

									<div className="hidden md:block w-[1px] bg-gray-400/30 dark:bg-gray-600/40 self-stretch rounded-full" />

									{/* PHẢI: Ảnh tương đồng */}
									<div className="w-full md:basis-5/7 h-full flex flex-col">
										{similar.length > 0 && (
											<p className="text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
												{similar.length} ảnh tương đồng tìm được:
											</p>
										)}

										{similar.length > 0 ? (
											<div className="max-h-[318px] overflow-y-auto pr-2 space-y-3">
												{similar.map((s, j) => (
													<div
														key={j}
														className="flex gap-4 bg-white dark:bg-gray-900 border rounded-xl shadow p-3"
													>
														{/* Ảnh tương đồng */}
														<div className="w-2/5">
															<img
																src={s.image_url}
																alt={`Tương đồng ${j + 1}`}
																className="w-full h-60 object-contain"
															/>
														</div>

														{/* Thông tin chi tiết */}
														<div className="w-3/5 text-gray-800 dark:text-gray-200 space-y-2">
															{s.title && (
																<p className="font-semibold text-indigo-600 dark:text-indigo-400">{s.title}</p>
															)}
															{s.caption && (
																<p className="text-sm text-gray-600 dark:text-gray-300">
																	<b>Chú thích: </b>  {s.caption}</p>
															)}
															{s.authors && (
																<p className="text-sm text-gray-600 dark:text-gray-300">
																	<b>Tác giả: </b>  {s.authors}</p>
															)}
															{s.approved_date && (
																<p className="text-sm text-gray-600 dark:text-gray-300">
																	<b>Ngày duyệt: </b>  {s.approved_date}</p>
															)}
															{s.doi && (
																<p className="text-sm">
																	<span className="font-semibold">DOI:</span>{" "}
																	{s.doi.toLowerCase().includes("no doi") ? (
																		s.doi
																	) : (
																		<a
																			href={`https://doi.org/${s.doi}`}
																			target="_blank"
																			rel="noopener noreferrer"
																			className="underline text-green-500 hover:text-green-400"
																		>
																			{s.doi}
																		</a>
																	)}
																</p>
															)}
															<p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
																<span className="font-semibold">Độ tương đồng:</span>{" "}
																{(s.similarity * 100).toFixed(2)}%
															</p>
														</div>
													</div>

												))}
											</div>
										) : (
											<p className="italic text-gray-500 dark:text-gray-400 mt-10 ml-5">
												Không tìm thấy ảnh tương đồng
											</p>
										)}
									</div>

								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>

	);
}
