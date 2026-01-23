const Product = require("../models/Product");
const ProductDetail = require("../models/Product_detail");
const User = require("../models/User");
const Masters = require("../models/masters");
const mongoose = require("mongoose");
const fs = require("fs");
const sharp = require("sharp");
const xlsx = require("xlsx");
const path = require("path");

const buildColumnWidth = (data) => {
  if (!data.length) return [];
  const headers = Object.keys(data[0]);

  return headers.map((h) => ({
    wch: Math.max(h.length, ...data.map((r) => String(r[h] ?? "").length)) + 2,
  }));
};

const createSheet = (workbook, name, data) => {
  const ws = xlsx.utils.json_to_sheet(data);
  ws["!cols"] = buildColumnWidth(data);
  xlsx.utils.book_append_sheet(workbook, ws, name);
};

exports.createProduct = async (req, res) => {
  let filesArray = [];
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("comp_id");

    if (!user || !user.comp_id) {
      return res.status(400).json({
        success: false,
        message: "User is not associated with a company.",
      });
    }

    const data = req.body;

    if (typeof data.stones === "string") {
      try {
        data.stones = JSON.parse(data.stones);
      } catch (e) {
        data.stones = [];
      }
    }
    if (typeof data.related_accessories === "string") {
      try {
        data.related_accessories = JSON.parse(data.related_accessories);
      } catch (e) {
        data.related_accessories = [];
      }
    }

    const existingProduct = await Product.findOne({
      product_code: data.code,
      comp_id: user.comp_id,
    });

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: `Product Code "${data.code}" already exists.`,
      });
    }

    if (
      data.related_accessories &&
      Array.isArray(data.related_accessories) &&
      data.related_accessories.length > 0
    ) {
      for (const item of data.related_accessories) {
        if (!mongoose.isValidObjectId(item.product_id)) {
          return res.status(400).json({
            success: false,
            message: `Invalid Accessory ID format: ${item.product_id}`,
          });
        }
        const accessoryExists = await Product.exists({
          _id: item.product_id,
          comp_id: user.comp_id,
        });

        if (!accessoryExists) {
          return res.status(400).json({
            success: false,
            message: `Accessory product not found: ${item.product_id}`,
          });
        }
      }
    }

    if (req.files?.length) {
      const uploadDir = "./uploads/product";
      if (!fs.existsSync(uploadDir))
        fs.mkdirSync(uploadDir, { recursive: true });

      const formats = {
        "image/jpeg": {
          ext: ".jpeg",
          type: "jpeg",
          options: { quality: 80 },
        },
        "image/png": {
          ext: ".png",
          type: "png",
          options: { compressionLevel: 8, quality: 80 },
        },
        "image/webp": {
          ext: ".webp",
          type: "webp",
          options: { quality: 80 },
        },
      };

      await Promise.all(
        req.files.map(async (file, index) => {
          const baseName = `product-${Date.now()}-${Math.round(
            Math.random() * 1e9,
          )}-${index}`;
          const format = formats[file.mimetype] || formats["image/jpeg"];
          const filename = `${baseName}${format.ext}`;
          const outputPath = path.join(uploadDir, filename);

          await sharp(file.buffer)
            .resize(1200, 1200, {
              fit: sharp.fit.inside,
              withoutEnlargement: true,
            })
            .toFormat(format.type, format.options)
            .toFile(outputPath);

          filesArray.push(filename);
        }),
      );
    }

    // --- Auto-create Master Logic ---
    const ensureMasterId = async (input, type) => {
      if (!input || (typeof input === "string" && input.trim() === ""))
        return null;

      if (mongoose.isValidObjectId(input)) {
        const exists = await Masters.exists({
          _id: input,
          comp_id: user.comp_id,
        });
        if (exists) return input;
      }

      let master = await Masters.findOne({
        master_name: { $regex: new RegExp(`^${input}$`, "i") },
        master_type: type,
        comp_id: user.comp_id,
      });

      if (!master) {
        master = await Masters.create({
          master_name: input,
          master_type: type,
          comp_id: user.comp_id,
          master_color: null,
        });
        console.log(`Auto-created Master: [${type}] ${input}`);
      }

      return master._id;
    };

    const mastersArray = [];
    const pushMaster = (masterId, qty = 0, weight = 0) => {
      if (masterId) mastersArray.push({ master_id: masterId, qty, weight });
    };

    const itemTypeId = await ensureMasterId(data.item_type, "item_type");
    pushMaster(itemTypeId, 1);

    if (data.metal) {
      const metalId = await ensureMasterId(data.metal, "metal");
      const metalColorId = await ensureMasterId(
        data.metal_color,
        "metal_color",
      );
      pushMaster(metalId, 1, data.net_weight || 0);
      pushMaster(metalColorId, 1);
    }

    // --- UPDATED: Stone Processing Logic ---

    const prepareStoneData = async (stoneData) => {
      return {
        stone_name: await ensureMasterId(stoneData.stone_name, "stone_name"),
        shape: await ensureMasterId(stoneData.shape, "shape"),
        size: await ensureMasterId(stoneData.size, "size"),
        color: await ensureMasterId(stoneData.color, "color"),
        cutting: await ensureMasterId(stoneData.cutting, "cutting"),
        quality: await ensureMasterId(stoneData.quality, "quality"),
        clarity: await ensureMasterId(stoneData.clarity, "clarity"),
        qty:
          stoneData.qty || stoneData.stone_qty
            ? Number(stoneData.qty || stoneData.stone_qty)
            : 1,
        weight: stoneData.weight ? Number(stoneData.weight) : 0,
      };
    };

    let primaryStoneData = null;
    if (data.stone_name) {
      let primaryWeight = 0;
      if (data.stone_weight) primaryWeight = Number(data.stone_weight);
      else if (!data.metal) primaryWeight = data.net_weight || data.weight || 0;
      else if (data.weight) primaryWeight = Number(data.weight);

      const rawPrimary = {
        stone_name: data.stone_name,
        shape: data.shape,
        size: data.size,
        color: data.color,
        cutting: data.cutting,
        quality: data.quality,
        clarity: data.clarity,
        stone_qty: data.stone_qty,
        weight: primaryWeight,
      };

      primaryStoneData = await prepareStoneData(rawPrimary);
    }

    let additionalStonesData = [];
    if (data.stones && Array.isArray(data.stones) && data.stones.length > 0) {
      for (const stone of data.stones) {
        const readyStone = await prepareStoneData(stone);
        additionalStonesData.push(readyStone);
      }
    }

    // Create Detail
    const newDetail = await ProductDetail.create({
      unit: data.unit || "g",
      size: data.product_size || data.size,
      gross_weight: data.gross_weight || 0,
      net_weight: data.net_weight || 0,
      weight: data.weight || 0,
      masters: mastersArray,
      primary_stone: primaryStoneData,
      additional_stones: additionalStonesData,
      description: data.description,
      comp_id: user.comp_id,
    });

    try {
      // Create Product
      const newProduct = await Product.create({
        product_code: data.code,
        product_name: data.product_name,
        product_detail_id: newDetail._id,
        comp_id: user.comp_id,
        file: filesArray,
        product_category: data.category,
        product_item_type: data.item_type,
        related_accessories: Array.isArray(data.related_accessories)
          ? data.related_accessories
          : [],
      });

      const populatedProduct = await Product.findById(newProduct._id)
        .populate({
          path: "product_detail_id",
          populate: [
            { path: "masters.master_id", select: "master_name master_type" },

            { path: "primary_stone.stone_name", select: "master_name" },
            { path: "primary_stone.shape", select: "master_name" },
            { path: "primary_stone.size", select: "master_name" },
            { path: "primary_stone.color", select: "master_name" },
            { path: "primary_stone.cutting", select: "master_name" },
            { path: "primary_stone.quality", select: "master_name" },
            { path: "primary_stone.clarity", select: "master_name" },

            { path: "additional_stones.stone_name", select: "master_name" },
            { path: "additional_stones.shape", select: "master_name" },
            { path: "additional_stones.size", select: "master_name" },
            { path: "additional_stones.color", select: "master_name" },
            { path: "additional_stones.cutting", select: "master_name" },
            { path: "additional_stones.quality", select: "master_name" },
            { path: "additional_stones.clarity", select: "master_name" },
          ],
        })
        .populate({
          path: "related_accessories.product_id",
          select: "product_name product_code",
        })
        .lean();

      // Flatten Response Data
      let responseData = populatedProduct;

      if (responseData.product_detail_id) {
        const detail = responseData.product_detail_id;
        const extractName = (field) =>
          field?.master_name ? field.master_name : null;

        if (detail.masters) {
          detail.masters = detail.masters.map((item) => {
            if (item.master_id && typeof item.master_id === "object") {
              return {
                _id: item.master_id._id,
                master_name: item.master_id.master_name,
                master_type: item.master_id.master_type,
                qty: item.qty,
                weight: item.weight,
              };
            }
            return item;
          });
        }

        if (detail.primary_stone) {
          detail.primary_stone.stone_name = extractName(
            detail.primary_stone.stone_name,
          );
          detail.primary_stone.shape = extractName(detail.primary_stone.shape);
          detail.primary_stone.size = extractName(detail.primary_stone.size);
          detail.primary_stone.color = extractName(detail.primary_stone.color);
          detail.primary_stone.cutting = extractName(
            detail.primary_stone.cutting,
          );
          detail.primary_stone.quality = extractName(
            detail.primary_stone.quality,
          );
          detail.primary_stone.clarity = extractName(
            detail.primary_stone.clarity,
          );
        }

        if (
          detail.additional_stones &&
          Array.isArray(detail.additional_stones)
        ) {
          detail.additional_stones = detail.additional_stones.map((stone) => ({
            ...stone,
            stone_name: extractName(stone.stone_name),
            shape: extractName(stone.shape),
            size: extractName(stone.size),
            color: extractName(stone.color),
            cutting: extractName(stone.cutting),
            quality: extractName(stone.quality),
            clarity: extractName(stone.clarity),
          }));
        }
      }

      res.status(201).json({
        success: true,
        message: "Product created successfully.",
        data: responseData,
        file: filesArray,
      });
    } catch (productError) {
      console.log("Error creating main product, rolling back detail...");
      await ProductDetail.findByIdAndDelete(newDetail._id);
      if (filesArray.length > 0) {
        filesArray.forEach((file) => {
          const filePath = path.join("./uploads/product", file);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
      }
      throw productError;
    }
  } catch (err) {
    console.log("Error create product:", err);
    if (filesArray.length > 0) {
      filesArray.forEach((file) => {
        const filePath = path.join("./uploads/product", file);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getOneProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format." });
    }

    const user = await User.findById(req.user.id).select("comp_id").lean();
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    const product = await Product.findOne({
      _id: id,
      comp_id: user.comp_id,
    })
      .populate({
        path: "product_detail_id",
        populate: [
          {
            path: "masters.master_id",
            select: "master_name master_type master_color code",
          },

          { path: "primary_stone.stone_name", select: "master_name" },
          { path: "primary_stone.shape", select: "master_name" },
          { path: "primary_stone.size", select: "master_name" },
          { path: "primary_stone.color", select: "master_name" },
          { path: "primary_stone.cutting", select: "master_name" },
          { path: "primary_stone.quality", select: "master_name" },
          { path: "primary_stone.clarity", select: "master_name" },

          { path: "additional_stones.stone_name", select: "master_name" },
          { path: "additional_stones.shape", select: "master_name" },
          { path: "additional_stones.size", select: "master_name" },
          { path: "additional_stones.color", select: "master_name" },
          { path: "additional_stones.cutting", select: "master_name" },
          { path: "additional_stones.quality", select: "master_name" },
          { path: "additional_stones.clarity", select: "master_name" },
        ],
      })
      .populate({
        path: "related_accessories.product_id",
        select: "product_code product_name file product_detail_id",
        populate: {
          path: "product_detail_id",
          select: "weight unit",
        },
      })
      .populate("comp_id", "comp_name")
      .lean();

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}/uploads/product/`;

    if (product.file && product.file.length > 0) {
      product.file = product.file.map((fileName) => `${baseUrl}${fileName}`);
    }

    if (product.product_detail_id) {
      const detail = product.product_detail_id;
      const extractName = (field) =>
        field?.master_name ? field.master_name : null;

      if (detail.primary_stone) {
        detail.primary_stone.stone_name = extractName(
          detail.primary_stone.stone_name,
        );
        detail.primary_stone.shape = extractName(detail.primary_stone.shape);
        detail.primary_stone.size = extractName(detail.primary_stone.size);
        detail.primary_stone.color = extractName(detail.primary_stone.color);
        detail.primary_stone.cutting = extractName(
          detail.primary_stone.cutting,
        );
        detail.primary_stone.quality = extractName(
          detail.primary_stone.quality,
        );
        detail.primary_stone.clarity = extractName(
          detail.primary_stone.clarity,
        );
      }

      if (detail.additional_stones && Array.isArray(detail.additional_stones)) {
        detail.additional_stones = detail.additional_stones.map((stone) => ({
          ...stone,
          stone_name: extractName(stone.stone_name),
          shape: extractName(stone.shape),
          size: extractName(stone.size),
          color: extractName(stone.color),
          cutting: extractName(stone.cutting),
          quality: extractName(stone.quality),
          clarity: extractName(stone.clarity),
        }));
      }
    }

    const attributes = {};
    if (product.product_detail_id && product.product_detail_id.masters) {
      product.product_detail_id.masters.forEach((m) => {
        if (m.master_id) {
          const type = m.master_id.master_type;

          const itemData = {
            _id: m.master_id._id,
            name: m.master_id.master_name,
            code: m.master_id.code,
          };

          if (type === "metal" || type === "stone") {
            itemData.qty = m.qty;
            itemData.weight = m.weight;
          }

          if (attributes[type]) {
            if (Array.isArray(attributes[type])) {
              attributes[type].push(itemData);
            } else {
              attributes[type] = [attributes[type], itemData];
            }
          } else {
            attributes[type] = itemData;
          }
        }
      });
    }

    const formattedAccessories = (product.related_accessories || [])
      .map((acc) => {
        const master = acc.product_id;

        if (!master) return null;

        return {
          _id: master._id,
          code: master.product_code,
          name: master.product_name,

          image:
            master.file && master.file.length > 0
              ? `${baseUrl}${master.file[0]}`
              : "",

          weight:
            acc.weight ||
            (master.product_detail_id ? master.product_detail_id.weight : 0),

          size: acc.size || "",
          metal: acc.metal || "",
          color: acc.color || "",
          description: acc.description || "",

          unit:
            acc.unit ||
            (master.product_detail_id ? master.product_detail_id.unit : "pcs"),
        };
      })
      .filter((item) => item !== null);

    product.attributes = attributes;
    product.related_accessories = formattedAccessories;

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.log("Error get product:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.list = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const userId = req.user.id;

    const user = await User.findById(userId).select("comp_id").lean();
    if (!user || !user.comp_id) {
      return res
        .status(400)
        .json({ success: false, message: "User not associated with company." });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const { category, search, item_type, stone } = req.query;

    let query = { comp_id: user.comp_id };

    if (category) {
      query.product_category = { $in: category.split(",") };
    }

    if (item_type) {
      query.product_item_type = { $in: item_type.split(",") };
    }

    if (stone) {
      const stoneIds = stone.split(",");

      const matchedDetails = await ProductDetail.find({
        "primary_stone.stone_name": { $in: stoneIds },
      }).select("_id");

      const detailIds = matchedDetails.map((detail) => detail._id);

      query.product_detail_id = { $in: detailIds };
    }

    if (search) {
      query.$or = [
        { product_name: { $regex: search, $options: "i" } },
        { product_code: { $regex: search, $options: "i" } },
      ];
    }

    const [products, total] = await Promise.all([
      Product.find(query)
        .select(
          "product_name product_code file product_category createdAt related_accessories is_active",
        )
        .populate({
          path: "product_detail_id",
          select:
            "masters size unit primary_stone weight gross_weight net_weight",
          populate: [
            {
              path: "masters.master_id",
              select: "master_name master_type",
            },
            {
              path: "primary_stone.stone_name",
              select: "master_name",
            },
          ],
        })
        .populate({
          path: "related_accessories.product_id",
          select: "product_code product_name product_detail_id file",
          populate: {
            path: "product_detail_id",
            select: "weight unit",
          },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Product.countDocuments(query),
    ]);

    const baseUrl = `${req.protocol}://${req.get("host")}/uploads/product/`;

    const formattedProducts = products.map((p) => {
      let foundItemType = "";
      let foundStone = "";
      let metal = "";
      let color = "";
      let size = "";
      let unit = "";

      let weight = 0;
      let gross_weight = 0;
      let net_weight = 0;

      if (p.product_detail_id) {
        const detail = p.product_detail_id;

        if (detail.size) {
          size = detail.size;
        }
        unit = detail.unit || "g";

        if (detail.weight) weight = detail.weight;
        if (detail.gross_weight) gross_weight = detail.gross_weight;
        if (detail.net_weight) net_weight = detail.net_weight;

        if (detail.masters) {
          detail.masters.forEach((m) => {
            if (m.master_id) {
              const name = m.master_id.master_name;
              const type = m.master_id.master_type;

              if (type === "metal") metal = name;
              else if (type === "metal_color" || type === "color") color = name;
              else if (type === "item_type") foundItemType = name;
            }
          });
        }

        if (detail.primary_stone && detail.primary_stone.stone_name) {
          if (detail.primary_stone.stone_name.master_name) {
            foundStone = detail.primary_stone.stone_name.master_name;
          }
        }
      }

      const parts = [];
      if (foundItemType) parts.push(foundItemType);
      if (foundStone) parts.push(foundStone);

      const finalTypeStone = parts.join(" / ");

      const formattedAccessories = (p.related_accessories || [])
        .map((acc) => {
          const master = acc.product_id;
          if (!master) return null;

          return {
            _id: master._id,
            code: master.product_code,
            name: master.product_name,

            image:
              master.file && master.file.length > 0
                ? `${baseUrl}${master.file[0]}`
                : "",
            weight:
              acc.weight ||
              (master.product_detail_id ? master.product_detail_id.weight : 0),
            unit:
              acc.unit ||
              (master.product_detail_id ? master.product_detail_id.unit : "g"),
          };
        })
        .filter((item) => item !== null);

      return {
        _id: p._id,
        code: p.product_code,
        name: p.product_name,
        image: p.file && p.file.length > 0 ? `${baseUrl}${p.file[0]}` : "",

        category: p.product_category,
        is_active: p.is_active,

        type_stone: finalTypeStone,
        stone_name: foundStone,
        item_type: foundItemType,

        unit: unit,
        size: size,
        metal: metal,
        color: color,

        weight: weight,
        gross_weight: gross_weight,
        net_weight: net_weight,

        accessories: formattedAccessories,
      };
    });

    res.status(200).json({
      success: true,
      count: formattedProducts.length,
      total_record: total,
      total_page: Math.ceil(total / limit),
      current_page: page,
      data: formattedProducts,
    });
  } catch (error) {
    console.log("Error list product:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.changeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const user = await User.findById(req.user.id).select("comp_id");

    const product = await Product.findOneAndUpdate(
      { _id: id, comp_id: user.comp_id },
      { is_active: is_active },
      { new: true },
    ).select("product_name is_active");

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    res.status(200).json({
      success: true,
      message: `Product is now ${product.is_active ? "Active" : "Inactive"}`,
      data: product,
    });
  } catch (error) {
    console.log("Error change status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateProduct = async (req, res) => {
  let newFilesArray = [];

  try {
    const { id } = req.params;
    const userId = req.user.id;
    const data = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const user = await User.findById(userId).select("comp_id");
    if (!user || !user.comp_id) {
      return res
        .status(400)
        .json({ success: false, message: "User not associated with company" });
    }

    const currentProduct = await Product.findOne({
      _id: id,
      comp_id: user.comp_id,
    });

    if (!currentProduct) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const currentDetail = await ProductDetail.findById(
      currentProduct.product_detail_id,
    ).lean();

    const category = currentProduct.product_category;

    if (category === "stone") {
      if (data.metal || data.item_type || data.gross_weight) {
        return res.status(400).json({
          success: false,
          message:
            "Category 'stone' cannot have metal, item_type, or gross_weight.",
        });
      }

      if (data.unit && !["g", "cts"].includes(data.unit)) {
        return res.status(400).json({
          success: false,
          message: "Invalid unit for Stone (allowed: g, cts)",
        });
      }
    }

    if (category === "accessory") {
      const forbiddenStoneFields = [
        "stone_name",
        "shape",
        "cutting",
        "quality",
        "clarity",
        "color",
      ];
      const hasForbiddenField = forbiddenStoneFields.some(
        (field) => data[field],
      );

      if (hasForbiddenField || (data.stones && data.stones.length > 0)) {
        return res.status(400).json({
          success: false,
          message: "Category 'accessory' cannot have stone details.",
        });
      }

      if (data.unit === "cts") {
        return res.status(400).json({
          success: false,
          message: "Category 'accessory' cannot utilize 'cts' unit.",
        });
      }
    }

    if (req.files && req.files.length > 0) {
      const uploadDir = "./uploads/product";
      if (!fs.existsSync(uploadDir))
        fs.mkdirSync(uploadDir, { recursive: true });

      await Promise.all(
        req.files.map(async (file, index) => {
          const filename = `product-${Date.now()}-${Math.round(
            Math.random() * 1e9,
          )}-${index}.jpeg`;
          const outputPath = path.join(uploadDir, filename);

          await sharp(file.buffer)
            .resize(1200, 1200, {
              fit: sharp.fit.inside,
              withoutEnlargement: true,
            })
            .toFormat("jpeg", { quality: 80 })
            .toFile(outputPath);

          newFilesArray.push(filename);
        }),
      );

      if (currentProduct.file && currentProduct.file.length > 0) {
        currentProduct.file.forEach((oldFile) => {
          const oldPath = path.join(uploadDir, oldFile);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        });
      }
    }

    const ensureMasterId = async (input, type) => {
      if (!input || (typeof input === "string" && input.trim() === ""))
        return null;

      if (mongoose.isValidObjectId(input)) {
        const exists = await Masters.exists({
          _id: input,
          comp_id: user.comp_id,
        });
        if (exists) return input;
      }

      let master = await Masters.findOne({
        master_name: { $regex: new RegExp(`^${input}$`, "i") },
        master_type: type,
        comp_id: user.comp_id,
      });

      if (!master) {
        master = await Masters.create({
          master_name: input,
          master_type: type,
          comp_id: user.comp_id,
        });
        console.log(`Auto-created Master (Update): [${type}] ${input}`);
      }

      return master._id;
    };

    let updatedMasters = currentDetail.masters || [];

    if (category !== "stone" && (data.item_type || data.metal)) {
      const tempMasters = [];

      const typeStr = data.item_type || currentProduct.product_item_type;
      if (typeStr) {
        const newItemTypeId = await ensureMasterId(typeStr, "item_type");
        if (newItemTypeId)
          tempMasters.push({ master_id: newItemTypeId, qty: 1 });
      }

      if (data.metal) {
        const newMetalId = await ensureMasterId(data.metal, "metal");
        if (newMetalId) {
          tempMasters.push({
            master_id: newMetalId,
            qty: 1,

            weight: data.net_weight
              ? Number(data.net_weight)
              : data.weight || 0,
          });
        }
      } else {
      }

      if (data.metal_color) {
        const newMetalColorId = await ensureMasterId(
          data.metal_color,
          "metal_color",
        );
        if (newMetalColorId)
          tempMasters.push({ master_id: newMetalColorId, qty: 1 });
      }

      if (tempMasters.length > 0) {
        updatedMasters = tempMasters;
      }
    }

    let primaryStoneObj = currentDetail.primary_stone || {};

    if (category !== "accessory") {
      const updateField = async (fieldName, type) => {
        if (data[fieldName]) {
          primaryStoneObj[fieldName] = await ensureMasterId(
            data[fieldName],
            type,
          );
        }
      };

      await updateField("stone_name", "stone_name");
      await updateField("shape", "shape");
      await updateField("size", "size");
      await updateField("color", "color");
      await updateField("cutting", "cutting");
      await updateField("quality", "quality");
      await updateField("clarity", "clarity");

      if (data.stone_qty) primaryStoneObj.qty = Number(data.stone_qty);
      if (data.stone_weight) primaryStoneObj.weight = Number(data.stone_weight);
    } else {
      primaryStoneObj = {};
    }

    let additionalStonesUpdate = currentDetail.additional_stones || [];

    if (category !== "accessory" && data.stones && Array.isArray(data.stones)) {
      additionalStonesUpdate = [];
      for (const stone of data.stones) {
        additionalStonesUpdate.push({
          stone_name: await ensureMasterId(stone.stone_name, "stone_name"),
          shape: await ensureMasterId(stone.shape, "shape"),
          size: await ensureMasterId(stone.size, "size"),
          color: await ensureMasterId(stone.color, "color"),
          cutting: await ensureMasterId(stone.cutting, "cutting"),
          quality: await ensureMasterId(stone.quality, "quality"),
          clarity: await ensureMasterId(stone.clarity, "clarity"),
          qty: stone.qty ? Number(stone.qty) : 1,
          weight: stone.weight ? Number(stone.weight) : 0,
        });
      }
    } else if (category === "accessory") {
      additionalStonesUpdate = [];
    }

    const detailUpdate = {
      unit: data.unit || currentDetail.unit,
      size: data.product_size || data.size || currentDetail.size,
      gross_weight:
        data.gross_weight !== undefined
          ? data.gross_weight
          : currentDetail.gross_weight,
      net_weight:
        data.net_weight !== undefined
          ? data.net_weight
          : currentDetail.net_weight,
      weight: data.weight !== undefined ? data.weight : currentDetail.weight,
      description:
        data.description !== undefined
          ? data.description
          : currentDetail.description,

      masters: updatedMasters,
      primary_stone: primaryStoneObj,
      additional_stones: additionalStonesUpdate,
    };

    await ProductDetail.findByIdAndUpdate(
      currentProduct.product_detail_id,
      { $set: detailUpdate },
      { new: true },
    );

    const productUpdate = {
      product_code: data.code,
      product_name: data.product_name,
      product_item_type: data.item_type,
    };

    if (newFilesArray.length > 0) {
      productUpdate.file = newFilesArray;
    }

    if (data.related_accessories && Array.isArray(data.related_accessories)) {
      productUpdate.related_accessories = data.related_accessories;
    }

    Object.keys(productUpdate).forEach(
      (key) => productUpdate[key] === undefined && delete productUpdate[key],
    );

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: productUpdate },
      { new: true },
    )
      .populate({
        path: "product_detail_id",
        populate: [
          { path: "masters.master_id", select: "master_name master_type" },
          { path: "primary_stone.stone_name", select: "master_name" },
          { path: "primary_stone.shape", select: "master_name" },
          { path: "primary_stone.size", select: "master_name" },
          { path: "primary_stone.color", select: "master_name" },
          { path: "primary_stone.cutting", select: "master_name" },
          { path: "primary_stone.quality", select: "master_name" },
          { path: "primary_stone.clarity", select: "master_name" },
          { path: "additional_stones.stone_name", select: "master_name" },
          { path: "additional_stones.shape", select: "master_name" },
          { path: "additional_stones.size", select: "master_name" },
          { path: "additional_stones.color", select: "master_name" },
          { path: "additional_stones.cutting", select: "master_name" },
          { path: "additional_stones.quality", select: "master_name" },
          { path: "additional_stones.clarity", select: "master_name" },
        ],
      })
      .populate({
        path: "related_accessories.product_id",
        select: "product_name product_code file",
      });

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (err) {
    console.log("Error update product:", err);
    if (newFilesArray.length > 0) {
      newFilesArray.forEach((f) => {
        const tempPath = path.join("./uploads/product", f);
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.removeOneProduct = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format" });
    }

    const user = await User.findById(req.user.id).select("comp_id");

    const product = await Product.findOne({ _id: id, comp_id: user.comp_id });
    if (!product) {
      return res.status(404).json({ success: false, message: "ไม่พบสินค้า" });
    }

    const usedAsAccessory = await Product.findOne({
      "related_accessories.product_id": id,
      comp_id: user.comp_id,
    }).select("product_code product_name");

    if (usedAsAccessory) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete! This product is used as a component in: ${usedAsAccessory.product_name} (${usedAsAccessory.product_code})`,
      });
    }

    if (product.file && product.file.length > 0) {
      product.file.forEach((fileName) => {
        const imagePath = path.join("./uploads/product", fileName);

        if (fs.existsSync(imagePath)) {
          try {
            fs.unlinkSync(imagePath);
          } catch (err) {
            console.log(`Delete Img Error: ${err.message}`);
          }
        }
      });
    }

    if (product.product_detail_id) {
      await ProductDetail.findByIdAndDelete(product.product_detail_id);
    }

    await Product.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Product deleted successfully.",
      deletedId: id,
    });
  } catch (error) {
    console.log("Error remove product:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.removeAllProducts = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await User.findById(req.user.id).select("comp_id");

    const usedAsAccessoryIds = await Product.distinct(
      "related_accessories.product_id",
      {
        comp_id: user.comp_id,
      },
    );

    const deleteQuery = {
      comp_id: user.comp_id,
      _id: { $nin: usedAsAccessoryIds },

      // StockTransaction
      // _id: { $nin: [...usedAsAccessoryIds, ...usedInStockIds] }
    };

    const productsToDelete = await Product.find(deleteQuery);

    if (productsToDelete.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "No deletable products found. (All remaining products are currently in use.)",
      });
    }

    const productIds = productsToDelete.map((p) => p._id);
    const detailIds = productsToDelete
      .filter((p) => p.product_detail_id)
      .map((p) => p.product_detail_id);

    productsToDelete.forEach((product) => {
      if (product.file && product.file.length > 0) {
        product.file.forEach((fileName) => {
          const imagePath = path.join("./uploads/product", fileName);

          if (fs.existsSync(imagePath)) {
            try {
              fs.unlinkSync(imagePath);
            } catch (err) {
              console.log(`Failed delete img: ${err.message}`);
            }
          }
        });
      }
    });

    if (detailIds.length > 0) {
      await ProductDetail.deleteMany({ _id: { $in: detailIds } });
    }

    await Product.deleteMany({ _id: { $in: productIds } });

    res.status(200).json({
      success: true,
      message: `Cleanup successful! Deleted ${productsToDelete.length} unused products. (Products in use were not deleted.)`,
    });
  } catch (error) {
    console.log("Error clear unused products:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.removeSingleFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { fileName } = req.body;

    const user = await User.findById(req.user.id).select("comp_id");
    const product = await Product.findOne({ _id: id, comp_id: user.comp_id });

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    const filePath = path.join(__dirname, "../uploads", fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        $pull: { file: fileName },
      },
      { new: true },
    );

    res.json({
      success: true,
      message: "File removed successfully",
      data: updatedProduct,
    });
  } catch (err) {
    console.error("Remove File Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.removeAllFiles = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(req.user.id).select("comp_id");
    const product = await Product.findOne({ _id: id, comp_id: user.comp_id });

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    if (product.file && product.file.length > 0) {
      product.file.forEach((fileName) => {
        const filePath = path.join(__dirname, "../uploads", fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }

    product.file = [];
    await product.save();

    res.json({
      success: true,
      message: "All files deleted successfully.",
      data: product,
    });
  } catch (err) {
    console.error("Remove All Files Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.exportProductToExcel = async (req, res) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const user = await User.findById(req.user.id).select("comp_id").lean();
    if (!user?.comp_id)
      return res
        .status(400)
        .json({ success: false, message: "User has no company" });

    const { type, value } = req.body;
    const query = {
      comp_id: user.comp_id,
      ...(type === "category" && value && { product_category: value }),
      ...(type === "selected" &&
        Array.isArray(value) &&
        value.length && { _id: { $in: value } }),
    };

    const products = await Product.find(query)
      .populate({
        path: "product_detail_id",
        populate: [
          "primary_stone.stone_name",
          "primary_stone.shape",
          "primary_stone.color",
          "primary_stone.clarity",
          "additional_stones.stone_name",
          "additional_stones.shape",
          "additional_stones.color",
          "additional_stones.clarity",
          "masters.master_id",
        ],
      })
      .lean();

    const rows = products.map((p) => {
      const d = p.product_detail_id || {};
      const ps = d.primary_stone || {};
      const addText = (d.additional_stones || [])
        .map(
          (s) =>
            `${s.stone_name?.master_name || "-"} ${s.shape?.master_name || ""} (${s.qty || 0}pcs)`,
        )
        .join(", ");

      return {
        Code: p.product_code,
        Name: p.product_name,
        Category: p.product_category,
        Type: p.product_item_type,
        "Gross Weight (g)": d.gross_weight || 0,
        "Net Weight (g)": d.net_weight || 0,
        "Product Unit": d.unit || p.unit || "",
        Size: d.size || "",
        "Main Stone": ps.stone_name?.master_name || "",
        "Main Shape": ps.shape?.master_name || "",
        "Main Color": ps.color?.master_color || ps.color?.master_name || "",
        "Main Clarity": ps.clarity?.master_name || "",
        "Main Qty": ps.qty || 0,
        "Main Weight": ps.weight || 0,
        "Additional Stones": addText,
        Components: (d.masters || [])
          .map((m) => m.master_id?.master_name || "-")
          .join(", "),
        Status: p.is_active ? "Active" : "Inactive",
        "Purchase Unit": "-",
        Qty: "-",
        Cost: "-",
        Price: "-",
      };
    });

    const workbook = xlsx.utils.book_new();

    if (type === "category") {
      const grouped = rows.reduce((acc, r) => {
        const key = r.Category || "Uncategorized";
        acc[key] = acc[key] || [];
        acc[key].push(r);
        return acc;
      }, {});

      Object.entries(grouped).forEach(([cat, data]) =>
        createSheet(
          workbook,
          cat.substring(0, 30).replace(/[\\/?*[\]]/g, ""),
          data,
        ),
      );
    } else {
      createSheet(workbook, "Products", rows);
    }

    const buffer = xlsx.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    const prefix =
      type === "category" ? value : type === "selected" ? "Selected" : "All";

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Purchase_Template_${prefix}_${Date.now()}.xlsx"`,
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    res.send(buffer);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Export Error", error: err.message });
  }
};
