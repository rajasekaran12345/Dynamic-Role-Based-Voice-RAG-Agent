import os
import sys

BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from dotenv import load_dotenv
load_dotenv(os.path.join(BACKEND_DIR, ".env"))

from pinecone import Pinecone
from rag.document_parser import extract_text_from_file, chunk_text
from rag.embeddings import generate_embeddings_batch
from rag.vector_store import upsert_document_chunks, query_vector_store

USER_ID = "1117_raj_legal"
UPLOADS_DIR = os.path.join(BACKEND_DIR, "uploads", USER_ID)

print(f"Syncing documents for user: {USER_ID}")
print(f"Uploads path: {UPLOADS_DIR}")

if not os.path.exists(UPLOADS_DIR):
    print("No uploads directory found.")
    sys.exit(1)

files = os.listdir(UPLOADS_DIR)
print(f"Found {len(files)} files: {files}")

total_chunks_synced = 0
for filename in files:
    file_path = os.path.join(UPLOADS_DIR, filename)
    if not os.path.isfile(file_path):
        continue

    print(f"\nProcessing '{filename}'...")
    text = extract_text_from_file(file_path)
    if not text.strip():
        print(f"  Skipping {filename}: empty text")
        continue

    chunks = chunk_text(text, filename=filename)
    print(f"  Extracted {len(chunks)} chunks.")

    texts = [c["text"] for c in chunks]
    print(f"  Generating 768-dim embeddings via Google GenAI...")
    embeddings = generate_embeddings_batch(texts)
    print(f"  Generated {len(embeddings)} vectors (dimension {len(embeddings[0])})")

    print(f"  Upserting vectors into Pinecone namespace '{USER_ID}'...")
    upsert_document_chunks(user_id=USER_ID, chunks=chunks, embeddings=embeddings)
    print(f"  [SUCCESS] '{filename}' indexed into Pinecone namespace '{USER_ID}'!")
    total_chunks_synced += len(chunks)

print(f"\nTotal chunks upserted to Pinecone: {total_chunks_synced}")

# Verify with Pinecone index stats
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index("thaagam-foundations-rag")
stats = index.describe_index_stats()
print("\n=== CURRENT PINECONE INDEX STATS ===")
print("Dimension:", stats.dimension)
print("Total Vectors:", stats.total_vector_count)
print("Namespaces:", stats.namespaces)
print("====================================")
