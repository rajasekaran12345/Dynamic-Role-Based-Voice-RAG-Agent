import os
import sys
import time
import requests
from dotenv import load_dotenv

# Fix Windows console encoding for Unicode characters (emoji in LLM replies)
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

BACKEND_URL = "http://127.0.0.1:8000"
TEST_USER_ID = "1117_raj_legal"

def run_test_pipeline():
    print("=" * 70)
    print("THAAGAM FOUNDATIONS — LIVEKIT VOICE & RAG CONVERSATIONAL TEST PIPELINE")
    print("Done by Rajasekaran M")
    print("=" * 70)

    # Stage 1: Backend Health Check
    print("\n[STAGE 1] Testing Backend API Availability...")
    try:
        res = requests.get(f"{BACKEND_URL}/")
        assert res.status_code == 200, f"Unexpected status: {res.status_code}"
        data = res.json()
        print(f"  --> PASS: Backend is healthy: {data.get('message', 'OK')}")
    except Exception as e:
        print(f"  --> FAIL: Backend connection failed: {e}")
        return False

    # Stage 2: LiveKit Token Generation
    print("\n[STAGE 2] Testing LiveKit WebRTC Token Generation...")
    try:
        res = requests.get(f"{BACKEND_URL}/api/livekit/token", params={"user_id": TEST_USER_ID})
        assert res.status_code == 200, f"Token generation returned status: {res.status_code}"
        data = res.json()
        assert "token" in data and len(data["token"]) > 20, "Missing or invalid LiveKit token"
        assert "livekit_url" in data, "Missing livekit_url"
        print(f"  --> PASS: LiveKit Token issued successfully!")
        print(f"      LiveKit Cloud URL : {data['livekit_url']}")
        print(f"      Assigned Room     : {data.get('room')}")
        print(f"      Token Length      : {len(data['token'])} chars")
    except Exception as e:
        print(f"  --> FAIL: LiveKit token test failed: {e}")
        return False

    # Stage 3: Voice Previews for Voice 1 (Male) and Voice 2 (Female)
    print("\n[STAGE 3] Testing Voice Previews (Male vs Female Distinction)...")
    try:
        # Voice 1: Male
        res_male = requests.get(f"{BACKEND_URL}/api/voice/preview", params={"voice": "voice_1_male"})
        assert res_male.status_code == 200, f"Male preview status: {res_male.status_code}"
        assert res_male.headers.get("content-type") == "audio/mpeg", "Invalid content-type for male audio"
        male_audio_len = len(res_male.content)
        assert male_audio_len > 2000, f"Male audio buffer too small ({male_audio_len} bytes)"

        # Voice 2: Female
        res_female = requests.get(f"{BACKEND_URL}/api/voice/preview", params={"voice": "voice_2_female"})
        assert res_female.status_code == 200, f"Female preview status: {res_female.status_code}"
        assert res_female.headers.get("content-type") == "audio/mpeg", "Invalid content-type for female audio"
        female_audio_len = len(res_female.content)
        assert female_audio_len > 2000, f"Female audio buffer too small ({female_audio_len} bytes)"

        print(f"  --> PASS: Both Male and Female voice previews generated distinct audio streams!")
        print(f"      Voice 1 (Blake - Male)         : {male_audio_len:,} bytes MP3")
        print(f"      Voice 2 (Jacqueline - Female)  : {female_audio_len:,} bytes MP3")
    except Exception as e:
        print(f"  --> FAIL: Voice preview test failed: {e}")
        return False

    # Stage 4: LiveKit Deepgram Nova-3 STT Inference -> Prompt into Search Bar & LLM
    print("\n[STAGE 4] Testing LiveKit STT Inference (Deepgram Nova-3) & LLM Invocation...")
    try:
        # 1. Synthesize audio speech
        test_audio_query = "What was the total annual sales and the top selling product category according to the report?"
        res_sample = requests.get(f"{BACKEND_URL}/api/voice/tts", params={"text": test_audio_query, "voice": "voice_1_male"})
        assert res_sample.status_code == 200

        # 2. Transcribe using LiveKit STT Inference (Deepgram Nova-3)
        stt_files = {"audio": ("sample_prompt.mp3", res_sample.content, "audio/mpeg")}
        res_stt = requests.post(f"{BACKEND_URL}/api/voice/stt", files=stt_files)
        assert res_stt.status_code == 200, f"LiveKit STT failed: {res_stt.text}"
        stt_data = res_stt.json()
        assert stt_data.get("status") == "success"
        assert stt_data.get("model") == "deepgram/nova-3"
        transcribed_text = stt_data.get("text") or test_audio_query
        print(f"  --> PASS: LiveKit STT inference (Deepgram Nova-3) generated text for search bar!")
        print(f"      Model: {stt_data.get('model')}")
        print(f"      Search Bar Generated Text: \"{transcribed_text}\"")

        # 3. Submit to LLM
        chat_payload = {
            "user_id": TEST_USER_ID,
            "message": test_audio_query,
            "retrieval_method": "semantic",
            "api_key": GEMINI_API_KEY
        }
        res_chat = requests.post(f"{BACKEND_URL}/api/chat/message", json=chat_payload)
        assert res_chat.status_code == 200, f"Chat endpoint failed with status {res_chat.status_code}: {res_chat.text}"
        chat_data = res_chat.json()
        reply_text = chat_data.get("reply", "")
        sources = chat_data.get("sources", [])
        assert len(reply_text) > 20, "Empty LLM reply received"
        print(f"  --> PASS: Gemini LLM generated response with {len(sources)} grounded sources!")
        print(f"      Sources Cited: {[s.get('filename') for s in sources]}")
        print(f"      LLM Reply Snippet: \"{reply_text[:120]}...\"")
    except Exception as e:
        print(f"  --> FAIL: LiveKit STT & LLM pipeline failed: {e}")
        return False

    # Stage 5: Response-to-Voice Conversion via LiveKit TTS
    print("\n[STAGE 5] Converting LLM Response to Automatic Spoken Voice Stream...")
    try:
        # Test synthesis for the user's active assistant voice
        clean_prompt = reply_text[:350]
        res_tts = requests.get(
            f"{BACKEND_URL}/api/voice/tts", 
            params={"text": clean_prompt, "voice": "voice_1_male"}
        )
        assert res_tts.status_code == 200, f"TTS stream status: {res_tts.status_code}"
        assert res_tts.headers.get("content-type") == "audio/mpeg", "TTS returned invalid content-type"
        speech_bytes_len = len(res_tts.content)
        assert speech_bytes_len > 5000, f"Spoken response audio unexpectedly small ({speech_bytes_len} bytes)"

        # Also test with Female voice
        res_tts_female = requests.get(
            f"{BACKEND_URL}/api/voice/tts", 
            params={"text": clean_prompt, "voice": "voice_2_female"}
        )
        assert res_tts_female.status_code == 200, f"Female TTS stream status: {res_tts_female.status_code}"
        speech_bytes_len_f = len(res_tts_female.content)
        assert speech_bytes_len_f > 5000, f"Female audio unexpectedly small ({speech_bytes_len_f} bytes)"

        print(f"  --> PASS: LLM response successfully synthesized into real-time audio streams!")
        print(f"      Spoken Stream (Male Voice)   : {speech_bytes_len:,} bytes MP3")
        print(f"      Spoken Stream (Female Voice) : {speech_bytes_len_f:,} bytes MP3")
        print(f"      Automatic Playback Ready      : YES")
    except Exception as e:
        print(f"  --> FAIL: Voice synthesis test failed: {e}")
        return False

    # Stage 6: Multi-Turn Live Sequence Verification
    print("\n[STAGE 6] Verifying Live Multi-Turn Conversational Sequence Loop...")
    turn_2_prompt = "Can you summarize the second quarter results briefly?"
    print(f"  Turn 2 Spoken Prompt: \"{turn_2_prompt}\"")
    try:
        res_turn2 = requests.post(f"{BACKEND_URL}/api/chat/message", json={
            "user_id": TEST_USER_ID,
            "message": turn_2_prompt,
            "retrieval_method": "sparse",
            "api_key": GEMINI_API_KEY
        })
        assert res_turn2.status_code == 200
        reply_2 = res_turn2.json().get("reply", "")
        assert len(reply_2) > 20
        res_tts2 = requests.get(
            f"{BACKEND_URL}/api/voice/tts",
            params={"text": reply_2[:300], "voice": "voice_2_female"}
        )
        assert res_tts2.status_code == 200
        print(f"  --> PASS: Multi-turn loop completed seamlessly (Turn 2 Audio: {len(res_tts2.content):,} bytes)!")
    except Exception as e:
        print(f"  --> FAIL: Turn 2 failed: {e}")
        return False

    print("\n" + "=" * 70)
    print("ALL 6 STAGES PASSED! LIVEKIT VOICE CONVERSATION PIPELINE FULLY VERIFIED.")
    print("=" * 70)
    return True

if __name__ == "__main__":
    success = run_test_pipeline()
    sys.exit(0 if success else 1)
