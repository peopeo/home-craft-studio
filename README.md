# Home Craft Studio

A full-stack application for visualizing apartment floor plans in 3D using FastAPI backend and React + Babylon.js frontend.

## Project Structure

```
home-craft-studio/
├── backend/              # FastAPI service
│   ├── app/
│   │   ├── main.py      # FastAPI application
│   │   └── services/
│   │       ├── csv_extractor.py    # CSV data extraction
│   │       └── gltf_converter.py   # Polygon to GLTF/GLB conversion
│   └── requirements.txt
├── frontend/            # React + Babylon.js web app
└── mds_V2_5.372k.csv   # Apartment data (1M+ rows)
```

## Features

- Extract apartment floor plan data by apartment_id
- Convert 2D polygon data to 3D meshes (GLTF/GLB format)
- **Separate selectable meshes** - Each room, wall, door, and window is a distinct mesh
- **Rich metadata** - Each mesh contains full CSV data (roomtype, zoning, area_id, coordinates, etc.)
- Color-coded room types (bathroom, living room, kitchen, bedroom, etc.)
- FastAPI REST API with CORS enabled
- React frontend with Babylon.js 3D rendering

## Setup

### Backend (FastAPI)

1. **Activate the conda environment:**
   ```bash
   conda activate home-craft-studio
   ```

2. **Start the FastAPI server:**
   ```bash
   cd backend
   /home/peo/anaconda3/envs/home-craft-studio/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

   Or if conda is activated:
   ```bash
   cd backend
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

3. **API will be available at:** `http://localhost:8000`

### Frontend (React + Babylon.js)

1. **Install dependencies (if not already done):**
   ```bash
   cd frontend
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Frontend will be available at:** `http://localhost:5173` (or shown in terminal)

## API Endpoints

### `GET /`
Root endpoint with API information

### `GET /apartments?limit=10`
List apartment IDs
- **Query Params:** `limit` (default: 10)
- **Response:** List of apartment IDs

### `GET /apartment/{apartment_id}`
Get apartment data as JSON
- **Response:** JSON with areas, separators, openings, and coordinates

### `GET /apartment/{apartment_id}/glb`
Get apartment as 3D GLB model
- **Response:** Binary GLB file for 3D visualization
- **Content-Type:** `model/gltf-binary`

## Example Usage

```bash
# List available apartments
curl http://localhost:8000/apartments

# Get apartment data as JSON
curl http://localhost:8000/apartment/3c3b1d6ca8b4b9092480b8c75f9eaa81

# Download GLB model
curl http://localhost:8000/apartment/3c3b1d6ca8b4b9092480b8c75f9eaa81/glb --output apartment.glb
```

### GLB File Structure

Each GLB file contains **separate meshes** for every geometry in the apartment:

- **39 meshes** in the example apartment (7 areas + 20 walls + 12 openings)
- **Unique names**: `area_0_BATHROOM_619311.0`, `separator_1_WALL_8`, `opening_3_DOOR_15`
- **Metadata attached to each mesh**:
  ```json
  {
    "entity_type": "area",
    "entity_subtype": "BATHROOM",
    "roomtype": "Bathroom",
    "zoning": "Zone3",
    "elevation": 0.0,
    "height": 2.6,
    "area_id": 619311.0,
    "unit_id": 7300.0,
    "coordinates": [[x, y], ...]
  }
  ```

This allows individual selection, highlighting, and information display in Babylon.js!

## Data Structure

The CSV contains:
- **apartment_id**: Unique identifier
- **entity_type**: area, separator, opening
- **entity_subtype**: BATHROOM, LIVING_ROOM, KITCHEN, ROOM, WALL, DOOR, WINDOW, etc.
- **geom**: POLYGON data in WKT format
- **elevation**: Base Z coordinate
- **height**: Extrusion height
- **roomtype**: Human-readable room name

## Color Coding

- **Bathroom**: Light blue
- **Living Room**: Light yellow
- **Kitchen**: Light red
- **Bedroom**: Light green
- **Balcony**: Light purple
- **Corridor**: Light gray
- **Walls**: Dark gray
- **Doors**: Brown
- **Windows**: Transparent blue

## Technologies

### Backend
- Python 3.12
- FastAPI 0.120.0
- Pandas 2.3.3
- Shapely 2.1.2
- Trimesh 4.9.0
- pygltflib 1.16.5

### Frontend
- React 18 with TypeScript
- Vite
- Babylon.js
  - @babylonjs/core
  - @babylonjs/loaders
  - @babylonjs/materials

## Development

The FastAPI server runs with `--reload` flag, so code changes will automatically restart the server.

The React frontend uses Vite's hot module replacement for instant updates during development.
