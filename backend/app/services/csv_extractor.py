import pandas as pd
from shapely import wkt
from shapely.geometry import Polygon
from typing import List, Dict, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ApartmentDataExtractor:
    """Extract apartment data from CSV file"""

    def __init__(self, csv_file_path: str):
        self.csv_file_path = csv_file_path
        self.df = None
        self._load_data()

    def _load_data(self):
        """Load CSV data into pandas DataFrame"""
        try:
            logger.info(f"Loading CSV file from {self.csv_file_path}")
            self.df = pd.read_csv(self.csv_file_path)
            logger.info(f"Loaded {len(self.df)} rows")
        except Exception as e:
            logger.error(f"Error loading CSV: {e}")
            raise

    def get_apartment_by_id(self, apartment_id: str) -> Optional[Dict]:
        """
        Get all data for a specific apartment ID
        Returns apartment data with parsed geometries
        """
        if self.df is None:
            raise ValueError("Data not loaded")

        # Filter by apartment_id
        apartment_df = self.df[self.df['apartment_id'] == apartment_id]

        if apartment_df.empty:
            return None

        # Group data by entity type
        areas = []
        separators = []
        openings = []

        for _, row in apartment_df.iterrows():
            try:
                # Parse WKT geometry
                geom = wkt.loads(row['geom'])

                entity_data = {
                    'entity_type': row['entity_type'],
                    'entity_subtype': row['entity_subtype'],
                    'geometry': geom,  # Keep for internal use
                    'coordinates': list(geom.exterior.coords) if isinstance(geom, Polygon) else [],
                    'elevation': float(row['elevation']) if pd.notna(row['elevation']) else 0.0,
                    'height': float(row['height']) if pd.notna(row['height']) else 2.6,
                    'zoning': str(row.get('zoning', '')),
                    'roomtype': str(row.get('roomtype', '')),
                    'area_id': float(row.get('area_id')) if pd.notna(row.get('area_id')) else None,
                    'unit_id': float(row.get('unit_id')) if pd.notna(row.get('unit_id')) else None,
                }

                # Categorize by entity type
                if row['entity_type'] == 'area':
                    areas.append(entity_data)
                elif row['entity_type'] == 'separator':
                    separators.append(entity_data)
                elif row['entity_type'] == 'opening':
                    openings.append(entity_data)

            except Exception as e:
                logger.warning(f"Error parsing row: {e}")
                continue

        return {
            'apartment_id': apartment_id,
            'areas': areas,
            'separators': separators,
            'openings': openings,
            'total_elements': len(areas) + len(separators) + len(openings),
        }

    def get_all_apartment_ids(self, limit: int = 100) -> List[str]:
        """Get list of unique apartment IDs"""
        if self.df is None:
            raise ValueError("Data not loaded")

        # Filter out NaN values and convert to list
        apartment_ids = self.df['apartment_id'].dropna().unique().tolist()
        return apartment_ids[:limit]

    def get_apartment_statistics(self, apartment_id: str) -> Optional[Dict]:
        """Get statistics for an apartment"""
        apartment_data = self.get_apartment_by_id(apartment_id)
        if not apartment_data:
            return None

        return {
            'apartment_id': apartment_id,
            'num_areas': len(apartment_data['areas']),
            'num_separators': len(apartment_data['separators']),
            'num_openings': len(apartment_data['openings']),
            'total_elements': apartment_data['total_elements'],
            'room_types': list(set([area['roomtype'] for area in apartment_data['areas'] if area['roomtype']])),
        }
