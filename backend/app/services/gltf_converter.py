import numpy as np
import trimesh
from shapely.geometry import Polygon
from typing import List, Dict
import logging
import io

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PolygonToGLTFConverter:
    """Convert polygon data to GLTF/GLB 3D models"""

    def __init__(self):
        self.color_map = {
            'BATHROOM': [0.7, 0.9, 1.0, 1.0],  # Light blue
            'LIVING_ROOM': [1.0, 0.9, 0.7, 1.0],  # Light yellow
            'KITCHEN': [1.0, 0.8, 0.8, 1.0],  # Light red
            'ROOM': [0.9, 1.0, 0.9, 1.0],  # Light green
            'BEDROOM': [0.9, 1.0, 0.9, 1.0],  # Light green
            'BALCONY': [0.8, 0.8, 1.0, 1.0],  # Light purple
            'CORRIDOR': [0.95, 0.95, 0.95, 1.0],  # Light gray
            'SHAFT': [0.6, 0.6, 0.6, 1.0],  # Gray
            'DINING': [1.0, 0.95, 0.8, 1.0],  # Light orange
            'WALL': [0.5, 0.5, 0.5, 1.0],  # Dark gray
            'DOOR': [0.6, 0.4, 0.2, 1.0],  # Brown
            'WINDOW': [0.7, 0.9, 1.0, 0.5],  # Transparent blue
            'ENTRANCE_DOOR': [0.4, 0.3, 0.2, 1.0],  # Dark brown
            'DEFAULT': [0.8, 0.8, 0.8, 1.0],  # Default gray
        }

    def _get_color_for_entity(self, entity_subtype: str, entity_type: str) -> np.ndarray:
        """Get color based on entity subtype or type"""
        color = self.color_map.get(entity_subtype, self.color_map.get(entity_type, self.color_map['DEFAULT']))
        return np.array(color)

    def _extrude_polygon(
        self,
        polygon: Polygon,
        elevation: float,
        height: float,
        color: np.ndarray
    ) -> trimesh.Trimesh:
        """
        Extrude a 2D polygon to create a 3D mesh

        Args:
            polygon: Shapely Polygon object
            elevation: Base elevation (Z coordinate)
            height: Extrusion height
            color: RGBA color array

        Returns:
            trimesh.Trimesh object
        """
        try:
            # Get exterior coordinates
            coords = list(polygon.exterior.coords)

            # Remove duplicate last point if it exists
            if coords[0] == coords[-1]:
                coords = coords[:-1]

            # Create vertices for bottom and top faces
            vertices_2d = np.array(coords)
            num_verts = len(vertices_2d)

            # Bottom vertices (at elevation)
            bottom_verts = np.column_stack([
                vertices_2d[:, 0],
                vertices_2d[:, 1],
                np.full(num_verts, elevation)
            ])

            # Top vertices (at elevation + height)
            top_verts = np.column_stack([
                vertices_2d[:, 0],
                vertices_2d[:, 1],
                np.full(num_verts, elevation + height)
            ])

            # Combine all vertices
            vertices = np.vstack([bottom_verts, top_verts])

            # Create faces
            faces = []

            # Bottom face (reversed for correct normal)
            bottom_face_indices = list(range(num_verts))
            bottom_face_indices.reverse()
            for i in range(1, num_verts - 1):
                faces.append([0, bottom_face_indices[i + 1], bottom_face_indices[i]])

            # Top face
            for i in range(1, num_verts - 1):
                faces.append([num_verts, num_verts + i, num_verts + i + 1])

            # Side faces
            for i in range(num_verts):
                next_i = (i + 1) % num_verts
                # Two triangles per side
                faces.append([i, next_i, num_verts + i])
                faces.append([next_i, num_verts + next_i, num_verts + i])

            faces = np.array(faces)

            # Create mesh
            mesh = trimesh.Trimesh(vertices=vertices, faces=faces)

            # Set vertex colors
            vertex_colors = np.tile(color, (len(vertices), 1))
            mesh.visual.vertex_colors = vertex_colors

            return mesh

        except Exception as e:
            logger.error(f"Error extruding polygon: {e}")
            raise

    def convert_apartment_to_glb(self, apartment_data: Dict) -> bytes:
        """
        Convert apartment data to GLB format with separate selectable meshes

        Args:
            apartment_data: Dictionary containing apartment data with areas, separators, openings

        Returns:
            GLB file as bytes
        """
        scene = trimesh.Scene()
        mesh_counter = 0

        try:
            # Process areas (rooms)
            for idx, area in enumerate(apartment_data.get('areas', [])):
                if not isinstance(area['geometry'], Polygon):
                    continue

                color = self._get_color_for_entity(area['entity_subtype'], area['entity_type'])
                mesh = self._extrude_polygon(
                    area['geometry'],
                    area['elevation'],
                    area['height'],
                    color
                )

                # Add metadata to mesh
                mesh.metadata = {
                    'entity_type': area.get('entity_type', ''),
                    'entity_subtype': area.get('entity_subtype', ''),
                    'roomtype': area.get('roomtype', ''),
                    'zoning': area.get('zoning', ''),
                    'elevation': area.get('elevation', 0.0),
                    'height': area.get('height', 2.6),
                    'area_id': area.get('area_id'),
                    'unit_id': area.get('unit_id'),
                    'coordinates': area.get('coordinates', [])
                }

                # Create unique name
                mesh_name = f"area_{idx}_{area.get('entity_subtype', 'unknown')}_{area.get('area_id', mesh_counter)}"
                scene.add_geometry(mesh, node_name=mesh_name, geom_name=mesh_name)
                mesh_counter += 1

            # Process separators (walls)
            for idx, separator in enumerate(apartment_data.get('separators', [])):
                if not isinstance(separator['geometry'], Polygon):
                    continue

                color = self._get_color_for_entity(separator['entity_subtype'], separator['entity_type'])
                mesh = self._extrude_polygon(
                    separator['geometry'],
                    separator['elevation'],
                    separator['height'],
                    color
                )

                # Add metadata to mesh
                mesh.metadata = {
                    'entity_type': separator.get('entity_type', ''),
                    'entity_subtype': separator.get('entity_subtype', ''),
                    'roomtype': separator.get('roomtype', ''),
                    'zoning': separator.get('zoning', ''),
                    'elevation': separator.get('elevation', 0.0),
                    'height': separator.get('height', 2.6),
                    'area_id': separator.get('area_id'),
                    'unit_id': separator.get('unit_id'),
                    'coordinates': separator.get('coordinates', [])
                }

                # Create unique name
                mesh_name = f"separator_{idx}_{separator.get('entity_subtype', 'unknown')}_{mesh_counter}"
                scene.add_geometry(mesh, node_name=mesh_name, geom_name=mesh_name)
                mesh_counter += 1

            # Process openings (doors, windows)
            for idx, opening in enumerate(apartment_data.get('openings', [])):
                if not isinstance(opening['geometry'], Polygon):
                    continue

                color = self._get_color_for_entity(opening['entity_subtype'], opening['entity_type'])
                mesh = self._extrude_polygon(
                    opening['geometry'],
                    opening['elevation'],
                    opening['height'],
                    color
                )

                # Add metadata to mesh
                mesh.metadata = {
                    'entity_type': opening.get('entity_type', ''),
                    'entity_subtype': opening.get('entity_subtype', ''),
                    'roomtype': opening.get('roomtype', ''),
                    'zoning': opening.get('zoning', ''),
                    'elevation': opening.get('elevation', 0.0),
                    'height': opening.get('height', 2.6),
                    'area_id': opening.get('area_id'),
                    'unit_id': opening.get('unit_id'),
                    'coordinates': opening.get('coordinates', [])
                }

                # Create unique name
                mesh_name = f"opening_{idx}_{opening.get('entity_subtype', 'unknown')}_{mesh_counter}"
                scene.add_geometry(mesh, node_name=mesh_name, geom_name=mesh_name)
                mesh_counter += 1

            if mesh_counter == 0:
                raise ValueError("No valid meshes created from apartment data")

            # Export scene to GLB (keeps meshes separate)
            glb_bytes = scene.export(file_type='glb')

            if isinstance(glb_bytes, str):
                glb_bytes = glb_bytes.encode()

            logger.info(f"Generated GLB with {mesh_counter} separate meshes")

            return glb_bytes

        except Exception as e:
            logger.error(f"Error converting to GLB: {e}")
            raise

    def convert_single_polygon_to_glb(
        self,
        polygon: Polygon,
        elevation: float = 0.0,
        height: float = 2.6,
        color: np.ndarray = None
    ) -> bytes:
        """
        Convert a single polygon to GLB format

        Args:
            polygon: Shapely Polygon object
            elevation: Base elevation
            height: Extrusion height
            color: RGBA color array

        Returns:
            GLB file as bytes
        """
        if color is None:
            color = self.color_map['DEFAULT']

        mesh = self._extrude_polygon(polygon, elevation, height, np.array(color))
        glb_bytes = mesh.export(file_type='glb')

        if isinstance(glb_bytes, str):
            glb_bytes = glb_bytes.encode()

        return glb_bytes
