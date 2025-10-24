import { useState, useEffect } from 'react';
import { ApartmentViewer } from './components/ApartmentViewer';
import './App.css';

const API_BASE_URL = 'http://localhost:8000';

interface ApartmentListResponse {
  apartment_ids: string[];
  total: number;
}

function App() {
  const [apartments, setApartments] = useState<string[]>([]);
  const [selectedApartment, setSelectedApartment] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load apartment list on mount
  useEffect(() => {
    const fetchApartments = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/apartments?limit=20`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: ApartmentListResponse = await response.json();
        setApartments(data.apartment_ids);

        // Auto-select first apartment
        if (data.apartment_ids.length > 0) {
          setSelectedApartment(data.apartment_ids[0]);
        }
        setLoading(false);
      } catch (err) {
        console.error('Error fetching apartments:', err);
        setError(`Failed to load apartments: ${err}`);
        setLoading(false);
      }
    };

    fetchApartments();
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '24px',
        fontWeight: 'bold',
      }}>
        Loading apartments...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        padding: '20px',
      }}>
        <div style={{
          backgroundColor: '#ff4444',
          color: 'white',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
        }}>
          {error}
        </div>
        <div style={{ color: '#666', textAlign: 'center' }}>
          <p>Make sure the FastAPI backend is running:</p>
          <code style={{
            backgroundColor: '#f5f5f5',
            padding: '10px',
            borderRadius: '4px',
            display: 'block',
            marginTop: '10px',
          }}>
            cd backend && uvicorn app.main:app --reload
          </code>
        </div>
      </div>
    );
  }

  if (!selectedApartment) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
      }}>
        No apartments available
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: '15px 20px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
      }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
          Home Craft Studio
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label htmlFor="apartment-select" style={{ fontSize: '14px', color: '#666' }}>
            Apartment:
          </label>
          <select
            id="apartment-select"
            value={selectedApartment}
            onChange={(e) => setSelectedApartment(e.target.value)}
            style={{
              padding: '8px 12px',
              fontSize: '14px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              backgroundColor: 'white',
              cursor: 'pointer',
              minWidth: '300px',
            }}
          >
            {apartments.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#999' }}>
          {apartments.length} apartments loaded
        </div>
      </div>

      {/* Viewer */}
      <div style={{ paddingTop: '60px', height: '100%' }}>
        <ApartmentViewer key={selectedApartment} apartmentId={selectedApartment} />
      </div>
    </div>
  );
}

export default App;
