/**
 * Pagination Utility
 * Provides pagination, filtering, sorting for queries
 */

export class PaginationHelper {
  static getPaginationParams(req) {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    return { page, limit, skip };
  }

  static async paginate(model, query = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      skip = 0,
      sort = { createdAt: -1 },
      select = null,
      populate = []
    } = options;

    const total = await model.countDocuments(query);
    const data = await model
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select(select);

    if (populate.length > 0) {
      for (const field of populate) {
        await model.populate(data, field);
      }
    }

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: page * limit < total,
        skip
      }
    };
  }

  static getSortObject(sortParam) {
    if (!sortParam) return { createdAt: -1 };

    const sorts = {};
    const fields = sortParam.split(',');

    for (const field of fields) {
      if (field.startsWith('-')) {
        sorts[field.substring(1)] = -1;
      } else {
        sorts[field] = 1;
      }
    }

    return sorts;
  }

  static buildFilterQuery(req, allowedFields = []) {
    const query = {};

    for (const field of allowedFields) {
      if (req.query[field]) {
        const value = req.query[field];
        
        // Handle range queries
        if (value.includes('..')) {
          const [min, max] = value.split('..');
          query[field] = { $gte: isNaN(min) ? min : parseFloat(min), $lte: isNaN(max) ? max : parseFloat(max) };
        }
        // Handle multiple values
        else if (value.includes(',')) {
          query[field] = { $in: value.split(',') };
        }
        // Handle regex search
        else if (value.includes('*')) {
          query[field] = { $regex: value.replace(/\*/g, '.*'), $options: 'i' };
        }
        // Direct match
        else {
          query[field] = value;
        }
      }
    }

    return query;
  }

  static buildSearchQuery(searchTerm, searchFields = []) {
    if (!searchTerm || searchFields.length === 0) return {};

    return {
      $or: searchFields.map(field => ({
        [field]: { $regex: searchTerm, $options: 'i' }
      }))
    };
  }
}

export default PaginationHelper;
