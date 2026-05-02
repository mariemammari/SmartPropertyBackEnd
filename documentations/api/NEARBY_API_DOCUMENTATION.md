# Nearby Feature — Backend API Documentation

## Endpoint

```
GET /nearby?lat=36.729&lng=10.335&radius=2000
```

---

## Query Parameters

| Parameter | Type | Required | Default | Range | Description |
|-----------|------|----------|---------|-------|-------------|
| `lat` | number | ✅ Yes | N/A | -90 to 90 | Property latitude |
| `lng` | number | ✅ Yes | N/A | -180 to 180 | Property longitude |
| `radius` | number | ❌ No | 2000 | 500-∞ | Search radius in meters |

---

## Success Response

**Status:** `200 OK`

```json
{
  "Education": [
    {
      "name": "École Primaire Bassatine",
      "km": 0.3,
      "label": "4 min walk"
    },
    {
      "name": "Lycée Carthage",
      "km": 0.8,
      "label": "9 min walk"
    }
  ],
  "Transport": [
    {
      "name": "Tunis Metro - Carthage Station",
      "km": 0.2,
      "label": "2 min walk"
    },
    {
      "name": "Bus Stop 115",
      "km": 0.5,
      "label": "6 min walk"
    }
  ],
  "Dining & Café": [
    {
      "name": "Café La Paix",
      "km": 0.1,
      "label": "1 min walk"
    },
    {
      "name": "Restaurant Océan",
      "km": 0.4,
      "label": "5 min walk"
    }
  ],
  "Shopping": [
    {
      "name": "Carrefour Hypermarket",
      "km": 1.2,
      "label": "3 min drive"
    }
  ]
}
```

---

## Field Explanation

- **`name`** - Name of the POI (Point of Interest)
- **`km`** - Distance from property in kilometers (1 decimal place)
- **`label`** - Human-readable time estimate
  - Shows **walk time** if ≤ 20 minutes
  - Shows **drive time** if > 20 minutes

---

## Error Responses

### Missing or Invalid Coordinates

**Status:** `400 Bad Request`

```json
{
  "statusCode": 400,
  "message": "Latitude and longitude are required",
  "error": "Bad Request"
}
```

### Invalid Latitude/Longitude Range

**Status:** `400 Bad Request`

```json
{
  "statusCode": 400,
  "message": "Invalid coordinates",
  "error": "Bad Request"
}
```

### Overpass API Failure

**Status:** `400 Bad Request`

```json
{
  "statusCode": 400,
  "message": "Failed to fetch nearby locations from Overpass API",
  "error": "Bad Request"
}
```

---

## Usage Example (Frontend)

```javascript
// Fetch nearby locations
const response = await fetch(
  `/nearby?lat=36.729&lng=10.335&radius=2000`
);
const data = await response.json();

// data = {
//   "Education": [...],
//   "Transport": [...],
//   "Dining & Café": [...],
//   "Shopping": [...]
// }
```

---

## Categories

| Category | Includes |
|----------|----------|
| **Education** | Schools, colleges, universities |
| **Transport** | Bus stops, train stations, metro stations, tram stops |
| **Dining & Café** | Restaurants, cafes, fast food, bars |
| **Shopping** | Malls, supermarkets, convenience stores |

---

## Data Source

- **API:** Overpass API (uses OpenStreetMap data)
- **Cost:** Free, no authentication required
- **Quality:** Depends on OSM community contributions (generally good in major cities)

---

## Performance Notes

- Response time: 1-3 seconds (depends on Overpass API load)
- Max 5 results per category
- Only includes named POIs (no unnamed locations)
- Results sorted by distance (closest first)

---

## Integration with Property Detail Page

```jsx
// Property Detail Component
import NearbySection from '@/components/NearbySection';

export const PropertyDetail = ({ property }) => {
  return (
    <div>
      <h1>{property.title}</h1>
      {/* ... other property info ... */}
      
      {/* Nearby section */}
      {property.lat && property.lng && (
        <NearbySection lat={property.lat} lng={property.lng} />
      )}
    </div>
  );
};
```

---

## Testing

Use Postman or curl to test:

```bash
# Test with sample coordinates (Carthage, Tunisia)
curl "http://localhost:3000/nearby?lat=36.729&lng=10.335"

# With custom radius (5km)
curl "http://localhost:3000/nearby?lat=36.729&lng=10.335&radius=5000"
```

---

**Backend Ready:** March 28, 2026  
**Awaiting:** Frontend integration
