# Nearby & Lifestyle Feature - Frontend Integration Guide

## Overview
The backend provides a **single API endpoint** that returns nearby Points of Interest (POIs) grouped into **6 categories**. The frontend consumes this data in two ways:
1. **NearbySection** — Shows full list of POIs per category
2. **LifestyleSection** — Shows summarized lifestyle cards (6 items max)

---

## 1. API Endpoint

### Request
```http
GET /nearby?lat={latitude}&lng={longitude}&radius={radiusInMeters}
```

### Query Parameters (NearbyQueryDto)

| Parameter | Type | Required | Constraints | Example |
|-----------|------|----------|-------------|---------|
| `lat` | number | ✅ Yes | -90 to 90 | `36.8065` |
| `lng` | number | ✅ Yes | -180 to 180 | `10.1957` |
| `radius` | number | ❌ Optional | min: 500, default: 2000 | `1500` |

**Note:** Use short parameter names: `lat` and `lng` (NOT `latitude`/`longitude`)

### Example Request
```
GET http://localhost:3000/nearby?lat=36.8065&lng=10.1957
GET http://localhost:3000/nearby?lat=36.8065&lng=10.1957&radius=1500
```

---

## 2. API Response Structure

### Response Type: `NearbyResponse`
```typescript
interface NearbyResponse {
  [category: string]: NearbyItem[]
}

interface NearbyItem {
  name: string;      // POI name (e.g., "École Primaire Rue Libye")
  km: number;        // Distance from property in km (e.g., 1.2)
  label: string;     // Walk/drive time (e.g., "12 min walk" or "3 min drive")
}
```

### Response Format (6 Categories)
```json
{
  "Education": [
    {"name": "الجامعة المركزية الخاصة", "km": 1.6, "label": "20 min walk"},
    {"name": "École Primaire Rue Libye", "km": 1.7, "label": "20 min walk"}
  ],
  "Transport": [
    {"name": "تونس البحرية", "km": 0.7, "label": "9 min walk"},
    {"name": "محطة المدي", "km": 0.9, "label": "11 min walk"}
  ],
  "Dining & Café": [
    {"name": "La Fábrica", "km": 0.8, "label": "10 min walk"},
    {"name": "Le Saint Malo", "km": 0.8, "label": "9 min walk"}
  ],
  "Shopping": [
    {"name": "Azaza", "km": 1.2, "label": "15 min walk"},
    {"name": "Camaieu", "km": 1.2, "label": "14 min walk"}
  ],
  "Nature": [],
  "Sport": []
}
```

### Categories Supported
1. **Education** — Schools, colleges, universities
2. **Transport** — Bus stops, train stations, metro stops
3. **Dining & Café** — Restaurants, cafes, fast food
4. **Shopping** — Malls, supermarkets, convenience stores
5. **Nature** — Parks, gardens, nature reserves
6. **Sport** — Gyms, stadiums, swimming pools, sports centers

**Note:** Categories may be empty (`[]`) if no POIs exist in that category within the radius.

---

## 3. Data Characteristics

### Distance Calculation
- Uses **Haversine formula** (spherical earth distance)
- Distance in **kilometers** (rounded to 1 decimal)
- Default radius: **2000 meters** (2 km)
- Max 5 results per category (sorted by distance)

### Time Labels
- **Walk time** (if ≤ 20 min walk):
  - 5 km/h walking speed
  - Format: `"X min walk"`
  - Example: `"7 min walk"`
  
- **Drive time** (if > 20 min walk):
  - 40 km/h driving speed
  - Format: `"Y min drive"`
  - Example: `"3 min drive"`

### Data Quality (Deduplication)
The API automatically removes duplicates through 3 strategies:

1. **Exact name match** — Removes identical POI names
2. **Fuzzy matching** — Removes POIs with 80%+ name similarity
3. **Proximity check** — Removes POIs within 50m of each other

**Arabic name normalization** included:
- Removes prefixes: محطة (station), ساحة (square), مركز (center)
- Removes text in parentheses: "ساحة حقوق الإنسان (إياب)" → "ساحة حقوق الإنسان"

---

## 4. Frontend Integration Pattern

### Architecture Overview
```
PropertyDetail.jsx (parent)
├── State: nearbyData (fetch once)
│   └── GET /nearby?lat={property.location.lat}&lng={property.location.lng}
│
├── NearbySection.jsx ← receives nearbyData as prop
│   └── Renders all POIs (full lists per category)
│
└── LifestyleSection.jsx ← receives nearbyData as prop
    ├── Calls summarizeLifestyle(nearbyData)
    └── Renders 6 lifestyle cards (1 summary per category)
```

### Key Principles
- **Single fetch** — Lift API call to parent `PropertyDetail.jsx`
- **Pass as prop** — Both sections share same `nearbyData`
- **No refetching** — Avoid duplicate API calls
- **Handle empty categories** — Skip rendering categories with 0 results

---

## 5. Implementation Details

### Step 1: Modify PropertyDetail.jsx

**Add state and fetch:**
```jsx
import { useEffect, useState } from 'react';
import NearbySection from './NearbySection';
import LifestyleSection from './LifestyleSection';

export default function PropertyDetail({ propertyId }) {
  const [property, setProperty] = useState(null);
  const [nearbyData, setNearbyData] = useState(null);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [error, setError] = useState(null);

  // Fetch property details
  useEffect(() => {
    fetchProperty();
  }, [propertyId]);

  // Fetch nearby POIs (only if property has coordinates)
  useEffect(() => {
    if (property?.location?.lat && property?.location?.lng) {
      fetchNearby();
    }
  }, [property?.location?.lat, property?.location?.lng]);

  const fetchProperty = async () => {
    // Your existing property fetch logic
  };

  const fetchNearby = async () => {
    try {
      setLoadingNearby(true);
      const response = await fetch(
        `/nearby?lat=${property.location.lat}&lng=${property.location.lng}`
      );
      const data = await response.json();
      setNearbyData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingNearby(false);
    }
  };

  if (!property) return <div>Loading property...</div>;

  return (
    <div className="property-detail">
      {/* Property header, images, etc. */}

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

### Step 2: Create `utils/summarizeLifestyle.js`

**Pure utility function to transform API data:**
```js
/**
 * Transforms nearby API response into 6 lifestyle card summaries
 * @param {Object} nearbyData - Response from /nearby endpoint
 * @returns {Array} Array of lifestyle cards [{ icon, label, summary }, ...]
 */
export function summarizeLifestyle(nearbyData) {
  const cards = [];
  
  // Category order and labels
  const categoryConfig = {
    'Education': { label: 'Education', icon: 'school' },
    'Transport': { label: 'Transport', icon: 'bus' },
    'Dining & Café': { label: 'Dining & Café', icon: 'utensils' },
    'Shopping': { label: 'Shopping', icon: 'shopping-bag' },
    'Nature': { label: 'Nature', icon: 'leaf' },
    'Sport': { label: 'Sport', icon: 'dumbbell' },
  };

  for (const [category, config] of Object.entries(categoryConfig)) {
    const pois = nearbyData[category] || [];
    
    // Skip empty categories
    if (pois.length === 0) continue;

    let summary = '';

    if (category === 'Education') {
      // "3 écoles dans un rayon de 0.3 km"
      const closest = pois[0];
      summary = `${pois.length} écoles · À ${closest.km} km`;
    } 
    else if (category === 'Transport') {
      // "Arrêt Bus Ligne 52 · 2 min walk"
      const closest = pois[0];
      summary = `${closest.name} · ${closest.label}`;
    } 
    else if (category === 'Nature') {
      // "Parcs et espaces verts · X min walk"
      const closest = pois[0];
      summary = closest.name 
        ? `${closest.name} · ${closest.label}`
        : `Parcs et espaces verts à proximité`;
    } 
    else if (category === 'Dining & Café') {
      // If > 3, say "Nombreux restaurants", else closest name
      if (pois.length > 3) {
        summary = `Nombreux restaurants à proximité`;
      } else {
        const closest = pois[0];
        summary = `${closest.name} · ${closest.label}`;
      }
    } 
    else if (category === 'Shopping') {
      // "Azaza · 15 min walk"
      const closest = pois[0];
      summary = `${closest.name} · ${closest.label}`;
    } 
    else if (category === 'Sport') {
      // "Gym Centre · 0.5 km"
      const closest = pois[0];
      summary = `${closest.name} · ${closest.km} km`;
    }

    cards.push({
      icon: config.icon,
      label: config.label,
      summary: summary,
    });
  }

  // Return max 6 cards (ordered by category config)
  return cards.slice(0, 6);
}
```

### Step 3: Create `components/LifestyleSection.jsx`

**Renders 6 lifestyle cards in a 3-column grid:**
```jsx
import { summarizeLifestyle } from '../utils/summarizeLifestyle';
import './LifestyleSection.css';

export default function LifestyleSection({ nearbyData }) {
  const cards = summarizeLifestyle(nearbyData);

  if (cards.length === 0) {
    return null; // Don't render if no data
  }

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
            {/* Icon Badge */}
            <div className="icon-badge">
              <i className={`icon-${card.icon}`}></i>
            </div>

            {/* Category Label */}
            <h3 className="card-title">{card.label}</h3>

            {/* Summary Text */}
            <p className="card-summary">{card.summary}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

**CSS for styling (LifestyleSection.css):**
```css
.lifestyle-section {
  padding: 3rem 2rem;
  background: #f9f9f9;
  border-radius: 8px;
  margin: 2rem 0;
}

.lifestyle-section h2 {
  font-size: 1.8rem;
  font-weight: 600;
  margin-bottom: 2rem;
  color: #333;
}

.lifestyle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.lifestyle-card {
  padding: 2rem;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.lifestyle-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
}

/* Color variants */
.lifestyle-card.warm-yellow {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
}

.lifestyle-card.light-blue {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
}

.lifestyle-card.light-gray {
  background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
}

.icon-badge {
  width: 60px;
  height: 60px;
  margin: 0 auto 1rem;
  background: rgba(0,0,0,0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
}

.card-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #1f2937;
}

.card-summary {
  font-size: 0.95rem;
  color: #6b7280;
  line-height: 1.5;
  margin: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .lifestyle-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .lifestyle-grid {
    grid-template-columns: 1fr;
  }
}
```

### Step 4: NearbySection.jsx (Optional - Detailed View)

If you want to show all POIs, create a detailed section:

```jsx
export default function NearbySection({ nearbyData }) {
  return (
    <section className="nearby-section">
      <h2>Nearby Places</h2>
      
      <div className="nearby-categories">
        {Object.entries(nearbyData).map(([category, pois]) => {
          // Skip empty categories
          if (pois.length === 0) return null;

          return (
            <div key={category} className="category-group">
              <h3>{category}</h3>
              <ul>
                {pois.map((poi, idx) => (
                  <li key={idx}>
                    <span className="poi-name">{poi.name}</span>
                    <span className="poi-distance">{poi.km} km</span>
                    <span className="poi-time">{poi.label}</span>
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

## 6. Error Handling

```jsx
const [error, setError] = useState(null);

const fetchNearby = async () => {
  try {
    setLoadingNearby(true);
    const response = await fetch(
      `/nearby?lat=${property.location.lat}&lng=${property.location.lng}`
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.statusCode}`);
    }

    const data = await response.json();
    setNearbyData(data);
  } catch (err) {
    console.error('Failed to fetch nearby data:', err);
    setError('Could not load nearby information');
    // Gracefully degrade - render property without Nearby/Lifestyle sections
  } finally {
    setLoadingNearby(false);
  }
};
```

---

## 7. Testing Endpoints

### Test URLs
```
# Tunis Center (full data)
http://localhost:3000/nearby?lat=36.8065&lng=10.1957

# Hamam Lif (original test location)
http://localhost:3000/nearby?lat=36.729&lng=10.335

# La Marsa (coastal, fewer POIs)
http://localhost:3000/nearby?lat=36.8769&lng=10.3244

# Custom 1km radius
http://localhost:3000/nearby?lat=36.8065&lng=10.1957&radius=1000
```

---

## 8. Summary

| Component | Responsibility | Location |
|-----------|-----------------|----------|
| **PropertyDetail.jsx** | Fetch nearby data, manage state | Parent component |
| **NearbySection.jsx** | Display all POIs per category | Detailed view |
| **LifestyleSection.jsx** | Display 6 lifestyle cards | Summary view |
| **summarizeLifestyle.js** | Transform API data to cards | Utility function |

**Data Flow:**
```
PropertyDetail (fetch nearbyData)
    ↓
    ├→ NearbySection (all POIs)
    └→ LifestyleSection (6 cards via summarizeLifestyle)
```

---

## 9. Quick Reference

### What You Need
✅ Latitude & Longitude of property  
✅ Single fetch in PropertyDetail.jsx  
✅ Pass nearbyData as props to both sections  
✅ Icon library (react-icons recommended)  
✅ CSS for card styling  

### What You Don't Need
❌ Additional API endpoints  
❌ Multiple fetches per page  
❌ Backend changes  
❌ New authentication  

**Backend is production-ready. Frontend integration takes ~2-3 hours.**
