# 🚀 Guide de Test Postman - Property Submission Workflow

## 📥 Étape 1: Importer la Collection

1. **Ouvrez Postman**
2. **Cliquez sur "Import"** (bouton haut-gauche)
3. **Sélectionnez le fichier:** `Property_Submission_Tests.postman_collection.json`
4. ✅ Vous voyez 8 requêtes prêtes à tester

---

## 🔑 Étape 2: Configurer l'Environment

Avant de tester, vous devez remplir les **Environment Variables**:

### 📍 Dans Postman: "Environments" (haut-droit) → "Edit" on "Property Submission Workflow"

Remplissez ces variables:

| Variable | Valeur | Comment Obtenir |
|----------|--------|-----------------|
| `baseUrl` | `http://localhost:3000` | Déjà rempli ✅ |
| `clientToken` | JWT d'un user CLIENT | 👇 Voir "Obtenir les tokens" |
| `agentToken` | JWT d'un REAL_ESTATE_AGENT (branchId1) | 👇 Voir "Obtenir les tokens" |
| `agent2Token` | JWT d'un autre REAL_ESTATE_AGENT (branchId1) | 👇 Voir "Obtenir les tokens" |
| `branchId` | ObjectId d'une branche | Ex: `507f1f77bcf86cd799439011` |
| `emptyBranchId` | ObjectId d'une branche sans agents | Une branche alternative |

---

## 🔐 Obtenir les JW Tokens

### Option 1: Utiliser le endpoint d'authentification (si disponible)

```bash
curl -X POST http://localhost:3000/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"client@example.com","password":"password123"}'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {...}
}
```

Copiez le `access_token` et mettez-le dans `clientToken`

### Option 2: Depuis MongoDB (direct)

Si vous avez accès MongoDB Atlas:

```javascript
// Connexion MongoDB
db.users.findOne({role: "client"}).then(user => console.log(user._id))
db.users.findOne({role: "real_estate_agent", branchId: "YOUR_BRANCH_ID"}).then(u => console.log(u._id))
```

Utilisez les `_id` pour générer les tokens (ou copiez depuis votre frontend)

---

## ✅ Étape 3: Exécuter les Tests

### 🧪 Test 1️⃣: Client Submission (Auto-Assignment)

1. **Cliquez sur:** "1️⃣ CLIENT SUBMISSION - WITH AGENT"
2. **Cliquez "Send"**
3. **Résultat attendu:**
   - ✅ Status 201 ou 200
   - ✅ `listing.status` = `"pending_review"`
   - ✅ `listing.submittedByClient` = `true`
   - ✅ `listing.assignmentStatus` = `"assigned"` ou `"unassigned"`
   - ℹ️ **Notez le `submissionId`** affiché en vert (sera auto-sauvegardé)

### 🧪 Test 2️⃣: Validation - branchId Manquant

1. **Cliquez sur:** "2️⃣ VALIDATION - MISSING branchId"
2. **Cliquez "Send"**
3. **Résultat attendu:**
   - ✅ Status 422 (Unprocessable Entity)
   - ✅ Message d'erreur mentionne "branchId"

### 🧪 Test 3️⃣: Pas d'Agents - Fallback

1. **Cliquez sur:** "3️⃣ NO AGENTS - Fallback to unassigned"
2. **Assurez-vous d'avoir rempli `emptyBranchId`**
3. **Cliquez "Send"**
4. **Résultat attendu:**
   - ✅ Status 200
   - ✅ `assignmentStatus` = `"unassigned"`
   - ✅ `assignedAgentId` = `null`
   - ✅ `warning` est présent

### 🧪 Test 4️⃣: Agent Voit ses Soumissions

1. **Cliquez sur:** "4️⃣ AGENT: View My Pending Submissions"
2. **Cliquez "Send"**
3. **Résultat attendu:**
   - ✅ Status 200
   - ✅ Array de `data` contenant les soumissions assignées
   - ℹ️ Vous devriez voir la soumission du Test 1

### 🧪 Test 5️⃣: Détails de la Soumission

1. **Cliquez sur:** "5️⃣ AGENT: GET Submission Details"
2. **Cliquez "Send"**
3. **Résultat attendu:**
   - ✅ Status 200
   - ✅ Tous les champs complétés (propertyId, ownerId, etc.)
   - ✅ Agent peut voir les détails complets

### 🧪 Test 6️⃣: Agent Approuve

1. **Cliquez sur:** "6️⃣ AGENT: APPROVE Submission"
2. **Cliquez "Send"**
3. **Résultat attendu:**
   - ✅ Status 200
   - ✅ `status` = `"approved"`
   - ✅ `reviewedBy` et `reviewedAt` renseignés
   - ✅ Message de succès
   - 💡 En BD: `property.status` → `"available"`

### 🧪 Test 7️⃣: Agent Rejette

⚠️ **Important:** Créez d'abord une nouvelle soumission (Test 1) pour avoir un nouveau `submissionId2`

1. **Dans Test 1, notez le response `submissionId`**
2. **Remplissez `submissionId2` dans l'Environment** (avec le nouvel ID)
3. **Cliquez sur:** "7️⃣ AGENT: REJECT Submission"
4. **Cliquez "Send"**
5. **Résultat attendu:**
   - ✅ Status 200
   - ✅ `status` = `"rejected"`
   - ✅ `rejectionReason` = votre texte
   - ✅ `reviewedBy` et `reviewedAt` renseignés
   - 💡 En BD: `property.status` reste `"inactive"`

### 🧪 Test 8️⃣: Sécurité - Mauvais Agent

1. **Cliquez sur:** "8️⃣ SECURITY: Wrong Agent Cannot Approve"
2. **Cliquez "Send"** (utilise `agent2Token` au lieu d'`agentToken`)
3. **Résultat attendu:**
   - ✅ Status 400 (Bad Request)
   - ✅ Message: "Only the assigned agent can approve"
   - ✅ Sécurité validée ✓

---

## 📊 Résumé des Résultats

Si tous les tests passent ✅:

```
✅ Client submissions créent property (inactive) + listing (pending_review)
✅ Auto-assignment au meilleur agent (least-loaded)
✅ Fallback à unassigned si pas d'agents
✅ Agent ne voit que SES soumissions
✅ Approval/Rejection transitions d'état
✅ Sécurité: agent non-assigné bloqué
```

---

## 🐛 Troubleshooting

### ❌ "Cannot find module" Error

→ Redémarrez le serveur: `npm run start:dev`

### ❌ Tokens vides

→ Remplissez les Environment Variables avant de tester

### ❌ "Authorization required"

→ Vérifiez que le token commence par `Bearer ` dans la request

### ❌ "branchId is required"

→ Remplissez `branchId` et `emptyBranchId` dans l'Environment

### ❌ Status 500

→ Vérifiez les logs du serveur pour voir l'erreur exacte

---

## 📈 Tests Avancés (Optional)

### Tester la Fairness (Least-Loaded)

1. Créez **5 soumissions d'affilée** (Test 1, 5 fois)
2. Vérifiez en **MongoDB** ou request **Test 4**:
   - Les soumissions sont distribuées entre les agents
   - Agent 1 a 2 soumissions, Agent 2 a 2, Agent 3 a 1
   - Distribution équilibrée ✓

### Tester la Distribution

```bash
# Depuis Terminal MongoDB
db.property_listings.find({submittedByClient: true, status: "pending_review"})
  .forEach(doc => print(doc.assignedAgentId + " - Workload"))
```

---

## 📝 Notes

- **Environment variables** sauvegardent les `submissionId` automatiquement après Test 1, 2, 3
- **Chaque test a des assertions** (vérifications automatiques)
- **Les logs Console** montrent des messages détaillés
- **Conservation d'état:** `submissionId` persiste entre les tests

---

Vous êtes prêt! 🎉

**Commencez par Test 1, puis allez séquentiellement jusqu'à Test 8.**
