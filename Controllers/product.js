const Product = require("../models/Product");
const ProductDetail = require("../models/Product_detail");
const User = require("../models/User");
const Masters = require("../models/masters");
const mongoose = require("mongoose");

const fs = require("fs");
const sharp = require("sharp");
const path = require("path");

exports.createProduct = async (req, res) => {
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

    // --- 1. จัดการรูปภาพ ---
    let filesArray = [];
    if (req.files && req.files.length > 0) {
      const uploadDir = "./uploads";
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

      await Promise.all(
        req.files.map(async (file, index) => {
          const filename = `product-${Date.now()}-${Math.round(
            Math.random() * 1e9
          )}-${index}.jpeg`;
          const outputPath = path.join(uploadDir, filename);

          await sharp(file.buffer)
            .resize(1200, 1200, {
              fit: sharp.fit.inside,
              withoutEnlargement: true,
            })
            .toFormat("jpeg", { quality: 80 })
            .toFile(outputPath);

          filesArray.push(filename);
        })
      );
    }

    // --- 2. เช็คสินค้าซ้ำ ---
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

    // --- 3. ฟังก์ชันช่วยค้นหา ID จากชื่อ (Helper) ---
    const getMasterId = async (name) => {
      if (!name) return null;
      // ค้นหาโดยดู comp_id ด้วย เพื่อความปลอดภัย
      const master = await Masters.findOne({
        master_name: name,
        comp_id: user.comp_id,
      });
      if (master) return master._id;
      return null;
    };

    const mastersArray = [];
    const pushMaster = (masterId, qty = 0, weight = 0) => {
      // ต้องมี ID เท่านั้นถึงจะ push ลงไป (กัน Error Cast Failed)
      if (masterId) {
        mastersArray.push({ master_id: masterId, qty, weight });
      }
    };

    // --- 4. 🔥 แปลงชื่อเป็น ID แล้วค่อย Push (จุดที่แก้) ---

    // 4.1 Item Type
    const itemTypeId = await getMasterId(data.item_type);
    pushMaster(itemTypeId, 1);

    // 4.2 Metal
    if (data.metal) {
      const metalId = await getMasterId(data.metal);
      const metalColorId = await getMasterId(data.metal_color);

      pushMaster(metalId, 1, data.net_weight || 0);
      pushMaster(metalColorId, 1);
    }

    // 4.3 Stone & Attributes
    let stoneWeight = 0;
    if (!data.metal && data.stone_name) {
      stoneWeight = data.net_weight || data.weight || 0;
    }

    // ⚠️ ต้องใช้ await getMasterId ทุกตัว
    const stoneNameId = await getMasterId(data.stone_name);
    const shapeId = await getMasterId(data.shape);
    const sizeId = await getMasterId(data.size);
    const colorId = await getMasterId(data.color);
    const cuttingId = await getMasterId(data.cutting);
    const qualityId = await getMasterId(data.quality);
    const clarityId = await getMasterId(data.clarity);

    // ส่ง ID ที่แปลงแล้วเข้าไป
    pushMaster(stoneNameId, 1, stoneWeight);
    pushMaster(shapeId);
    pushMaster(sizeId);
    pushMaster(colorId);
    pushMaster(cuttingId);
    pushMaster(qualityId);
    pushMaster(clarityId);

    // --- 5. สร้าง Detail ---
    const newDetail = await ProductDetail.create({
      unit: data.unit || "pcs",
      size: data.product_size || data.size,
      gross_weight: data.gross_weight || data.weight || 0,
      net_weight: data.net_weight || data.weight || 0,
      masters: mastersArray, // ตอนนี้ในนี้จะมีแต่ ObjectId ล้วนๆ แล้ว
      description: data.description,
      comp_id: user.comp_id,
    });

    try {
      // --- 6. สร้าง Product Main ---

      // หมายเหตุ: data.item_type เป็นชื่อ (String) อยู่แล้ว เอาไปบันทึกได้เลย
      // ไม่ต้องไป findById อีกรอบ เพราะจะ Error

      const newProduct = await Product.create({
        product_code: data.code,
        product_name: data.product_name,
        product_detail_id: newDetail._id,
        comp_id: user.comp_id,
        file: filesArray,
        product_category: data.category,
        product_item_type: data.item_type, // ใช้ชื่อที่ส่งมาจากหน้าบ้านได้เลย (เช่น "Ring")
      });

      res.status(201).json({
        success: true,
        message: "Product created successfully.",
        data: newProduct,
        file: filesArray,
      });
    } catch (productError) {
      console.log("Error creating main product, rolling back detail...");
      await ProductDetail.findByIdAndDelete(newDetail._id);
      throw productError;
    }
  } catch (err) {
    console.log("Error create product:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getOneProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format.",
      });
    }

    const product = await Product.findById(id)
      .populate({
        path: "product_detail_id",
        populate: {
          path: "masters.master_id",
        },
      })
      .populate("comp_id", "comp_name")
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.log("Error get product:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.list = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("comp_id");

    if (!user || !user.comp_id) {
      return res.status(400).json({
        success: false,
        message: "User is not associated with a company.",
      });
    }

    const { category, item_type, search } = req.query;

    let query = { comp_id: user.comp_id };

    if (category) {
      query.category = { $in: category.split(",") };
    }

    if (item_type) {
      query.item_type = { $in: item_type.split(",") };
    }

    if (search) {
      query.$or = [
        { product_name: { $regex: search, $options: "i" } },
        { product_code: { $regex: search, $options: "i" } },
      ];
    }

    console.log("🔍 Filtering with:", JSON.stringify(query));

    const products = await Product.find(query)
      .populate({
        path: "product_detail_id",
        populate: {
          path: "masters.master_id",
          select: "master_name master_type master_color",
        },
      })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.log("Error list product:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const user = await User.findById(userId).select("comp_id");

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
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
      currentProduct.product_detail_id
    )
      .populate("masters.master_id")
      .lean();

    let oldData = {
      item_type: null,
      metal: null,
      metal_color: null,
      stone_name: null,
      shape: null,
      size: null,
      color: null,
      cutting: null,
      quality: null,
      clarity: null,
    };

    if (currentDetail && currentDetail.masters) {
      currentDetail.masters.forEach((m) => {
        if (m.master_id) {
          const type = m.master_id.master_type;
          const id = m.master_id._id.toString();
          if (type === "item_type") oldData.item_type = id;
          if (type === "metal") oldData.metal = id;
          if (type === "stone_name") oldData.stone_name = id;
          if (type === "shape") oldData.shape = id;
          if (oldData[type] !== undefined) oldData[type] = id;
        }
      });
    }

    const data = req.body;

    if (req.file) {
      data.image = req.file.filename;
    }

    const mastersArray = [];
    const pushMaster = (masterId, qty = 0, weight = 0) => {
      if (masterId) mastersArray.push({ master_id: masterId, qty, weight });
    };

    pushMaster(data.item_type || oldData.item_type, 1);

    const finalMetal = data.metal || oldData.metal;
    if (finalMetal) {
      const finalNetWt =
        data.net_weight !== undefined
          ? data.net_weight
          : currentDetail.net_weight;
      pushMaster(finalMetal, 1, finalNetWt);

      pushMaster(data.metal_color || oldData.metal_color, 1);
    }

    const finalStone = data.stone_name || oldData.stone_name;
    let stoneWeight = 0;
    if (!finalMetal && finalStone) {
      stoneWeight =
        data.net_weight !== undefined
          ? data.net_weight
          : currentDetail.net_weight;
    }
    pushMaster(finalStone, 1, stoneWeight);

    pushMaster(data.shape || oldData.shape);
    pushMaster(data.size || oldData.size);
    pushMaster(data.color || oldData.color);
    pushMaster(data.cutting || oldData.cutting);
    pushMaster(data.quality || oldData.quality);
    pushMaster(data.clarity || oldData.clarity);

    const detailUpdate = {
      unit: data.unit,
      size: data.product_size || data.size,
      gross_weight: data.gross_weight,
      net_weight: data.net_weight,
      // cost: data.cost,
      // price: data.sale_price,
      description: data.description,

      masters: mastersArray,
    };

    Object.keys(detailUpdate).forEach(
      (key) => detailUpdate[key] === undefined && delete detailUpdate[key]
    );

    await ProductDetail.findByIdAndUpdate(
      currentProduct.product_detail_id,
      detailUpdate,
      { new: true }
    );

    const productUpdate = {
      product_code: data.code,
      product_name: data.product_name,
      product_Image: data.image,
      // sale_price: data.sale_price,
    };
    Object.keys(productUpdate).forEach(
      (key) => productUpdate[key] === undefined && delete productUpdate[key]
    );

    const updatedProduct = await Product.findByIdAndUpdate(id, productUpdate, {
      new: true,
    });

    res.status(200).json({
      success: true,
      message: "Product updated successfully (Partial Update)",
      data: updatedProduct,
    });
  } catch (err) {
    console.log("Error update product:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.removeOneProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format" });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "ไม่พบสินค้านี้" });
    }

    if (product.file) {
      const imagePath = `./uploads/${product.file}`;

      fs.unlink(imagePath, (err) => {
        if (err) console.log("Failed to delete local image:", err);
        else console.log("Successfully deleted local image");
      });
    }

    if (product.product_detail_id) {
      await ProductDetail.findByIdAndDelete(product.product_detail_id);
    }

    await Product.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Product and related data deleted successfully.",
      deletedId: id,
    });
  } catch (error) {
    console.log("Error remove product:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
