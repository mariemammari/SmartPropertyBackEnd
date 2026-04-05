# 🚀 Guide Rapide - Tester le Workflow (5 min)

## ✅ Le serveur est déjà lancé!

Vous pouvez voir les routes dans le terminal:
```
✅ POST /property-submissions/client
✅ GET /property-submissions/assigned/pending
✅ PATCH /property-submissions/:id/approve
✅ PATCH /property-submissions/:id/reject
```

---

## 📥 Step 1: Importer dans Postman (2 min)

1. Ouvrez **Postman**
2. Cliquez **File → Import** (ou Ctrl+O)
3. Sélectionnez: `Property_Submission_Tests.postman_collection.json`
4. ✅ Fait!

Vous devez voir 8 tests:
- 1️⃣ CLIENT SUBMISSION
- 2️⃣ VALIDATION
- 3️⃣ NO AGENTS
- 4️⃣ AGENT VIEW
- 5️⃣ GET DETAILS
- 6️⃣ APPROVE
- 7️⃣ REJECT
- 8️⃣ SECURITY

---

## 🔑 Step 2: Passer les tokens (2 min)

### Vous avez besoin de 4 tokens JWT:

**Option rapide:** Depuis MongoDB (un vrai user qui existe):

```javascript
// Copie cet ID
db.users.findOne({role: "client"})._id
db.users.findOne({role: "real_estate_agent", status: "active"})._id  // Agent 1
db.users.findOne({role: "real_estate_agent", status: "active", _id: { $ne: ObjectId1 }})._id  // Agent 2
```

**Obtenir un token:**

```bash
curl -X POST http://localhost:3000/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client@example.com",
    "password": "password123"
  }'
```

Copie le `access_token` de la réponse.

### Dans Postman:

1. **Haut-droit → "Environment" dropdown**
2. **"Edit" or "+" pour créer/éditer**
3. Remplissez ces champs:
   - `baseUrl` → `http://localhost:3000`
   - `clientToken` → Ton token JWT client
   - `agentToken` → Token JWT agent 1
   - `agent2Token` → Token JWT agent 2
   - `branchId` → Un ObjectId de branche (ex: depuis MongoDB)
   - `emptyBranchId` → ObjectId d'une autre branche

4. **Save & Close**

---

## ▶️ Step 3: Lancer les tests! (1 min)

1. **Clique sur Test 1** → "CLIENT SUBMISSION"
2. **Clique "Send"** (bleu, haut-droit)
3. ✅ Tu dois voir:
   ```
   Status: 201
   {
     "listing": {
       "status": "pending_review",
       "submittedByClient": true,
       "assignmentStatus": "assigned",
       ...
     }
   }
   ```

4. **Le submissionId est sauvegardé automatiquement!** ✨

5. **Clique sur Test 4** → "AGENT: VIEW PENDING"
6. **Send**
7. ✅ Tu dois voir ta soumission dans la liste

8. **Clique sur Test 6** → "AGENT: APPROVE"
9. **Send**
10. ✅ Status change à "approved"

---

## 📊 Plus de détails?

Lire les guides complets:
- [PROPERTY_SUBMISSION_GUIDE.md](./PROPERTY_SUBMISSION_GUIDE.md) - Workflow complet
- [POSTMAN_TEST_GUIDE.md](./POSTMAN_TEST_GUIDE.md) - Chaque test détaillé
- [CURL_EXAMPLES.sh](./CURL_EXAMPLES.sh) - Exemples bash

---

## 🐛 Ça marche pas?

### ❌ "Cannot POST /property-submissions/client"
→ Le serveur ne reconnaît pas la route
→ Arrête le serveur (`Ctrl+C`)
→ Relance: `npm run start:dev`

### ❌ "Authorization required"
→ Le token est vide ou incorrect
→ Vérifie l'Environment Postman

### ❌ "branchId is required"
→ Remplis `branchId` dans l'Environment

### ❌ Tokens vides
→ Utilise `/auth/signin` pour en obtenir des nouveaux

---

## ✨ Fin!

Ça marche! 🎉

Tu as validé:
✅ Soumission client → auto-assignation
✅ Agent voit ses soumissions
✅ Approbation/Rejet
✅ Sécurité (mauvais agent bloqué)

Prêt à vérifier les changements! 🚀
