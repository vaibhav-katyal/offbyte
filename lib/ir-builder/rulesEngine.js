/**
 * Rules Engine - Field Detection & Type Resolution
 * Professional approach: Rules define how to detect & validate fields
 * NOT hardcoded if/else logic
 */

/**
 * Core Rules - What defines each field type
 * Pattern: fieldNamePattern → fieldType + validators + properties
 */
const FIELD_RULES = {
  // Email Field
  email: {
    patterns: ['email', 'emailaddress', 'e-mail', 'user_email'],
    type: 'String',
    properties: {
      lowercase: true,
      trim: true,
      match: '/.+\\@.+\\..+/'
    },
    validators: ['email', 'required'],
    description: 'Email field with validation'
  },

  // Password Fields
  password: {
    patterns: ['password', 'passwd', 'pwd', 'confirmpassword', 'newpassword'],
    type: 'String',
    properties: {
      select: false, // Don't return in queries
      minlength: 6
    },
    validators: ['required', 'hash'],
    hooks: ['hash-before-save'],
    description: 'Password field - auto hashed'
  },

  // Phone Numbers
  phone: {
    patterns: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'contact'],
    type: 'String',
    properties: {
      match: '/^\\d{10,}$/'
    },
    validators: ['phone'],
    description: 'Phone number with validation'
  },

  // URLs
  url: {
    patterns: ['url', 'website', 'link', 'profileurl', 'avatar', 'image', 'photo'],
    type: 'String',
    properties: {
      trim: true
    },
    validators: ['url'],
    description: 'URL field with validation'
  },

  // Dates
  date: {
    patterns: ['date', 'createddate', 'duedate', 'deadline', 'startdate', 'enddate', 'publishdate', 'birthdate'],
    type: 'Date',
    properties: {},
    validators: ['date'],
    description: 'Date field'
  },

  // Boolean Fields
  boolean: {
    patterns: ['active', 'inactive', 'completed', 'published', 'verified', 'approved', 'enabled', 'disabled', 'public', 'private', 'is_', 'has_'],
    type: 'Boolean',
    properties: {
      default: false
    },
    validators: [],
    description: 'Boolean flag field'
  },

  // Numbers - Price/Cost
  price: {
    patterns: ['price', 'cost', 'amount', 'rate', 'salary', 'fee', 'charge', 'total'],
    type: 'Number',
    properties: {
      default: 0,
      min: 0
    },
    validators: ['number', 'positive'],
    description: 'Monetary value'
  },

  // Numbers - Count/Rating
  count: {
    patterns: ['count', 'views', 'likes', 'downloads', 'rating', 'score', 'points', 'stars'],
    type: 'Number',
    properties: {
      default: 0,
      min: 0
    },
    validators: ['number'],
    description: 'Numeric counter field'
  },

  // ID/Reference Fields
  reference: {
    patterns: ['id', 'userid', 'authorid', 'postid', 'productid', 'categoryid', 'ownerid', 'createdby', 'updatedby', '_id', 'ref_'],
    type: 'ObjectId',
    properties: {
      ref: 'AUTO' // Ref determined by field name
    },
    validators: [],
    hooks: ['resolve-reference'],
    description: 'Reference to another document'
  },

  // Status Enum
  status: {
    patterns: ['status', 'state', 'condition'],
    type: 'String',
    properties: {
      enum: ['active', 'inactive', 'pending', 'archived', 'deleted'],
      default: 'active'
    },
    validators: ['enum'],
    description: 'Status field with predefined values'
  },

  // Array of Strings
  tags: {
    patterns: ['tags', 'categories', 'keywords', 'labels', 'skills', 'interests'],
    type: 'Array',
    properties: {
      itemType: 'String'
    },
    validators: ['array'],
    description: 'List of string values'
  },

  // Rich Text/Markdown
  text: {
    patterns: ['description', 'content', 'body', 'bio', 'summary', 'intro', 'notes', 'remarks', 'feedback'],
    type: 'String',
    properties: {
      trim: true
    },
    validators: ['text'],
    description: 'Long text field'
  },

  // Default String
  string: {
    patterns: ['name', 'title', 'username', 'firstname', 'lastname', 'fullname', 'displayname'],
    type: 'String',
    properties: {
      trim: true,
      required: true
    },
    validators: ['required', 'string'],
    description: 'Standard string field'
  }
};

/**
 * Apply rules to detect field type
 * @param {string} fieldName - The field name from frontend
 * @returns {Object} - Detected field configuration
 */
export function detectFieldType(fieldName) {
  const normalizedName = fieldName.toLowerCase();

  // Check each rule
  for (const [ruleKey, rule] of Object.entries(FIELD_RULES)) {
    // Check if field name matches any pattern
    const matches = rule.patterns.some(pattern => {
      if (pattern.startsWith('is_') || pattern.startsWith('has_')) {
        return normalizedName.startsWith(pattern);
      }
      return normalizedName.includes(pattern);
    });

    if (matches) {
      return {
        fieldName,
        rule: ruleKey,
        type: rule.type,
        properties: { ...rule.properties },
        validators: [...rule.validators],
        hooks: rule.hooks || [],
        description: rule.description
      };
    }
  }

  // Default: treat as string
  return {
    fieldName,
    rule: 'string',
    type: 'String',
    properties: { trim: true },
    validators: ['string'],
    hooks: [],
    description: 'Default string field'
  };
}

/**
 * Detect if field needs indexing
 * @param {string} fieldName
 * @returns {boolean}
 */
export function shouldIndex(fieldName) {
  const indexPatterns = ['email', 'username', 'userid', 'status', 'active', 'createdby'];
  return indexPatterns.some(
    pattern => fieldName.toLowerCase().includes(pattern)
  );
}

/**
 * Detect relationships between resources
 * Enhanced to auto-detect common relationship patterns
 * @param {string} fieldName
 * @param {string} resourceName
 * @param {Array} allResources - List of all available resources
 * @returns {Object|null}
 */
export function detectRelationship(fieldName, resourceName, allResources = []) {
  const normalized = fieldName.toLowerCase();
  
  // Smart role-based user references (admin, organizer, owner, creator, author)
  const userRolePatterns = ['admin', 'organizer', 'owner', 'creator', 'author', 'user', 'createdby', 'updatedby', 'assignedto'];
  for (const pattern of userRolePatterns) {
    if (normalized === pattern || normalized.startsWith(pattern)) {
      return {
        fieldName,
        type: 'ObjectId',
        ref: 'User',
        isRequired: ['admin', 'organizer', 'owner', 'creator', 'user'].includes(normalized)
      };
    }
  }
  
  // Array of user references (members, participants, attendees, followers, subscribers, admins, organizers)
  const userArrayPatterns = ['members', 'participants', 'attendees', 'followers', 'subscribers', 'admins', 'organizers', 'users', 'authors', 'contributors'];
  if (userArrayPatterns.includes(normalized)) {
    return {
      fieldName,
      type: 'Array',
      arrayItemType: 'ObjectId',
      ref: 'User',
      isRequired: false
    };
  }

  // Direct resource name references (club, event, product, category, etc.)
  // Check if field name matches any resource name
  const resourceMatch = allResources.find(r => 
    normalized === r.name.toLowerCase() || 
    normalized === r.singular.toLowerCase() ||
    normalized === r.plural.toLowerCase()
  );
  
  if (resourceMatch) {
    // Check if it's plural (array) or singular (single ref)
    const isArray = normalized === resourceMatch.plural.toLowerCase();
    
    return {
      fieldName,
      type: isArray ? 'Array' : 'ObjectId',
      arrayItemType: isArray ? 'ObjectId' : undefined,
      ref: resourceMatch.singular.charAt(0).toUpperCase() + resourceMatch.singular.slice(1),
      isRequired: !isArray && ['club', 'event', 'product', 'category', 'post'].includes(normalized)
    };
  }

  // UserId → Reference to User (existing pattern)
  // ProductId → Reference to Product
  // AuthorId → Reference to User
  const idMatch = normalized.match(/(\w+)id$/i);
  if (idMatch) {
    let refModel = idMatch[1];
    
    // Smart mapping
    const commonMappings = {
      'author': 'User',
      'user': 'User',
      'owner': 'User',
      'creator': 'User',
      'admin': 'User',
      'organizer': 'User'
    };

    refModel = commonMappings[refModel] || 
               refModel.charAt(0).toUpperCase() + refModel.slice(1);

    return {
      fieldName,
      type: 'ObjectId',
      ref: refModel,
      isRequired: false
    };
  }

  return null;
}

/**
 * Build complete field configuration from rules
 * @param {string} fieldName
 * @param {string} resourceName
 * @param {Array} allResources - List of all resources for relationship detection
 * @returns {Object}
 */
export function buildFieldConfig(fieldName, resourceName = '', allResources = []) {
  const detected = detectFieldType(fieldName);
  const relationship = detectRelationship(fieldName, resourceName, allResources);

  return {
    name: fieldName,
    ...detected,
    relationship,
    shouldIndex: shouldIndex(fieldName),
    isRequired: 
      fieldName.toLowerCase().includes('required') ||
      fieldName.toLowerCase().includes('email') ||
      fieldName.toLowerCase().includes('name') ||
      (relationship && relationship.isRequired)
  };
}

/**
 * Get all rules (for rule engine UI/admin)
 */
export function getAllRules() {
  return Object.entries(FIELD_RULES).map(([key, rule]) => ({
    id: key,
    ...rule
  }));
}

/**
 * Add custom rule (for extensibility)
 */
export function addCustomRule(identity, rule) {
  FIELD_RULES[identity] = rule;
  return true;
}

/**
 * Get rule by ID
 */
export function getRule(ruleId) {
  return FIELD_RULES[ruleId] || null;
}
