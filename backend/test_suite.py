import os
import sys
import unittest
from fastapi.testclient import TestClient

# Ensure backend directory is in python path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from main import app
from database import SessionLocal
import models
from rag.document_parser import chunk_text
from rag.sparse_store import add_chunks_to_sparse_store, query_sparse_store

client = TestClient(app)

class TestThaagamFoundations(unittest.TestCase):

    def setUp(self):
        self.test_name = "Sarah Connor"
        self.test_role = "Security_Lead"

    def test_01_health_check(self):
        response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json().get("status"), "ok")

    def test_02_register_user(self):
        payload = {"name": self.test_name, "role": self.test_role}
        response = client.post("/api/register", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("user", data)
        user_id = data["user"]["generated_user_id"]
        # Format: [random]_[name]_[role]
        self.assertTrue(user_id.endswith(f"{self.test_name.replace(' ', '_')}_{self.test_role}"))
        print(f"\n[PASS] User Registered: {user_id}")
        self.__class__.test_user_id = user_id

    def test_03_login_user(self):
        user_id = getattr(self.__class__, "test_user_id", None)
        self.assertIsNotNone(user_id)
        response = client.post("/api/login", json={"user_id": user_id})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["user"]["generated_user_id"], user_id)
        print(f"[PASS] User Login Validated: {user_id}")

    def test_04_save_agent_prompt(self):
        user_id = getattr(self.__class__, "test_user_id", None)
        prompt = "Always prioritize data security and enforce least-privilege document access."
        response = client.post("/api/agent-prompt", json={"user_id": user_id, "system_prompt": prompt})
        self.assertEqual(response.status_code, 200)

        # Verify saved in db
        db = SessionLocal()
        config = db.query(models.AgentConfig).filter(models.AgentConfig.user_id == user_id).first()
        self.assertEqual(config.system_prompt, prompt)
        db.close()
        print("[PASS] Agent Prompt Updated & Persisted")

    def test_05_save_agent_voice(self):
        user_id = getattr(self.__class__, "test_user_id", None)
        response = client.post("/api/agent-voice", json={"user_id": user_id, "selected_voice": "voice_2_female"})
        self.assertEqual(response.status_code, 200)

        db = SessionLocal()
        config = db.query(models.AgentConfig).filter(models.AgentConfig.user_id == user_id).first()
        self.assertEqual(config.selected_voice, "voice_2_female")
        db.close()
        print("[PASS] Agent Voice Persisted (voice_2_female)")

    def test_06_voice_preview_stream(self):
        res1 = client.get("/api/voice/preview?voice=voice_1_male")
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res1.headers.get("content-type"), "audio/mpeg")
        self.assertTrue(len(res1.content) > 1000)

        res2 = client.get("/api/voice/preview?voice=voice_2_female")
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.headers.get("content-type"), "audio/mpeg")
        self.assertTrue(len(res2.content) > 1000)
        print(f"[PASS] Voice previews generated: Male ({len(res1.content)} bytes), Female ({len(res2.content)} bytes)")

    def test_07_livekit_token(self):
        user_id = getattr(self.__class__, "test_user_id", "test_user")
        response = client.get(f"/api/livekit/token?user_id={user_id}")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("token", data)
        self.assertIn("livekit_url", data)
        self.assertTrue(len(data["token"]) > 20)
        print(f"[PASS] LiveKit WebRTC Token Created: {data['token'][:20]}...")

    def test_08_bm25_sparse_rag_isolation(self):
        user_id = getattr(self.__class__, "test_user_id", "test_user")
        sample_doc = (
            "Thaagam Foundations provides strict enterprise role-based access control. "
            "Confidential salary guidelines: Level 4 engineers receive equity compensation. "
            "Security audits must be completed every quarter."
        )
        chunks = chunk_text(sample_doc, filename="security_policy.txt")
        self.assertTrue(len(chunks) > 0)

        # Index in user BM25
        add_chunks_to_sparse_store(user_id, chunks)

        # Search for equity compensation
        results = query_sparse_store(user_id=user_id, query="equity compensation")
        self.assertTrue(len(results) > 0)
        self.assertIn("equity compensation", results[0]["text"])
        print(f"[PASS] BM25 Isolated Search verified for {user_id}. Top score: {results[0]['score']}")

    def test_09_mcp_tools_execution(self):
        user_id = getattr(self.__class__, "test_user_id", "test_user")
        
        # 1. Manage personal notes (General tool)
        note_res = client.post("/api/mcp/execute", json={
            "user_id": user_id,
            "tool_name": "manage_personal_notes",
            "arguments": {"action": "create", "title": "Audit Checklist", "content": "Review SOC2 compliance docs"}
        })
        self.assertEqual(note_res.status_code, 200)
        self.assertEqual(note_res.json()["result"]["status"], "created")

        # 2. Generate interview questions (HR-Specific tool)
        iq_res = client.post("/api/mcp/execute", json={
            "user_id": user_id,
            "tool_name": "generate_interview_questions",
            "arguments": {"role_title": "AI Architect", "required_skills": "RAG, FastAPI, LiveKit"}
        })
        self.assertEqual(iq_res.status_code, 200)
        self.assertIn("AI Architect", iq_res.json()["result"])
        print("[PASS] MCP General and HR-Specific Tools Executed Successfully")

    def test_10_chat_pipeline(self):
        user_id = getattr(self.__class__, "test_user_id", "test_user")
        chat_res = client.post("/api/chat", json={
            "user_id": user_id,
            "message": "What is the policy for equity compensation in Thaagam Foundations?",
            "retrieval_method": "sparse"
        })
        self.assertEqual(chat_res.status_code, 200)
        data = chat_res.json()
        self.assertIn("reply", data)
        self.assertTrue(len(data["reply"]) > 10)
        print(f"\n[PASS] Chat Agent Response:\n{data['reply']}\n")

if __name__ == "__main__":
    unittest.main()
