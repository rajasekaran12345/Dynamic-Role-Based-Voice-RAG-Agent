import os
from typing import List, Dict, Any, Optional
from pinecone import Pinecone, ServerlessSpec
from dotenv import load_dotenv

load_dotenv()

INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "thaagam-foundations-rag")

def get_pinecone_client(api_key: Optional[str] = None) -> Optional[Pinecone]:
    key = api_key or os.getenv("PINECONE_API_KEY", "")
    if not key or key.strip() == "":
        return None
    return Pinecone(api_key=key.strip())

def ensure_index_exists(pc: Pinecone, index_name: str = INDEX_NAME, dimension: int = 768):
    """Ensure the serverless pinecone index exists with 768 dimension and cosine metric."""
    existing_indexes = [idx.name for idx in pc.list_indexes()]
    if index_name not in existing_indexes:
        try:
            pc.create_index(
                name=index_name,
                dimension=dimension,
                metric="cosine",
                spec=ServerlessSpec(
                    cloud="aws",
                    region="us-east-1"
                )
            )
        except Exception as e:
            print(f"Notice during index creation: {e}")

def upsert_document_chunks(
    user_id: str,
    chunks: List[Dict[str, Any]],
    embeddings: List[List[float]],
    api_key: Optional[str] = None
) -> bool:
    """
    CRITICAL MULTI-TENANCY REQUIREMENT:
    All chunks for a user MUST be strictly stored in a Pinecone namespace matching generated_user_id.
    """
    pc = get_pinecone_client(api_key)
    if not pc:
        raise ValueError("PINECONE_API_KEY is not configured. Please supply your Pinecone API key.")

    index = pc.Index(INDEX_NAME)
    
    import re
    vectors_to_upsert = []
    for chunk, emb in zip(chunks, embeddings):
        raw_id = f"{user_id}#{chunk['chunk_id']}"
        ascii_id = re.sub(r"[^\x20-\x7E]", "_", raw_id)
        vectors_to_upsert.append({
            "id": ascii_id,
            "values": emb,
            "metadata": {
                "user_id": user_id,
                "filename": chunk["filename"],
                "chunk_index": chunk["chunk_index"],
                "text": chunk["text"]
            }
        })
    
    # Upsert in batches of 50
    batch_size = 50
    for i in range(0, len(vectors_to_upsert), batch_size):
        batch = vectors_to_upsert[i:i + batch_size]
        # Strict user_id namespace enforcement
        index.upsert(vectors=batch, namespace=user_id)
        
    return True

def query_vector_store(
    user_id: str,
    query_vector: List[float],
    top_k: int = 5,
    api_key: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    CRITICAL MULTI-TENANCY REQUIREMENT:
    All queries MUST strictly query only the user's isolated namespace.
    """
    pc = get_pinecone_client(api_key)
    if not pc:
        raise ValueError("PINECONE_API_KEY is not configured.")

    index = pc.Index(INDEX_NAME)
    
    # Strictly query user's namespace
    results = index.query(
        vector=query_vector,
        top_k=top_k,
        include_metadata=True,
        namespace=user_id
    )
    
    matched_chunks = []
    for match in results.get("matches", []):
        metadata = match.get("metadata", {})
        matched_chunks.append({
            "id": match.get("id"),
            "score": match.get("score"),
            "filename": metadata.get("filename", "Unknown"),
            "text": metadata.get("text", ""),
            "chunk_index": metadata.get("chunk_index", 0)
        })
        
    return matched_chunks

def delete_document_vectors(user_id: str, filename: str, api_key: Optional[str] = None) -> bool:
    """Deletes all vector embeddings of a given document within the user's Pinecone namespace."""
    try:
        pc = get_pinecone_client(api_key)
        if not pc:
            return False
        index = pc.Index(INDEX_NAME)
        index.delete(filter={"filename": {"$eq": filename}}, namespace=user_id)
        return True
    except Exception as e:
        print(f"Pinecone vector deletion notice: {e}")
        return False
