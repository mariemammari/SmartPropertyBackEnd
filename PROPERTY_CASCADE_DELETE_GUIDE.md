# Property & PropertyListing Module Guide

## Overview
This guide documents how the **Property** and **PropertyListing** modules work together, with special focus on cascade deletion: **when a property is deleted, all associated listings are automatically deleted**.

---

## 1. Property Module (`src/property/`)

### 1.1 What is a Property?
A **Property** represents the actual physical real estate (apartment, villa, house, etc.). It contains core information about the property itself.

### 1.2 Property Schema Fields

```typescript
{
  _id: ObjectId,
  propertyType: string,          // apartment, villa, house, etc.
  propertySubType: string,       // S, S+1, S+2, etc.
  type: enum,                    // 'rent' or 'sale'
  price: number,                 // Required
  description: string,
  status: enum,                  // available, rented, sold, inactive
  size: number,                  // in m²
  rooms: number,
  bedrooms: number,
  bathrooms: number,
  address: string,
  city: string,
  state: string,
  lat: number,
  lng: number,
  
  // ⭐ KEY FOR CASCADE DELETE
  createdBy: ObjectId (ref: User),   // User who created property
  ownerId: ObjectId (ref: User),     // Property owner
  branchId: string,                   // AUTO-ASSIGNED from authenticated user
  
  images: string[],
  createdAt: Date,
  updatedAt: Date
}
```

### 1.3 Property Creation Flow

```javascript
// Frontend sends (JWT token REQUIRED):
POST /property
{
  propertyType: "apartment",
  type: "rent",
  price: 500000,
  address: "123 Rue de la Paix",
  city: "Tunis",
  bedrooms: 2,
  // ... other fields ...
  // ❌ DO NOT send branchId - backend assigns it
}

// Backend (property.controller.ts):
@Post()
@UseGuards(JwtAuthGuard)
async create(@Body() dto: CreatePropertyDto, @Req() req) {
  // Extract user from JWT token
  const userId = req.user.sub;
  const userBranch = req.user.branchId;
  
  // Get full user object to access branchId
  const user = await this.userService.findById(userId);
  
  // Inject into DTO before saving
  dto.branchId = user.branchId;
  dto.createdBy = userId;
  dto.ownerId = userId;
  
  return this.propertyService.create(dto);
}

// Response (201 Created):
{
  _id: "property_123",
  propertyType: "apartment",
  branchId: "auto-assigned-from-jwt",  // ✅ Auto-assigned
  createdBy: "user_id",                // ✅ From JWT
  ownerId: "user_id",                  // ✅ From JWT
  // ... other fields ...
}
```

---

## 2. PropertyListing Module (`src/property-listing/`)

### 2.1 What is a PropertyListing?
A **PropertyListing** is the listing/advertisement of a property. It contains rental/sale terms, policies, and workflow status. **One property can have multiple listings** (e.g., same property listed in different markets or at different times).

### 2.2 PropertyListing Schema Fields

```typescript
{
  _id: ObjectId,
  
  // ⭐ CRITICAL: Reference to Property
  propertyId: ObjectId (ref: Property, REQUIRED),  // Links to which property
  
  // User references
  ownerId: ObjectId (ref: User, REQUIRED),
  createdBy: ObjectId (ref: User, REQUIRED),
  agentId: ObjectId (ref: User),
  branchId: ObjectId (ref: Branch),
  
  // Pricing
  price: number,
  isPriceNegotiable: boolean,
  monthlyCharges: number,
  
  // Details
  furnishingStatus: string,     // furnished, partially_furnished, unfurnished
  standing: string,              // haut_standing, standing, traditionnel, bas_standing
  wifiEthernet: boolean,
  
  // ⭐ STATUS WORKFLOW (Important for listing lifecycle)
  status: enum,  // draft → pending_review → approved → active → rented/sold/inactive
  
  // Review & Publishing
  submittedForReviewAt: Date,
  reviewedAt: Date,
  publishedAt: Date,
  expiresAt: Date,
  
  // Policies
  contractPolicies: { minDuration, depositMonths, petsAllowed, ... },
  housePolicies: { noSmoking, quietHours, ... },
  salePolicies: { paymentTerms, handoverDate, ... },
  
  // Fees
  fees: { rentAmount, depositAmount, agencyFees, ... },
  
  // Auto-generated
  referenceNumber: string,  // SP-TUN-2024-XXXXXX
  
  createdAt: Date,
  updatedAt: Date
}
```

---

## 3. ⭐ CASCADE DELETE IMPLEMENTATION

### 3.1 The Problem
Before this implementation, if you deleted a property:
- ❌ Property was deleted
- ❌ PropertyListing records remained in database (orphaned)
- ❌ Data integrity broken

**Result:** Zombie listings pointing to non-existent properties

### 3.2 The Solution
We implemented **cascade delete**: When a property is deleted, all associated listings are automatically deleted.

### 3.3 Code Changes

#### Change 1: PropertyModule.ts
**What we did:** Import PropertyListing schema into PropertyModule so PropertyService can access it

**Before:**
```typescript
@Module({
  providers: [PropertyService],
  controllers: [PropertyController],
  imports: [
    MongooseModule.forFeature([
      { name: Property.name, schema: PropertySchema }
      // ❌ PropertyListing NOT imported
    ]),
    forwardRef(() => NotificationModule)
  ],
  exports: [PropertyService]
})
export class PropertyModule {}
```

**After:**
```typescript
import { PropertyListing, PropertyListingSchema } from '../property-listing/schemas/property-listing.schema';

@Module({
  providers: [PropertyService],
  controllers: [PropertyController],
  imports: [
    MongooseModule.forFeature([
      { name: Property.name, schema: PropertySchema },
      { name: PropertyListing.name, schema: PropertyListingSchema }  // ✅ ADDED
    ]),
    forwardRef(() => NotificationModule)
  ],
  exports: [PropertyService]
})
export class PropertyModule {}
```

#### Change 2: PropertyService Constructor
**What we did:** Inject the PropertyListing model so we can query/delete listings

**Before:**
```typescript
constructor(
  @InjectModel('Property') private propertyModel: Model<PropertyDocument>
) {}
```

**After:**
```typescript
constructor(
  @InjectModel('Property') private propertyModel: Model<PropertyDocument>,
  @InjectModel('PropertyListing') private listingModel: Model<PropertyListingDocument>  // ✅ ADDED
) {}
```

#### Change 3: PropertyService remove() Method
**What we did:** Delete all listings associated with property BEFORE deleting property

**Before:**
```typescript
async remove(id: string) {
  const property = await this.propertyModel.findByIdAndDelete(id);
  if (!property) throw new NotFoundException('Property not found');
  return { message: 'Property deleted successfully' };
}
```

**After:**
```typescript
async remove(id: string) {
  // ✅ STEP 1: Delete all listings for this property
  await this.listingModel.deleteMany({ propertyId: id });
  
  // ✅ STEP 2: Delete the property
  const property = await this.propertyModel.findByIdAndDelete(id);
  if (!property) throw new NotFoundException('Property not found');
  
  return { message: 'Property and associated listings deleted successfully' };
}
```

### 3.4 How It Works

```
User clicks "Delete Property"
          ↓
Frontend sends: DELETE /property/property_123
          ↓
Backend PropertyController receives request
          ↓
PropertyService.remove('property_123') executes
          ↓
DATABASE TRANSACTION:
  1️⃣  DELETE all PropertyListing records WHERE propertyId = 'property_123'
      (e.g., 3 listings deleted if property had 3 listings)
          ↓
  2️⃣  DELETE Property record WHERE _id = 'property_123'
          ↓
DATABASE RESULT:
  ✅ Property deleted
  ✅ All associated listings deleted
  ✅ No orphaned records
          ↓
Return response: "Property and associated listings deleted successfully"
```

### 3.5 Example Scenario

```
BEFORE deletion:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PropertyListings table:
│ _id    │ propertyId │ status │ price    │
├────────┼────────────┼────────┼──────────┤
│ list1  │ prop_123   │ active │ 500000   │
│ list2  │ prop_123   │ draft  │ 500000   │
│ list3  │ prop_456   │ active │ 750000   │

Property table:
│ _id    │ propertyType │ city   │
├────────┼──────────────┼────────┤
│ prop_123 │ apartment  │ Tunis │
│ prop_456 │ villa      │ Sousse│


User deletes Property 'prop_123'
         ↓
         ↓
AFTER deletion:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PropertyListings table:
│ _id    │ propertyId │ status │ price    │
├────────┼────────────┼────────┼──────────┤
│ list3  │ prop_456   │ active │ 750000   │  ← Only this remains

Property table:
│ _id      │ propertyType │ city   │
├──────────┼──────────────┼────────┤
│ prop_456 │ villa        │ Sousse │ ← Only this remains

✅ list1 & list2 automatically deleted (cascade)
✅ prop_123 deleted
✅ No orphaned listings
```

---

## 4. Relationship Diagram

```
┌─────────────────┐
│   User/Agent    │
│   (creates)     │
└────────┬────────┘
         │
         │ creates
         ↓
┌─────────────────┐         ┌──────────────────────┐
│    Property     │◄───┐    │  PropertyListing[0] │
│                 │    │    │  (draft / active)    │
│  • propertyType │    │    └──────────────────────┘
│  • price        │    │
│  • address      │    ├───┐┌──────────────────────┐
│  • branchId     │    │   └─► PropertyListing[1] │
│  • createdBy    │    │    │  (pending_review)   │
└────────┬────────┘    │    └──────────────────────┘
         │             │
         │  CASCADE    │┌──────────────────────┐
         │  DELETE     └─► PropertyListing[2] │
         │             │  (approved)          │
         └─────────────┘  └──────────────────────┘

When Property is deleted:
  ↓
All PropertyListings pointing to it are AUTOMATICALLY deleted
  ↓
Maintains referential integrity
```

---

## 5. Frontend Integration

### 5.1 Delete Property Endpoint

```javascript
// Frontend code
const deleteProperty = async (propertyId) => {
  const response = await fetch(`${API_BASE}/property/${propertyId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${jwt_token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (response.ok) {
    const result = await response.json();
    // result.message = "Property and associated listings deleted successfully"
    console.log('Property and all its listings deleted');
    // Navigate away, refresh property list, etc.
  }
};
```

### 5.2 User Warning (Best Practice)

```javascript
// Before calling delete, warn user:
const handleDeleteProperty = (propertyId) => {
  const confirmDelete = window.confirm(
    '⚠️ WARNING: Deleting this property will also delete ALL associated listings. This action cannot be undone. Continue?'
  );
  
  if (confirmDelete) {
    deleteProperty(propertyId);
  }
};
```

---

## 6. Summary of Changes Made

| File | Change | Purpose |
|------|--------|---------|
| **PropertyModule.ts** | Added PropertyListing import to MongooseModule.forFeature() | Enable PropertyService to access PropertyListing model |
| **PropertyService Constructor** | Added `@InjectModel('PropertyListing')` | Inject listing model for deletion queries |
| **PropertyService.remove()** | Added `await this.listingModel.deleteMany({ propertyId: id })` | Delete all listings before deleting property |

---

## 7. Testing Cascade Delete

### Manual Test Steps

```bash
# 1. Create a property
POST /property
{
  "propertyType": "apartment",
  "type": "rent",
  "price": 500000,
  // ... other fields ...
}
Response: { _id: "prop_123", ... }

# 2. Create a listing for that property
POST /property-listing
{
  "propertyId": "prop_123",
  "price": 500000,
  // ... other fields ...
}
Response: { _id: "list_123", propertyId: "prop_123", ... }

# 3. Verify listing exists
GET /property-listing
Response: [{ _id: "list_123", propertyId: "prop_123", ... }]

# 4. Delete the property
DELETE /property/prop_123
Response: { 
  message: "Property and associated listings deleted successfully" 
}

# 5. Verify listing is GONE
GET /property-listing
Response: []  ← Empty! Listing was cascade deleted ✅
```

---

## 8. Key Points

✅ **What works now:**
- When a property is created, `branchId` is auto-assigned from authenticated user
- When a property is deleted, all its listings are automatically deleted
- Data integrity is maintained (no orphaned listings)

✅ **Important reminders:**
- Frontend should NOT send `branchId` - backend assigns it
- Frontend should warn users before property deletion
- One property can have multiple listings
- Cascade delete happens in right order (listings first, then property)

