from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from db import init_db
from config_com import router as config_router, seed_env_defaults
from logs import router as logs_router
from services import router as services_router
from stats import router as stats_router
from updates import router as updates_router
from network import router as network_router

DIST_PATH = Path(__file__).parent.parent / "dist"

app = FastAPI()

# --- Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Startup ---
init_db()
seed_env_defaults()

# --- Routers ---
app.include_router(config_router)
app.include_router(logs_router)
app.include_router(services_router)
app.include_router(stats_router)
app.include_router(updates_router)
app.include_router(network_router)

# --- SPA Serving ---
app.mount("/assets", StaticFiles(directory=DIST_PATH / "assets"), name="assets")


@app.get("/")
async def serve_root():
    return FileResponse(DIST_PATH / "index.html")


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    file = DIST_PATH / full_path
    if file.exists() and file.is_file():
        return FileResponse(file)
    return FileResponse(DIST_PATH / "index.html")
