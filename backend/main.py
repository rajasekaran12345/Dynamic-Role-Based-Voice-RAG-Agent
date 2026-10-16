import os
import random
import re
import shutil
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import io

DOTENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(DOTENV_PATH)
load_dotenv()

from database import engine, Base, get_db
import models
from rag.document_parser import extract_text_from_file, chunk_text
from rag.embeddings import generate_embedding, generate_embeddings_batch
from rag.vector_store import upsert_document_chunks, query_vector_store, delete_document_vectors
from rag.sparse_store import add_chunks_to_sparse_store, query_sparse_store, remove_document_from_sparse_store
from voice.livekit_service import (
    generate_livekit_token,
    synthesize_speech,
    transcribe_audio_livekit,
    LIVEKIT_URL,
    LIVEKIT_API_KEY
)
import mcp.tools as mcp_tools

# Create SQLite database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Thaagam Foundations - Role-Based AI Agent",
    description="Role-Based AI Agent for Secure Document Intelligence with Multi-Tenant RAG, Voice, and MCP Tools",
    version="1.0.0"
)

# Enable CORS for React frontend (Vite & Next.js standard dev ports)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "status": "online",
        "app": "Thaagam Foundations - Role-Based AI Agent",
        "creator": "Rajasekaran M",
        "version": "1.0.0"
    }

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

# ----------------- PYDANTIC SCHEMAS -----------------

class RegisterRequest(BaseModel):
    name: str
    role: str

class LoginRequest(BaseModel):
    user_id: str

class AgentPromptRequest(BaseModel):
    user_id: str
    system_prompt: str

class AgentVoiceRequest(BaseModel):
    user_id: str
    selected_voice: str

class ChatRequest(BaseModel):
    user_id: str
    message: str
    retrieval_method: str = "sparse"  # "sparse" or "semantic"
    api_key: Optional[str] = None
    generate_audio: Optional[bool] = False

class MCPExecuteRequest(BaseModel):
    user_id: str
    tool_name: str
    arguments: dict
    api_key: Optional[str] = None

# ----------------- AUTH & USER ENDPOINTS -----------------

@app.post("/api/register")
def register_user(req: RegisterRequest, db: Session = Depends(get_db)):
    """
    Step 2 Register Flow:
    Takes Name and Role, concatenates randomized number + name + role
    to produce unique user_id (e.g., 8573_John_HR)
    """
    name_clean = re.sub(r"[^\w]", "", req.name.strip().replace(" ", "_"))
    role_clean = re.sub(r"[^\w]", "", req.role.strip().replace(" ", "_"))
    if not name_clean or not role_clean:
        raise HTTPException(status_code=400, detail="Name and Role cannot be empty.")

    # Generate 4-digit random number
    random_num = random.randint(1000, 9999)
    generated_id = f"{random_num}_{name_clean}_{role_clean}"

    # Ensure uniqueness in db
    while db.query(models.User).filter(models.User.generated_user_id == generated_id).first():
        random_num = random.randint(1000, 9999)
        generated_id = f"{random_num}_{name_clean}_{role_clean}"

    new_user = models.User(
        name=req.name.strip(),
        role=req.role.strip(),
        generated_user_id=generated_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Initialize default agent config
    default_config = models.AgentConfig(
        user_id=generated_id,
        system_prompt=f"You are a dedicated AI assistant for {new_user.name}, who is an authorized {new_user.role}. "
                      f"Maintain strict security and assist only using the authorized documents and functions.",
        selected_voice="voice_1_male"
    )
    db.add(default_config)
    db.commit()

    return {
        "status": "success",
        "user": {
            "id": new_user.id,
            "name": new_user.name,
            "role": new_user.role,
            "generated_user_id": new_user.generated_user_id
        }
    }

@app.post("/api/login")
def login_user(req: LoginRequest, db: Session = Depends(get_db)):
    """
    Step 2 Login Flow:
    Takes user_id, validates against SQLite database.
    """
    user = db.query(models.User).filter(models.User.generated_user_id == req.user_id.strip()).first()
    if not user:
        raise HTTPException(status_code=404, detail="Invalid User ID. User does not exist.")

    config = db.query(models.AgentConfig).filter(models.AgentConfig.user_id == user.generated_user_id).first()

    return {
        "status": "success",
        "user": {
            "id": user.id,
            "name": user.name,
            "role": user.role,
            "generated_user_id": user.generated_user_id
        },
        "config": {
            "system_prompt": config.system_prompt if config else "",
            "selected_voice": config.selected_voice if config else "voice_1_male"
        }
    }

# ----------------- AGENT CONFIG ENDPOINTS -----------------

@app.post("/api/agent-prompt")
def set_agent_prompt(req: AgentPromptRequest, db: Session = Depends(get_db)):
    """Step 3 Dynamic Agent Onboarding: Save dynamic prompt"""
    config = db.query(models.AgentConfig).filter(models.AgentConfig.user_id == req.user_id).first()
    if not config:
        config = models.AgentConfig(user_id=req.user_id, system_prompt=req.system_prompt)
        db.add(config)
    else:
        config.system_prompt = req.system_prompt
    db.commit()
    return {"status": "success", "message": "Agent instructions saved successfully."}

@app.post("/api/agent-voice")
def set_agent_voice(req: AgentVoiceRequest, db: Session = Depends(get_db)):
    """Step 3 Voice Selection: Save choice (voice_1_male or voice_2_female)"""
    config = db.query(models.AgentConfig).filter(models.AgentConfig.user_id == req.user_id).first()
    if not config:
        config = models.AgentConfig(user_id=req.user_id, selected_voice=req.selected_voice)
        db.add(config)
    else:
        config.selected_voice = req.selected_voice
    db.commit()
    return {"status": "success", "message": "Agent voice updated successfully."}

@app.get("/api/agent-config/{user_id}")
def get_agent_config(user_id: str, db: Session = Depends(get_db)):
    config = db.query(models.AgentConfig).filter(models.AgentConfig.user_id == user_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Agent config not found")
    return {
        "user_id": config.user_id,
        "system_prompt": config.system_prompt,
        "selected_voice": config.selected_voice
    }

# ----------------- LIVEKIT & VOICE ENDPOINTS -----------------

@app.get("/api/voice/preview")
def get_voice_preview(voice: str = Query(default="voice_1_male")):
    """
    Streams a voice preview for Voice 1 (Male) or Voice 2 (Female).
    Allows user to play preview audio in UI.
    """
    if "jacqueline" in voice.lower() or "female" in voice.lower() or voice == "voice_2_female":
        sample_text = "Hi there! I am Jacqueline, your female intelligence assistant for Thaagam Foundations, created by Rajasekaran M. I am delighted to help you analyze your documents today!"
    else:
        sample_text = "Hello, I am Blake, your male executive intelligence assistant for Thaagam Foundations, created by Rajasekaran M. Ready to analyze your authorized files."

    audio_bytes = synthesize_speech(sample_text, voice_type=voice)
    return Response(
        content=audio_bytes, 
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

@app.api_route("/api/voice/tts", methods=["GET", "POST"])
def tts_stream(text: str = Query(default=None), voice: str = Query(default="voice_1_male")):
    """Converts dynamic LLM response text into MP3 voice stream (supports GET audio streaming and POST)."""
    if not text:
        text = "Hello from Thaagam Foundations, done by Rajasekaran M."
    audio_bytes = synthesize_speech(text, voice_type=voice)
    return Response(
        content=audio_bytes, 
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

@app.get("/api/livekit/token")
def get_livekit_token(user_id: str = Query(...), room: Optional[str] = None):
    """Generates a LiveKit WebRTC room token for the user."""
    room_name = room or f"room_{user_id}"
    token = generate_livekit_token(
        room_name=room_name,
        participant_identity=user_id,
        participant_name=user_id
    )
    return {
        "livekit_url": LIVEKIT_URL,
        "token": token,
        "room": room_name
    }

@app.post("/api/voice/stt")
async def speech_to_text_endpoint(
    audio: UploadFile = File(...),
    language: str = Form(default="en")
):
    """
    Receives voice audio from frontend and converts it to text using LiveKit inference STT
    (model: deepgram/nova-3) to populate the search bar in the chat UI.
    """
    ext = os.path.splitext(audio.filename or "")[1] or ".webm"
    temp_dir = os.path.join(BASE_DIR, "temp_audio")
    os.makedirs(temp_dir, exist_ok=True)
    temp_file_path = os.path.join(temp_dir, f"stt_{os.getpid()}_{random.randint(1000, 9999)}{ext}")

    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(audio.file, buffer)

        transcribed_text = await transcribe_audio_livekit(temp_file_path, language=language)
        return {
            "status": "success",
            "text": transcribed_text,
            "model": "deepgram/nova-3"
        }
    except Exception as e:
        print(f"LiveKit STT inference error: {e}")
        raise HTTPException(status_code=500, detail=f"Speech-to-text inference failed: {e}")
    finally:
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass

# ----------------- DOCUMENT PROCESSING & RAG -----------------

@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    retrieval_method: str = Form(default="sparse"),
    api_key: Optional[str] = Form(default=None),
    db: Session = Depends(get_db)
):
    """
    Step 5: Upload document, chunk text, index in Pinecone (Semantic) or local BM25 (Sparse).
    Strict multi-tenant isolation enforced by user_id namespace.
    """
    user_upload_dir = os.path.join(UPLOADS_DIR, user_id)
    os.makedirs(user_upload_dir, exist_ok=True)
    file_path = os.path.join(user_upload_dir, file.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Extract text from supported formats
    raw_text = extract_text_from_file(file_path)
    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="Uploaded file contains no readable text.")

    # Chunk the document
    chunks = chunk_text(raw_text, filename=file.filename)
    if not chunks:
        raise HTTPException(status_code=400, detail="Could not create chunks from file.")

    # 1. ALWAYS add to local BM25 sparse store for high-speed keyword search
    add_chunks_to_sparse_store(user_id, chunks)

    # 2. Always index into Pinecone Serverless (768 dimensions) if PINECONE_API_KEY is configured
    pinecone_indexed = False
    try:
        texts = [c["text"] for c in chunks]
        embeddings = generate_embeddings_batch(texts, api_key=api_key)
        upsert_document_chunks(user_id=user_id, chunks=chunks, embeddings=embeddings)
        pinecone_indexed = True
        print(f"Successfully indexed {len(chunks)} chunks into Pinecone namespace '{user_id}'")
    except Exception as e:
        print(f"Pinecone indexing notice: {e}")
        pinecone_indexed = False

    # Save document record in SQLite
    file_ext = os.path.splitext(file.filename)[1].replace(".", "")
    doc_record = models.DocumentRecord(
        user_id=user_id,
        filename=file.filename,
        file_type=file_ext,
        file_path=file_path,
        chunk_count=len(chunks)
    )
    db.add(doc_record)
    db.commit()
    db.refresh(doc_record)

    return {
        "status": "success",
        "filename": file.filename,
        "chunks_indexed": len(chunks),
        "pinecone_semantic": pinecone_indexed,
        "bm25_sparse": True
    }

@app.get("/api/documents/{user_id}")
def list_documents(user_id: str, db: Session = Depends(get_db)):
    docs = db.query(models.DocumentRecord).filter(models.DocumentRecord.user_id == user_id).all()
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "file_type": d.file_type,
            "chunk_count": d.chunk_count,
            "uploaded_at": d.uploaded_at.isoformat()
        }
        for d in docs
    ]

@app.delete("/api/documents/{doc_id}")
def delete_document(
    doc_id: int,
    user_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db)
):
    """
    Deletes an uploaded document:
    1. Removes file on disk
    2. Purges indexed chunks from local BM25 store
    3. Deletes document vectors from Pinecone user namespace
    4. Deletes DocumentRecord row from SQLite
    """
    query = db.query(models.DocumentRecord).filter(models.DocumentRecord.id == doc_id)
    if user_id:
        query = query.filter(models.DocumentRecord.user_id == user_id)
    doc = query.first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found or unauthorized.")

    filename = doc.filename
    owner_user_id = doc.user_id
    file_path = doc.file_path

    # 1. Remove physical file from disk
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"Warning removing physical file: {e}")

    # 2. Remove indexed chunks from BM25 sparse store
    try:
        remove_document_from_sparse_store(owner_user_id, filename)
    except Exception as e:
        print(f"Warning removing from sparse store: {e}")

    # 3. Remove vectors from Pinecone
    try:
        delete_document_vectors(owner_user_id, filename)
    except Exception as e:
        print(f"Warning removing from Pinecone vector store: {e}")

    # 4. Remove record from database
    db.delete(doc)
    db.commit()

    return {
        "status": "success",
        "message": f"Document '{filename}' deleted successfully.",
        "deleted_id": doc_id
    }

# ----------------- CHAT & RAG QUERY PIPELINE -----------------

@app.post("/api/chat")
@app.post("/api/chat/message")
def chat_pipeline(req: ChatRequest, db: Session = Depends(get_db)):
    """
    Step 6: Chat endpoint using Gemini LLM, strict context retrieval, and user_id enforcement.
    """
    user = db.query(models.User).filter(models.User.generated_user_id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    config = db.query(models.AgentConfig).filter(models.AgentConfig.user_id == req.user_id).first()
    system_prompt = config.system_prompt if config and config.system_prompt else (
        f"You are an AI Agent for {user.name} ({user.role}) at Thaagam Foundations. "
        "Provide accurate, secure document intelligence based strictly on authorized user documents."
    )

    # Retrieval based on user selection
    retrieved_chunks = []
    used_method = req.retrieval_method
    if req.retrieval_method == "semantic":
        try:
            emb = generate_embedding(req.message, api_key=req.api_key)
            retrieved_chunks = query_vector_store(user_id=req.user_id, query_vector=emb, top_k=5)
            print(f"[Pinecone Semantic RAG] Retrieved {len(retrieved_chunks)} vectors for namespace '{req.user_id}'")
        except Exception as e:
            print(f"[Pinecone Semantic Error, fallback to sparse]: {e}")
            retrieved_chunks = query_sparse_store(user_id=req.user_id, query=req.message, top_k=5)
            used_method = "sparse (fallback)"
    else:
        retrieved_chunks = query_sparse_store(user_id=req.user_id, query=req.message, top_k=5)
        print(f"[BM25 Sparse RAG] Retrieved {len(retrieved_chunks)} documents for '{req.user_id}'")

    # Build context string
    context_text = ""
    if retrieved_chunks:
        context_parts = []
        for i, c in enumerate(retrieved_chunks):
            context_parts.append(f"[Source {i+1}: {c.get('filename')}]\n{c.get('text')}")
        context_text = "\n\n".join(context_parts)
    else:
        context_text = "No specific document context found for this query in user's workspace."

    # Gemini LLM generation
    gemini_key = req.api_key or os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        raise HTTPException(status_code=400, detail="Gemini API Key is required. Please paste it in the right sidebar.")

    from google import genai
    from google.genai import types
    client = genai.Client(api_key=gemini_key)

    system_instruction_text = (
        f"You are the dedicated role-based AI document intelligence agent for Thaagam Foundations.\n"
        f"User: {user.name}\n"
        f"Role: {user.role}\n"
        f"User ID: {user.generated_user_id}\n\n"
        f"CUSTOM AGENT INSTRUCTIONS:\n{system_prompt}\n\n"
        f"AUTHORIZED TENANT DOCUMENT CONTEXT:\n{context_text}\n\n"
        f"DIRECTIVE: Answer clearly and accurately based strictly on the authorized document context and your role."
    )

    candidate_models = [
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.8-flash"
    ]
    assistant_reply = None
    last_error = None

    for model_name in candidate_models:
        for attempt in range(2):
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=req.message,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction_text
                    )
                )
                if response and response.text:
                    assistant_reply = response.text
                    break
                elif response:
                    assistant_reply = "I processed your request, but received an empty response."
                    break
            except Exception as e:
                last_error = e
                if "503" in str(e):
                    import time
                    time.sleep(1.0)
                    continue
                else:
                    break
        if assistant_reply:
            break

    if assistant_reply is None:
        err_msg = str(last_error)
        if "401" in err_msg or "UNAUTHENTICATED" in err_msg or "ACCESS_TOKEN_TYPE_UNSUPPORTED" in err_msg:
            assistant_reply = (
                "⚠️ **Invalid Gemini API Key**: The provided key was rejected by Google AI Studio (401 UNAUTHENTICATED).\n\n"
                "Please verify that you are using a valid Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey). "
                "Official Gemini API keys always start with `AIzaSy...` (39 characters).\n\n"
                "👉 Paste your `AIzaSy...` key into the **API key** box on the right sidebar and submit again!"
            )
        else:
            assistant_reply = f"Error generating response from Gemini: {err_msg}"

    # Save to chat history
    user_chat = models.ChatHistory(user_id=req.user_id, role="user", content=req.message)
    assistant_chat = models.ChatHistory(user_id=req.user_id, role="assistant", content=assistant_reply)
    db.add(user_chat)
    db.add(assistant_chat)
    db.commit()

    return {
        "reply": assistant_reply,
        "sources": [
            {"filename": c.get("filename"), "score": c.get("score"), "method": used_method}
            for c in retrieved_chunks
        ],
        "selected_voice": config.selected_voice if config else "voice_1_male",
        "retrieval_used": used_method
    }

@app.get("/api/chat/history/{user_id}")
def get_chat_history(user_id: str, db: Session = Depends(get_db)):
    chats = db.query(models.ChatHistory).filter(
        models.ChatHistory.user_id == user_id
    ).order_by(models.ChatHistory.timestamp.asc()).all()

    return [
        {
            "id": c.id,
            "role": c.role,
            "content": c.content,
            "timestamp": c.timestamp.isoformat()
        }
        for c in chats
    ]

# ----------------- MCP TOOLS EXECUTION -----------------

@app.post("/api/mcp/execute")
def execute_mcp_tool(req: MCPExecuteRequest):
    """
    Enforces user_id context across all 15 MCP general and HR-specific tools.
    """
    user_id = req.user_id
    tool_name = req.tool_name
    args = req.arguments or {}

    tool_registry = {
        "search_documents": lambda: mcp_tools.search_documents(
            query=args.get("query", ""),
            user_id=user_id,
            mode=args.get("mode", "sparse"),
            api_key=req.api_key
        ),
        "read_document": lambda: mcp_tools.read_document(
            filename=args.get("filename", ""),
            user_id=user_id
        ),
        "summarize_document": lambda: mcp_tools.summarize_document(
            filename=args.get("filename", ""),
            user_id=user_id
        ),
        "ask_documents": lambda: mcp_tools.ask_documents(
            question=args.get("question", ""),
            user_id=user_id,
            mode=args.get("mode", "sparse"),
            api_key=req.api_key
        ),
        "compare_documents": lambda: mcp_tools.compare_documents(
            filename1=args.get("filename1", ""),
            filename2=args.get("filename2", ""),
            user_id=user_id
        ),
        "extract_key_information": lambda: mcp_tools.extract_key_information(
            filename=args.get("filename", ""),
            user_id=user_id
        ),
        "create_document": lambda: mcp_tools.create_document(
            title=args.get("title", "Untitled"),
            content=args.get("content", ""),
            user_id=user_id
        ),
        "rewrite_text": lambda: mcp_tools.rewrite_text(
            text=args.get("text", ""),
            tone=args.get("tone", "formal")
        ),
        "find_action_items": lambda: mcp_tools.find_action_items(
            filename=args.get("filename", ""),
            user_id=user_id
        ),
        "manage_personal_notes": lambda: mcp_tools.manage_personal_notes(
            action=args.get("action", "list"),
            user_id=user_id,
            title=args.get("title", ""),
            content=args.get("content", ""),
            note_id=args.get("note_id")
        ),
        # HR Specific Tools
        "summarize_resume": lambda: mcp_tools.summarize_resume(
            filename=args.get("filename", ""),
            user_id=user_id
        ),
        "generate_interview_questions": lambda: mcp_tools.generate_interview_questions(
            role_title=args.get("role_title", "Software Engineer"),
            required_skills=args.get("required_skills", "General"),
            experience_level=args.get("experience_level", "Mid-level")
        ),
        "draft_hr_document": lambda: mcp_tools.draft_hr_document(
            doc_type=args.get("doc_type", "Offer Letter"),
            candidate_name=args.get("candidate_name", ""),
            details=args.get("details", ""),
            user_id=user_id
        ),
        "search_hr_policies": lambda: mcp_tools.search_hr_policies(
            query=args.get("query", ""),
            user_id=user_id,
            mode=args.get("mode", "sparse"),
            api_key=req.api_key
        ),
        "create_interview_schedule": lambda: mcp_tools.create_interview_schedule(
            candidate_name=args.get("candidate_name", ""),
            interviewer=args.get("interviewer", ""),
            time_slots=args.get("time_slots", ""),
            user_id=user_id
        )
    }

    if tool_name not in tool_registry:
        raise HTTPException(status_code=400, detail=f"Tool '{tool_name}' not found.")

    try:
        result = tool_registry[tool_name]()
        return {"status": "success", "tool": tool_name, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tool execution failed: {str(e)}")

@app.get("/health")
def health_check():
    return {"status": "ok", "app": "Thaagam Foundations Role-Based AI Agent"}
