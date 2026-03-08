export function generateServer(ir) {
  const imports = (ir.resources || [])
    .map((r) => `import ${r.name}Routes from './routes/${r.name}.routes.js';`)
    .join('\n');

  const routes = (ir.resources || [])
    .map((r) => `app.use('/api/${r.name}s', ${r.name}Routes);`)
    .join('\n');

  const serverCode = `import 'dotenv/config';\nimport express from 'express';\nimport cors from 'cors';\nimport mongoose from 'mongoose';\n${imports}\n\nconst app = express();\nconst PORT = process.env.PORT || 3000;\nconst MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/offbyte';\n\napp.use(cors());\napp.use(express.json());\n\n${routes}\n\nconst healthHandler = (req, res) => {\n  res.json({\n    status: 'ok',\n    timestamp: new Date().toISOString(),\n    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'\n  });\n};\n\napp.get('/health', healthHandler);\napp.get(`/api/health`, healthHandler);\n\napp.use((req, res) => {\n  res.status(404).json({\n    error: 'Not Found',\n    path: req.path,\n    method: req.method\n  });\n});\n\nasync function connectDB() {\n  try {\n    await mongoose.connect(MONGODB_URI, {\n      serverSelectionTimeoutMS: 5000\n    });\n    console.log('âœ… MongoDB Connected');\n  } catch (error) {\n    console.error('âŒ MongoDB Connection Failed:', error.message);\n    process.exit(1);\n  }\n}\n\nasync function startServer() {\n  await connectDB();\n  app.listen(PORT, () => {\n    console.log(\`ðŸš€ Server running on \${PORT}\`);\n  });\n}\n\nstartServer().catch((error) => {\n  console.error(error);\n  process.exit(1);\n});\n`;

  return {
    'server.js': serverCode
  };
}

export default generateServer;

