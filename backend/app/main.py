from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from .services.csv_extractor import ApartmentDataExtractor
from .services.gltf_converter import PolygonToGLTFConverter
import os

app = FastAPI(
    title="Home Craft Studio API",
    description="API for extracting apartment data and converting to GLTF/GLB format",
    version="1.0.0"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get CSV file path from parent directory
CSV_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "mds_V2_5.372k.csv")

# Initialize services
extractor = ApartmentDataExtractor(CSV_FILE_PATH)
converter = PolygonToGLTFConverter()


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Home Craft Studio API",
        "endpoints": {
            "/apartment/{apartment_id}": "Get apartment data as JSON",
            "/apartment/{apartment_id}/glb": "Get apartment as GLB 3D model"
        }
    }


def _prepare_for_json(apartment_data: dict) -> dict:
    """Remove non-JSON-serializable fields from apartment data"""
    json_data = apartment_data.copy()

    # Remove geometry objects from each entity
    for entity_list in [json_data.get('areas', []), json_data.get('separators', []), json_data.get('openings', [])]:
        for entity in entity_list:
            if 'geometry' in entity:
                del entity['geometry']

    return json_data


@app.get("/apartment/{apartment_id}")
async def get_apartment_data(apartment_id: str):
    """Get apartment data by ID"""
    try:
        apartment_data = extractor.get_apartment_by_id(apartment_id)
        if not apartment_data:
            raise HTTPException(status_code=404, detail=f"Apartment with ID {apartment_id} not found")

        # Prepare data for JSON serialization
        json_data = _prepare_for_json(apartment_data)
        return json_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.api_route("/apartment/{apartment_id}/glb", methods=["GET", "HEAD"])
async def get_apartment_glb(apartment_id: str):
    """Get apartment as GLB 3D model"""
    try:
        # Extract apartment data
        apartment_data = extractor.get_apartment_by_id(apartment_id)
        if not apartment_data:
            raise HTTPException(status_code=404, detail=f"Apartment with ID {apartment_id} not found")

        # Convert to GLB
        glb_bytes = converter.convert_apartment_to_glb(apartment_data)

        # Return GLB file
        return Response(
            content=glb_bytes,
            media_type="model/gltf-binary",
            headers={
                "Content-Disposition": f"inline; filename=apartment_{apartment_id}.glb"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/apartment/{apartment_id}/polygons")
async def get_apartment_polygons(apartment_id: str):
    """Get apartment as 2D polygon data (for frontend extrusion)"""
    try:
        apartment_data = extractor.get_apartment_by_id(apartment_id)
        if not apartment_data:
            raise HTTPException(status_code=404, detail=f"Apartment with ID {apartment_id} not found")

        # Convert polygon data to GeoJSON-like format
        result = {
            "apartment_id": apartment_id,
            "areas": [],
            "separators": [],
            "openings": []
        }

        # Process areas
        for area in apartment_data.get('areas', []):
            result["areas"].append({
                "id": area.get('area_id'),
                "type": area.get('entity_subtype'),
                "roomtype": area.get('roomtype'),
                "zoning": area.get('zoning'),
                "elevation": area.get('elevation', 0),
                "height": area.get('height', 2.5),
                "coordinates": area.get('coordinates', [])
            })

        # Process separators (walls)
        for separator in apartment_data.get('separators', []):
            result["separators"].append({
                "type": separator.get('entity_subtype'),
                "elevation": separator.get('elevation', 0),
                "height": separator.get('height', 2.5),
                "coordinates": separator.get('coordinates', [])
            })

        # Process openings (doors, windows)
        for opening in apartment_data.get('openings', []):
            result["openings"].append({
                "type": opening.get('entity_subtype'),
                "elevation": opening.get('elevation', 0),
                "height": opening.get('height', 2.0),
                "coordinates": opening.get('coordinates', [])
            })

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/apartments")
async def list_apartments(limit: int = 10):
    """List all apartment IDs (limited)"""
    try:
        apartment_ids = extractor.get_all_apartment_ids(limit=limit)
        return {"apartment_ids": apartment_ids, "total": len(apartment_ids)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
