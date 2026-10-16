import os
import json
import re
from typing import List, Dict, Any
from rank_bm25 import BM25Plus

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BM25_DIR = os.path.join(BASE_DIR, "bm25_indices")
os.makedirs(BM25_DIR, exist_ok=True)

def tokenize(text: str) -> List[str]:
    """Simple lowercase alphanumeric word tokenizer."""
    return re.findall(r"\w+", text.lower())

def get_user_bm25_file(user_id: str) -> str:
    safe_user_id = re.sub(r"[^\w\-]", "_", user_id)
    return os.path.join(BM25_DIR, f"{safe_user_id}_bm25.json")

def load_user_documents(user_id: str) -> List[Dict[str, Any]]:
    file_path = get_user_bm25_file(user_id)
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading BM25 data for {user_id}: {e}")
            return []
    return []

def save_user_documents(user_id: str, docs: List[Dict[str, Any]]):
    file_path = get_user_bm25_file(user_id)
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(docs, f, ensure_ascii=False, indent=2)

def add_chunks_to_sparse_store(user_id: str, new_chunks: List[Dict[str, Any]]):
    """Appends new chunks to the user's isolated local BM25 document store."""
    current_docs = load_user_documents(user_id)
    existing_ids = {d["chunk_id"] for d in current_docs if "chunk_id" in d}
    for chunk in new_chunks:
        if chunk["chunk_id"] not in existing_ids:
            current_docs.append(chunk)
            existing_ids.add(chunk["chunk_id"])
    save_user_documents(user_id, current_docs)

def remove_document_from_sparse_store(user_id: str, filename: str):
    """Removes all indexed chunks of a given document from the user's BM25 store."""
    current_docs = load_user_documents(user_id)
    remaining_docs = [d for d in current_docs if d.get("filename") != filename]
    save_user_documents(user_id, remaining_docs)

def query_sparse_store(user_id: str, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """Runs BM25Plus ranking strictly over the logged-in user's documents."""
    docs = load_user_documents(user_id)
    if not docs:
        return []

    tokenized_corpus = [tokenize(d.get("text", "")) for d in docs]
    valid_indices = [i for i, tokens in enumerate(tokenized_corpus) if len(tokens) > 0]
    if not valid_indices:
        return []

    valid_corpus = [tokenized_corpus[i] for i in valid_indices]
    valid_docs = [docs[i] for i in valid_indices]

    bm25 = BM25Plus(valid_corpus)
    tokenized_query = tokenize(query)
    
    if not tokenized_query:
        return valid_docs[:top_k]

    doc_scores = bm25.get_scores(tokenized_query)
    
    scored_results = []
    for idx, score in enumerate(doc_scores):
        # Check term overlap as well to ensure relevance
        overlap = set(tokenized_query).intersection(set(valid_corpus[idx]))
        if score > 0.0 or len(overlap) > 0:
            doc = valid_docs[idx]
            scored_results.append({
                "id": doc.get("chunk_id", f"bm25_{idx}"),
                "score": float(max(score, len(overlap) * 0.5)),
                "filename": doc.get("filename", "Unknown"),
                "text": doc.get("text", ""),
                "chunk_index": doc.get("chunk_index", 0)
            })

    scored_results.sort(key=lambda x: x["score"], reverse=True)
    return scored_results[:top_k]
