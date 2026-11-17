from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import rfqs

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="British Auction RFQ System API",
    description="Backend API for Freight RFQ dynamic reverse auctions with automatic extension mechanics.",
    version="1.0.0",
)

# Enable CORS for frontend Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rfqs.router, prefix="/api")


@app.get("/api/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "british-auction-rfq-api"}
