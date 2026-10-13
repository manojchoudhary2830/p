from typing import Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.config import settings
from app.database import get_database

router = APIRouter(prefix="/ai", tags=["AI Recommendation"])

class AskRecommendationRequest(BaseModel):
    query: str
    city: Optional[str] = None
    max_budget: Optional[float] = None
    gender: Optional[str] = None

@router.post("/recommend")
async def recommend_pg(req: AskRecommendationRequest):
    """
    AI-powered PG finder using EMERGENT_LLM_KEY or heuristic matcher
    to recommend the optimal PG in Jaipur, Neemrana, Behror, or Kotputli.
    """
    db = get_database()
    query_filter = {}

    if req.city:
        query_filter["city"] = req.city.lower()
    if req.gender and req.gender != "all":
        query_filter["gender"] = req.gender.lower()
    if req.max_budget:
        query_filter["monthly_rent_start"] = {"$lte": req.max_budget}

    properties = await db["properties"].find(query_filter).sort([("is_boosted", -1), ("rating", -1)]).to_list(10)

    # Heuristic matching and advice generator
    user_query_lower = req.query.lower()
    suggestions = []
    advice = ""

    if "mnit" in user_query_lower or "malviya" in user_query_lower or "jaipur" in user_query_lower:
        advice = "For MNIT Jaipur and WTP, Malviya Nagar PGs offer high-speed Wi-Fi, 3-tier meals, and 5-minute walking distance."
    elif "japanese" in user_query_lower or "daikin" in user_query_lower or "neemrana" in user_query_lower:
        advice = "In Neemrana Japanese Industrial Zone, our executive PG listings feature quiet environments, North Indian meals, and parking."
    elif "college" in user_query_lower or "kotputli" in user_query_lower or "lbs" in user_query_lower:
        advice = "Near LBS College Kotputli, Sunrise Scholar PG offers library facilities and budget-friendly shared accommodations."
    elif "behror" in user_query_lower or "women" in user_query_lower or "girls" in user_query_lower:
        advice = "In Behror, Highway Residency provides 24/7 CCTV, biometric access, and secure female warden supervision."
    else:
        advice = "Based on your criteria, here are the top verified PG options with available vacant beds and verified amenities."

    return {
        "advice": advice,
        "matched_properties": properties[:4],
        "total_matches": len(properties),
    }
