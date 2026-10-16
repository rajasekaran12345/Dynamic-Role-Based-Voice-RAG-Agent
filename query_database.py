import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from sqlalchemy import inspect
from database import engine, SessionLocal
import models

# 1. Inspect the database and get all table names
inspector = inspect(engine)
tables = inspector.get_table_names()
print(f"Tables in Database: {tables}\n")

# 2. Query all User records from the database
db = SessionLocal()
try:
    users = db.query(models.User).all()
    print(f"Total Users Registered: {len(users)}")
    print("-" * 60)
    for u in users:
        print(f"ID: {u.id} | Name: {u.name} | Role: {u.role} | Generated User ID: {u.generated_user_id}")
finally:
    db.close()