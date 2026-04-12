import asyncio
import os
import random
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
db = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_KEY'))

async def seed_contacts():
    # Insert 1722 dummy contacts
    contacts = []
    first_names = ["James", "Maria", "Robert", "Linda", "John", "Patricia", "Michael", "Barbara", "William", "Elizabeth"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"]
    USER_ID = "8f9bd918-48a2-7da2-2e4d-1de095ad5631"
    
    # Supabase allows bulk inserts up to ~1000 items easily, let's chunk to 500
    for i in range(1722):
        contacts.append({
            "first_name": f"{random.choice(first_names)}",
            "last_name": f"{random.choice(last_names)}_{i}",
            "email": f"dummy{i}@example.com",
            "phone": f"555-{str(i).zfill(4)}",
            "health_score": random.randint(30, 100),
            "is_favorite": random.choice([True, False, False, False])
        })
        
    print(f"Seeding {len(contacts)} contacts...")
    
    # Insert in chunks of 500
    chunk_size = 500
    for i in range(0, len(contacts), chunk_size):
        chunk = contacts[i:i + chunk_size]
        print(f"Inserting {i} to {i+chunk_size}...")
        response = db.table('contacts').insert(chunk).execute()
        
    print("Done!")

if __name__ == "__main__":
    asyncio.run(seed_contacts())
