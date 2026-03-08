import mongoose from 'mongoose';

const __MODEL_NAME__Schema = new mongoose.Schema(
  {
/* __FIELDS__ */
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    metadata: {
      updatedBy: mongoose.Schema.Types.ObjectId,
      version: { type: Number, default: 1 },
      tags: [String]
    }
  },
  { 
    timestamps: true,
    collection: '__COLLECTION_NAME__'
  }
);

// ============================================================
// INDEXES FOR PERFORMANCE
// ============================================================
__MODEL_NAME__Schema.index({ createdAt: -1 });
__MODEL_NAME__Schema.index({ updatedAt: -1 });
__MODEL_NAME__Schema.index({ isActive: 1 });
__MODEL_NAME__Schema.index({ isDeleted: 1, createdAt: -1 });

// ============================================================
// HOOKS
// ============================================================
__MODEL_NAME__Schema.pre('save', function(next) {
  if (this.isModified()) {
    this.metadata.version = (this.metadata.version || 0) + 1;
  }
  next();
});

// ============================================================
// QUERY HELPERS
// ============================================================
__MODEL_NAME__Schema.query.active = function() {
  return this.find({ isActive: true, isDeleted: false });
};

// ============================================================
// STATIC METHODS
// ============================================================
__MODEL_NAME__Schema.statics.findAllActive = async function(options = {}) {
  return this.find({ isActive: true, isDeleted: false })
    .sort(options.sort || { createdAt: -1 })
    .limit(options.limit || 100)
    .skip(options.skip || 0);
};

__MODEL_NAME__Schema.statics.softDelete = async function(id) {
  return this.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { new: true }
  );
};

// ============================================================
// INSTANCE METHODS
// ============================================================
__MODEL_NAME__Schema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

const __MODEL_NAME__ = mongoose.model('__MODEL_NAME__', __MODEL_NAME__Schema);

export default __MODEL_NAME__;
