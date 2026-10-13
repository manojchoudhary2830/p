import asyncio
import copy
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.config import settings

logger = logging.getLogger("uvicorn.error")

# ─────────────────────────────────────────────────────────
# Fallback In-Memory Async Document Store
# Mimics Motor/MongoDB async collections for zero-setup execution
# ─────────────────────────────────────────────────────────

class AsyncCursor:
    def __init__(self, documents: List[Dict[str, Any]]):
        self.docs = copy.deepcopy(documents)
        self._index = 0

    def sort(self, key_or_list, direction=None):
        if isinstance(key_or_list, str):
            key = key_or_list
            reverse = direction == -1
        elif isinstance(key_or_list, list) and key_or_list:
            key, dir_val = key_or_list[0]
            reverse = dir_val == -1
        else:
            return self

        def sort_key(d):
            val = d.get(key, 0)
            return val if val is not None else 0

        self.docs.sort(key=sort_key, reverse=reverse)
        return self

    def limit(self, n: int):
        self.docs = self.docs[:n]
        return self

    def skip(self, n: int):
        self.docs = self.docs[n:]
        return self

    async def to_list(self, length: Optional[int] = None) -> List[Dict[str, Any]]:
        if length is not None:
            return self.docs[:length]
        return self.docs

    def __aiter__(self):
        self._index = 0
        return self

    async def __anext__(self):
        if self._index < len(self.docs):
            item = self.docs[self._index]
            self._index += 1
            return item
        raise StopAsyncIteration


class AsyncCollectionMock:
    def __init__(self, name: str, storage: Dict[str, Dict[str, Any]]):
        self.name = name
        self.storage = storage

    def _matches(self, doc: Dict[str, Any], query: Dict[str, Any]) -> bool:
        for k, v in query.items():
            if k == "$or" and isinstance(v, list):
                if not any(self._matches(doc, sub_q) for sub_q in v):
                    return False
                continue
            if k == "$and" and isinstance(v, list):
                if not all(self._matches(doc, sub_q) for sub_q in v):
                    return False
                continue

            doc_val = doc.get(k)
            if isinstance(v, dict):
                if "$regex" in v:
                    pattern = v["$regex"]
                    flags = re.IGNORECASE if v.get("$options") == "i" else 0
                    if not (isinstance(doc_val, str) and re.search(pattern, doc_val, flags)):
                        return False
                if "$in" in v:
                    if doc_val not in v["$in"]:
                        return False
                if "$nin" in v:
                    if doc_val in v["$nin"]:
                        return False
                if "$gte" in v and not (doc_val is not None and doc_val >= v["$gte"]):
                    return False
                if "$lte" in v and not (doc_val is not None and doc_val <= v["$lte"]):
                    return False
                if "$gt" in v and not (doc_val is not None and doc_val > v["$gt"]):
                    return False
                if "$lt" in v and not (doc_val is not None and doc_val < v["$lt"]):
                    return False
                if "$ne" in v and doc_val == v["$ne"]:
                    return False
            else:
                if doc_val != v:
                    return False
        return True

    async def find_one(self, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        for doc in self.storage.get(self.name, {}).values():
            if self._matches(doc, query):
                return copy.deepcopy(doc)
        return None

    def find(self, query: Optional[Dict[str, Any]] = None) -> AsyncCursor:
        query = query or {}
        matches = [
            doc for doc in self.storage.get(self.name, {}).values()
            if self._matches(doc, query)
        ]
        return AsyncCursor(matches)

    async def insert_one(self, doc: Dict[str, Any]):
        doc_copy = copy.deepcopy(doc)
        if "_id" not in doc_copy:
            doc_copy["_id"] = str(uuid.uuid4())
        elif isinstance(doc_copy["_id"], dict):
            doc_copy["_id"] = str(uuid.uuid4())

        if self.name not in self.storage:
            self.storage[self.name] = {}
        self.storage[self.name][str(doc_copy["_id"])] = doc_copy

        class InsertResult:
            inserted_id = doc_copy["_id"]
        return InsertResult()

    async def update_one(self, query: Dict[str, Any], update: Dict[str, Any]):
        matched = 0
        modified = 0
        target_id = None
        for doc_id, doc in self.storage.get(self.name, {}).items():
            if self._matches(doc, query):
                target_id = doc_id
                matched = 1
                break

        if target_id:
            doc = self.storage[self.name][target_id]
            if "$set" in update:
                doc.update(copy.deepcopy(update["$set"]))
                modified = 1
            if "$inc" in update:
                for inc_k, inc_v in update["$inc"].items():
                    doc[inc_k] = doc.get(inc_k, 0) + inc_v
                modified = 1
            if "$push" in update:
                for push_k, push_v in update["$push"].items():
                    doc.setdefault(push_k, []).append(push_v)
                modified = 1

        class UpdateResult:
            matched_count = matched
            modified_count = modified
        return UpdateResult()

    async def delete_one(self, query: Dict[str, Any]):
        deleted = 0
        for doc_id, doc in list(self.storage.get(self.name, {}).items()):
            if self._matches(doc, query):
                del self.storage[self.name][doc_id]
                deleted = 1
                break

        class DeleteResult:
            deleted_count = deleted
        return DeleteResult()

    async def count_documents(self, query: Optional[Dict[str, Any]] = None) -> int:
        query = query or {}
        return sum(
            1 for doc in self.storage.get(self.name, {}).values()
            if self._matches(doc, query)
        )


class MockDatabase:
    def __init__(self):
        self.storage: Dict[str, Dict[str, Any]] = {}

    def __getitem__(self, item: str) -> AsyncCollectionMock:
        return AsyncCollectionMock(item, self.storage)


# Global DB client & database references
db_client = None
db = None
is_mock_db = False

# ─────────────────────────────────────────────────────────
# Initial Seeding for Jaipur, Neemrana, Behror, Kotputli
# ─────────────────────────────────────────────────────────

INITIAL_PROPERTIES = [
    {
        "_id": "prop-jpr-01",
        "title": "Royal Heritage Luxury Boys & Girls PG",
        "city": "jaipur",
        "area": "Malviya Nagar / MNIT Road",
        "address": "B-42, Siddharth Nagar, Near MNIT Campus, Malviya Nagar, Jaipur, Rajasthan",
        "gender": "co-ed",
        "description": "Premium student & young professional PG directly adjacent to MNIT Jaipur and World Trade Park. Fully air-conditioned, high-speed 300 Mbps Wi-Fi, 3-tier vegetarian buffet, daily housekeeping, biometric access control, and 24/7 power backup.",
        "monthly_rent_start": 8500,
        "security_deposit": 10000,
        "token_deposit_fraction": 0.2,  # 20% token deposit
        "is_boosted": True,
        "boost_expiry": "2027-01-01T00:00:00Z",
        "rating": 4.9,
        "reviews_count": 86,
        "amenities": ["Air Conditioning", "High-Speed Wi-Fi", "3-Time Meals Included", "Power Backup", "Housekeeping", "Biometric Access", "RO Water", "Gym & Fitness Zone", "Washing Machine"],
        "cover_image": "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=80",
        "images": [
            "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80"
        ],
        "owner_id": "owner-manoj-01",
        "owner_name": "Manoj Sharma",
        "owner_phone": "+91 74259 69215",
        "owner_email": "manoj.portfolio.website@gmail.com",
        "rooms": [
            {
                "room_id": "room-101",
                "room_type": "Single Deluxe AC",
                "rent": 13500,
                "sharing": 1,
                "beds": [
                    {"bed_id": "bed-101-A", "status": "vacant", "code": "101-A", "locked_until": None}
                ]
            },
            {
                "room_id": "room-102",
                "room_type": "Double Sharing AC",
                "rent": 8500,
                "sharing": 2,
                "beds": [
                    {"bed_id": "bed-102-A", "status": "vacant", "code": "102-A", "locked_until": None},
                    {"bed_id": "bed-102-B", "status": "vacant", "code": "102-B", "locked_until": None}
                ]
            },
            {
                "room_id": "room-103",
                "room_type": "Triple Sharing Regular",
                "rent": 6500,
                "sharing": 3,
                "beds": [
                    {"bed_id": "bed-103-A", "status": "occupied", "code": "103-A", "locked_until": None},
                    {"bed_id": "bed-103-B", "status": "vacant", "code": "103-B", "locked_until": None},
                    {"bed_id": "bed-103-C", "status": "vacant", "code": "103-C", "locked_until": None}
                ]
            }
        ],
        "rules": ["Valid ID/College ID required", "Gate closes at 10:30 PM", "No smoking/alcohol inside premises", "Quiet study hours after 11 PM"],
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "_id": "prop-neem-01",
        "title": "Japanese Zone Executive PG & Hostel",
        "city": "neemrana",
        "area": "RIICO Japanese Industrial Zone",
        "address": "Plot 18-A, Near Daikin & Havells Industrial Park, Neemrana, Alwar District, Rajasthan",
        "gender": "male",
        "description": "Specifically tailored for engineers, managers, and executives working in Neemrana Japanese Industrial Zone and St. Margaret Engineering College. Peaceful environment, Japanese & North Indian cuisine options, laundry, ergonomic work desks.",
        "monthly_rent_start": 7500,
        "security_deposit": 8000,
        "token_deposit_fraction": 0.2,
        "is_boosted": True,
        "boost_expiry": "2027-01-01T00:00:00Z",
        "rating": 4.8,
        "reviews_count": 52,
        "amenities": ["Air Conditioning", "Wi-Fi (High Speed)", "Meals (Breakfast & Dinner)", "Power Backup 24/7", "Dedicated Study Desk", "RO Water", "Parking (Two & Four Wheeler)", "Daily Room Cleaning"],
        "cover_image": "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1200&q=80",
        "images": [
            "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1200&q=80",
            "https://images.unsplash.com/photo-1540518614846-7ede433c4b49?auto=format&fit=crop&w=1200&q=80"
        ],
        "owner_id": "owner-neem-01",
        "owner_name": "Rajesh Yadav",
        "owner_phone": "+91 94140 88765",
        "owner_email": "rajesh.neemrana.pg@gmail.com",
        "rooms": [
            {
                "room_id": "room-201",
                "room_type": "Single Executive AC",
                "rent": 11000,
                "sharing": 1,
                "beds": [
                    {"bed_id": "bed-201-A", "status": "vacant", "code": "201-A", "locked_until": None}
                ]
            },
            {
                "room_id": "room-202",
                "room_type": "Double Sharing AC",
                "rent": 7500,
                "sharing": 2,
                "beds": [
                    {"bed_id": "bed-202-A", "status": "vacant", "code": "202-A", "locked_until": None},
                    {"bed_id": "bed-202-B", "status": "vacant", "code": "202-B", "locked_until": None}
                ]
            }
        ],
        "rules": ["Corporate ID required", "Visitors allowed in lobby only", "Strict adherence to noise policies"],
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "_id": "prop-beh-01",
        "title": "Highway Residency Girls & Working Women PG",
        "city": "behror",
        "area": "NH-48 Corridor / Behror Central",
        "address": "Ward 12, Behind Government College, Main Behror, Rajasthan",
        "gender": "female",
        "description": "Safe, secure, and modern women's PG residence in the heart of Behror with 24/7 CCTV surveillance, female security guards, biometric entry, hygienic home-style food, and uninterrupted power backup.",
        "monthly_rent_start": 6000,
        "security_deposit": 7000,
        "token_deposit_fraction": 0.2,
        "is_boosted": False,
        "boost_expiry": None,
        "rating": 4.7,
        "reviews_count": 39,
        "amenities": ["CCTV & Biometric Entry", "Pure Veg Home Food", "Wi-Fi", "Air Cooler & AC Options", "Washing Machine", "Power Backup", "Geyser in Bathroom"],
        "cover_image": "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80",
        "images": [
            "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80"
        ],
        "owner_id": "owner-beh-01",
        "owner_name": "Sunita Choudhary",
        "owner_phone": "+91 94142 33445",
        "owner_email": "sunita.behrorpg@gmail.com",
        "rooms": [
            {
                "room_id": "room-301",
                "room_type": "Double Sharing AC",
                "rent": 7000,
                "sharing": 2,
                "beds": [
                    {"bed_id": "bed-301-A", "status": "vacant", "code": "301-A", "locked_until": None},
                    {"bed_id": "bed-301-B", "status": "vacant", "code": "301-B", "locked_until": None}
                ]
            },
            {
                "room_id": "room-302",
                "room_type": "Triple Sharing Cooler",
                "rent": 5500,
                "sharing": 3,
                "beds": [
                    {"bed_id": "bed-302-A", "status": "vacant", "code": "302-A", "locked_until": None},
                    {"bed_id": "bed-302-B", "status": "vacant", "code": "302-B", "locked_until": None},
                    {"bed_id": "bed-302-C", "status": "vacant", "code": "302-C", "locked_until": None}
                ]
            }
        ],
        "rules": ["Females only", "Entry deadline: 9:00 PM", "Parental verification on admission"],
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "_id": "prop-kot-01",
        "title": "Sunrise Scholar Youth & Boys PG",
        "city": "kotputli",
        "area": "College Road / RIICO Industrial Area",
        "address": "Sector 4, Near LBS College, Kotputli, Jaipur Rural / NCR, Rajasthan",
        "gender": "male",
        "description": "Ideal PG for students of LBS College, coaching institutes, and professionals at Kotputli RIICO. High-speed optical fiber internet, spacious ventilated rooms, attached bathrooms, hygienic kitchen, and power backup.",
        "monthly_rent_start": 5500,
        "security_deposit": 6000,
        "token_deposit_fraction": 0.2,
        "is_boosted": True,
        "boost_expiry": "2027-01-01T00:00:00Z",
        "rating": 4.85,
        "reviews_count": 44,
        "amenities": ["Air Cooler / AC", "Wi-Fi (Fiber)", "Tiffin & Dinning Hall", "Power Backup", "RO Water", "Parking", "Library & Study Space"],
        "cover_image": "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1200&q=80",
        "images": [
            "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1200&q=80"
        ],
        "owner_id": "owner-kot-01",
        "owner_name": "Vikram Singh Gurjar",
        "owner_phone": "+91 97850 77123",
        "owner_email": "vikram.kotputlipg@gmail.com",
        "rooms": [
            {
                "room_id": "room-401",
                "room_type": "Double Sharing Standard",
                "rent": 5500,
                "sharing": 2,
                "beds": [
                    {"bed_id": "bed-401-A", "status": "vacant", "code": "401-A", "locked_until": None},
                    {"bed_id": "bed-401-B", "status": "vacant", "code": "401-B", "locked_until": None}
                ]
            },
            {
                "room_id": "room-402",
                "room_type": "Single AC Study Room",
                "rent": 9000,
                "sharing": 1,
                "beds": [
                    {"bed_id": "bed-402-A", "status": "vacant", "code": "402-A", "locked_until": None}
                ]
            }
        ],
        "rules": ["Valid student or employment ID", "No loud music during exam seasons"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
]

INITIAL_USERS = [
    {
        "_id": "user-demo-tenant",
        "email": "student@example.com",
        "password_hash": "$2b$12$52izrd/wnMBx2PyeoqME0e4pYOLzzHTAgU/1St7tGmw8Nb6SSC3F2", # "password123"
        "full_name": "Aman Verma",
        "phone": "+91 98765 43210",
        "role": "tenant",
        "created_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "_id": "user-demo-owner",
        "email": "manoj.portfolio.website@gmail.com",
        "password_hash": "$2b$12$52izrd/wnMBx2PyeoqME0e4pYOLzzHTAgU/1St7tGmw8Nb6SSC3F2", # "password123"
        "full_name": "Manoj Kumar",
        "phone": "+91 98290 12345",
        "role": "owner",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
]

async def seed_mock_data():
    global db
    if db is None:
        return
    # Check if properties already exist
    count = await db["properties"].count_documents({})
    if count == 0:
        logger.info("🌱 Seeding initial properties for Jaipur, Neemrana, Behror, Kotputli...")
        for p in INITIAL_PROPERTIES:
            await db["properties"].insert_one(p)

    u_count = await db["users"].count_documents({})
    if u_count == 0:
        logger.info("🌱 Seeding demo tenant and owner accounts...")
        for u in INITIAL_USERS:
            await db["users"].insert_one(u)

async def connect_to_database():
    global db_client, db, is_mock_db
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        client = AsyncIOMotorClient(settings.MONGO_URL, serverSelectionTimeoutMS=1500)
        # Test connection with ping
        await client.admin.command('ping')
        db_client = client
        db = client[settings.DB_NAME]
        is_mock_db = False
        logger.info(f"✅ Connected to real MongoDB at {settings.MONGO_URL}")
    except Exception as e:
        logger.warning(f"⚠️ Real MongoDB connection skipped ({e}). Falling back to in-memory async store.")
        db = MockDatabase()
        is_mock_db = True

    await seed_mock_data()

async def close_database():
    global db_client
    if db_client:
        db_client.close()
        logger.info("MongoDB client disconnected")

def get_database():
    return db
