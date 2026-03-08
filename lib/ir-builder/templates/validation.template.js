/**
 * Validation Schema Template
 */

export const VALIDATION_TEMPLATE = `import Joi from 'joi';

const validate<%= capitalize(resource.singular) %> = {
  create: Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().optional()
  })
};

export default validate<%= capitalize(resource.singular) %>;
`;
