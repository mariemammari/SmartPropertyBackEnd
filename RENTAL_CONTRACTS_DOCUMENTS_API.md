# Rental Contracts & Documents API Documentation

This documentation covers all endpoints for managing rental contracts and documents in the Smart Property Backend.

## Base URL
```
/rental-documents
```

All endpoints require Bearer token authentication.

## Table of Contents
- [Contracts](#contracts)
  - [Create Contract](#create-contract)
  - [Get Contracts](#get-contracts)
  - [Get Latest Contract](#get-latest-contract)
  - [Get Specific Contract](#get-specific-contract)
  - [Sign Contract](#sign-contract)
  - [Download Contract](#download-contract)
  - [Archive Contract](#archive-contract)
- [Documents](#documents)
  - [Upload Document](#upload-document)
  - [Get Documents](#get-documents)
  - [Get Specific Document](#get-specific-document)
  - [Update Document](#update-document)
  - [Download Document](#download-document)
  - [Delete Document](#delete-document)

---

## Contracts

### Create Contract
Create a new rental contract version.

**Endpoint:**
```
POST /rental-documents/contracts
```

**Required Roles:** ACCOUNTANT, REAL_ESTATE_AGENT, SUPER_ADMIN

**Request Body:**
```json
{
  "rentalId": "65f3a1b2c7d8e9f0a1b2c3d4",
  "contractType": "standard",
  "templateId": "template-001",
  "startDate": "2024-01-15",
  "endDate": "2025-01-15",
  "terms": "Standard rental agreement with maintenance clause",
  "signatures": {
    "owner": false,
    "tenant": false
  },
  "documentUrl": "https://cloudinary.com/contracts/contract-signed-2024.pdf",
  "publicId": "smart-property/contracts/rental-001",
  "fileName": "Rental_Agreement_2024.pdf"
}
```

**Response:**
```json
{
  "_id": "65f4c2d8e1f3a5b7c9d1e2f3",
  "rentalId": "65f3a1b2c7d8e9f0a1b2c3d4",
  "contractType": "standard",
  "templateId": "template-001",
  "startDate": "2024-01-15T00:00:00.000Z",
  "endDate": "2025-01-15T00:00:00.000Z",
  "terms": "Standard rental agreement with maintenance clause",
  "versionNumber": 1,
  "status": "draft",
  "signatures": {
    "owner": {
      "signed": false,
      "signedAt": null,
      "signedBy": null
    },
    "tenant": {
      "signed": false,
      "signedAt": null,
      "signedBy": null
    }
  },
  "documentUrl": "https://cloudinary.com/contracts/contract-signed-2024.pdf",
  "fileName": "Rental_Agreement_2024.pdf",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "createdBy": "user-001"
}
```

---

### Get Contracts
Get all contract versions for a specific rental.

**Endpoint:**
```
GET /rental-documents/contracts?rentalId={rentalId}
```

**Query Parameters:**
- `rentalId` (required): MongoDB ObjectId of the rental

**Response:**
```json
[
  {
    "_id": "65f4c2d8e1f3a5b7c9d1e2f3",
    "rentalId": "65f3a1b2c7d8e9f0a1b2c3d4",
    "contractType": "standard",
    "versionNumber": 1,
    "status": "pending_signature",
    "signatures": {
      "owner": {
        "signed": true,
        "signedAt": "2024-01-20T14:22:00.000Z",
        "signedBy": "owner-001"
      },
      "tenant": {
        "signed": false,
        "signedAt": null,
        "signedBy": null
      }
    },
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  {
    "_id": "65f4c2d8e1f3a5b7c9d1e2f4",
    "versionNumber": 2,
    "status": "draft",
    "createdAt": "2024-01-18T09:45:00.000Z"
  }
]
```

---

### Get Latest Contract
Get the most recent contract version for a rental.

**Endpoint:**
```
GET /rental-documents/contracts/rental/{rentalId}/latest
```

**Path Parameters:**
- `rentalId`: MongoDB ObjectId of the rental

**Response:**
```json
{
  "_id": "65f4c2d8e1f3a5b7c9d1e2f3",
  "versionNumber": 1,
  "status": "pending_signature",
  "signatures": {...}
}
```

---

### Get Specific Contract
Get a contract by ID with full details.

**Endpoint:**
```
GET /rental-documents/contracts/{contractId}
```

**Path Parameters:**
- `contractId`: MongoDB ObjectId of the contract

**Response:** Full contract object (see Create Contract response)

---

### Sign Contract
Sign a contract as the authenticated user (owner or tenant).

**Endpoint:**
```
PATCH /rental-documents/contracts/{contractId}/sign
```

**Path Parameters:**
- `contractId`: MongoDB ObjectId of the contract

**Request Body:**
```json
{
  "signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR",
  "signerType": "owner"
}
```

**Response:**
```json
{
  "_id": "65f4c2d8e1f3a5b7c9d1e2f3",
  "status": "pending_signature",
  "signatures": {
    "owner": {
      "signed": true,
      "signedAt": "2024-01-25T10:15:00.000Z",
      "signedBy": "65f3a1b2c7d8e9f0a1b2c3d5",
      "signature": "data:image/png;base64,..."
    },
    "tenant": {
      "signed": false,
      "signedAt": null,
      "signedBy": null
    }
  }
}
```

---

### Download Contract
Get a download URL for the contract PDF.

**Endpoint:**
```
GET /rental-documents/contracts/{contractId}/download
```

**Response:**
```json
{
  "url": "https://cloudinary.com/contracts/contract-001.pdf?fl_attachment:Rental_Agreement_2024.pdf",
  "fileName": "Rental_Agreement_2024.pdf"
}
```

**Frontend Usage:**
```typescript
// Fetch download URL
const response = await fetch(`/rental-documents/contracts/${contractId}/download`, {
  headers: { 'Authorization': 'Bearer token' }
});
const data = await response.json();

// Trigger download
const link = document.createElement('a');
link.href = data.url;
link.download = data.fileName;
link.click();
```

---

### Archive Contract
Archive a contract (soft delete).

**Endpoint:**
```
PATCH /rental-documents/contracts/{contractId}/archive
```

**Response:**
```json
{
  "_id": "65f4c2d8e1f3a5b7c9d1e2f3",
  "isArchived": true,
  "archivedAt": "2024-02-01T08:30:00.000Z"
}
```

---

## Documents

### Upload Document
Upload a rental document (invoice, inspection report, inventory list, etc.).

**Endpoint:**
```
POST /rental-documents
```

**Required Roles:** Any user with rental access

**Request Body:**
```json
{
  "rentalId": "65f3a1b2c7d8e9f0a1b2c3d4",
  "documentType": "invoice",
  "title": "Monthly Rent Invoice - January 2024",
  "description": "Invoice for January 2024 rent payment",
  "documentUrl": "https://cloudinary.com/documents/invoice-jan-2024.pdf",
  "publicId": "smart-property/documents/invoice-001",
  "fileName": "Invoice_January_2024.pdf",
  "isPublic": true,
  "visibleToUserIds": ["65f3a1b2c7d8e9f0a1b2c3d5", "65f3a1b2c7d8e9f0a1b2c3d6"],
  "expiresAt": "2025-01-15"
}
```

**Response:**
```json
{
  "_id": "65f4d3e9f2g4b6c8d0e2f3g4",
  "rentalId": "65f3a1b2c7d8e9f0a1b2c3d4",
  "documentType": "invoice",
  "title": "Monthly Rent Invoice - January 2024",
  "description": "Invoice for January 2024 rent payment",
  "documentUrl": "https://cloudinary.com/documents/invoice-jan-2024.pdf",
  "fileName": "Invoice_January_2024.pdf",
  "isPublic": true,
  "visibleTo": ["65f3a1b2c7d8e9f0a1b2c3d5", "65f3a1b2c7d8e9f0a1b2c3d6"],
  "uploadedBy": {
    "_id": "65f3a1b2c7d8e9f0a1b2c3d7",
    "fullName": "John Agent",
    "email": "john@example.com"
  },
  "uploadedAt": "2024-01-15T11:22:00.000Z",
  "expiresAt": "2025-01-15T00:00:00.000Z",
  "isDeleted": false
}
```

---

### Get Documents
Get all documents for a rental, with optional filtering.

**Endpoint:**
```
GET /rental-documents?rentalId={rentalId}&documentType={type}
```

**Query Parameters:**
- `rentalId` (required): MongoDB ObjectId of the rental
- `documentType` (optional): Filter by document type (invoice, inspection, inventory, contract, other)

**Example Requests:**
```
GET /rental-documents?rentalId=65f3a1b2c7d8e9f0a1b2c3d4
GET /rental-documents?rentalId=65f3a1b2c7d8e9f0a1b2c3d4&documentType=invoice
```

**Response:**
```json
[
  {
    "_id": "65f4d3e9f2g4b6c8d0e2f3g4",
    "rentalId": "65f3a1b2c7d8e9f0a1b2c3d4",
    "documentType": "invoice",
    "title": "Monthly Rent Invoice - January 2024",
    "uploadedBy": {
      "_id": "65f3a1b2c7d8e9f0a1b2c3d7",
      "fullName": "John Agent"
    },
    "uploadedAt": "2024-01-15T11:22:00.000Z"
  },
  {
    "_id": "65f4d3e9f2g4b6c8d0e2f3g5",
    "rentalId": "65f3a1b2c7d8e9f0a1b2c3d4",
    "documentType": "inspection",
    "title": "Move-in Inspection Report",
    "uploadedAt": "2024-01-14T09:15:00.000Z"
  }
]
```

---

### Get Specific Document
Get a single document by ID.

**Endpoint:**
```
GET /rental-documents/{documentId}
```

**Path Parameters:**
- `documentId`: MongoDB ObjectId of the document

**Response:** Full document object (see Upload Document response)

---

### Update Document
Update document metadata (visibility, title, expiration, notes).

**Endpoint:**
```
PATCH /rental-documents/{documentId}
```

**Path Parameters:**
- `documentId`: MongoDB ObjectId of the document

**Request Body:**
```json
{
  "title": "Updated Invoice Title",
  "description": "New description",
  "isPublic": false,
  "visibleToUserIds": ["65f3a1b2c7d8e9f0a1b2c3d8"],
  "expiresAt": "2024-12-31",
  "notes": "Updated visibility restrictions"
}
```

**Response:** Updated document object

---

### Download Document
Get a download URL for a document.

**Endpoint:**
```
GET /rental-documents/{documentId}/download
```

**Response:**
```json
{
  "url": "https://cloudinary.com/documents/invoice-jan-2024.pdf?fl_attachment:Invoice_January_2024.pdf",
  "fileName": "Invoice_January_2024.pdf"
}
```

---

### Delete Document
Delete a document (soft delete - sets isDeleted flag).

**Endpoint:**
```
DELETE /rental-documents/{documentId}
```

**Response:**
```json
{
  "_id": "65f4d3e9f2g4b6c8d0e2f3g4",
  "isDeleted": true,
  "deletedAt": "2024-01-20T14:30:00.000Z"
}
```

---

## Document Types

The system supports the following document types:

| Type | Description | Example |
|------|-------------|---------|
| `invoice` | Monthly rent invoices and billing statements | Monthly_Invoice_Jan_2024.pdf |
| `inspection` | Move-in/move-out inspection reports | MoveIn_Inspection_Report.pdf |
| `inventory` | Property inventory lists with photos | Inventory_List_with_Photos.pdf |
| `contract` | Rental agreements and amendments | Rental_Agreement_2024.pdf |
| `maintenance` | Maintenance records and repair logs | Maintenance_Log_2024.pdf |
| `other` | Any other document type | Custom_Agreement.pdf |

---

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "rentalId, documentUrl, and documentType are required",
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "User must be authenticated"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Document not found",
  "error": "Not Found"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Only document uploader can modify",
  "error": "Forbidden"
}
```

---

## Frontend Integration Examples

### Upload Document from Frontend
```typescript
// 1. Upload file to Cloudinary (or your storage)
const formData = new FormData();
formData.append('file', file);
formData.append('upload_preset', 'your_preset');

const cloudinaryResponse = await fetch(
  'https://api.cloudinary.com/v1_1/your_cloud/auto/upload',
  { method: 'POST', body: formData }
);

const { secure_url, public_id } = await cloudinaryResponse.json();

// 2. Save document reference in backend
const response = await fetch('/rental-documents', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    rentalId,
    documentType: 'invoice',
    title: 'Monthly Invoice',
    documentUrl: secure_url,
    publicId: public_id,
    fileName: file.name,
    isPublic: true
  })
});

const document = await response.json();
console.log('Document uploaded:', document._id);
```

### Sign Contract from Frontend
```typescript
// Get signature from canvas or input
const signatureUrl = canvas.toDataURL('image/png');

const response = await fetch(`/rental-documents/contracts/${contractId}/sign`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    signature: signatureUrl,
    signerType: 'owner'
  })
});

const signedContract = await response.json();
```

### List and Download Documents
```typescript
// Fetch all documents for rental
const response = await fetch(
  `/rental-documents?rentalId=${rentalId}&documentType=invoice`,
  { headers: { 'Authorization': 'Bearer ' + token } }
);

const documents = await response.json();

// Download a document
const downloadResponse = await fetch(
  `/rental-documents/${documentId}/download`,
  { headers: { 'Authorization': 'Bearer ' + token } }
);

const { url, fileName } = await downloadResponse.json();

// Trigger browser download
const link = document.createElement('a');
link.href = url;
link.download = fileName;
link.click();
```

---

## Cloudinary Configuration

To use the document system with Cloudinary:

1. **Add credentials to `.env`:**
```
CLOUDINARY_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

2. **Frontend: Generate upload widget:**
```typescript
import CloudinaryWidget from 'next-cloudinary';

export function DocumentUploader({ onUpload }) {
  return (
    <CloudinaryWidget
      onSuccess={(result) => {
        onUpload({
          url: result.info.secure_url,
          publicId: result.info.public_id,
          fileName: result.info.original_filename
        });
      }}
    />
  );
}
```

3. **Backend: Configure Cloudinary client** (already handled in schemas)

---

## Permissions & Access Control

### View/List Documents
- Owner: All documents for their rental
- Tenant: Only public documents + documents marked visible to them
- Agent/Accountant: All documents for their managed rentals
- Admin: All documents

### Modify Documents
- Only the uploader can update or delete
- System allows modification of: title, description, visibility, expiration

### Delete Contracts
- Only system admin can delete contracts
- Contract deletion is permanent

---

## Best Practices

1. **File Naming:** Use descriptive names with dates
   - ✅ `Invoice_January_2024.pdf`
   - ❌ `document1.pdf`

2. **Document Types:** Use correct types for filtering
   - Match related documents to their class

3. **Visibility:** Default is public, restrict as needed
   - Use `isPublic: false` + `visibleToUserIds` for sensitive docs

4. **Expiration:** Set for time-sensitive documents
   - Auto-archived after expiration
   - Useful for inspection reports, temporary notices

5. **Versioning:** Store multiple contract versions
   - System automatically increments version numbers
   - Old versions remain accessible

---

## Testing the API

Use Postman or curl to test endpoints:

```bash
# Get all documents for a rental
curl -X GET "http://localhost:3000/rental-documents?rentalId=65f3a1b2c7d8e9f0a1b2c3d4" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create a document
curl -X POST "http://localhost:3000/rental-documents" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rentalId": "65f3a1b2c7d8e9f0a1b2c3d4",
    "documentType": "invoice",
    "title": "Test Invoice",
    "documentUrl": "https://example.com/invoice.pdf",
    "fileName": "invoice.pdf"
  }'

# Sign a contract
curl -X PATCH "http://localhost:3000/rental-documents/contracts/65f4c2d8e1f3a5b7c9d1e2f3/sign" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "signature": "data:image/png;base64,...",
    "signerType": "owner"
  }'
```

---

## Related Documentation
- [Property Cascade Delete Guide](./PROPERTY_CASCADE_DELETE_GUIDE.md)
- [Rental Payment Processing](./NEARBY_LIFESTYLE_INTEGRATION_GUIDE.md)
