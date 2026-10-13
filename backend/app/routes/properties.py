import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.config import settings
from app.database import get_database
from app.utils.security import get_current_user, get_optional_user

router = APIRouter(prefix="/properties", tags=["Properties"])

class BedCreate(BaseModel):
    bed_id: Optional[str] = None
    code: str  # e.g., "101-A"
    status: str = "vacant"  # "vacant", "occupied", "locked"

class RoomCreate(BaseModel):
    room_id: Optional[str] = None
    room_type: str  # "Single Deluxe AC", "Double Sharing AC", etc.
    rent: float
    sharing: int
    beds: List[BedCreate]

class PropertyCreate(BaseModel):
    title: str
    city: str  # "jaipur", "neemrana", "behror", "kotputli"
    area: str
    address: str
    gender: str = "co-ed"  # "male", "female", "co-ed"
    description: str
    monthly_rent_start: float
    security_deposit: float
    token_deposit_fraction: float = 0.2
    amenities: List[str] = []
    cover_image: str
    images: List[str] = []
    rooms: List[RoomCreate]
    rules: List[str] = []

class PropertyUpdate(BaseModel):
    title: Optional[str] = None
    city: Optional[str] = None
    area: Optional[str] = None
    address: Optional[str] = None
    gender: Optional[str] = None
    description: Optional[str] = None
    monthly_rent_start: Optional[float] = None
    security_deposit: Optional[float] = None
    amenities: Optional[List[str]] = None
    cover_image: Optional[str] = None
    images: Optional[List[str]] = None
    rules: Optional[List[str]] = None


# ─────────────────────────────────────────────────────────
# Public Listing & Search with ReDoS Protection
# ─────────────────────────────────────────────────────────

@router.get("")
async def list_properties(
    city: Optional[str] = Query(None, description="City: jaipur, neemrana, behror, kotputli"),
    gender: Optional[str] = Query(None, description="male, female, co-ed"),
    min_rent: Optional[float] = Query(None),
    max_rent: Optional[float] = Query(None),
    sharing: Optional[int] = Query(None),
    amenity: Optional[List[str]] = Query(None),
    search: Optional[str] = Query(None, description="Free text search term"),
    is_boosted: Optional[bool] = Query(None),
    sort: Optional[str] = Query("recommended", description="recommended, price_asc, price_desc, rating"),
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
):
    db = get_database()
    query_filter: dict = {}

    # City filter
    if city:
        query_filter["city"] = city.strip().lower()

    # Gender filter
    if gender and gender.lower() != "all":
        query_filter["gender"] = gender.strip().lower()

    # Price range filter
    if min_rent is not None or max_rent is not None:
        rent_filter = {}
        if min_rent is not None:
            rent_filter["$gte"] = min_rent
        if max_rent is not None:
            rent_filter["$lte"] = max_rent
        query_filter["monthly_rent_start"] = rent_filter

    # Boosted filter
    if is_boosted is not None:
        query_filter["is_boosted"] = is_boosted

    # Free text search with ReDoS protection (p.md lines 92-100)
    if search and search.strip():
        # SECURITY FIX: re.escape ensures input characters like (.*)+ cannot cause catastrophic backtracking
        safe_search = re.escape(search.strip())
        regex_query = {"$regex": safe_search, "$options": "i"}
        query_filter["$or"] = [
            {"title": regex_query},
            {"area": regex_query},
            {"address": regex_query},
            {"description": regex_query},
            {"city": regex_query},
        ]

    cursor = db["properties"].find(query_filter)

    # Sorting
    if sort == "price_asc":
        cursor.sort("monthly_rent_start", 1)
    elif sort == "price_desc":
        cursor.sort("monthly_rent_start", -1)
    elif sort == "rating":
        cursor.sort("rating", -1)
    else:
        # Default: boosted properties first, then rating
        cursor.sort([("is_boosted", -1), ("rating", -1)])

    total_count = await db["properties"].count_documents(query_filter)
    properties = await cursor.skip(skip).limit(limit).to_list(limit)

    # Post-filtering for sharing or specific amenities if requested
    filtered = properties
    if sharing:
        filtered = [
            p for p in filtered
            if any(r.get("sharing") == sharing for r in p.get("rooms", []))
        ]
    if amenity:
        filtered = [
            p for p in filtered
            if all(a.lower() in [x.lower() for x in p.get("amenities", [])] for a in amenity)
        ]

    return {
        "total": total_count,
        "count": len(filtered),
        "limit": limit,
        "skip": skip,
        "properties": filtered,
    }


@router.get("/featured")
async def get_featured_properties():
    """Returns top boosted and highest-rated PG listings across Jaipur, Neemrana, Behror & Kotputli"""
    db = get_database()
    cursor = db["properties"].find({}).sort([("is_boosted", -1), ("rating", -1)]).limit(6)
    featured = await cursor.to_list(6)
    return {"properties": featured}


@router.get("/cities-stats")
async def get_cities_stats():
    """Provides stats for Jaipur, Neemrana, Behror, Kotputli landing pages"""
    db = get_database()
    cities = ["jaipur", "neemrana", "behror", "kotputli"]
    stats = {}

    for c in cities:
        count = await db["properties"].count_documents({"city": c})
        # Calculate lowest rent
        cursor = db["properties"].find({"city": c}).sort("monthly_rent_start", 1).limit(1)
        cheapest = await cursor.to_list(1)
        min_rent = cheapest[0]["monthly_rent_start"] if cheapest else 5000

        city_meta = {
            "jaipur": {"name": "Jaipur", "tagline": "Capital Education & Tech Hub", "hubs": ["MNIT", "WTP Malviya Nagar", "Sitapura RIICO", "Gopalpura Bypass"]},
            "neemrana": {"name": "Neemrana", "tagline": "Japanese Industrial Zone", "hubs": ["RIICO Japanese Zone", "Havells/Daikin Park", "St. Margaret College"]},
            "behror": {"name": "Behror", "tagline": "NH-48 Golden Corridor", "hubs": ["Govt College", "RIICO Phase I & II", "Highway Bus Stand"]},
            "kotputli": {"name": "Kotputli", "tagline": "Emerging NCR District Hub", "hubs": ["LBS College", "Cement Plant Hub", "Kotputli RIICO"]},
        }

        stats[c] = {
            **city_meta.get(c, {}),
            "property_count": count,
            "starting_price": min_rent,
        }

    return stats


@router.get("/{property_id}")
async def get_property_detail(property_id: str):
    db = get_database()
    property_doc = await db["properties"].find_one({"_id": property_id})
    if not property_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")

    # Clean up expired locks from rooms/beds before returning
    now_iso = datetime.now(timezone.utc).isoformat()
    modified = False
    for r in property_doc.get("rooms", []):
        for b in r.get("beds", []):
            if b.get("status") == "locked" and b.get("locked_until"):
                if b["locked_until"] < now_iso:
                    b["status"] = "vacant"
                    b["locked_until"] = None
                    modified = True

    if modified:
        await db["properties"].update_one(
            {"_id": property_id},
            {"$set": {"rooms": property_doc["rooms"]}}
        )

    return property_doc


# ─────────────────────────────────────────────────────────
# Owner Management & Boost Endpoints
# ─────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_property(req: PropertyCreate, user: dict = Depends(get_current_user)):
    if user.get("role") not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only registered PG owners or administrators can list properties.",
        )

    db = get_database()
    prop_id = f"prop-{uuid.uuid4().hex[:8]}"

    # Structure rooms and beds
    rooms_data = []
    for r_idx, r in enumerate(req.rooms):
        room_id = r.room_id or f"room-{prop_id}-{r_idx+1}"
        beds_data = []
        for b_idx, b in enumerate(r.beds):
            bed_id = b.bed_id or f"bed-{room_id}-{chr(65+b_idx)}"
            beds_data.append({
                "bed_id": bed_id,
                "code": b.code or f"{r_idx+1}01-{chr(65+b_idx)}",
                "status": b.status or "vacant",
                "locked_until": None,
            })
        rooms_data.append({
            "room_id": room_id,
            "room_type": r.room_type,
            "rent": r.rent,
            "sharing": r.sharing,
            "beds": beds_data,
        })

    property_doc = {
        "_id": prop_id,
        "title": req.title.strip(),
        "city": req.city.strip().lower(),
        "area": req.area.strip(),
        "address": req.address.strip(),
        "gender": req.gender.strip().lower(),
        "description": req.description.strip(),
        "monthly_rent_start": req.monthly_rent_start,
        "security_deposit": req.security_deposit,
        "token_deposit_fraction": req.token_deposit_fraction,
        "is_boosted": False,
        "boost_expiry": None,
        "rating": 5.0,
        "reviews_count": 0,
        "amenities": req.amenities,
        "cover_image": req.cover_image,
        "images": req.images or [req.cover_image],
        "owner_id": user["_id"],
        "owner_name": user.get("full_name", ""),
        "owner_phone": user.get("phone", ""),
        "owner_email": user.get("email", ""),
        "rooms": rooms_data,
        "rules": req.rules,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db["properties"].insert_one(property_doc)
    return property_doc


@router.put("/{property_id}")
async def update_property(property_id: str, req: PropertyUpdate, user: dict = Depends(get_current_user)):
    db = get_database()
    property_doc = await db["properties"].find_one({"_id": property_id})
    if not property_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")

    if property_doc["owner_id"] != user["_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")

    update_fields = {}
    for k, v in req.dict(exclude_unset=True).items():
        if v is not None:
            update_fields[k] = v

    if update_fields:
        await db["properties"].update_one({"_id": property_id}, {"$set": update_fields})

    return await db["properties"].find_one({"_id": property_id})


@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_property(property_id: str, user: dict = Depends(get_current_user)):
    db = get_database()
    property_doc = await db["properties"].find_one({"_id": property_id})
    if not property_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")

    if property_doc["owner_id"] != user["_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")

    await db["properties"].delete_one({"_id": property_id})
    return None


@router.post("/{property_id}/boost")
async def boost_property(property_id: str, user: dict = Depends(get_current_user)):
    """
    Boosts a property listing to appear at the top of search results.
    Price: BOOST_PRICE_INR (₹499) for BOOST_DURATION_DAYS (30 days) per p.md line 32
    """
    db = get_database()
    property_doc = await db["properties"].find_one({"_id": property_id})
    if not property_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")

    if property_doc["owner_id"] != user["_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")

    expiry = datetime.now(timezone.utc) + timedelta(days=settings.BOOST_DURATION_DAYS)

    await db["properties"].update_one(
        {"_id": property_id},
        {"$set": {
            "is_boosted": True,
            "boost_expiry": expiry.isoformat(),
        }}
    )

    # Record boost transaction
    boost_tx = {
        "_id": str(uuid.uuid4()),
        "property_id": property_id,
        "owner_id": user["_id"],
        "amount_inr": settings.BOOST_PRICE_INR,
        "duration_days": settings.BOOST_DURATION_DAYS,
        "boost_expiry": expiry.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db["boost_transactions"].insert_one(boost_tx)

    return {
        "message": f"Property boosted successfully for {settings.BOOST_DURATION_DAYS} days!",
        "boost_price_inr": settings.BOOST_PRICE_INR,
        "boost_expiry": expiry.isoformat(),
    }


@router.get("/owner/my-properties")
async def get_my_properties(user: dict = Depends(get_current_user)):
    db = get_database()
    properties = await db["properties"].find({"owner_id": user["_id"]}).to_list(100)
    return {"properties": properties}
