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
  category: Joi.string()
    .required()
    .valid("productmaster", "stone", "semimount", "accessory", "others"),

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
  stone_name: Joi.string().required(),
  shape: Joi.string().allow("", null).optional(),
  size: Joi.string().allow("", null).optional(),
  color: Joi.string().allow("", null).optional(),
  cutting: Joi.string().allow("", null).optional(),
  quality: Joi.string().allow("", null).optional(),
  clarity: Joi.string().allow("", null).optional(),
  qty: Joi.number().allow("", null).optional(),
  weight: Joi.number().allow("", null).optional(),
});

const accessoryItemSchema = Joi.object({
  product_id: objectId.required(),
  weight: Joi.number().required(),

  size: Joi.string().allow("", null).optional(),
  metal: Joi.string().allow("", null).optional(),

  description: Joi.string().allow("", null).optional(),
});

const productMasterSchema = Joi.object({
  ...baseSchema,

  item_type: Joi.string().required(),
  product_size: Joi.string().required(),
  metal: Joi.string().required(),
  metal_color: Joi.string().allow("", null).optional(),
  gross_weight: Joi.number().required(),
  net_weight: Joi.number().required(),
  unit: Joi.string().valid("g", "pcs", "pair", "cts").default("g").optional(),
  stone_name: Joi.string().allow("", null).optional(),
  shape: Joi.string().allow("", null).optional(),
  size: Joi.string().allow("", null).optional(),
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
  unit: Joi.string().valid("g", "cts").default("cts").optional(),
  stone_name: Joi.string().required(),
  shape: Joi.string().required(),
  size: Joi.string().required(),

  net_weight: Joi.number()
    .required()
    .messages({ "any.required": "Carat Weight (Nwt) is required" }),
  gross_weight: Joi.forbidden(),

  color: Joi.string().optional(),
  cutting: Joi.string().optional(),
  quality: Joi.string().optional(),
  clarity: Joi.string().optional(),
  stones: Joi.array().items(stoneItemSchema).optional(),
});

const semiMountSchema = Joi.object({
  ...baseSchema,

  item_type: Joi.string().required(),
  product_size: Joi.string().required(),
  metal: Joi.string().required(),
  metal_color: Joi.string().allow("", null).optional(),
  unit: Joi.string().valid("g", "pcs", "pair", "cts").default("g").optional(),
  gross_weight: Joi.number().required(),
  net_weight: Joi.number().required(),

  stone_name: Joi.string().allow("", null).optional(),
  shape: Joi.string().optional(),
  size: Joi.string().allow("", null).optional(),
  color: Joi.string().allow("", null).optional(),
  cutting: Joi.string().allow("", null).optional(),
  quality: Joi.string().allow("", null).optional(),
  clarity: Joi.string().allow("", null).optional(),
  stones: Joi.array().items(stoneItemSchema).optional(),
  stone_weight: Joi.number().allow("", null).optional(),
  related_accessories: Joi.array().items(accessoryItemSchema).optional(),
});

const accessorySchema = Joi.object({
  ...baseSchema,

  metal: objectId.required(),
  product_size: Joi.string().required(),
  weight: Joi.number().required(),
  unit: Joi.string().valid("g", "pcs", "pair", "cts").default("g").optional(),
});

const othersSchema = Joi.object({
  ...baseSchema,

  product_size: Joi.string().required(),
  weight: Joi.number().required(),
  unit: Joi.string().valid("g", "pcs", "pair", "cts").default("g").optional(),
});

const updateProductSchema = Joi.object({
  product_name: Joi.string().optional(),
  code: Joi.string().optional(),
  description: Joi.string().allow("").optional(),
  image: Joi.string().allow("").optional(),

  related_accessories: Joi.array().items(accessoryItemSchema).optional(),
  stones: Joi.array().items(stoneItemSchema).optional(),

  item_type: Joi.string().optional(),
  metal: Joi.string().optional(),
  stone_name: Joi.string().optional(),
  shape: Joi.string().optional(),
  cutting: Joi.string().optional(),
  quality: Joi.string().optional(),
  clarity: Joi.string().optional(),

  metal_color: Joi.string().optional(),
  color: Joi.string().optional(),

  product_size: Joi.string().optional(),
  size: Joi.string().optional(),
  unit: Joi.string().valid("g", "pcs", "pair", "cts").default("pcs").optional(),
  gross_weight: Joi.number().optional(),
  net_weight: Joi.number().optional(),
  weight: Joi.number().optional(),

  product_type: Joi.string().optional(),
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
