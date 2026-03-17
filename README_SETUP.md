# SmartProperty Backend - Setup Guide

## Installation des dépendances

```bash
npm install @nestjs/mongoose mongoose @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt class-validator class-transformer
npm install --save-dev @types/passport-jwt @types/bcrypt
```

## Configuration MongoDB

1. Assurez-vous que MongoDB est installé et en cours d'exécution
2. Créez un fichier `.env` à la racine du projet :

```env
MONGODB_URI=mongodb://localhost:27017/smartproperty
JWT_SECRET=your-super-secret-jwt-key-change-in-production
PORT=3000
FRONTEND_URL=http://localhost:5173
```

## Structure du module User

- **Schéma User** : `/src/user/schemas/user.schema.ts`
  - Contient tous les champs du data model
  - Rôles disponibles : SUPER_ADMIN, BRANCH_MANAGER, ACCOUNTANT, REAL_ESTATE_AGENT, RENTAL_MANAGER, PROPERTY_OWNER, TENANT

- **DTOs** : `/src/user/dto/`
  - `signup.dto.ts` : Validation des données d'inscription
  - `signin.dto.ts` : Validation des données de connexion

- **Service User** : `/src/user/user.service.ts`
  - Création d'utilisateur avec hashage du mot de passe
  - Recherche par email/ID
  - Validation des mots de passe

- **Service Auth** : `/src/auth/auth.service.ts`
  - Gestion de l'inscription et de la connexion
  - Génération de tokens JWT
  - Validation des utilisateurs

- **Contrôleur Auth** : `/src/auth/auth.controller.ts`
  - `POST /auth/signup` : Inscription
  - `POST /auth/signin` : Connexion
  - `GET /auth/profile` : Profil utilisateur (protégé par JWT)

## Démarrage

```bash
npm run start:dev
```

Le serveur démarre sur `http://localhost:3000`

## Endpoints API

### POST /auth/signup
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "state": "California",
  "city": "Los Angeles",
  "password": "password123",
  "dateOfBirth": "1990-01-01"
}
```

### POST /auth/signin
```json
{
  "email": "john@example.com",
  "password": "password123",
  "rememberMe": true
}
```

### GET /auth/profile
Headers: `Authorization: Bearer <token>`

## Sécurité

- Les mots de passe sont hashés avec bcrypt (10 rounds)
- JWT tokens expirent après 24h
- CORS configuré pour le frontend
- Validation des données avec class-validator

