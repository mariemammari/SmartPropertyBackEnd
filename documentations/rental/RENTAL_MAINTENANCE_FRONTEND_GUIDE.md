# 🔧 Rental Maintenance Frontend Integration Guide

## Overview

The **Rental Maintenance** module allows property owners and agents to track, manage, and resolve maintenance issues, inspections, and repairs on rental properties. This guide shows frontend developers how to integrate all endpoints and UI components.

---

## API Endpoints Summary

All endpoints require Bearer token in Authorization header.

### **1. Create Maintenance Task**
```
POST /rental-maintenance
Content-Type: application/json
Authorization: Bearer {token}

{
  "propertyId": "507f1f77bcf86cd799439011",      // Required: Property ObjectId
  "rentalId": "507f1f77bcf86cd799439012",        // Optional: Link to active rental
  "title": "Water leak in kitchen",               // Required
  "description": "Found water dripping...",       // Optional
  "photos": ["https://...photo1.jpg"],            // Optional
  "priority": "high",                             // Optional: low|medium|high
  "scheduledAt": "2026-04-15T10:00:00Z",         // Optional: When to schedule
  "costEstimate": 250                             // Optional: Estimated cost
}

Response 201:
{
  "_id": "507f1f77bcf86cd799439013",
  "propertyId": "507f1f77bcf86cd799439011",
  "rentalId": "507f1f77bcf86cd799439012",
  "reportedBy": { "_id": "...", "name": "John Doe" },
  "title": "Water leak in kitchen",
  "status": "open",
  "priority": "high",
  "photos": ["...jpg"],
  "createdAt": "2026-04-05T14:32:00Z",
  "updatedAt": "2026-04-05T14:32:00Z"
}
```

### **2. Get Single Maintenance Task**
```
GET /rental-maintenance/:taskId
Authorization: Bearer {token}

Response 200:
{
  "_id": "507f1f77bcf86cd799439013",
  "propertyId": { "_id": "...", "address": "123 Main St" },
  "reportedBy": { "_id": "...", "name": "John" },
  "assignedTo": { "_id": "...", "name": "Mike (Maintenance)" },
  "title": "Water leak in kitchen",
  "description": "Found water dripping from ceiling",
  "status": "in_progress",
  "priority": "high",
  "photos": ["https://...photo1.jpg"],
  "scheduledAt": "2026-04-15T10:00:00Z",
  "costEstimate": 250,
  "actualCost": null,
  "notes": [
    "Created by user john-123",
    "Assigned to user mike-456"
  ],
  "createdAt": "2026-04-05T14:32:00Z"
}
```

### **3. Get Maintenance Tasks for Property**
```
GET /rental-maintenance/property/:propertyId?status=open&priority=high&assignedTo=user-id

Query Parameters (all optional):
  ?status=open          // Filter by status
  ?priority=high        // Filter by priority
  ?assignedTo=user-id   // Filter by assigned user

Response 200:
[
  { task object },
  { task object },
  ...
]
```

### **4. Get Maintenance Tasks for Rental (Property Detail Page)**
```
GET /rental-maintenance/rental/:rentalId
Returns ONLY open/in-progress/needs_approval tasks for this rental agreement

Response 200:
[
  { 
    "_id": "507f...",
    "title": "Post-Rental Property Inspection",
    "status": "open",
    "priority": "high",
    "createdAt": "2026-04-05T14:32:00Z"
  },
  ...
]
```

### **5. Update Maintenance Task**
```
PATCH /rental-maintenance/:taskId
Authorization: Bearer {token}

{
  "title": "Updated title",                    // Optional
  "description": "Updated description",       // Optional
  "status": "in_progress",                    // Optional: open|in_progress|needs_approval|completed|cancelled
  "priority": "high",                         // Optional: low|medium|high
  "scheduledAt": "2026-04-15T10:00:00Z",     // Optional
  "actualCost": 300,                          // Optional: Set when completing
  "assignedToId": "507f1f77bcf86cd799439099", // Optional: Assign to user
  "photos": ["...new photo"],                 // Optional: Add photos
  "notes": ["Photo taken, waiting for approval"] // Optional: Add notes
}

Response 200: Updated task object
```

### **6. Assign Task to User**
```
PATCH /rental-maintenance/:taskId/assign
Authorization: Bearer {token}

{
  "userId": "507f1f77bcf86cd799439099"
}

Response 200: Updated task (status auto-set to in_progress)
```

### **7. Mark Task as Completed**
```
PATCH /rental-maintenance/:taskId/complete
Authorization: Bearer {token}

{
  "actualCost": 275  // Required: Final cost
}

Response 200: Updated task (status=completed, completedAt=now)
```

### **8. Add Note/Comment to Task**
```
POST /rental-maintenance/:taskId/notes
Authorization: Bearer {token}

{
  "note": "Photo evidence attached. Ready for approval."
}

Response 200: Updated task with new note added
```

---

## Frontend Implementation Examples

### **1. Property Detail Page — Show Maintenance Tab**

```javascript
// On rental property detail page
async function loadPropertyMaintenance(rentalId) {
  const res = await fetch(`/rental-maintenance/rental/${rentalId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const tasks = await res.json();
  
  // Display in UI
  renderMaintenanceTasks(tasks);  // Show list with badges
}

// Helper: Render maintenance tasks
function renderMaintenanceTasks(tasks) {
  const statusStyles = {
    'open': { color: 'red', icon: '🔴' },
    'in_progress': { color: 'orange', icon: '🟠' },
    'needs_approval': { color: 'yellow', icon: '🟡' },
    'completed': { color: 'green', icon: '🟢' },
    'cancelled': { color: 'gray', icon: '⚫' },
  };
  
  tasks.forEach(task => {
    const style = statusStyles[task.status];
    console.log(`
      ${style.icon} [${task.status}] ${task.title}
      Priority: ${task.priority}
      Created: ${new Date(task.createdAt).toLocaleDateString()}
      <button onclick="editTask('${task._id}')">Edit</button>
    `);
  });
}
```

### **2. Create Maintenance Task Form (Agent/Owner)**

```javascript
async function submitMaintenanceForm(formData) {
  const payload = {
    propertyId: formData.propertyId,
    rentalId: formData.rentalId || undefined,
    title: formData.title,
    description: formData.description,
    priority: formData.priority,  // 'low' | 'medium' | 'high'
    scheduledAt: formData.scheduledDate ? new Date(formData.scheduledDate) : undefined,
    costEstimate: parseFloat(formData.costEstimate) || undefined,
    photos: await uploadPhotos(formData.photoFiles),  // [URLs]
  };
  
  const res = await fetch('/rental-maintenance', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  
  if (res.ok) {
    const task = await res.json();
    showNotification(`✅ Task created: ${task._id}`);
    navigateTo(`/maintenance/${task._id}`);
  } else {
    showError('Failed to create task');
  }
}
```

### **3. Maintenance Task Detail Modal/Page**

```javascript
async function viewMaintenanceDetail(taskId) {
  const res = await fetch(`/rental-maintenance/${taskId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  
  const task = await res.json();
  
  // Display task details
  displayTaskUI(task);
}

function displayTaskUI(task) {
  const html = `
    <div class="maintenance-card">
      <h2>${task.title}</h2>
      <p>${task.description}</p>
      
      <!-- Status badge -->
      <span class="badge status-${task.status}">${task.status}</span>
      <span class="badge priority-${task.priority}">${task.priority}</span>
      
      <!-- Photos -->
      ${task.photos?.map(url => `<img src="${url}" width="200">`).join('')}
      
      <!-- Details -->
      <div class="grid">
        <div><strong>Reported:</strong> ${task.reportedBy?.name}</div>
        <div><strong>Assigned:</strong> ${task.assignedTo?.name || 'Unassigned'}</div>
        <div><strong>Date:</strong> ${new Date(task.createdAt).toLocaleDateString()}</div>
        <div><strong>Est. Cost:</strong> €${task.costEstimate || 'TBD'}</div>
        ${task.actualCost ? `<div><strong>Actual Cost:</strong> €${task.actualCost}</div>` : ''}
      </div>
      
      <!-- Notes/Comments -->
      <div class="notes">
        ${task.notes?.map(note => `<p class="note-item">📝 ${note}</p>`).join('')}
      </div>
      
      <!-- Actions -->
      ${isAgent || isOwner ? `
        <button onclick="assignTask('${task._id}')">Assign</button>
        <button onclick="editTask('${task._id}')">Edit</button>
      ` : ''}
      
      ${isMaintenanceWorker && task.status === 'in_progress' ? `
        <button onclick="completeTask('${task._id}')">Mark Complete</button>
      ` : ''}
    </div>
  `;
  
  document.getElementById('maintenance-detail').innerHTML = html;
}
```

### **4. Assign Maintenance Worker**

```javascript
async function assignTask(taskId) {
  const workerId = prompt('Enter maintenance worker ID or select from dropdown');
  
  const res = await fetch(`/rental-maintenance/${taskId}/assign`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId: workerId }),
  });
  
  if (res.ok) {
    const task = await res.json();
    showNotification(`✅ Task assigned to ${task.assignedTo.name}`);
    displayTaskUI(task);
  }
}
```

### **5. Complete Maintenance Task with Cost**

```javascript
async function completeTask(taskId) {
  const actualCost = prompt('Enter actual cost (e.g., 275)');
  
  if (!actualCost || isNaN(actualCost)) {
    showError('Please enter a valid cost');
    return;
  }
  
  const res = await fetch(`/rental-maintenance/${taskId}/complete`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ actualCost: parseFloat(actualCost) }),
  });
  
  if (res.ok) {
    const task = await res.json();
    showNotification(`✅ Task marked complete. Cost: €${task.actualCost}`);
    displayTaskUI(task);
  }
}
```

### **6. Add Comment to Task**

```javascript
async function addNote(taskId) {
  const note = prompt('Add a note/update:');
  
  if (!note) return;
  
  const res = await fetch(`/rental-maintenance/${taskId}/notes`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ note }),
  });
  
  if (res.ok) {
    const task = await res.json();
    showNotification('✅ Note added');
    refreshTaskUI(task);
  }
}
```

---

## UI Mockups & Components

### **Property Detail Page — Maintenance Tab**

```
┌─────────────────────────────────────────────────┐
│ 🔧 Maintenance (3)                              │
├─────────────────────────────────────────────────┤
│                                                  │
│ 🔴 OPEN — Water leak in kitchen [HIGH]          │
│    Reported 2 days ago                          │
│    Est. Cost: €250 | Assigned: Unassigned      │
│    [Assign] [Edit]                             │
│                                                  │
│ 🟠 IN_PROGRESS — Broken AC unit [MEDIUM]        │
│    Reported 5 days ago                          │
│    Assigned to: Mike Johnson                    │
│    Est. Cost: €600 | Actual: €575              │
│    [View] [Mark Complete]                      │
│                                                  │
│ 🟢 COMPLETED — Door lock replacement [LOW]      │
│    Completed 1 day ago                          │
│    Cost: €120                                   │
│    [Details]                                    │
│                                                  │
├─────────────────────────────────────────────────┤
│ [+ New Maintenance Task]                        │
└─────────────────────────────────────────────────┘
```

### **Maintenance Detail Modal**

```
┌──────────────────────────────────────────┐
│ Water leak in kitchen                    │
├──────────────────────────────────────────┤
│                                           │
│ [Photo 1] [Photo 2]                      │
│                                           │
│ Status:        🔴 OPEN                   │
│ Priority:      HIGH                      │
│ Reported by:   John Tenant               │
│ Assigned to:   [Unassigned ▼]            │
│ Created:       Apr 5, 2026               │
│                                           │
│ Description:                              │
│ Water dripping from ceiling in kitchen   │
│ Found near window area...                │
│                                           │
│ Estimated Cost: €250                     │
│ Scheduled:      Apr 15, 2026 10:00 AM    │
│                                           │
│ Notes:                                    │
│ 📝 Created by user john-123              │
│ 📝 Photo taken, waiting for approval     │
│                                           │
│ [Add Comment] [Edit] [Mark Complete]    │
│                                           │
└──────────────────────────────────────────┘
```

---

## Integration Points

### **1. From Property Listing Page (Agent)**
- Click property → Show "Maintenance" tab
- Count badge: "🔧 Maintenance (3)" where 3 = open tasks
- Sort properties by "Most maintenance needs" to track problem properties

### **2. From Property Detail (Owner/Agent)**
- Display "Recent Maintenance" widget
- Show assigned worker's contact info
- Allow inline status updates (dropdown: open → in_progress → completed)

### **3. From Rental Agreement Page**
- Auto-load maintenance for this rental
- Auto-create "Post-Rental Inspection" when `RENTAL_ENDED` (scheduler does this automatically)
- Show inspection status when property moves to `RENTAL_ENDED`

### **4. From Admin/Dashboard**
- Show all open maintenance tasks across all properties
- Filter by priority, property, assigned user
- Track average completion time, total costs

---

## Data Types & Enums

```typescript
// Status
type MaintenanceStatus = 'open' | 'in_progress' | 'needs_approval' | 'completed' | 'cancelled';

// Priority
type MaintenancePriority = 'low' | 'medium' | 'high';

// Task object
interface RentalMaintenance {
  _id: string;
  propertyId: Property;
  rentalId?: Rental;
  reportedBy: User;
  assignedTo?: User;
  title: string;
  description?: string;
  photos?: string[];  // URLs
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  scheduledAt?: Date;
  completedAt?: Date;
  costEstimate?: number;
  actualCost?: number;
  notes?: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Testing Checklist

- [ ] Create maintenance task via form → verify in DB and UI
- [ ] Assign task to maintenance worker → verify assignedTo updated
- [ ] View task detail → all fields populate correctly
- [ ] Add note/comment → appended to notes array
- [ ] Mark complete with cost → status changes, actualCost set, completedAt updated
- [ ] Filter tasks by status/priority → correct subset returned
- [ ] Auto-inspection created when property moves to RENTAL_ENDED (scheduler runs daily)
- [ ] Mobile responsiveness: forms, modals, task cards
- [ ] Pagination for property with 50+ tasks

---

## Error Handling

```javascript
// Common error responses
400: { message: "propertyId is required" }
400: { message: "actualCost is required to mark as completed" }
404: { message: "Maintenance task not found" }
500: { message: "Internal server error" }

// Handle in UI
if (res.status === 400) {
  const err = await res.json();
  showError(err.message);  // Show to user
} else if (res.status === 404) {
  redirectTo('/404');
} else if (res.status === 500) {
  showError('Server error. Please try again.');
}
```

---

## Next Steps (Backend Ready)

✅ All endpoints implemented and functional  
✅ Auto-inspection task created on rental expiry  
✅ Permissions: owners, agents, maintenance workers all have appropriate access  

Frontend To-Do:
1. [ ] Integrate endpoints into property detail & rental pages
2. [ ] Create maintenance forms with photo upload
3. [ ] Build task detail modal/page
4. [ ] Add filter/search by status, priority
5. [ ] Show maintenance badge counts on property cards
6. [ ] Implement permission checks (agent vs owner vs worker)
7. [ ] Add loading states & error messages
8. [ ] Test on mobile

---

**Questions?** Backend team ready to help with schema extends or custom queries.  
Endpoints live at: `POST|GET|PATCH /rental-maintenance*` 🚀
