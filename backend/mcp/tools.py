import os
import json
from typing import Dict, Any, List, Optional
from database import SessionLocal
from models import DocumentRecord, PersonalNote
from rag.sparse_store import query_sparse_store
from rag.vector_store import query_vector_store
from rag.embeddings import generate_embedding
from rag.document_parser import extract_text_from_file

def enforce_user_context(user_id: str):
    if not user_id:
        raise PermissionError("Access denied: missing user context.")

# ----------------- GENERAL MCP TOOLS -----------------

def search_documents(query: str, user_id: str, mode: str = "sparse", top_k: int = 5, api_key: str = None) -> List[Dict[str, Any]]:
    """Search personal or authorized documents using keywords or semantic search strictly in user namespace."""
    enforce_user_context(user_id)
    if mode == "semantic":
        emb = generate_embedding(query, api_key=api_key)
        return query_vector_store(user_id=user_id, query_vector=emb, top_k=top_k)
    else:
        return query_sparse_store(user_id=user_id, query=query, top_k=top_k)

def read_document(filename: str, user_id: str) -> str:
    """Retrieve the full text contents of a user's authorized document."""
    enforce_user_context(user_id)
    db = SessionLocal()
    try:
        record = db.query(DocumentRecord).filter(
            DocumentRecord.user_id == user_id,
            DocumentRecord.filename == filename
        ).first()
        if not record or not os.path.exists(record.file_path):
            return f"Error: Document '{filename}' not found for user {user_id}."
        return extract_text_from_file(record.file_path)
    finally:
        db.close()

def summarize_document(filename: str, user_id: str) -> str:
    """Generate a concise summary of a document."""
    enforce_user_context(user_id)
    content = read_document(filename, user_id)
    if content.startswith("Error:"):
        return content
    # Return first 2000 chars as context for the agent to summarize
    return f"Document Content for '{filename}':\n\n{content[:2500]}\n\n(Total length: {len(content)} chars)"

def ask_documents(question: str, user_id: str, mode: str = "sparse", api_key: str = None) -> List[Dict[str, Any]]:
    """Answer questions using RAG over the user's authorized documents."""
    enforce_user_context(user_id)
    return search_documents(query=question, user_id=user_id, mode=mode, top_k=5, api_key=api_key)

def compare_documents(filename1: str, filename2: str, user_id: str) -> Dict[str, Any]:
    """Compare two documents and return both text samples for side-by-side analysis."""
    enforce_user_context(user_id)
    doc1_text = read_document(filename1, user_id)
    doc2_text = read_document(filename2, user_id)
    return {
        "doc1": {"filename": filename1, "content": doc1_text[:2000]},
        "doc2": {"filename": filename2, "content": doc2_text[:2000]}
    }

def extract_key_information(filename: str, user_id: str) -> str:
    """Extract dates, names, responsibilities, deadlines, and other relevant fields."""
    enforce_user_context(user_id)
    content = read_document(filename, user_id)
    return f"Extract information from '{filename}':\n{content[:3000]}"

def create_document(title: str, content: str, user_id: str) -> str:
    """Draft a new document based on user instructions and save it to the user's workspace."""
    enforce_user_context(user_id)
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    user_docs_dir = os.path.join(base_dir, "uploads", user_id)
    os.makedirs(user_docs_dir, exist_ok=True)
    
    clean_title = f"{title}.txt" if not title.endswith(".txt") else title
    file_path = os.path.join(user_docs_dir, clean_title)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    db = SessionLocal()
    try:
        doc = DocumentRecord(
            user_id=user_id,
            filename=clean_title,
            file_type="txt",
            file_path=file_path,
            chunk_count=1
        )
        db.add(doc)
        db.commit()
    finally:
        db.close()
    return f"Document '{clean_title}' successfully created and saved in user workspace."

def rewrite_text(text: str, tone: str = "formal") -> str:
    """Rewrite content in a formal, concise, or professional tone."""
    return f"Target tone: {tone}\nOriginal text to rewrite:\n{text}"

def find_action_items(filename: str, user_id: str) -> str:
    """Extract tasks, responsible persons, and deadlines from documents."""
    enforce_user_context(user_id)
    content = read_document(filename, user_id)
    return f"Action items target text from '{filename}':\n{content[:2500]}"

def manage_personal_notes(action: str, user_id: str, title: str = "", content: str = "", note_id: Optional[int] = None) -> Any:
    """Create, retrieve, update, and delete the user's private notes."""
    enforce_user_context(user_id)
    db = SessionLocal()
    try:
        if action == "create":
            note = PersonalNote(user_id=user_id, title=title, content=content)
            db.add(note)
            db.commit()
            db.refresh(note)
            return {"status": "created", "id": note.id, "title": note.title}
        elif action == "list":
            notes = db.query(PersonalNote).filter(PersonalNote.user_id == user_id).all()
            return [{"id": n.id, "title": n.title, "content": n.content} for n in notes]
        elif action == "update":
            note = db.query(PersonalNote).filter(PersonalNote.user_id == user_id, PersonalNote.id == note_id).first()
            if note:
                if title: note.title = title
                if content: note.content = content
                db.commit()
                return {"status": "updated", "id": note.id}
            return {"error": "Note not found"}
        elif action == "delete":
            note = db.query(PersonalNote).filter(PersonalNote.user_id == user_id, PersonalNote.id == note_id).first()
            if note:
                db.delete(note)
                db.commit()
                return {"status": "deleted", "id": note_id}
            return {"error": "Note not found"}
        return {"error": f"Unknown action: {action}"}
    finally:
        db.close()

# ----------------- HR-SPECIFIC MCP TOOLS -----------------

def summarize_resume(filename: str, user_id: str) -> str:
    """Extract candidate skills, qualifications, experience, and project details from an authorized resume."""
    enforce_user_context(user_id)
    content = read_document(filename, user_id)
    return f"Resume content for '{filename}':\n{content[:3000]}"

def generate_interview_questions(role_title: str, required_skills: str, experience_level: str = "Mid-level") -> str:
    """Generate interview questions based on a job description and required skills."""
    return f"Role: {role_title}\nRequired Skills: {required_skills}\nExperience Level: {experience_level}"

def draft_hr_document(doc_type: str, candidate_name: str, details: str, user_id: str) -> str:
    """Draft offer letters, onboarding checklists, interview invitations, and policy announcements."""
    enforce_user_context(user_id)
    return f"Drafting {doc_type} for {candidate_name}.\nDetails: {details}"

def search_hr_policies(query: str, user_id: str, mode: str = "sparse", api_key: str = None) -> List[Dict[str, Any]]:
    """Answer questions about leave policies, attendance rules, benefits, and onboarding procedures using authorized HR documents."""
    enforce_user_context(user_id)
    return search_documents(query=f"HR policy {query}", user_id=user_id, mode=mode, top_k=4, api_key=api_key)

def create_interview_schedule(candidate_name: str, interviewer: str, time_slots: str, user_id: str) -> str:
    """Draft interview schedules and coordinate proposed time slots."""
    enforce_user_context(user_id)
    return f"Interview Schedule:\nCandidate: {candidate_name}\nInterviewer: {interviewer}\nSlots: {time_slots}"
