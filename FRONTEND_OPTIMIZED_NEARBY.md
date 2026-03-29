# Optimized Nearby & Lifestyle - Frontend Implementation

## Optimization Applied
1. ✅ **Reduced radius** from 2000m to 1000m (default)
2. ✅ **Added caching** for instant subsequent requests
3. ✅ **Increased timeout** from 8s to 30s

---

## 1. Create Cache Hook: `hooks/useNearbyCache.js`

```javascript
import { useState, useCallback } from 'react';

/**
 * Custom hook for caching nearby POI data
 * Prevents refetching when coordinates haven't changed
 */
export function useNearbyCache() {
  const [cache, setCache] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Generate cache key from coordinates
  const getCacheKey = useCallback((lat, lng, radius = 1000) => {
    return `${lat.toFixed(4)}_${lng.toFixed(4)}_${radius}`;
  }, []);

  // Get from cache or return null
  const getFromCache = useCallback((lat, lng, radius = 1000) => {
    const key = getCacheKey(lat, lng, radius);
    return cache[key] || null;
  }, [cache, getCacheKey]);

  // Save to cache
  const saveToCache = useCallback((lat, lng, data, radius = 1000) => {
    const key = getCacheKey(lat, lng, radius);
    setCache(prev => ({
      ...prev,
      [key]: {
        data,
        timestamp: Date.now(),
        lat,
        lng,
        radius
      }
    }));
  }, [getCacheKey]);

  // Clear all cache
  const clearCache = useCallback(() => {
    setCache({});
  }, []);

  // Check if cache is valid (optional: expire after 1 hour)
  const isCacheValid = useCallback((cachedItem, maxAge = 3600000) => {
    if (!cachedItem) return false;
    return (Date.now() - cachedItem.timestamp) < maxAge;
  }, []);

  return {
    cache,
    loading,
    setLoading,
    error,
    setError,
    getFromCache,
    saveToCache,
    clearCache,
    isCacheValid
  };
}
```

---

## 2. Updated PropertyDetail.jsx

```jsx
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNearbyCache } from './hooks/useNearbyCache';
import NearbySection from './NearbySection';
import LifestyleSection from './LifestyleSection';

const API_BASE = 'http://localhost:3000';
const NEARBY_RADIUS = 1000; // 1km default (reduced from 2km)

export default function PropertyDetail({ propertyId }) {
  const [property, setProperty] = useState(null);
  const [nearbyData, setNearbyData] = useState(null);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [error, setError] = useState(null);

  // Use caching hook
  const { getFromCache, saveToCache, isCacheValid } = useNearbyCache();

  // Fetch property
  useEffect(() => {
    fetchProperty();
  }, [propertyId]);

  // Fetch nearby (with caching)
  useEffect(() => {
    if (property?.location?.lat && property?.location?.lng) {
      fetchNearby();
    }
  }, [property?.location?.lat, property?.location?.lng]);

  const fetchProperty = async () => {
    try {
      // Your existing property fetch logic
      const response = await axios.get(`${API_BASE}/properties/${propertyId}`);
      setProperty(response.data);
    } catch (err) {
      setError('Failed to load property');
      console.error(err);
    }
  };

  const fetchNearby = async () => {
    const { lat, lng } = property.location;

    // ✅ CHECK CACHE FIRST
    const cachedData = getFromCache(lat, lng, NEARBY_RADIUS);
    if (cachedData && isCacheValid(cachedData)) {
      console.log('📦 Using cached nearby data (instant!)');
      setNearbyData(cachedData.data);
      return;
    }

    try {
      setLoadingNearby(true);
      console.log('🔄 Fetching fresh nearby data...');

      // ✅ INCREASED TIMEOUT: 30 seconds instead of 8
      const response = await axios.get(
        `${API_BASE}/nearby?lat=${lat}&lng=${lng}&radius=${NEARBY_RADIUS}`,
        {
          timeout: 30000 // 30 seconds
        }
      );

      // ✅ SAVE TO CACHE
      saveToCache(lat, lng, response.data, NEARBY_RADIUS);
      setNearbyData(response.data);
      setError(null);
    } catch (err) {
      console.error('❌ Error fetching nearby:', err);
      setError('Could not load nearby information');
    } finally {
      setLoadingNearby(false);
    }
  };

  if (!property) return <div>Loading property...</div>;

  return (
    <div className="property-detail">
      {/* Property header, images, etc. */}
      
      {/* Loading indicator */}
      {loadingNearby && (
        <div className="loading-indicator">
          ⏳ Loading nearby information...
        </div>
      )}

      {/* Error message */}
      {error && !nearbyData && (
        <div className="error-message">{error}</div>
      )}

      {/* Lifestyle Section (summary view) */}
      {nearbyData && (
        <LifestyleSection nearbyData={nearbyData} />
      )}

      {/* Nearby Section (detailed view) */}
      {nearbyData && (
        <NearbySection nearbyData={nearbyData} />
      )}
    </div>
  );
}
```

---

## 3. Updated LifestyleSection.jsx

```jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { summarizeLifestyle } from '../utils/summarizeLifestyle';
import './LifestyleSection.css';

const API_BASE = 'http://localhost:3000';
const NEARBY_RADIUS = 1000; // 1km (reduced)

export default function LifestyleSection({ latitude, longitude }) {
  const [nearbyData, setNearbyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cachedLocation, setCachedLocation] = useState(null);

  useEffect(() => {
    if (!latitude || !longitude) return;

    // ✅ Simple cache: only fetch if coordinates changed
    const currentLocation = `${latitude}_${longitude}`;
    if (cachedLocation === currentLocation && nearbyData) {
      console.log('📦 Using cached lifestyle data');
      return;
    }

    fetchLifestyleData();
  }, [latitude, longitude, cachedLocation]);

  const fetchLifestyleData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching lifestyle data...');

      const response = await axios.get(
        `${API_BASE}/nearby?lat=${latitude}&lng=${longitude}&radius=${NEARBY_RADIUS}`,
        {
          timeout: 30000 // ✅ 30 second timeout
        }
      );

      setNearbyData(response.data);
      setCachedLocation(`${latitude}_${longitude}`);
      setError(null);
    } catch (err) {
      console.error('❌ Error fetching lifestyle:', err);
      setError('Could not load lifestyle information');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">⏳ Loading lifestyle...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!nearbyData) return null;

  const cards = summarizeLifestyle(nearbyData);
  if (cards.length === 0) return null;

  const cardColors = ['warm-yellow', 'light-blue', 'light-gray'];

  return (
    <section className="lifestyle-section">
      <h2>Lifestyle & Amenities</h2>

      <div className="lifestyle-grid">
        {cards.map((card, index) => (
          <div
            key={card.label}
            className={`lifestyle-card ${cardColors[index % 3]}`}
          >
            <div className="icon-badge">
              <i className={`icon-${card.icon}`}></i>
            </div>
            <h3 className="card-title">{card.label}</h3>
            <p className="card-summary">{card.summary}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

---

## 4. Updated NearbySection.jsx

```jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import './NearbySection.css';

const API_BASE = 'http://localhost:3000';
const NEARBY_RADIUS = 1000; // ✅ 1km (reduced from 2km)

export default function NearbySection({ latitude, longitude }) {
  const [nearbyData, setNearbyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cachedLocation, setCachedLocation] = useState(null);

  useEffect(() => {
    if (!latitude || !longitude) return;

    // ✅ Simple cache: skip if location unchanged
    const currentLocation = `${latitude}_${longitude}`;
    if (cachedLocation === currentLocation && nearbyData) {
      console.log('📦 Using cached nearby data');
      return;
    }

    fetchNearbyData();
  }, [latitude, longitude, cachedLocation]);

  const fetchNearbyData = async () => {
    try {
      setLoading(true);
      console.log('🗺️ Fetching nearby data...');

      const response = await axios.get(
        `${API_BASE}/nearby?lat=${latitude}&lng=${longitude}&radius=${NEARBY_RADIUS}`,
        {
          timeout: 30000 // ✅ 30 second timeout
        }
      );

      setNearbyData(response.data);
      setCachedLocation(`${latitude}_${longitude}`);
      setError(null);
    } catch (err) {
      console.error('❌ Error fetching nearby:', err);
      setError('Could not load nearby information');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">⏳ Loading nearby places...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!nearbyData) return null;

  const hasAnyData = Object.values(nearbyData).some(arr => arr.length > 0);
  if (!hasAnyData) return <div>No nearby places found</div>;

  return (
    <section className="nearby-section">
      <h2>Nearby Places</h2>

      <div className="nearby-categories">
        {Object.entries(nearbyData).map(([category, pois]) => {
          if (pois.length === 0) return null; // Skip empty categories

          return (
            <div key={category} className="category-group">
              <h3>{category} ({pois.length})</h3>
              <ul className="poi-list">
                {pois.map((poi, idx) => (
                  <li key={idx} className="poi-item">
                    <span className="poi-name">{poi.name}</span>
                    <span className="poi-time">{poi.label}</span>
                    <span className="poi-distance">{poi.km} km</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

---

## 5. Quick Summary of Changes

| Optimization | Before | After |
|--------------|--------|-------|
| **Radius** | 2000m (2 km) | 1000m (1 km) |
| **Timeout** | 8 seconds | 30 seconds |
| **Caching** | ❌ None | ✅ Per coordinates |
| **First Load** | 5-15 seconds | 5-15 seconds |
| **Subsequent Loads** | 5-15 seconds | <100ms |

---

## 6. Performance Expectations

**First property load:**
- Radius: 1000m (faster Overpass query)
- Timeout: 30 seconds (won't fail)
- Time: ~5-10 seconds

**Switch to another property with same coordinates:**
- Returns from cache instantly
- Time: <100ms

**Switch to different property:**
- New fetch (not in cache)
- Time: ~5-10 seconds

---

## 7. Testing

After implementing:

```bash
# Test URL with smaller radius
http://localhost:3000/nearby?lat=36.729&lng=10.335&radius=1000
```

You should see:
- ✅ Faster initial response
- ✅ Cache hit on second load
- ✅ No timeout errors

Check browser console for:
```
🔄 Fetching fresh nearby data...
📦 Using cached nearby data (instant!)
```
