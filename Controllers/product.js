const Product = require("../models/Product");
const ProductDetail = require("../models/Product_detail");
const User = require("../models/User");
const Masters = require("../models/masters");
const Order = require("../models/Order");
const Purchase = require("../models/Purchase");
const StockTransaction = require("../models/StockTransaction");
const Stock = require("../models/Stock");
const mongoose = require("mongoose");
const fs = require("fs");
const sharp = require("sharp");
const ExcelJS = require("exceljs");
const path = require("path");

const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

//helper
// Helper Function: จัดรูปแบบข้อมูลให้หน้าบ้านใช้งานง่าย (Clean Version)

// NORMALIZER (วางตรงนี้ เหนือ formatProductResponse)

const normalizeStone = (stone) => {
  if (!stone) return null;

  return {
    ...stone,

    size:
      typeof stone.size === "object"
        ? stone.size.master_name
        : (stone.size ?? ""),

    color:
      typeof stone.color === "object"
        ? stone.color.master_name
        : (stone.color ?? ""),

    unit: stone.unit ?? "g",
  };
};

const formatProductResponse = (product, req) => {
  if (!product) return null;

  const detail = product.product_detail_id || {};
  const categoryName =
    product.product_category?.master_name?.toLowerCase() || "";

  // 1. โครงสร้างพื้นฐาน (Common Fields)
  let formatted = {
    _id: product._id,
    code: product.product_code,
    product_name: product.product_name,
    description: detail.description || product.description || "",

    // จัดการรูปภาพ (Image URLs)
    file:
      product.file && product.file.length > 0
        ? product.file.map((f) =>
            f.startsWith("http")
              ? f
              : `${req.protocol}://${req.get("host")}/uploads/product/${f}`,
          )
        : [],

    // Category ยังคงเป็น Object เพราะเป็น Dropdown ที่ต้องเลือกจาก Master
    category: product.product_category
      ? {
          _id: product.product_category._id,
          name: product.product_category.master_name,
        }
      : null,

    unit: detail.unit || "g",
    weight: detail.weight || 0,
  };

  // --- 2. Logic แยกตามประเภทสินค้า (Clean Up) ---

  // กรณี A: Stone (หิน/พลอยร่วง)
  if (categoryName === "stone" || categoryName === "diamond") {
    // formatted.unit = detail.unit || "cts";
    formatted.unit = detail.unit ?? "g";

    // Size: ส่งเป็น String ตรงๆ (เช่น "10*10")
    formatted.size = detail.size || "";

    // Primary Stone: ส่งไปทั้งก้อน (Color, Size ในนี้เป็น String แล้วจาก Create)
    // formatted.primary_stone = detail.primary_stone || null;
    formatted.primary_stone = normalizeStone(detail.primary_stone);

    return formatted;
  }

  // กรณี B: Others (สินค้าอื่นๆ)
  if (categoryName === "others") {
    // Product Size: ส่งเป็น String ตรงๆ (เช่น "M", "L")
    formatted.product_size = detail.size || "";

    return formatted;
  }

  // กรณี C: Jewelry / Accessory (สินค้าสำเร็จรูป)

  // Product Size: ส่งเป็น String ตรงๆ (เช่น "54", "18cm")
  formatted.product_size = detail.size || "";

  formatted.gross_weight = detail.gross_weight || 0;
  formatted.net_weight = detail.net_weight || 0;

  // formatted.primary_stone = detail.primary_stone || null;
  // formatted.additional_stones = detail.additional_stones || [];
  formatted.primary_stone = normalizeStone(detail.primary_stone);
  formatted.additional_stones = (detail.additional_stones || []).map(
    normalizeStone,
  );

  formatted.related_accessories = (product.related_accessories || []).map(
    (acc) => ({
      product_id: acc.product_id,
      weight: acc.weight ?? 0,
      unit: acc.unit ?? "g",
      size: acc.size ?? "",
      metal: acc.metal ?? null,
      description: acc.description ?? "",
    }),
  );

  if (categoryName === "accessory") {
    formatted.product_size = detail.size || "";
    formatted.weight = detail.weight || 0;
    formatted.unit = detail.unit ?? "g";

    if (detail.masters && Array.isArray(detail.masters)) {
      detail.masters.forEach((item) => {
        if (item.master_id && typeof item.master_id === "object") {
          const type = item.master_id.master_type;
          const valueObj = {
            _id: item.master_id._id,
            name: item.master_id.master_name,
          };

          if (type === "metal") formatted.metal = valueObj;
          if (type === "metal_color") formatted.metal_color = valueObj;
          if (type === "item_type") formatted.item_type = valueObj;
        }
      });
    }
  }

  // จัดการ Masters Array (ดึง Metal, Item Type ออกมาจาก Array)
  if (detail.masters && Array.isArray(detail.masters)) {
    detail.masters.forEach((item) => {
      // เช็คว่าเป็น Object ที่ populate มาแล้ว
      if (item.master_id && typeof item.master_id === "object") {
        const type = item.master_id.master_type;
        const valueObj = {
          _id: item.master_id._id,
          name: item.master_id.master_name,
          qty: item.qty,
          weight: item.weight,
        };

        // Map เข้าตัวแปรตามประเภท
        if (type === "item_type") formatted.item_type = valueObj;
        if (type === "metal") formatted.metal = valueObj;
        if (type === "metal_color") formatted.metal_color = valueObj;
      }
    });
  }

  // Fallback: ถ้า Item Type ไม่เจอใน Masters ให้ดูที่ Product Root
  if (!formatted.item_type && product.product_item_type) {
    formatted.item_type = {
      _id: product.product_item_type._id,
      name: product.product_item_type.master_name,
    };
  }

  return formatted;
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

    // --- JSON Parsing ---
    if (typeof data.primary_stone === "string") {
      try {
        data.primary_stone = JSON.parse(data.primary_stone);
      } catch (e) {
        data.primary_stone = null;
      }
    }

    if (typeof data.additional_stones === "string") {
      try {
        data.additional_stones = JSON.parse(data.additional_stones);
      } catch (e) {
        data.additional_stones = [];
      }
    }

    if (typeof data.related_accessories === "string") {
      try {
        data.related_accessories = JSON.parse(data.related_accessories);
      } catch (e) {
        data.related_accessories = [];
      }
    }

    // --- Check Duplicate ---
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

    // --- Check Accessories ---
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

    // --- File Upload ---
    if (req.files?.length) {
      const uploadDir = "./uploads/product";
      if (!fs.existsSync(uploadDir))
        fs.mkdirSync(uploadDir, { recursive: true });

      const formats = {
        "image/jpeg": { ext: ".jpeg", type: "jpeg", options: { quality: 80 } },
        "image/png": {
          ext: ".png",
          type: "png",
          options: { compressionLevel: 8, quality: 80 },
        },
        "image/webp": { ext: ".webp", type: "webp", options: { quality: 80 } },
      };

      await Promise.all(
        req.files.map(async (file, index) => {
          const baseName = `product-${Date.now()}-${Math.round(Math.random() * 1e9)}-${index}`;
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

    // ✅ Helper: Escape Regex (แก้ปัญหา 10*10)
    const escapeRegex = (string) => {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    };

    // --- Auto-create Master Logic (Updated) ---
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

      const trimmedInput = input.toString().trim();

      // ✅ ใช้ escapeRegex ในการค้นหา
      let master = await Masters.findOne({
        master_name: {
          $regex: new RegExp(`^${escapeRegex(trimmedInput)}$`, "i"),
        },
        master_type: type,
        comp_id: user.comp_id,
      });

      if (master) return master._id;

      // ✅ Try-Catch ดัก Duplicate Key Error
      try {
        master = await Masters.create({
          master_name: trimmedInput,
          master_type: type,
          comp_id: user.comp_id,
          master_color: null,
        });
      } catch (error) {
        if (error.code === 11000) {
          master = await Masters.findOne({
            master_name: {
              $regex: new RegExp(`^${escapeRegex(trimmedInput)}$`, "i"),
            },
            master_type: type,
            comp_id: user.comp_id,
          });
        } else {
          throw error;
        }
      }

      return master ? master._id : null;
    };

    const mastersArray = [];
    const pushMaster = (masterId, qty = 0, weight = 0) => {
      if (masterId) mastersArray.push({ master_id: masterId, qty, weight });
    };

    //  1. แปลง Category, ItemType, และ Size (เป็น ObjectId)
    const categoryId = await ensureMasterId(data.category, "product_category");
    const itemTypeId = await ensureMasterId(data.item_type, "item_type");
    const sizeString = data.product_size || data.size || "";

    // 2. Unit ไม่แปลง (ใช้ค่า String เดิม)
    // const unitId = await ensureMasterId(data.unit, "unit");

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

    // --- Stone Logic ---
    const prepareStoneData = async (stoneData) => {
      return {
        stone_name: await ensureMasterId(stoneData.stone_name, "stone_name"),
        shape: await ensureMasterId(stoneData.shape, "shape"),
        size: stoneData.size || "",
        color: stoneData.color || "",
        cutting: await ensureMasterId(stoneData.cutting, "cutting"),
        quality: await ensureMasterId(stoneData.quality, "quality"),
        clarity: await ensureMasterId(stoneData.clarity, "clarity"),
        qty:
          stoneData.qty || stoneData.stone_qty
            ? Number(stoneData.qty || stoneData.stone_qty)
            : 1,
        weight: stoneData.weight ? Number(stoneData.weight) : 0,
        unit: stoneData.unit || "g",
      };
    };

    let primaryStoneData = null;

    // รองรับ object
    if (data.primary_stone && typeof data.primary_stone === "object") {
      primaryStoneData = await prepareStoneData(data.primary_stone);
    }

    // รองรับแบบ flat (backward compatibility)
    else if (data.stone_name) {
      const rawPrimary = {
        stone_name: data.stone_name,
        shape: data.shape,
        size: data.size,
        color: data.color,
        cutting: data.cutting,
        quality: data.quality,
        clarity: data.clarity,
        stone_qty: data.stone_qty,
        weight: data.weight,
        unit: data.unit,
      };

      primaryStoneData = await prepareStoneData(rawPrimary);
    }

    let additionalStonesData = [];
    if (
      data.additional_stones &&
      Array.isArray(data.additional_stones) &&
      data.additional_stones.length > 0
    ) {
      for (const stone of data.additional_stones) {
        const readyStone = await prepareStoneData(stone);
        additionalStonesData.push(readyStone);
      }
    }

    // Create Detail
    const newDetail = await ProductDetail.create({
      // Unit: ใช้ String ตรงๆ
      unit: data.unit || "g",

      size: sizeString,

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

        // Category & ItemType: ใช้ ID (Master)
        product_category: categoryId,
        product_item_type: itemTypeId,

        related_accessories: Array.isArray(data.related_accessories)
          ? data.related_accessories
          : [],
      });

      const populatedProduct = await Product.findById(newProduct._id)
        .populate("product_category", "master_name")
        .populate("product_item_type", "master_name")
        .populate({
          path: "product_detail_id",
          populate: [
            { path: "masters.master_id", select: "master_name master_type" },
            { path: "primary_stone.stone_name", select: "master_name code" },
            { path: "primary_stone.shape", select: "master_name code" },
            { path: "primary_stone.cutting", select: "master_name code" },
            { path: "primary_stone.quality", select: "master_name code" },
            { path: "primary_stone.clarity", select: "master_name code" },
            {
              path: "additional_stones.stone_name",
              select: "master_name code",
            },
            { path: "additional_stones.shape", select: "master_name code" },
            { path: "additional_stones.cutting", select: "master_name code" },
            { path: "additional_stones.quality", select: "master_name code" },
            { path: "additional_stones.clarity", select: "master_name code" },
          ],
        })
        .populate({
          path: "related_accessories.product_id",
          select: "product_name product_code",
        })
        .lean();

      // Flatten Response Data
      let responseData = populatedProduct;
      const formattedData = formatProductResponse(responseData, req);

      res.status(201).json({
        success: true,
        message: "Product created successfully.",
        data: formattedData,
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
    if (!mongoose.isValidObjectId(id))
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format." });

    const user = await User.findById(req.user.id).select("comp_id").lean();
    if (!user)
      return res
        .status(401)
        .json({ success: false, message: "User not found" });

    const product = await Product.findOne({ _id: id, comp_id: user.comp_id })
      .populate("product_category", "master_name")
      .populate("product_item_type", "master_name")
      .populate({
        path: "product_detail_id",
        populate: [
          {
            path: "masters.master_id",
            select: "master_name master_type master_color code",
          },
          { path: "primary_stone.stone_name", select: "master_name code" },
          { path: "primary_stone.shape", select: "master_name code" },
          { path: "primary_stone.cutting", select: "master_name code" },
          { path: "primary_stone.quality", select: "master_name code" },
          { path: "primary_stone.clarity", select: "master_name code" },
          { path: "additional_stones.stone_name", select: "master_name code" },
          { path: "additional_stones.shape", select: "master_name code" },
          { path: "additional_stones.cutting", select: "master_name code" },
          { path: "additional_stones.quality", select: "master_name code" },
          { path: "additional_stones.clarity", select: "master_name code" },
        ],
      })
      .populate({
        path: "related_accessories.product_id",
        select: "product_name product_code file product_detail_id",
        populate: { path: "product_detail_id", select: "weight unit" },
      })
      .populate({
        path: "related_accessories.metal",
        select: "master_name",
      })
      .populate("comp_id", "comp_name")
      .lean();

    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });

    const formattedData = formatProductResponse(product, req);

    res.status(200).json({ success: true, data: formattedData });
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

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const { category, search, item_type, stone } = req.query;

    let query = { comp_id: user.comp_id };

    if (category) {
      const catNames = category.split(",");
      const masterCats = await Masters.find({
        master_name: { $in: catNames },
        comp_id: user.comp_id,
      }).select("_id");

      const catIds = masterCats.map((m) => m._id);
      query.product_category = { $in: catIds };
    }

    if (item_type) {
      const typeNames = item_type.split(",");
      const masterTypes = await Masters.find({
        master_name: { $in: typeNames },
        comp_id: user.comp_id,
      }).select("_id");

      const typeIds = masterTypes.map((m) => m._id);
      query.product_item_type = { $in: typeIds };
    }

    if (stone) {
      const stoneNames = stone.split(",");

      const masterStones = await Masters.find({
        master_name: { $in: stoneNames },
        comp_id: user.comp_id,
      }).select("_id");
      const masterStoneIds = masterStones.map((m) => m._id);

      const matchedDetails = await ProductDetail.find({
        "primary_stone.stone_name": { $in: masterStoneIds },
      }).select("_id");

      const detailIds = matchedDetails.map((detail) => detail._id);
      query.product_detail_id = { $in: detailIds };
    }

    if (search) {
      const safeSearch = escapeRegex(String(search));
      query.$or = [
        { product_name: { $regex: safeSearch, $options: "i" } },
        { product_code: { $regex: safeSearch, $options: "i" } },
      ];
    }

    const [products, total] = await Promise.all([
      Product.find(query)
        .select(
          "product_name product_code file product_category product_item_type createdAt related_accessories is_active",
        )
        .populate("product_category", "master_name")
        .populate("product_item_type", "master_name")
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
      let metal_color = "";
      let stone_color = "";
      let stone_size = "";

      let size = "";
      let unit = "";

      let weight = 0;
      let gross_weight = 0;
      let net_weight = 0;

      if (p.product_detail_id) {
        const detail = p.product_detail_id;

        size = detail.size || "";
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
              else if (type === "metal_color") metal_color = name;
              else if (type === "item_type") foundItemType = name;
            }
          });
        }

        if (detail.primary_stone && detail.primary_stone.stone_name) {
          if (detail.primary_stone.stone_name.master_name) {
            foundStone = detail.primary_stone.stone_name.master_name;
          }
          if (detail.primary_stone.color) {
            stone_color = detail.primary_stone.color;
          }
          if (detail.primary_stone.size) {
            stone_size = detail.primary_stone.size;
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
            weight: acc.weight || master.product_detail_id?.weight || 0,
            unit: acc.unit || master.product_detail_id?.unit || "g",
          };
        })
        .filter((item) => item !== null);

      return {
        _id: p._id,
        product_code: p.product_code,
        product_name: p.product_name,
        image: p.file && p.file.length > 0 ? `${baseUrl}${p.file[0]}` : "",

        category: p.product_category,
        is_active: p.is_active,

        type_stone: finalTypeStone,
        stone_name: foundStone,
        item_type: foundItemType,

        unit: unit,
        size: size,
        metal: metal,
        color: metal_color,

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
      limit: limit,
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

    // Normalize Stone Payload (เหมือน createProduct)
    const normalizedPrimaryStone =
      data.primary_stone ??
      (data.stone_name || data.shape || data.cutting
        ? {
            stone_name: data.stone_name,
            shape: data.shape,
            size: data.size,
            color: data.color,
            cutting: data.cutting,
            quality: data.quality,
            clarity: data.clarity,
            qty: data.stone_qty,
            weight: data.stone_weight,
            unit: data.stone_unit,
          }
        : undefined);

    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ success: false, message: "Invalid ID" });

    const user = await User.findById(userId).select("comp_id");
    if (!user || !user.comp_id)
      return res
        .status(400)
        .json({ success: false, message: "User not associated with company" });

    const currentProduct = await Product.findOne({
      _id: id,
      comp_id: user.comp_id,
    });
    if (!currentProduct)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });

    const currentDetail = await ProductDetail.findById(
      currentProduct.product_detail_id,
    ).lean();

    // ✅ Helper: Escape Regex
    const escapeRegex = (string) => {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    };

    // --- Auto-create Master Logic ---
    const ensureMasterId = async (input, type) => {
      // ถ้าส่งมาเป็นค่าว่าง ให้ return null (เพื่อลบค่าใน DB)
      if (!input || (typeof input === "string" && input.trim() === ""))
        return null;

      if (mongoose.isValidObjectId(input)) {
        const exists = await Masters.exists({
          _id: input,
          comp_id: user.comp_id,
        });
        if (exists) return input;
      }
      const trimmedInput = input.toString().trim();

      let master = await Masters.findOne({
        master_name: {
          $regex: new RegExp(`^${escapeRegex(trimmedInput)}$`, "i"),
        },
        master_type: type,
        comp_id: user.comp_id,
      });
      if (master) return master._id;

      try {
        master = await Masters.create({
          master_name: trimmedInput,
          master_type: type,
          comp_id: user.comp_id,
          master_color: null,
        });
      } catch (error) {
        if (error.code === 11000) {
          master = await Masters.findOne({
            master_name: {
              $regex: new RegExp(`^${escapeRegex(trimmedInput)}$`, "i"),
            },
            master_type: type,
            comp_id: user.comp_id,
          });
        } else {
          throw error;
        }
      }
      return master ? master._id : null;
    };

    // --- File Upload ---
    if (req.files && req.files.length > 0) {
      const uploadDir = "./uploads/product";
      if (!fs.existsSync(uploadDir))
        fs.mkdirSync(uploadDir, { recursive: true });
      await Promise.all(
        req.files.map(async (file, index) => {
          const filename = `product-${Date.now()}-${Math.round(Math.random() * 1e9)}-${index}.jpeg`;
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

    // ✅ 1. แปลง Master Fields (ถ้าส่งมา ให้ update / ถ้าส่ง "" ให้เป็น null)
    // ใช้ !== undefined เพื่อเช็คว่ามีการส่ง field นี้มาไหม
    const categoryIdUpdate =
      data.category !== undefined
        ? await ensureMasterId(data.category, "product_category")
        : undefined;

    const itemTypeIdUpdate =
      data.item_type !== undefined
        ? await ensureMasterId(data.item_type, "item_type")
        : undefined;

    const sizeInput =
      data.product_size !== undefined ? data.product_size : data.size;

    // --- Prepare Update Masters Array (Metal/ItemType) ---
    // Logic: ถ้ามีการส่ง item_type หรือ metal มาใหม่ เราจะสร้าง Array masters ใหม่เลย
    // ถ้าส่ง "" มา ensureMasterId จะได้ null และจะไม่ถูก push ลง array (เท่ากับลบออก)
    let updatedMasters = currentDetail.masters || [];
    if (
      data.item_type !== undefined ||
      data.metal !== undefined ||
      data.metal_color !== undefined
    ) {
      const tempMasters = [];

      // จัดการ Item Type
      if (data.item_type !== undefined) {
        const id = await ensureMasterId(data.item_type, "item_type");
        if (id) tempMasters.push({ master_id: id, qty: 1 });
      } else {
        // ถ้าไม่ได้ส่งมา ให้คงค่าเดิมไว้ (ถ้ามี)
        const oldItemType = currentDetail.masters.find(
          (m) => m.master_id?.master_type === "item_type", // ต้องเช็คดีๆ ว่า populate หรือยัง ถ้ายังอาจจะต้องใช้วิธีอื่น แต่ปกติตรงนี้ยากเพราะ DB เก็บแค่ ID
        );

        if (currentProduct.product_item_type) {
          // เช็คว่า User ตั้งใจลบ item_type ไหม? (ถ้า data.item_type === "")
          if (data.item_type !== "") {
            tempMasters.push({
              master_id: currentProduct.product_item_type,
              qty: 1,
            });
          }
        }
      }
      const newMastersList = [];

      // 1. Item Type
      if (data.item_type !== undefined) {
        const id = await ensureMasterId(data.item_type, "item_type");
        if (id) newMastersList.push({ master_id: id, qty: 1 });
      } else if (currentProduct.product_item_type) {
        // ถ้าไม่ส่งมา ให้เอาของเก่าใส่กลับเข้าไป
        newMastersList.push({
          master_id: currentProduct.product_item_type,
          qty: 1,
        });
      }

      // 2. Metal
      if (data.metal !== undefined) {
        const id = await ensureMasterId(data.metal, "metal");
        if (id) {
          newMastersList.push({
            master_id: id,
            qty: 1,
            weight:
              data.net_weight !== undefined
                ? Number(data.net_weight)
                : data.weight || 0,
          });
        }
      } else {
        // หาของเก่ามาใส่ (ถ้าหาได้) หรือข้ามไป
      }

      // 3. Metal Color
      if (data.metal_color !== undefined) {
        const id = await ensureMasterId(data.metal_color, "metal_color");
        if (id) newMastersList.push({ master_id: id, qty: 1 });
      }

      if (
        newMastersList.length > 0 ||
        data.metal === "" ||
        data.item_type === ""
      ) {
        updatedMasters = newMastersList;
      }
    }

    // --- Stone Logic ---

    let primaryStoneObj = currentDetail.primary_stone || {};

    if (normalizedPrimaryStone !== undefined) {
      const ps = normalizedPrimaryStone || {};

      // primaryStoneObj = {
      //   stone_name: await ensureMasterId(ps.stone_name, "stone_name"),
      //   shape: await ensureMasterId(ps.shape, "shape"),
      //   size: ps.size || "",
      //   color: ps.color || "",
      //   cutting: await ensureMasterId(ps.cutting, "cutting"),
      //   quality: await ensureMasterId(ps.quality, "quality"),
      //   clarity: await ensureMasterId(ps.clarity, "clarity"),
      //   qty: ps.qty ? Number(ps.qty) : 1,
      //   weight: ps.weight ? Number(ps.weight) : 0,
      //   unit: ps.unit ?? currentDetail.primary_stone?.unit ?? data.unit ?? "g",
      // };

      primaryStoneObj = {
        stone_name:
          ps.stone_name !== undefined
            ? await ensureMasterId(ps.stone_name, "stone_name")
            : null,

        shape:
          ps.shape !== undefined
            ? await ensureMasterId(ps.shape, "shape")
            : null,

        size: ps.size ?? "",

        color: ps.color ?? "",

        cutting:
          ps.cutting !== undefined
            ? await ensureMasterId(ps.cutting, "cutting")
            : null,

        quality:
          ps.quality !== undefined
            ? await ensureMasterId(ps.quality, "quality")
            : null,

        clarity:
          ps.clarity !== undefined
            ? await ensureMasterId(ps.clarity, "clarity")
            : null,

        qty: ps.qty ? Number(ps.qty) : 1,
        weight: Number(ps.weight || 0),
        unit:
          ps.unit !== undefined
            ? ps.unit
            : (currentDetail.primary_stone?.unit ?? "g"),
      };
    }

    // Additional Stones
    let additionalStonesUpdate = [];
    if (data.additional_stones !== undefined) {
      if (Array.isArray(data.additional_stones)) {
        for (const s of data.additional_stones) {
          additionalStonesUpdate.push({
            stone_name: await ensureMasterId(s.stone_name, "stone_name"),
            shape: await ensureMasterId(s.shape, "shape"),
            size: s.size || "",
            color: s.color || "",
            cutting: await ensureMasterId(s.cutting, "cutting"),
            quality: await ensureMasterId(s.quality, "quality"),
            clarity: await ensureMasterId(s.clarity, "clarity"),
            qty: s.qty ? Number(s.qty) : 1,
            weight: s.weight ? Number(s.weight) : 0,
            unit: s.unit ?? "g",
          });
        }
      }
    }

    // บันทึก Detail
    const detailUpdate = {
      // แก้ไข Unit: ใช้ !== undefined (ถ้าส่ง "" มา ก็จะ save "")
      unit: data.unit !== undefined ? data.unit : currentDetail.unit,

      // แก้ไข Size: ถ้า sizeIdUpdate มีค่า (รวมถึง null) ให้ update
      ...(sizeInput !== undefined && { size: sizeInput }),

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

    await ProductDetail.findByIdAndUpdate(currentProduct.product_detail_id, {
      $set: detailUpdate,
    });

    // บันทึก Product
    const productUpdate = {
      product_name: data.product_name,
      product_code: data.code,
      // ถ้ามีค่า (รวมถึง null) ให้ update
      ...(categoryIdUpdate !== undefined && {
        product_category: categoryIdUpdate,
      }),
      ...(itemTypeIdUpdate !== undefined && {
        product_item_type: itemTypeIdUpdate,
      }),
    };

    if (newFilesArray.length > 0) productUpdate.file = newFilesArray;
    if (data.related_accessories && Array.isArray(data.related_accessories)) {
      productUpdate.related_accessories = data.related_accessories.map(
        (acc, i) => {
          const old = currentProduct.related_accessories?.[i] || {};

          return {
            product_id: acc.product_id ?? old.product_id,

            weight:
              acc.weight !== undefined && acc.weight !== ""
                ? Number(acc.weight)
                : (old.weight ?? 0),

            unit: acc.unit ?? old.unit ?? "g",

            size: acc.size ?? old.size ?? "",

            metal: acc.metal ?? old.metal ?? "",

            description: acc.description ?? old.description ?? "",
          };
        },
      );
    }

    // ลบ key ที่เป็น undefined จริงๆ ออก (แต่ null เก็บไว้เพื่อลบค่าใน DB)
    Object.keys(productUpdate).forEach(
      (key) => productUpdate[key] === undefined && delete productUpdate[key],
    );

    // 🟢 Fetch & Format Response
    let updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: productUpdate },
      { new: true },
    )
      .populate("product_category", "master_name")
      .populate("product_item_type", "master_name")
      .populate({
        path: "product_detail_id",
        populate: [
          { path: "masters.master_id", select: "master_name master_type" },
          { path: "primary_stone.stone_name", select: "master_name" },
          { path: "primary_stone.shape", select: "master_name" },
          { path: "primary_stone.cutting", select: "master_name" },
          { path: "primary_stone.quality", select: "master_name" },
          { path: "primary_stone.clarity", select: "master_name" },
          { path: "additional_stones.stone_name", select: "master_name" },
          { path: "additional_stones.shape", select: "master_name" },
          { path: "additional_stones.cutting", select: "master_name" },
          { path: "additional_stones.quality", select: "master_name" },
          { path: "additional_stones.clarity", select: "master_name" },
        ],
      })
      .populate({
        path: "related_accessories.product_id",
        select: "product_name product_code file",
      })
      .lean();

    const formattedData = formatProductResponse(updatedProduct, req);
    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: formattedData,
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
    // -----------------------------------------------------
    // 1. Validate & Find User
    // -----------------------------------------------------
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
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // -----------------------------------------------------
    // 2. 🔍 Check References (ตรวจสอบว่าสินค้าถูกใช้งานไปหรือยัง)
    // -----------------------------------------------------

    // 2.1 เช็คว่าอยู่ใน Order (ขายไปหรือยัง)
    const isUsedInOrder = await Order.exists({ "items.product_id": id });

    // 2.2 เช็คว่าอยู่ใน Purchase (เคยสั่งซื้อเข้ามาหรือยัง)
    const isUsedInPurchase = await Purchase.exists({ "items.product_id": id });

    // 2.3 เช็คว่ามี Transaction การเคลื่อนไหวสต็อกไหม
    const isUsedInTrans = await StockTransaction.exists({ product_id: id });

    // 2.4 เช็คว่าเป็นส่วนประกอบ (Accessory) ของสินค้าอื่นไหม
    const isUsedAsAccessory = await Product.exists({
      "related_accessories.product_id": id,
      comp_id: user.comp_id,
    });

    // -----------------------------------------------------
    // 3. 🟡 CASE: ถูกใช้งานแล้ว -> เปลี่ยนเป็น Inactive (Soft Delete)
    // -----------------------------------------------------
    if (
      isUsedInOrder ||
      isUsedInPurchase ||
      isUsedInTrans ||
      isUsedAsAccessory
    ) {
      // อัปเดตสถานะเป็น Inactive
      product.is_active = false;
      await product.save();

      return res.status(200).json({
        success: true,
        message:
          "Product is in use. Status changed to Inactive instead of deleting.",
        action: "soft_delete", // บอกหน้าบ้านว่าแค่นี้ปิดการใช้งานนะ ไม่ได้ลบหาย
        data: { _id: product._id, is_active: false },
      });
    }

    // -----------------------------------------------------
    // 4. 🔴 CASE: ยังไม่เคยถูกใช้ -> ลบถาวร (Hard Delete)
    // -----------------------------------------------------

    // 4.1 ลบรูปภาพ
    if (product.file && product.file.length > 0) {
      product.file.forEach((fileName) => {
        // เช็คว่าเป็นรูป Local ไม่ใช่ Link ภายนอก
        if (!fileName.startsWith("http")) {
          const imagePath = path.join("./uploads/product", fileName);
          if (fs.existsSync(imagePath)) {
            try {
              fs.unlinkSync(imagePath);
            } catch (err) {
              console.log(`Delete Img Error: ${err.message}`);
            }
          }
        }
      });
    }

    // 4.2 ลบ Stock (Inventory) ที่ผูกกับสินค้านี้ทิ้งด้วย (ไม่งั้นจะเป็น Data ขยะ)
    await Stock.deleteMany({ product_id: id });

    // 4.3 ลบ Product Detail
    if (product.product_detail_id) {
      await ProductDetail.findByIdAndDelete(product.product_detail_id);
    }

    // 4.4 ลบ Product หลัก
    await Product.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Product permanently deleted.",
      action: "hard_delete",
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

    // const updatedProduct = await Product.findByIdAndUpdate(
    //   id,
    //   {
    //     $pull: { file: fileName },
    //   },
    //   { new: true },
    // );

    const updatedProduct = await Product.findByIdAndUpdate(id, update, {
      new: true,
    })
      .populate("product_category", "master_name")
      .populate("product_item_type", "master_name")
      .populate("metal", "master_name master_color")
      .populate({
        path: "related_accessories.product_id",
        select: "product_name product_code",
      });

    res.status(200).json({
      success: true,
      data: updatedProduct,
    });

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

const buildQuery = async (user, type, value) => {
  let query = { comp_id: user.comp_id };

  if (type === "category" && value) {
    const values = Array.isArray(value) ? value : [value];
    const targetIds = values.filter((v) => mongoose.Types.ObjectId.isValid(v));
    const names = values.filter((v) => !mongoose.Types.ObjectId.isValid(v));

    if (names.length > 0) {
      const masters = await Masters.find({
        master_name: { $in: names },
        comp_id: user.comp_id,
      }).select("_id");
      targetIds.push(...masters.map((m) => m._id));
    }
    query.product_category = { $in: targetIds }; // $in: [] ไม่ error ใน mongo ยุคใหม่
  } else if (type === "selected" && Array.isArray(value) && value.length) {
    query._id = { $in: value };
  }

  return query;
};

// 2. จัดรูปแบบข้อมูล (Formatting)
const formatRows = (products) => {
  const formatted = products.map((p) => {
    const d = p.product_detail_id || {};
    const ps = d.primary_stone || {};

    const addText = (d.additional_stones || [])
      .map(
        (s) =>
          `${s.stone_name?.master_name || "-"} ${s.shape?.master_name || ""} ${s.color ? `(${s.color})` : ""} (${s.qty || 0}pcs)`,
      )
      .join("\r\n");

    const accText = (p.related_accessories || [])
      .map(
        (acc) =>
          acc.product_id?.product_name ||
          acc.product_id?.product_code ||
          "Unknown",
      )
      .join("\r\n");

    const val = (v) => (v !== undefined && v !== null && v !== "" ? v : "-");
    const redVal = (v) => (v !== undefined && v !== null && v !== "" ? v : "");

    return {
      Code: val(p.product_code),
      Name: val(p.product_name),
      Category: p.product_category?.master_name || p.product_category || "-",
      Type: p.product_item_type?.master_name || p.product_item_type || "-",
      "Gross Weight": redVal(d.gross_weight),
      "Net Weight": redVal(d.net_weight),
      "Product Unit": val(d.unit || p.unit),
      Size: val(d.size),
      Stone: val(ps.stone_name?.master_name),
      Shape: val(ps.shape?.master_name),
      Color: val(ps.color),
      Clarity: val(ps.clarity?.master_name),
      "Stone Qty": ps.qty || "-",
      "Stone Weight": ps.weight || "-",
      "Additional Stones": val(addText),
      Components: val(
        (d.masters || [])
          .map((m) => m.master_id?.master_name || "-")
          .join(", "),
      ),
      Accessories: val(accText),
      Status: p.is_active ? "Active" : "Inactive",
      "Purchase Unit": redVal(),
      Qty: redVal(),
      Cost: redVal(),
      Price: redVal(),
    };
  });

  return formatted.sort((a, b) => {
    const catA = (a.Category || "").toLowerCase();
    const catB = (b.Category || "").toLowerCase();
    return catA === catB
      ? (a.Name || "").localeCompare(b.Name || "")
      : catA.localeCompare(catB);
  });
};

// 3. ตกแต่ง Header (Style) - แยกออกมาเพื่อลด Nesting
const styleSheetHeader = (sheet) => {
  const editableFields = [
    "Gross Weight",
    "Net Weight",
    "Purchase Unit",
    "Qty",
    "Cost",
    "Price",
  ];
  const headerRow = sheet.getRow(1);

  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 12 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };

    if (editableFields.includes(cell.value)) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFF0000" },
      };
      cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    } else {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEEEEEE" },
      };
    }
  });
};

// 4. ฝังสูตร Excel (Formula) - แยกออกมาลดความซับซ้อน
const injectExcelFormulas = (sheet) => {
  const grossCol = sheet.getColumn("Gross Weight");
  const netCol = sheet.getColumn("Net Weight");

  if (!grossCol || !netCol) return;

  const gLetter = grossCol.letter;
  // ใช้ Loop แบบธรรมดาเพื่อลด Nesting ของ Callback
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const netCell = row.getCell("Net Weight");
    if (!netCell.value) {
      netCell.value = {
        formula: `IF(${gLetter}${rowNumber}="","",${gLetter}${rowNumber})`,
      };
    }
  });
};

// 5. จัดขนาด Column (Auto Width) - แยกออกมา
const autoSizeColumns = (sheet) => {
  sheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber > 1)
        cell.alignment = {
          vertical: "top",
          horizontal: "left",
          wrapText: true,
        };

      const valStr =
        cell.value && cell.value.formula
          ? ""
          : cell.value
            ? cell.value.toString()
            : "";
      const lines = valStr.split("\r\n");
      const maxLine = Math.max(...lines.map((l) => l.length));
      if (maxLine > maxLength) maxLength = maxLine;
    });
    column.width = maxLength < 15 ? 15 : maxLength > 50 ? 50 : maxLength + 2;
  });
};

// 6. รวมร่าง Excel Generator
const createExcelWorkbook = (rows) => {
  const workbook = new ExcelJS.Workbook();
  const safeName = "Products";
  const sheet = workbook.addWorksheet(safeName);

  if (rows.length > 0) {
    sheet.columns = Object.keys(rows[0]).map((h) => ({
      header: h,
      key: h,
      width: 15,
    }));
    sheet.addRows(rows);

    // เรียกใช้ฟังก์ชันย่อย (Method Calls are Free!) 🚀
    styleSheetHeader(sheet);
    injectExcelFormulas(sheet);
    autoSizeColumns(sheet);
  }
  return workbook;
};

exports.exportProductToExcel = async (req, res) => {
  try {
    // 1. Security Check (Guard Clauses ลด Nesting)
    if (!req.user?.id)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    const user = await User.findById(req.user.id).select("comp_id").lean();
    if (!user?.comp_id)
      return res
        .status(400)
        .json({ success: false, message: "User has no company" });

    // 2. Prepare Data
    const query = await buildQuery(user, req.body.type, req.body.value);

    // 3. Fetch from DB
    const products = await Product.find(query)
      .populate("product_category", "master_name")
      .populate("product_item_type", "master_name")
      .populate({
        path: "product_detail_id",
        populate: [
          "primary_stone.stone_name",
          "primary_stone.shape",
          "primary_stone.clarity",
          "primary_stone.cutting",
          "primary_stone.quality",
          "additional_stones.stone_name",
          "additional_stones.shape",
          "additional_stones.clarity",
          "masters.master_id",
        ],
      })
      .populate({
        path: "related_accessories.product_id",
        select: "product_name product_code",
      })
      .lean();

    // 4. Transform & Generate
    const rows = formatRows(products);
    const workbook = createExcelWorkbook(rows);

    // 5. Send Response
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const prefix =
      req.body.type === "category"
        ? "Categories_Mix"
        : req.body.type === "selected"
          ? "Selected"
          : "All";
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Purchase_Template_${prefix}_${Date.now()}.xlsx"`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Export Error", error: err.message });
  }
};
