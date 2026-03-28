/**
 * Mongoose Model Template
 */

export const MODEL_TEMPLATE = `import mongoose from 'mongoose';

const <%= capitalize(resource.singular) %>Schema = new mongoose.Schema({
  <%= resource.name === 'user' ? \`
  username: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  firstName: { type: String },
  lastName: { type: String },
  role: { type: String, enum: ['student', 'organizer', 'admin'], default: 'student' },
  avatar: { type: String },
\` : resource.name === 'club' ? \`
  name: { type: String, required: true },
  description: { type: String },
  admin: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Types.ObjectId, ref: 'User' }],
  image: { type: String },
\` : resource.name === 'event' ? \`
  title: { type: String, required: true },
  description: { type: String },
  club: { type: mongoose.Types.ObjectId, ref: 'Club', required: true },
  date: { type: Date, required: true },
  location: { type: String },
  capacity: { type: Number },
  organizer: { type: mongoose.Types.ObjectId, ref: 'User' },
  image: { type: String },
\` : resource.name === 'registration' ? \`
  event: { type: mongoose.Types.ObjectId, ref: 'Event', required: true },
  user: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['confirmed', 'waitlist', 'cancelled'], default: 'confirmed' },
\` : \`
  name: { type: String, required: true },
  email: { type: String },
\` %>
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true, collection: '<%= resource.plural.toLowerCase() %>' });

const <%= capitalize(resource.singular) %> = mongoose.model('<%= capitalize(resource.singular) %>', <%= capitalize(resource.singular) %>Schema);
export default <%= capitalize(resource.singular) %>;
`;
