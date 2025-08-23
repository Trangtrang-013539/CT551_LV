# File: main.py

from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware

from model_loader import preload_models

# load trước các model 1 lần khi khởi tạo
# lifespan của FastAPI (được chạy trong cả process chính và phụ) nên preload model ở đây thì biến loaded_models sẽ ko bị khởi tạo lại

from faiss_index import load_faiss_index
from db import connect_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    preload_models()

    # preload FAISS index
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT f.model_name, r.class_name FROM feature f JOIN research r ON f.image_id = r.image_id; ")
    rows = cursor.fetchall()
    for model_name, class_name in rows:
        try:
            load_faiss_index(model_name.replace("_pca", ""), class_name)
        except Exception as e:
            print(f"⚠️ Không preload được FAISS index cho {model_name} - {class_name}: {e}")
    cursor.close()
    conn.close()

    yield
    print("[LIFESPAN] Shutting down...")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import router 
from app_classify import router as classify_router
app.include_router(classify_router)

from app_similarity import router as similarity_router
app.include_router(similarity_router)

from app_similarity_pdf import router as similarity_pdf_router
app.include_router(similarity_pdf_router)
