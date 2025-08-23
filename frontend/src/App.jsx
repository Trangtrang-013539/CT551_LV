import { Routes, Route } from "react-router-dom"
import HomePage from "./pages/HomePage"
import ClassifyPage from "./pages/ClassifyPage"
import SimilarPage from "./pages/SimilarPage"
import ExtractPDFPage from "./pages/ExtractPDFPage"
import SimilarPDFPage from "./pages/SimilarPDFPage"

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/classify" element={<ClassifyPage />} />
        <Route path="/similar-image" element={<SimilarPage />} />
        <Route path="/extract-images-pdf" element={<ExtractPDFPage />} />
        <Route path="/similar-images-pdf" element={<SimilarPDFPage />} />
      </Routes>
    </div>
  )
}

export default App