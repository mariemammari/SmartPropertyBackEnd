# Property & PropertyListing Schema Reference

## Property Schema

```typescript
{
  _id: ObjectId,
  
  // Basic Info
  propertyType: enum['apartment', 'villa', 'house', 'townhouse', 'penthouse', 'studio', 'duplex', 'commercial_space', 'office', 'land', 'garage', 'warehouse', 'other'],
  propertySubType: enum['S', 'S+1', 'S+2', 'S+3', 'S+4', 'S+5', 'S+6', 'STUDIO', 'OTHER'],
  type: enum['rent', 'sale'],
  
  // Pricing
  price: number (required, min: 0),
  monthlyCharges: number (min: 0, default: 0),
  
  // Description
  description: string,
  status: enum['available', 'rented', 'sold', 'inactive'],
  
  // Physical Characteristics
  size: number,                    // in m²
  rooms: number,
  bedrooms: number,
  bathrooms: number,
  floor: number,
  totalFloors: number,
  condition: string,               // e.g., "excellent", "good", "fair"
  yearBuilt: number,
  
  // Amenities (11 boolean flags)
  amenities: {
    hasGym: boolean,
    hasPool: boolean,
    hasParking: boolean,
    hasElevator: boolean,
    hasAc: boolean,
    hasHeating: boolean,
    hasSecurity24h: boolean,
    hasGarden: boolean,
    hasBalcony: boolean,
    hasTerrace: boolean,
    hasInternet: boolean
  },
  
  // Location
  address: string,
  city: string,
  state: string,                   // e.g., "TUN", "BEN", "ARY"
  neighborhood: string,
  postalCode: string,
  
  // Geolocation
  lat: number,
  lng: number,
  location: {
    type: 'Point',
    coordinates: [number, number]  // [longitude, latitude]
  },
  
  // Relationships
  createdBy: ObjectId (ref: User),
  ownerId: ObjectId (ref: User),
  branchId: string,                // AUTO-ASSIGNED FROM AUTHENTICATED USER
  
  // Media
  images: string[],                // Array of image URLs
  
  // Timestamps
  createdAt: Date (auto-set),
  updatedAt: Date (auto-set)
}
```

---

## PropertyListing Schema

```typescript
{
  _id: ObjectId,
  
  // Core References
  propertyId: ObjectId (ref: Property, required),
  ownerId: ObjectId (ref: User, required),
  createdBy: ObjectId (ref: User, required),
  agentId: ObjectId (ref: User),
  branchId: ObjectId (ref: Branch),
  
  // ─── PRICING SECTION ─────────────────────────────────
  price: number (required, min: 0),
  isPriceNegotiable: boolean (default: false),
  isPriceAIGenerated: boolean (default: false),
  monthlyCharges: number (min: 0, default: 0),
  
  // ─── DETAILS SECTION ─────────────────────────────────
  furnishingStatus: enum['furnished', 'partially_furnished', 'unfurnished'],
  standing: enum['haut_standing', 'standing', 'traditionnel', 'bas_standing'],
  wifiEthernet: boolean (default: false),
  
  // ─── STATUS WORKFLOW ─────────────────────────────────
  status: enum[
    'draft',          // Initial state
    'pending_review', // Awaiting admin approval
    'approved',       // Admin approved
    'active',         // Published to public
    'rented',         // Lease completed
    'sold',           // Sale completed
    'inactive',       // User deactivated
    'rejected',       // Admin rejected
    'archived'        // Old listing
  ] (default: 'draft', indexed),
  
  // ─── REVIEW PROCESS ─────────────────────────────────
  submittedForReviewAt: Date,
  reviewedAt: Date,
  reviewedBy: ObjectId (ref: User),
  rejectionReason: string,
  agentComments: string[] (default: []),
  
  // ─── PUBLISHING ─────────────────────────────────────
  publishedAt: Date,
  expiresAt: Date,
  
  // ─── REFERENCE NUMBER ───────────────────────────────
  referenceNumber: string (unique, sparse, auto-generated: 'SP-TUN-YYYY-XXXXXX'),
  
  // ─── CONTRACT POLICIES ──────────────────────────────
  contractPolicies: {
    minDuration: number (min: 1),
    maxDuration: number,
    noticePeriodDays: number (min: 0),
    depositMonths: number (min: 0),
    guarantorRequired: boolean (default: false),
    petsAllowed: boolean (default: false),
    sublettingAllowed: boolean (default: false)
  },
  
  // ─── HOUSE POLICIES ─────────────────────────────────
  housePolicies: {
    noSmoking: boolean (default: false),
    noPets: boolean (default: false),
    noParties: boolean (default: false),
    quietHours: string,
    visitorRules: string,
    cleaningSchedule: string
  },
  
  // ─── SALE POLICIES ──────────────────────────────────
  salePolicies: {
    paymentTerms: enum['cash', 'installment', 'bank_loan'],
    installmentDetails: string,
    mortgageAssistance: boolean (default: false),
    handoverDate: Date,
    includedFixtures: string[] (default: [])
  },
  
  // ─── FEES ───────────────────────────────────────────
  fees: {
    rentAmount: number (min: 0),
    depositAmount: number (min: 0),
    agencyFees: number (min: 0),
    commonCharges: number (min: 0),
    billsIncluded: boolean (default: false),
    billsDetails: string[] (default: [])
  },
  
  // ─── CUSTOM FIELDS ──────────────────────────────────
  customFields: Record<string, any> (default: {}),
  
  // ─── TIMESTAMPS ──────────────────────────────────────
  createdAt: Date (auto-set),
  updatedAt: Date (auto-set)
}
```

---

## User Schema (Relevant Fields)

```typescript
{
  _id: ObjectId,
  
  // Authentication
  email: string (unique, required),
  password: string (hashed with bcrypt, salt rounds: 10),
  
  // Identity
  fullName: string,
  firstName: string,
  lastName: string,
  dateOfBirth: Date (optional for ALL roles, ISO format),
  phone: string (required, regex: /^(\+|[0-9])[0-9\-\+]{7,}$/),
  
  // Profile
  photo: string (URL or base64),
  city: string,
  state: string,
  status: enum['active', 'inactive', 'suspended'] (default: 'active'),
  
  // Role & Branch
  role: enum[
    'SUPER_ADMIN',
    'BRANCH_MANAGER',
    'REAL_ESTATE_AGENT',
    'ACCOUNTANT',
    'CLIENT'
  ] (required),
  branchId: string (required for BRANCH_MANAGER, REAL_ESTATE_AGENT, ACCOUNTANT),
  
  // Relationships
  managedProperties: ObjectId[] (ref: Property),
  savedProperties: ObjectId[] (ref: Property),
  documents: string[],
  
  // AI Risk Score
  Ai_riskScore: number,
  
  // Password Reset
  resetPasswordToken: string,
  resetPasswordExpires: Date,
  
  // Timestamps
  createdAt: Date (auto-set),
  updatedAt: Date (auto-set)
}
```

---

## Data Relationships

```
User (REAL_ESTATE_AGENT)
├── has branchId: "branch_id_123"
└── creates Property
    ├── _id: "property_id"
    ├── createdBy: "agent_user_id"
    ├── ownerId: "agent_user_id"
    ├── branchId: "branch_id_123" (auto-assigned from agent)
    └── has PropertyListing (can have multiple)
        ├── propertyId: "property_id"
        ├── createdBy: "agent_user_id"
        ├── ownerId: "agent_user_id"
        ├── agentId: "agent_user_id"
        └── branchId: "branch_id_123"

CASCADE DELETE:
Property.delete() → deletes all PropertyListing records where propertyId matches
```

---

## Create Property Request/Response

### Request (POST /property)

```json
{
  "propertyType": "apartment",
  "propertySubType": "S+2",
  "type": "rent",
  "price": 500000,
  "description": "Modern apartment with parking",
  "status": "available",
  "monthlyCharges": 50000,
  "size": 85,
  "rooms": 3,
  "bedrooms": 2,
  "bathrooms": 1,
  "floor": 3,
  "totalFloors": 5,
  "condition": "excellent",
  "yearBuilt": 2022,
  "amenities": {
    "hasGym": true,
    "hasPool": false,
    "hasParking": true,
    "hasElevator": true,
    "hasAc": true,
    "hasHeating": false,
    "hasSecurity24h": true,
    "hasGarden": false,
    "hasBalcony": true,
    "hasTerrace": false,
    "hasInternet": true
  },
  "address": "123 Rue de la Paix",
  "city": "Tunis",
  "state": "TUN",
  "neighborhood": "La Marsa",
  "postalCode": "2070",
  "lat": 36.8971,
  "lng": 10.2897,
  "images": [
    "https://res.cloudinary.com/dxbtkryjy/image/upload/v1234567890/smart_property/image1.jpg"
  ]
}
```

**Headers Required:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### Response (201 Created)

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "propertyType": "apartment",
  "propertySubType": "S+2",
  "type": "rent",
  "price": 500000,
  "description": "Modern apartment with parking",
  "status": "available",
  "monthlyCharges": 50000,
  "size": 85,
  "rooms": 3,
  "bedrooms": 2,
  "bathrooms": 1,
  "floor": 3,
  "totalFloors": 5,
  "condition": "excellent",
  "yearBuilt": 2022,
  "amenities": {
    "hasGym": true,
    "hasPool": false,
    "hasParking": true,
    "hasElevator": true,
    "hasAc": true,
    "hasHeating": false,
    "hasSecurity24h": true,
    "hasGarden": false,
    "hasBalcony": true,
    "hasTerrace": false,
    "hasInternet": true
  },
  "address": "123 Rue de la Paix",
  "city": "Tunis",
  "state": "TUN",
  "neighborhood": "La Marsa",
  "postalCode": "2070",
  "lat": 36.8971,
  "lng": 10.2897,
  "location": {
    "type": "Point",
    "coordinates": [10.2897, 36.8971]
  },
  "createdBy": "507f1f77bcf86cd799439012",
  "ownerId": "507f1f77bcf86cd799439012",
  "branchId": "507f1f77bcf86cd799439013",
  "images": [
    "https://res.cloudinary.com/dxbtkryjy/image/upload/v1234567890/smart_property/image1.jpg"
  ],
  "createdAt": "2024-03-28T10:30:00Z",
  "updatedAt": "2024-03-28T10:30:00Z"
}
```

---

## Create PropertyListing Request/Response

### Request (POST /property-listing)

```json
{
  "propertyId": "507f1f77bcf86cd799439011",
  "ownerId": "507f1f77bcf86cd799439012",
  "agentId": "507f1f77bcf86cd799439012",
  "price": 500000,
  "isPriceNegotiable": true,
  "monthlyCharges": 50000,
  "furnishingStatus": "partially_furnished",
  "standing": "standing",
  "wifiEthernet": true,
  "status": "draft",
  "contractPolicies": {
    "minDuration": 12,
    "noticePeriodDays": 30,
    "depositMonths": 3,
    "petsAllowed": false,
    "sublettingAllowed": false
  },
  "housePolicies": {
    "noSmoking": true,
    "noPets": false,
    "quietHours": "22:00 - 07:00"
  },
  "fees": {
    "rentAmount": 500000,
    "depositAmount": 1500000,
    "agencyFees": 50000,
    "commonCharges": 50000,
    "billsIncluded": false
  },
  "customFields": {
    "schoolNearby": true,
    "parkingSpaces": 2
  }
}
```

### Response (201 Created)

```json
{
  "_id": "507f1f77bcf86cd799439020",
  "propertyId": "507f1f77bcf86cd799439011",
  "ownerId": "507f1f77bcf86cd799439012",
  "createdBy": "507f1f77bcf86cd799439012",
  "agentId": "507f1f77bcf86cd799439012",
  "branchId": "507f1f77bcf86cd799439013",
  "price": 500000,
  "isPriceNegotiable": true,
  "isPriceAIGenerated": false,
  "monthlyCharges": 50000,
  "furnishingStatus": "partially_furnished",
  "standing": "standing",
  "wifiEthernet": true,
  "status": "draft",
  "referenceNumber": "SP-TUN-2024-439020",
  "contractPolicies": {
    "minDuration": 12,
    "noticePeriodDays": 30,
    "depositMonths": 3,
    "guarantorRequired": false,
    "petsAllowed": false,
    "sublettingAllowed": false
  },
  "housePolicies": {
    "noSmoking": true,
    "noPets": false,
    "noParties": false,
    "quietHours": "22:00 - 07:00"
  },
  "fees": {
    "rentAmount": 500000,
    "depositAmount": 1500000,
    "agencyFees": 50000,
    "commonCharges": 50000,
    "billsIncluded": false,
    "billsDetails": []
  },
  "customFields": {
    "schoolNearby": true,
    "parkingSpaces": 2
  },
  "createdAt": "2024-03-28T10:35:00Z",
  "updatedAt": "2024-03-28T10:35:00Z"
}
```

---

## Key Notes for Frontend Implementation

1. **BranchId Auto-Assignment**: Never send `branchId` in property creation request - backend extracts it from JWT
2. **OwnerID & CreatedBy**: Automatically set from authenticated user - don't send manually
3. **Image URLs**: Must be valid Cloudinary URLs before sending to backend
4. **Cascade Delete**: When property is deleted, all associated listings are auto-deleted
5. **ListingStatus Workflow**: 
   - Users create listings as `draft`
   - Submit for review → `pending_review`
   - Admin approval → `approved`, then published → `active`
6. **Phone Format**: Must match regex `/^(\+|[0-9])[0-9\-\+]{7,}$/` (minimum 8 chars with +, -, or digits)

