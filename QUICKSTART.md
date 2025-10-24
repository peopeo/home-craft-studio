# Quick Start Guide

## ✅ Your Application is Ready!

Both the backend and frontend are currently running:

- **Backend API**: http://localhost:8000
- **Frontend UI**: http://localhost:5173

## 🚀 How to Use

### Open the Web App

1. **Open your browser** and navigate to:
   ```
   http://localhost:5173
   ```

2. The app will automatically:
   - Load the first 20 apartments from the database
   - Display the first apartment in 3D
   - Show apartment selector in the header

### Interact with the 3D Model

#### **Navigation**
- **Rotate**: Click and drag
- **Zoom**: Scroll wheel
- **Pan**: Right-click and drag

#### **Selection**
- **Click on any room, wall, door, or window** to see its details
- Selected mesh will be highlighted in yellow
- Metadata panel appears at bottom-left showing:
  - Room type (Bathroom, Kitchen, Bedroom, etc.)
  - Zone information
  - Area ID and Unit ID
  - Elevation and height
  - Mesh name

#### **Controls (Top-Right)**
- **Toggle Walls**: Hide/show all walls
- **Toggle Doors**: Hide/show all doors
- **Toggle Windows**: Hide/show all windows

#### **Switch Apartments**
- Use the dropdown in the header to select different apartments
- The 3D model will reload automatically

## 🎨 Features

### What You Can Do
- ✅ Browse 20+ apartments from the database
- ✅ View 3D floor plans with color-coded rooms
- ✅ Click to select individual elements
- ✅ View detailed metadata for each room/wall/door/window
- ✅ Toggle visibility of different element types
- ✅ Rotate, zoom, and explore in 3D

### Current Apartment Example
- **Apartment ID**: `3c3b1d6ca8b4b9092480b8c75f9eaa81`
- **Elements**: 39 separate meshes (7 rooms, 20 walls, 12 openings)
- **Rooms**: Bathroom, Living Room, Kitchen, 2 Bedrooms, Balcony, Corridor

## 🛠 Restarting the Servers

If you need to restart:

### Backend (FastAPI)
```bash
cd backend
/home/peo/anaconda3/envs/home-craft-studio/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Or with conda activated:
```bash
conda activate home-craft-studio
cd backend
uvicorn app.main:app --reload
```

### Frontend (React)
```bash
cd frontend
npm run dev
```

## 🎯 Color Coding

Rooms are automatically color-coded by type:
- 🔵 **Bathroom**: Light blue
- 💛 **Living Room**: Light yellow
- 🔴 **Kitchen**: Light red
- 💚 **Bedroom**: Light green
- 💜 **Balcony**: Light purple
- ⚪ **Corridor**: Light gray
- ⚫ **Walls**: Dark gray
- 🟤 **Doors**: Brown
- 🔵 **Windows**: Transparent blue

## 📊 API Endpoints

While the UI is the main interface, you can also access the API directly:

```bash
# List apartments
curl http://localhost:8000/apartments

# Get apartment data as JSON
curl http://localhost:8000/apartment/3c3b1d6ca8b4b9092480b8c75f9eaa81

# Download GLB model
curl http://localhost:8000/apartment/3c3b1d6ca8b4b9092480b8c75f9eaa81/glb --output apartment.glb
```

## 🐛 Troubleshooting

### Backend Not Running
If you see connection errors, make sure the FastAPI backend is running on port 8000.

### Frontend Shows Error
- Check browser console (F12) for error messages
- Ensure CORS is working (should be enabled by default)
- Verify both servers are running

### 3D Model Not Loading
- Check the apartment ID is valid
- Look for errors in the browser console
- Verify the GLB endpoint returns data: http://localhost:8000/apartment/{id}/glb

## 📚 Next Steps

- **Explore different apartments** using the dropdown
- **Toggle walls off** to see room layouts clearly
- **Click on rooms** to see their metadata
- **Check out BABYLON_EXAMPLE.md** for advanced customization

Enjoy exploring your 3D apartment viewer! 🏠
