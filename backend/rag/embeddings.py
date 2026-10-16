import os
from typing import List
from google import genai
from google.genai import types

EMBEDDING_CANDIDATES = ["gemini-embedding-001", "text-embedding-004", "embedding-001"]
EMBEDDING_MODEL = EMBEDDING_CANDIDATES[0]
EMBEDDING_DIMENSION = 768

def get_genai_client(api_key: str = None) -> genai.Client:
    key = api_key or os.getenv("GEMINI_API_KEY", "")
    if not key:
        raise ValueError("Google Gemini API Key is required for embeddings and LLM.")
    return genai.Client(api_key=key)

def generate_embedding(text: str, api_key: str = None) -> List[float]:
    """Generate a single embedding vector (strictly 768 dimensions) matching Pinecone serverless index."""
    client = get_genai_client(api_key)
    last_err = None
    for model_name in EMBEDDING_CANDIDATES:
        try:
            # Use output_dimensionality=768 for models supporting MRL (like gemini-embedding-001)
            cfg = types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIMENSION)
            response = client.models.embed_content(
                model=model_name,
                contents=text,
                config=cfg
            )
            if hasattr(response, "embeddings") and response.embeddings:
                values = response.embeddings[0].values
                return values[:EMBEDDING_DIMENSION]
            elif hasattr(response, "embedding"):
                values = response.embedding.values
                return values[:EMBEDDING_DIMENSION]
        except Exception as e:
            # Try without config if model doesn't support dimensionality param
            try:
                response = client.models.embed_content(
                    model=model_name,
                    contents=text
                )
                if hasattr(response, "embeddings") and response.embeddings:
                    values = response.embeddings[0].values
                    return values[:EMBEDDING_DIMENSION]
                elif hasattr(response, "embedding"):
                    values = response.embedding.values
                    return values[:EMBEDDING_DIMENSION]
            except Exception as inner_e:
                last_err = inner_e
                continue
    raise RuntimeError(f"Failed to retrieve embedding vector: {str(last_err)}")

def generate_embeddings_batch(texts: List[str], api_key: str = None) -> List[List[float]]:
    """Generate batch embeddings (strictly 768 dimensions) for a list of texts."""
    client = get_genai_client(api_key)
    vectors = []
    # Process in batches of 20 to avoid exceeding rate limits
    batch_size = 20
    for i in range(0, len(texts), batch_size):
        chunk_batch = texts[i:i + batch_size]
        try:
            cfg = types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIMENSION)
            response = client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=chunk_batch,
                config=cfg
            )
            if hasattr(response, "embeddings") and response.embeddings:
                for emb in response.embeddings:
                    vectors.append(emb.values[:EMBEDDING_DIMENSION])
            else:
                for t in chunk_batch:
                    vectors.append(generate_embedding(t, api_key))
        except Exception as e:
            # Fallback one-by-one
            for t in chunk_batch:
                vectors.append(generate_embedding(t, api_key))
    return vectors
