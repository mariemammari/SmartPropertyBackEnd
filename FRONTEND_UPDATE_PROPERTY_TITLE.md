# Frontend Update: New Property Title Field

## Change Summary
A new **`title`** field has been added to the Property schema to provide a custom, user-friendly name/title for each property listing.

---

## Details

### Field Name
**`title`**

### Data Type
`String`

### Status
- **Required** when creating a property (`POST /properties`)
- **Optional** when updating a property (`PATCH /properties/:id`)

### Location in API
- **Property Creation:** `POST /properties`
- **Property Update:** `PATCH /properties/:id`
- **Property Response:** Included in all property GET endpoints

---

## Usage Examples

### Creating a Property
```json
{
  "propertyType": "apartment",
  "type": "rent",
  "title": "Modern 3-Bedroom Apartment in Carthage",
  "description": "Spacious apartment with sea view",
  "price": 1500,
  "city": "Tunis",
  "address": "123 Rue de Carthage"
}
```

### Updating a Property
```json
{
  "title": "Beautiful Villa with Pool in Sidi Bou Said"
}
```

### Response Example
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "propertyType": "villa",
  "type": "sale",
  "title": "Beautiful Villa with Pool in Sidi Bou Said",
  "description": "...",
  "price": 450000,
  "city": "Sidi Bou Said",
  "createdAt": "2026-03-28T10:30:00Z",
  "updatedAt": "2026-03-28T10:30:00Z"
}
```

---

## Frontend Implementation Checklist

- [ ] Add `title` input field to property creation form
- [ ] Make `title` field required in create form validation
- [ ] Add `title` field to property edit form (optional)
- [ ] Display `title` prominently in property detail views
- [ ] Update property listing card to show title
- [ ] Add title to property search/filter results
- [ ] Use title in breadcrumbs/navigation
- [ ] Update form validation error messages

---

## Database Impact
- Existing properties may have `null` or missing `title` field
- Consider migration or populate on first update for existing records
- Use `description` as fallback if `title` is missing

---

## No Breaking Changes
This is a **backward compatible** change:
- Existing endpoint parameters remain unchanged
- New field is optional in updates
- API responses now include the new field

---

**Backend Implementation Date:** March 28, 2026  
**Implemented by:** Backend Team
