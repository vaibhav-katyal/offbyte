
import mongoose from 'mongoose';

export async function connectDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/offbyte';
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('âœ… MongoDB Connected');
  } catch (error) {
    console.error('âŒ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
}
