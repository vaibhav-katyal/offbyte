# Offbyt - Automatic Backend Generation

**Scan frontend → Auto-generate production backend in seconds** 

Offbyt detects your frontend API calls and generates an enterprise-grade Express.js + MongoDB backend with CRUD, authentication, validation, rate limiting, caching, and Socket.io—100% offline, no AI needed.

## ⚡ Quick Start

```bash
npm install -g offbyt
offbyt generate        # Generate backend (interactive setup)
cd backend && npm run dev   # Run backend on http://localhost:5000
```

## 🚀 Main Features

✅ **Auto-Generated Backend** - Express.js, NestJS, or Fastify  
✅ **Multiple Databases** - MongoDB, PostgreSQL, MySQL, SQLite  
✅ **Complete CRUD APIs** - Pagination, search, filtering, sorting  
✅ **Authentication** - JWT, OAuth, or Session-based  
✅ **Security** - Rate limiting, input validation, Helmet.js, CORS  
✅ **Performance** - Compression, caching, database indexes  
✅ **Real-time Chat** - Socket.io with messaging, typing indicators  
✅ **Frontend Integration** - Auto-connect URLs, sync changes  
✅ **One-Command Deploy** - Vercel/Netlify + Railway/Render  
✅ **Performance Testing** - Load testing & optimization recommendations  

## 📚 Commands

| Command | Purpose |
|---------|---------|
| `offbyt generate` | Generate backend (interactive setup) |
| `offbyt generate --quick` | Generate with defaults |
| `offbyt compile` | Auto-connect frontend & backend URLs |
| `offbyt sync` | Update backend when frontend changes |
| `offbyt benchmark` | Performance & scalability testing |
| `offbyt deploy --full` | Deploy frontend + backend (Vercel + Railway) |
| `offbyt generate-api` | Generate APIs from frontend state patterns |
| `offbyt doctor` | System health check |

## 🎯 Generated Backend Structure

```
backend/
├── server.js              # Express entry point
├── package.json           # Dependencies
├── .env                   # Environment config
├── routes/                # API endpoints
├── models/                # Mongoose schemas
├── middleware/            # Error handling, logging, auth
├── controllers/           # Business logic
├── config/                # Database config
└── utils/                 # Utilities
```

## ⚙️ Environment Setup

```bash
MONGODB_URI=mongodb://localhost:27017/myapp
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

## 🔄 Typical Workflow

```bash
# 1. Generate backend from frontend
offbyt generate

# 2. Start backend
cd backend && npm run dev

# 3. Connect frontend with backend
offbyt connect .

# 4. When frontend changes, sync backend
offbyt sync

# 5. Test performance before production
offbyt benchmark

# 6. Deploy
offbyt deploy --full
```

## 🛠️ Customization

### Add Custom Routes
```javascript
// backend/routes/custom.routes.js
import express from 'express';
const router = express.Router();

router.get('/custom', (req, res) => {
  res.json({ message: 'Custom route' });
});

export default router;
```

Then register in `server.js`:
```javascript
import customRoutes from './routes/custom.routes.js';
app.use('/api', customRoutes);
```

## 🐛 Troubleshooting

**MongoDB connection failed?**
```bash
mongod  # Start MongoDB locally
# Or use MongoDB Atlas → update MONGODB_URI in .env
```

**Port 5000 already in use?**
```bash
# Change in .env
PORT=5001
```

**Dependencies installation failed?**
```bash
cd backend && npm install --legacy-peer-deps
```

## 📋 Requirements

- Node.js 18+
- npm 9+
- MongoDB (local or Atlas)

## ✨ Advanced Features

- **Mongoose Hooks** - Pre/post save, update, delete  
- **Soft Delete** - Data recovery without hard delete  
- **Bulk Operations** - Create/update/delete multiple records  
- **Virtual Fields** - Computed properties  
- **Health Check Endpoint** - `/health`  
- **Graceful Shutdown** - Proper database disconnection  


---

**Built for developers who want to focus on building, not boilerplate.**