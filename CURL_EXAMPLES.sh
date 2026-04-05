#!/bin/bash
# Property Submission Workflow - cURL Examples
# Run each command one by one to test the workflow

# ═══════════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════════

BASE_URL="http://localhost:3000"
CLIENT_TOKEN="YOUR_CLIENT_TOKEN_HERE"
AGENT_TOKEN="YOUR_AGENT_TOKEN_HERE"
AGENT2_TOKEN="YOUR_AGENT2_TOKEN_HERE"
BRANCH_ID="YOUR_BRANCH_ID_HERE"
EMPTY_BRANCH_ID="YOUR_EMPTY_BRANCH_ID_HERE"

# ═══════════════════════════════════════════════════════════════════════════════
# 1️⃣ CLIENT: Submit Property (Auto-Assignment)
# ═══════════════════════════════════════════════════════════════════════════════

echo "█ TEST 1: Client submits property..."
curl -X POST "$BASE_URL/property-submissions/client" \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "'$BRANCH_ID'",
    "propertyType": "villa",
    "type": "sale",
    "title": "Villa Carthage",
    "description": "Beautiful villa via cURL",
    "price": 450000,
    "bedrooms": 4,
    "bathrooms": 2,
    "size": 250,
    "city": "Tunis",
    "address": "Carthage Avenue",
    "lat": 36.85,
    "lng": 10.33,
    "furnishingStatus": "unfurnished",
    "standing": "haut_standing"
  }' | jq .

# ➜ Save the returned submission._id as $SUBMISSION_ID
# SUBMISSION_ID="copy_from_response"

echo -e "\n✅ Submission created. Copy the _id and set as SUBMISSION_ID\n"

# ═══════════════════════════════════════════════════════════════════════════════
# 2️⃣ VALIDATION: Missing branchId
# ═══════════════════════════════════════════════════════════════════════════════

echo "█ TEST 2: Validation - Missing branchId..."
curl -X POST "$BASE_URL/property-submissions/client" \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyType": "villa",
    "type": "sale",
    "price": 450000
  }' | jq .

echo -e "\n✅ Expected: 422 Unprocessable Entity\n"

# ═══════════════════════════════════════════════════════════════════════════════
# 3️⃣ AGENT: View Pending Submissions
# ═══════════════════════════════════════════════════════════════════════════════

echo "█ TEST 3: Agent views pending submissions..."
curl -X GET "$BASE_URL/property-submissions/assigned/pending?page=1&limit=10" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" | jq .

echo -e "\n✅ Sample agent submissions returned\n"

# ═══════════════════════════════════════════════════════════════════════════════
# 4️⃣ AGENT: Get Submission Details
# ═══════════════════════════════════════════════════════════════════════════════

echo "█ TEST 4: Get submission details..."
# Replace SUBMISSION_ID with actual ID from TEST 1
curl -X GET "$BASE_URL/property-submissions/SUBMISSION_ID" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" | jq .

echo -e "\n✅ Full submission details with populated refs\n"

# ═══════════════════════════════════════════════════════════════════════════════
# 5️⃣ AGENT: Approve Submission
# ═══════════════════════════════════════════════════════════════════════════════

echo "█ TEST 5: Agent approves submission..."
curl -X PATCH "$BASE_URL/property-submissions/SUBMISSION_ID/approve" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agentComments": "Excellent property, all checks passed"
  }' | jq .

echo -e "\n✅ Submission approved. Status→approved, property→available\n"

# ═══════════════════════════════════════════════════════════════════════════════
# 6️⃣ AGENT: Reject Submission
# ═══════════════════════════════════════════════════════════════════════════════

echo "█ TEST 6: Agent rejects submission..."
# Create a new submission first (run TEST 1 again), then use its ID
curl -X PATCH "$BASE_URL/property-submissions/SUBMISSION_ID_2/reject" \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rejectionReason": "Poor quality photos",
    "agentComments": "Please provide professional photography"
  }' | jq .

echo -e "\n✅ Submission rejected. Status→rejected, property stays inactive\n"

# ═══════════════════════════════════════════════════════════════════════════════
# 7️⃣ SECURITY: Wrong Agent Cannot Approve
# ═══════════════════════════════════════════════════════════════════════════════

echo "█ TEST 7: Security - Wrong agent tries to approve..."
# This uses AGENT2_TOKEN (different agent than who is assigned)
curl -X PATCH "$BASE_URL/property-submissions/SUBMISSION_ID/approve" \
  -H "Authorization: Bearer $AGENT2_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agentComments": "I will approve this"
  }' | jq .

echo -e "\n✅ Expected: 400 - Only assigned agent can approve\n"

# ═══════════════════════════════════════════════════════════════════════════════
# 8️⃣ Database Check (Optional MongoDB)
# ═══════════════════════════════════════════════════════════════════════════════

echo "█ TEST 8: MongoDB Check (if you have mongosh)..."
echo "Run this in MongoDB Compass or mongosh:"
echo ""
echo "db.property_listings.findOne({submittedByClient: true})"
echo "db.property_listings.find({assignmentStatus: 'assigned'}).count()"
echo "db.users.findOne({_id: ObjectId('AGENT_ID')}).lastAssignedAt"
echo ""
echo "✅ Verify fields are populated correctly"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 💡 NOTES
# ═══════════════════════════════════════════════════════════════════════════════

cat << 'EOF'

💡 Quick Tips:
  1. All tokens must be JWT from /auth/signin
  2. Replace SUBMISSION_ID, SUBMISSION_ID_2, etc. with actual values
  3. Pipe to | jq . for pretty JSON output (requires jq)
  4. All tests use environment variables - configure them at the top
  5. Each test returns response data needed for next test

🎯 Test Order:
  1. Submit property
  2. Validation error
  3. View pending
  4. Get details
  5. Approve
  6. Reject (need new submission)
  7. Security test
  8. Verify in MongoDB

✅ Expected Results Summary:
  ✓ Client submission creates pending_review listing
  ✓ Missing branchId returns 422
  ✓ Agent sees only assigned submissions
  ✓ Approval changes status to "approved"
  ✓ Rejection changes status to "rejected"
  ✓ Wrong agent gets 400 error
  ✓ Database fields populated correctly

EOF
