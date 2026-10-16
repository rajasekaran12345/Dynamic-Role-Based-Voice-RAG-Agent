import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    role = Column(String(100), nullable=False)
    generated_user_id = Column(String(150), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    agent_config = relationship("AgentConfig", back_populates="user", uselist=False, cascade="all, delete-orphan")
    chat_history = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")
    personal_notes = relationship("PersonalNote", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("DocumentRecord", back_populates="user", cascade="all, delete-orphan")

class AgentConfig(Base):
    __tablename__ = "agent_config"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(150), ForeignKey("users.generated_user_id"), unique=True, nullable=False)
    system_prompt = Column(Text, nullable=True)
    selected_voice = Column(String(50), default="voice_1_male")  # voice_1_male or voice_2_female
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="agent_config")

class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(150), ForeignKey("users.generated_user_id"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="chat_history")

class PersonalNote(Base):
    __tablename__ = "personal_notes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(150), ForeignKey("users.generated_user_id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="personal_notes")

class DocumentRecord(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(150), ForeignKey("users.generated_user_id"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_path = Column(String(500), nullable=False)
    chunk_count = Column(Integer, default=0)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="documents")
