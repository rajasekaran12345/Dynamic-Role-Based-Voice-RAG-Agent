
import os
import io
import re
import asyncio
import requests
from typing import Optional
from dotenv import load_dotenv

# --------------------------------------------------
# 1. Environment configuration
# --------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOTENV_PATH = os.path.join(os.path.dirname(BASE_DIR), ".env")

load_dotenv(DOTENV_PATH)
load_dotenv()

LIVEKIT_URL = os.getenv("LIVEKIT_URL", "")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")
CARTESIA_API_KEY = os.getenv("CARTESIA_API_KEY", "")


# --------------------------------------------------
# 2. Cartesia Sonic-3 voice configuration
# --------------------------------------------------

CARTESIA_VOICE_IDS = {
    "voice_1_male": "a167e0f3-df7e-4d52-a9c3-f949145efdab",
    "blake": "a167e0f3-df7e-4d52-a9c3-f949145efdab",

    "voice_2_female": "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
    "jacqueline": "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
}

# Explicit aliases prevent "female" from being mistaken for "male".
VOICE_CONFIG = {
    "voice_1_male": {
        "voice_id": CARTESIA_VOICE_IDS["blake"],
        "edge_voice": "en-US-GuyNeural",
        "pitch": "-4Hz",
        "rate": "-4%",
    },
    "blake": {
        "voice_id": CARTESIA_VOICE_IDS["blake"],
        "edge_voice": "en-US-GuyNeural",
        "pitch": "-4Hz",
        "rate": "-4%",
    },
    "male": {
        "voice_id": CARTESIA_VOICE_IDS["blake"],
        "edge_voice": "en-US-GuyNeural",
        "pitch": "-4Hz",
        "rate": "-4%",
    },
    "voice_2_female": {
        "voice_id": CARTESIA_VOICE_IDS["jacqueline"],
        "edge_voice": "en-US-JennyNeural",
        "pitch": "+8Hz",
        "rate": "+3%",
    },
    "jacqueline": {
        "voice_id": CARTESIA_VOICE_IDS["jacqueline"],
        "edge_voice": "en-US-JennyNeural",
        "pitch": "+8Hz",
        "rate": "+3%",
    },
    "female": {
        "voice_id": CARTESIA_VOICE_IDS["jacqueline"],
        "edge_voice": "en-US-JennyNeural",
        "pitch": "+8Hz",
        "rate": "+3%",
    },
}


# --------------------------------------------------
# 3. Generate a LiveKit access token
# --------------------------------------------------

def generate_livekit_token(
    room_name: str,
    participant_identity: str,
    participant_name: str,
) -> str:
    """Generate a LiveKit JWT for joining an audio room."""

    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        raise RuntimeError(
            "Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET in .env"
        )

    try:
        from livekit import api

        token = api.AccessToken(
            api_key=LIVEKIT_API_KEY,
            api_secret=LIVEKIT_API_SECRET,
        )

        token.with_identity(participant_identity)
        token.with_name(participant_name)

        token.with_grants(
            api.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
            )
        )

        return token.to_jwt()

    except Exception as e:
        raise RuntimeError(
            f"Failed to generate LiveKit token: {e}"
        ) from e


# --------------------------------------------------
# 4. Cartesia Sonic-3 speech synthesis
# --------------------------------------------------

def _synthesize_cartesia(
    text: str,
    voice_id: str,
) -> Optional[bytes]:
    """Generate MP3 audio using the Cartesia Sonic-3 API."""

    if not CARTESIA_API_KEY:
        return None

    try:
        clean_text = re.sub(r"[*_#`\[\]()]", " ", text).strip()
        clean_text = clean_text[:600]

        if not clean_text:
            return None

        url = "https://api.cartesia.ai/tts/bytes"

        headers = {
            "X-API-Key": CARTESIA_API_KEY,
            "Cartesia-Version": "2024-06-10",
            "Content-Type": "application/json",
        }

        payload = {
            "model_id": "sonic-3",
            "transcript": clean_text,
            "voice": {
                "mode": "id",
                "id": voice_id,
            },
            "output_format": {
                "container": "mp3",
                "encoding": "mp3",
                "sample_rate": 44100,
            },
        }

        response = requests.post(
            url,
            json=payload,
            headers=headers,
            timeout=15,
        )

        if response.status_code == 200 and len(response.content) > 500:
            return response.content

        print(
            f"Cartesia API error: {response.status_code}: "
            f"{response.text[:300]}"
        )

    except Exception as e:
        print(f"Cartesia synthesis error: {e}")

    return None


# --------------------------------------------------
# 5. Edge TTS fallback
# --------------------------------------------------

async def _synthesize_edge_tts(
    text: str,
    voice_name: str,
    pitch: str = "+0Hz",
    rate: str = "+0%",
) -> bytes:
    """Generate speech using Microsoft Edge TTS."""

    import edge_tts

    clean_text = re.sub(r"[*_#`\[\]()]", " ", text).strip()
    clean_text = clean_text[:600]

    if not clean_text:
        clean_text = "Hello! Welcome to Thaagam Foundations."

    communicate = edge_tts.Communicate(
        clean_text,
        voice_name,
        pitch=pitch,
        rate=rate,
    )

    audio_buffer = bytearray()

    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_buffer.extend(chunk["data"])

    return bytes(audio_buffer)


# --------------------------------------------------
# 6. Emergency gTTS fallback
# --------------------------------------------------

def _synthesize_gtts(
    text: str,
    is_male: bool,
) -> bytes:
    """Last-resort speech synthesis using gTTS."""

    from gtts import gTTS

    clean_text = text[:300].strip()

    if not clean_text:
        clean_text = "Hello! Welcome to Thaagam Foundations."

    # gTTS does not provide selectable male/female voice identities.
    # The domain choice below does NOT guarantee a gendered voice.
    tts = gTTS(
        text=clean_text,
        lang="en",
        slow=False,
    )

    buffer = io.BytesIO()
    tts.write_to_fp(buffer)

    return buffer.getvalue()


# --------------------------------------------------
# 7. Main speech synthesis function
# --------------------------------------------------

def synthesize_speech(
    text: str,
    voice_type: str = "voice_1_male",
) -> bytes:
    """
    Supported voice_type values:
        voice_1_male / blake / male
        voice_2_female / jacqueline / female

    Priority:
        1. Cartesia Sonic-3 with the selected voice ID.
        2. Edge TTS with the matching fallback voice.
        3. gTTS as an emergency fallback.

    Returns audio bytes.
    """

    voice_type = voice_type.lower().strip()

    # Default to Blake for unknown voice names.
    config = VOICE_CONFIG.get(
        voice_type,
        VOICE_CONFIG["voice_1_male"],
    )

    is_male = voice_type in (
        "voice_1_male",
        "blake",
        "male",
    ) or voice_type not in VOICE_CONFIG

    # Step 1: Cartesia Sonic-3
    cartesia_audio = _synthesize_cartesia(
        text,
        config["voice_id"],
    )

    if cartesia_audio:
        print(f"Using Cartesia voice: {voice_type}")
        return cartesia_audio

    # Step 2: Edge TTS with the correct fallback voice
    try:
        loop = asyncio.new_event_loop()

        try:
            edge_audio = loop.run_until_complete(
                _synthesize_edge_tts(
                    text,
                    config["edge_voice"],
                    pitch=config["pitch"],
                    rate=config["rate"],
                )
            )

            if edge_audio and len(edge_audio) > 500:
                print(
                    f"Using Edge TTS fallback: "
                    f"{config['edge_voice']}"
                )
                return edge_audio

        finally:
            loop.close()

    except Exception as e:
        print(f"Edge TTS fallback error: {e}")

    # Step 3: Emergency gTTS fallback
    try:
        audio = _synthesize_gtts(text, is_male)

        if audio:
            print("Using gTTS emergency fallback")
            return audio

    except Exception as e:
        print(f"gTTS fallback error: {e}")

    return b""


# --------------------------------------------------
# 8. LiveKit Speech-to-Text (STT) inference
# --------------------------------------------------

import warnings
warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")

from livekit.agents import AgentSession, inference, utils
from livekit.agents.utils.audio import audio_frames_from_file

def get_livekit_stt_session(language: str = "en"):
    """
    Builds an AgentSession with LiveKit inference.STT (Deepgram Nova-3).
    Matches user-specified sample code:
    from livekit.agents import AgentSession, inference

    session = AgentSession(
        stt=inference.STT(
            model="deepgram/nova-3",
            language="en",
        ),
        # Add your LLM and TTS configuration here
    )
    """
    return AgentSession(
        stt=inference.STT(
            model="deepgram/nova-3",
            language=language,
        ),
    )

async def transcribe_audio_livekit(file_path: str, language: str = "en") -> str:
    """
    Transcribes recorded audio speech using LiveKit inference.STT (Deepgram Nova-3).
    Decodes audio frames and streams them through the LiveKit STT session.
    """
    async with utils.http_context.open():
        session = get_livekit_stt_session(language=language)
        stt_instance = session._stt
        stream = stt_instance.stream()

        async def _push_audio():
            try:
                async for frame in audio_frames_from_file(file_path):
                    stream.push_frame(frame)
                stream.end_input()
            except Exception as err:
                print(f"Error streaming audio frames to LiveKit STT: {err}")

        push_task = asyncio.create_task(_push_audio())
        recognized_text = ""

        try:
            async for event in stream:
                if event.alternatives:
                    for alt in event.alternatives:
                        if alt.text and alt.text.strip():
                            recognized_text = alt.text.strip()
        except Exception as e:
            print(f"Notice in LiveKit STT stream: {e}")

        await push_task
        await stream.aclose()
        return recognized_text


