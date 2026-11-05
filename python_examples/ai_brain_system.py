"""
AI Autonomous Brain & Hybrid Database Integration System
--------------------------------------------------------
Tích hợp toàn diện giữa:
1. Relational Database & Vector Database (PostgreSQL + pgvector / Chroma)
2. Google Gemini API (@google/genai) cho Embeddings & LLM Reasoning
3. Bộ nhớ dài hạn (Long-term Memory / RAG) & Trạng thái Agent tự chủ
"""

import os
import asyncio
from typing import List, Dict, Any
from google import genai
from google.genai import types

# Khởi tạo Gemini Client (Sử dụng GEMINI_API_KEY từ biến môi trường)
# Lưu ý: AI Studio / môi trường tự động inject GEMINI_API_KEY
client = genai.Client()

class AIBrainMemorySystem:
    """Hệ thống quản lý bộ nhớ và truy vấn tri thức cho Bộ não AI tự chủ."""
    
    def __init__(self):
        self.embedding_model = "text-embedding-004"
        self.generation_model = "gemini-2.5-flash"
        # Giả lập bộ nhớ Vector trong bộ nhớ (hoặc kết nối PostgreSQL / ChromaDB)
        self.vector_store: List[Dict[str, Any]] = []

    def generate_embedding(self, text: str) -> List[float]:
        """Tạo vector embedding từ văn bản sử dụng Gemini Embedding API."""
        try:
            response = client.models.embed_content(
                model=self.embedding_model,
                contents=text,
            )
            # Trả về list các số float đại diện cho vector embedding (chiều 768)
            return response.embeddings[0].values
        except Exception as e:
            print(f"Lỗi tạo embedding: {e}")
            return []

    def add_knowledge(self, doc_id: str, content: str, metadata: Dict[str, Any] = None):
        """Thêm tài liệu vào kho tri thức (Vector Store / RAG Memory)."""
        vector = self.generate_embedding(content)
        if vector:
            self.vector_store.append({
                "id": doc_id,
                "content": content,
                "vector": vector,
                "metadata": metadata or {}
            })
            print(f"✅ Đã lập chỉ mục tri thức [{doc_id}] thành công.")

    def cosine_similarity(self, v1: List[float], v2: List[float]) -> float:
        """Tính độ tương đồng Cosine giữa 2 vector."""
        import math
        dot_product = sum(a * b for a, b in zip(v1, v2))
        magnitude1 = math.sqrt(sum(a * a for a in v1))
        magnitude2 = math.sqrt(sum(b * b for b in v2))
        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0
        return dot_product / (magnitude1 * magnitude2)

    def search_knowledge(self, query: str, top_k: int = 2) -> List[Dict[str, Any]]:
        """Tìm kiếm ngữ nghĩa (Semantic Search) trong bộ nhớ tri thức."""
        query_vector = self.generate_embedding(query)
        if not query_vector:
            return []

        scored_results = []
        for item in self.vector_store:
            score = self.cosine_similarity(query_vector, item["vector"])
            scored_results.append((score, item))

        # Sắp xếp theo độ tương đồng giảm dần
        scored_results.sort(key=lambda x: x[0], reverse=True)
        return [item for score, item in scored_results[:top_k]]

    def autonomous_reasoning(self, user_prompt: str) -> str:
        """Bộ não AI tự chủ kết hợp RAG và Gemini LLM Reasoning."""
        # Bước 1: Truy vấn bộ nhớ dài hạn (RAG Context Retrieval)
        relevant_docs = self.search_knowledge(user_prompt, top_k=2)
        context_str = "\n\n".join([f"- {doc['content']}" for doc in relevant_docs])

        # Bước 2: Xây dựng System Prompt cho Agent tự chủ
        system_instruction = (
            "Bạn là một AI Agent tự chủ thông minh. "
            "Hãy sử dụng ngữ cảnh tri thức được cung cấp dưới đây để trả lời câu hỏi một cách chính xác nhất. "
            "Nếu thông tin không có trong ngữ cảnh, hãy dùng kiến thức chung của bạn nhưng phải ghi chú rõ."
        )

        prompt = f"""
[NGUỒN TRI THỨC BỘ NHỚ]:
{context_str if context_str else "Không có tài liệu liên quan trong bộ nhớ."}

[CÂU HỎI TỪ NGƯỜI DÙNG]:
{user_prompt}
"""

        try:
            response = client.models.generate_content(
                model=self.generation_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.3,
                )
            )
            return response.text
        except Exception as e:
            return f"Lỗi sinh phản hồi từ AI: {str(e)}"

# === KỊCH BẢN CHẠY THỬ NGHIỆM (DEMO) ===
if __name__ == "__main__":
    print("🚀 Khởi tạo Hệ thống Bộ não AI & Hybrid Database...")
    brain = AIBrainMemorySystem()

    # 1. Nạp tri thức ban đầu vào cơ sở dữ liệu vector
    brain.add_knowledge(
        "doc_1", 
        "Kiến trúc MCP (Model Context Protocol) cho phép các mô hình AI kết nối an toàn với cơ sở dữ liệu, công cụ lập trình và API bên ngoài qua chuẩn giao tiếp JSON-RPC.",
        {"category": "architecture"}
    )
    brain.add_knowledge(
        "doc_2", 
        "PostgreSQL kết hợp extension pgvector là giải pháp tối ưu để lưu trữ dữ liệu quan hệ kết hợp tìm kiếm vector similarity trên cùng một hạ tầng.",
        {"category": "database"}
    )
    brain.add_knowledge(
        "doc_3", 
        "Google Gemini API hỗ trợ mô hình text-embedding-004 tạo vector nhúng 768 chiều với chất lượng hàng đầu cho tác vụ RAG.",
        {"category": "ai_model"}
    )

    # 2. Thử nghiệm truy vấn thông minh với RAG
    query = "Làm thế nào để kết nối AI với cơ sở dữ liệu và công cụ ngoài?"
    print(f"\n🔍 Truy vấn người dùng: '{query}'")
    
    answer = brain.autonomous_reasoning(query)
    print(f"\n🤖 Phản hồi từ Bộ não AI:\n{answer}")
