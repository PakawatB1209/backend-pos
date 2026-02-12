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
  category: Joi.string().required(),
  // cost: Joi.number()
  //   .min(0)
  //   .required()
  //   .messages({ "any.required": "Cost is required" }),
  // sale_price: Joi.number()
  //   .min(0)
  //   .required()
  //   .messages({ "any.required": "Selling Price is required" }),
};

const stoneItemSchema = Joi.object({
  stone_name: Joi.string().allow("", null).optional(),
  shape: Joi.string().allow("", null).optional(),
  size: Joi.string().allow("", null).optional(),
  color: Joi.string().allow("", null).optional(),
  cutting: Joi.string().allow("", null).optional(),
  quality: Joi.string().allow("", null).optional(),
  clarity: Joi.string().allow("", null).optional(),
  qty: Joi.number().allow("", null).optional(),
  weight: Joi.number().allow("", null).optional(),
  unit: Joi.string().valid("g", "cts").default("g").optional(),
});

const accessoryItemSchema = Joi.object({
  product_id: objectId.required(),
  weight: Joi.number().required(),
  unit: Joi.string().valid("g", "cts").default("g").optional(),

  size: Joi.string().allow("", null).optional(),
  metal: Joi.string().allow("", null).optional(),

  description: Joi.string().allow("", null).optional(),
});

const productMasterSchema = Joi.object({
  ...baseSchema,

  item_type: Joi.string().required(),
  metal: Joi.string().required(),
  metal_color: Joi.string().allow("", null).optional(),
  gross_weight: Joi.number().required(),
  net_weight: Joi.number().required(),
  unit: Joi.string().valid("g", "cts").default("g").optional(),
  stone_name: Joi.string().allow("", null).optional(),
  shape: Joi.string().allow("", null).optional(),
  size: Joi.string().required(),
  weight: Joi.number().allow("", null).optional(),
  color: Joi.string().allow("", null).optional(),
  cutting: Joi.string().allow("", null).optional(),
  quality: Joi.string().allow("", null).optional(),
  clarity: Joi.string().allow("", null).optional(),
  stones: Joi.array().items(stoneItemSchema).optional(),
  related_accessories: Joi.array().items(accessoryItemSchema).optional(),
});

const stoneSchema = Joi.object({
  ...baseSchema,

  metal: Joi.forbidden(),
  item_type: Joi.forbidden(),
  unit: Joi.string().valid("g", "cts").default("g").optional(),
  stone_name: Joi.string().required(),
  shape: Joi.string().required(),
  size: Joi.string().required(),
  weight: Joi.number().required(),
  color: Joi.string().optional(),
  cutting: Joi.string().optional(),
  quality: Joi.string().optional(),
  clarity: Joi.string().optional(),
  stones: Joi.array().items(stoneItemSchema).optional(),
});

const semiMountSchema = Joi.object({
  ...baseSchema,

  item_type: Joi.string().required(),
  metal: Joi.string().required(),
  metal_color: Joi.string().allow("", null).optional(),
  unit: Joi.string().valid("g", "cts").default("g").optional(),
  gross_weight: Joi.number().required(),
  net_weight: Joi.number().required(),

  stone_name: Joi.string().allow("", null).optional(),
  shape: Joi.string().allow("", null).optional(),
  size: Joi.string().required(),
  color: Joi.string().allow("", null).optional(),
  cutting: Joi.string().allow("", null).optional(),
  quality: Joi.string().allow("", null).optional(),
  clarity: Joi.string().allow("", null).optional(),
  stones: Joi.array().items(stoneItemSchema).optional(),
  weight: Joi.number().allow("", null).optional(),
  related_accessories: Joi.array().items(accessoryItemSchema).optional(),
});

const accessorySchema = Joi.object({
  ...baseSchema,

  metal: objectId.required(),
  size: Joi.string().required(),
  weight: Joi.number().required(),
  unit: Joi.string().valid("g", "cts").default("g").optional(),
});

const othersSchema = Joi.object({
  ...baseSchema,

  size: Joi.string().required(),
  weight: Joi.number().required(),
  unit: Joi.string().valid("g", "cts").default("g").optional(),
});

const updateProductSchema = Joi.object({
  product_name: Joi.string().optional(),
  code: Joi.string().optional(),
  description: Joi.string().allow("").optional(),
  image: Joi.string().allow("").optional(),
  stones: Joi.array().items(stoneItemSchema).optional(),

  item_type: Joi.string().optional(),
  metal: Joi.string().optional(),
  stone_name: Joi.string().allow("", null).optional(),
  shape: Joi.string().allow("", null).optional(),
  cutting: Joi.string().allow("", null).optional(),
  quality: Joi.string().allow("", null).optional(),
  clarity: Joi.string().allow("", null).optional(),

  metal_color: Joi.string().allow("", null).optional(),
  color: Joi.string().allow("", null).optional(),
  size: Joi.string().optional(),
  unit: Joi.string().valid("g", "cts").optional(),
  gross_weight: Joi.number().optional(),
  net_weight: Joi.number().optional(),
  weight: Joi.number().optional(),

  product_type: Joi.string().optional(),

  primary_stone: Joi.object({
    stone_name: Joi.string().allow("", null).optional(),
    shape: Joi.string().allow("", null).optional(),
    size: Joi.string().allow("", null).optional(),
    weight: Joi.number().allow("", null).optional(),
    unit: Joi.string().valid("g", "cts").optional(),
    color: Joi.string().allow("", null).optional(),
    cutting: Joi.string().allow("", null).optional(),
    quality: Joi.string().allow("", null).optional(),
    clarity: Joi.string().allow("", null).optional(),
  })
    .optional()
    .allow(null),

  additional_stones: Joi.array().items(stoneItemSchema).optional(),
  related_accessories: Joi.array().items(accessoryItemSchema).optional(),
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
      case "accessory":
        schema = accessorySchema;
        break;
      case "others":
        schema = othersSchema;
        break;
      case "update":
        schema = updateProductSchema;
        break;
      default:
        return res.status(500).json({ message: "Schema not found" });
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      convert: true, // convert: true = "2.5" → 2.5
    });

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
