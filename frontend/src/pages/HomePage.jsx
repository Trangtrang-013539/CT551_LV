import { useNavigate } from "react-router-dom";
import { ArrowRight, ImagePlus, ScanSearch, FileScan } from "lucide-react";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="px-4 md:px-8 bg-gradient-to-b from-white to-slate-100 dark:from-gray-900 dark:to-gray-950 min-h-screen">
      <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col items-center px-6 py-16 space-y-20">
        <h1 className="text-xl md:text-4xl font-extrabold text-gray-900 dark:text-white text-center max-w-5xl leading-tight mb-12 px-2">
          HỆ THỐNG PHÂN LOẠI VÀ TÌM ẢNH TƯƠNG ĐỒNG
        </h1>

        <p className="text-lg text-gray-600 dark:text-gray-300 text-center mb-12 max-w-xl">
          Vui lòng chọn một chức năng để bắt đầu
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 w-full max-w-7xl">
          {/* Phân loại ảnh */}
          <div
            onClick={() => navigate("/classify")}
            className="cursor-pointer p-6 
                      bg-sky-100 dark:bg-sky-300/20 
                      border border-sky-200 dark:border-sky-500/30 
                      rounded-2xl shadow 
                      hover:shadow-lg hover:-translate-y-1 hover:scale-[1.02]
                      hover:ring-1 hover:ring-sky-300 dark:hover:ring-sky-400
                      transition-all duration-300
                      flex flex-col justify-between min-h-[320px]"
          >
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-sky-700 dark:text-sky-400 mb-2">
                <ImagePlus className="w-6 h-6" />
                Phân loại ảnh
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Chọn một ảnh bất kỳ để hệ thống nhận dạng và phân loại nội dung chính.
              </p>
            </div>
            <div className="text-sky-600 font-medium flex items-center gap-1 mt-auto">
              Bắt đầu <ArrowRight size={18} />
            </div>
          </div>

          {/* Tìm ảnh tương đồng */}
          <div
            onClick={() => navigate("/similar-image")}
            className="cursor-pointer p-6 
                      bg-emerald-100 dark:bg-emerald-300/20 
                      border border-emerald-50 dark:border-gray-800 
                      rounded-2xl shadow 
                      hover:shadow-lg hover:-translate-y-1 hover:scale-[1.02]
                      hover:ring-1 hover:ring-emerald-300 dark:hover:ring-emerald-400
                      transition-all duration-300
                      flex flex-col justify-between min-h-[320px]"
          >
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-emerald-700 dark:text-emerald-400 mb-2">
                <ScanSearch className="w-6 h-6" />
                Tìm ảnh tương đồng
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Tải ảnh bất kỳ để hệ thống tìm các ảnh tương đồng dựa trên nội dung.
              </p>
            </div>
            <div className="text-emerald-600 font-medium flex items-center gap-1 mt-auto">
              Bắt đầu <ArrowRight size={18} />
            </div>
          </div>

          {/* Tìm ảnh từ PDF */}
          <div
            onClick={() => {
              // Xóa dữ liệu session cũ trước khi vào lại trang chức năng
              sessionStorage.removeItem("pdfUrl");
              sessionStorage.removeItem("selectedModel");
              sessionStorage.removeItem("threshold");
              sessionStorage.removeItem("imagesExtracted");
              sessionStorage.removeItem("extractedData");
              sessionStorage.removeItem("selectedImages");
              sessionStorage.removeItem("similarResults");
              
              navigate("/extract-images-pdf")
            }}
            className="cursor-pointer p-6 
                      bg-rose-100 dark:bg-rose-300/20 
                      border border-rose-50 dark:border-gray-800 
                      rounded-2xl shadow 
                      hover:shadow-lg hover:-translate-y-1 hover:scale-[1.02]
                      hover:ring-1 hover:ring-rose-300 dark:hover:ring-rose-400
                      transition-all duration-300
                      flex flex-col justify-between min-h-[320px]"
          >
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-rose-700 dark:text-rose-400 mb-2">
                <FileScan className="w-6 h-6" />
                Tìm ảnh tương đồng từ file PDF
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Tải file PDF, hệ thống sẽ trích xuất hình ảnh và tìm các ảnh tương đồng theo nội dung.
              </p>
            </div>
            <div className="text-rose-600 font-medium flex items-center gap-1 mt-auto">
              Bắt đầu <ArrowRight size={18} />
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

