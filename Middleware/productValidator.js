const Joi = require("joi");

const objectId = Joi.string().hex().length(24).messages({
  "string.hex": "ID must be a hexadecimal string",
  "string.length": "ID must be 24 characters long",
});

const baseSchema = {
  product_name: Joi.string()
    .required()
    .messages({ "any.required": "Product name is required" }),
  code: Joi.string()
    .required()
    .messages({ "any.required": "Product Code is required" }),
  description: Joi.string().allow("").optional(),

  cost: Joi.number()
    .min(0)
    .required()
    .messages({ "any.required": "Cost is required" }),
  sale_price: Joi.number()
    .min(0)
    .required()
    .messages({ "any.required": "Selling Price is required" }),
};

const productMasterSchema = Joi.object({
  ...baseSchema,

  item_type: objectId.required(),
  product_size: Joi.string().required(),
  metal: objectId.required(),
  metal_color: Joi.string().optional(),

  gross_weight: Joi.number().required(),
  net_weight: Joi.number().required(),

  stone_name: objectId.required(),
  shape: objectId.required(),
  size: Joi.string().optional(),
  color: Joi.string().optional(),
  cutting: objectId.optional(),
  quality: objectId.optional(),
  clarity: objectId.optional(),
});

const stoneSchema = Joi.object({
  ...baseSchema,

  metal: Joi.forbidden(),
  item_type: Joi.forbidden(),

  stone_name: objectId.required(),
  shape: objectId.required(),
  size: Joi.string().required(),

  net_weight: Joi.number()
    .required()
    .messages({ "any.required": "Carat Weight (Nwt) is required" }),
  gross_weight: Joi.forbidden(),

  color: Joi.string().optional(),
  cutting: objectId.optional(),
  quality: objectId.optional(),
  clarity: objectId.optional(),
});

const semiMountSchema = Joi.object({
  ...baseSchema,

  item_type: objectId.required(),
  product_size: Joi.string().required(),
  metal: objectId.required(),
  metal_color: Joi.string().optional(),

  gross_weight: Joi.number().required(),
  net_weight: Joi.number().required(),

  stone_name: objectId.optional(),
  shape: objectId.optional(),
});

const othersSchema = Joi.object({
  ...baseSchema,

  product_size: Joi.string().required(),
  weight: Joi.number().required(),
});

exports.validateSchema = (schemaName) => {
  return (req, res, next) => {
    let schema;

    switch (schemaName) {
      case "master":
        schema = productMasterSchema;
        break;
      case "stone":
        schema = stoneSchema;
        break;
      case "semimount":
        schema = semiMountSchema;
        break;
      case "others":
        schema = othersSchema;
        break;
      default:
        return res.status(500).json({ message: "Schema not found" });
    }

    const { error, value } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join(", ");
      return res.status(400).json({
        success: false,
        message: `Validation Error: ${errorMessage}`,
      });
    }

    req.body = value;
    next();
  };
};
