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
    // debug const getMasterId = async (name, fieldName) => {
    //   if (!name) return null;

    //   // ค้นหาโดยดูทั้ง ชื่อ และ comp_id
    //   const master = await Masters.findOne({
    //     master_name: name,
    //     comp_id: user.comp_id,
    //   }).lean();

    //   // 🚨 LOG จับผิด: ดูว่าหาเจอไหม
    //   if (!master) {
    //     console.log(
    //       `❌ ไม่พบ Master: "${name}" (ในฟิลด์: ${fieldName}) | Comp ID: ${user.comp_id}`
    //     );
    //   } else {
    //     console.log(`✅ พบ Master: "${name}" -> ID: ${master._id}`);
    //   }

    //   return master ? master._id : null;
    // };
    const getMasterId = async (name) => {
      if (!name) return null;

      const master = await Masters.findOne({
        master_name: name,
        comp_id: user.comp_id,
      }).lean();

      return master ? master._id : null;
    };

    const mastersArray = [];
    const pushMaster = (masterId, qty = 0, weight = 0) => {
      if (masterId) mastersArray.push({ master_id: masterId, qty, weight });
    };

    const itemTypeId = await getMasterId(data.item_type);
    pushMaster(itemTypeId, 1);

    if (data.metal) {
      const metalId = await getMasterId(data.metal);
      const metalColorId = await getMasterId(data.metal_color);
      pushMaster(metalId, 1, data.net_weight || 0);
      pushMaster(metalColorId, 1);
    }

    if (data.stones && Array.isArray(data.stones) && data.stones.length > 0) {
      for (const stone of data.stones) {
        const stoneNameId = await getMasterId(stone.stone_name);
        const shapeId = await getMasterId(stone.shape);
        const sizeId = await getMasterId(stone.size);
        const colorId = await getMasterId(stone.color);
        const cuttingId = await getMasterId(stone.cutting);
        const qualityId = await getMasterId(stone.quality);
        const clarityId = await getMasterId(stone.clarity);

        const qty = stone.qty ? Number(stone.qty) : 1;
        const weight = stone.weight ? Number(stone.weight) : 0;

        pushMaster(stoneNameId, qty, weight);
        pushMaster(shapeId);
        pushMaster(sizeId);
        pushMaster(colorId);
        pushMaster(cuttingId);
        pushMaster(qualityId);
        pushMaster(clarityId);
      }
    } else if (data.stone_name) {
      const stoneQty = data.stone_qty ? Number(data.stone_qty) : 1;
      let stoneWeight = 0;
      if (data.stone_weight) {
        stoneWeight = Number(data.stone_weight);
      } else if (!data.metal) {
        stoneWeight = data.net_weight || data.weight || 0;
      }

      const stoneNameId = await getMasterId(data.stone_name);
      pushMaster(stoneNameId, stoneQty, stoneWeight);

      const shapeId = await getMasterId(data.shape);
      const sizeId = await getMasterId(data.size);
      const colorId = await getMasterId(data.color);
      const cuttingId = await getMasterId(data.cutting);
      const qualityId = await getMasterId(data.quality);
      const clarityId = await getMasterId(data.clarity);

      pushMaster(shapeId);
      pushMaster(sizeId);
      pushMaster(colorId);
      pushMaster(cuttingId);
      pushMaster(qualityId);
      pushMaster(clarityId);
    }

    const newDetail = await ProductDetail.create({
      unit: data.unit || "pcs",
      size: data.product_size || data.size,
      gross_weight: data.gross_weight || data.weight || 0,
      net_weight: data.net_weight || data.weight || 0,
      masters: mastersArray,
      description: data.description,
      comp_id: user.comp_id,
    });

    try {
      const newProduct = await Product.create({
        product_code: data.code,
        product_name: data.product_name,
        product_detail_id: newDetail._id,
        comp_id: user.comp_id,
        file: filesArray,
        product_category: data.category,
        product_item_type: data.item_type,
      });
      const populatedProduct = await Product.findById(newProduct._id).populate({
        path: "product_detail_id",
        populate: {
          path: "masters.master_id", // เจาะเข้าไปดึงข้อมูล Master
          select: "master_name master_type", // ดึงเฉพาะฟิลด์ที่ต้องใช้
        },
      });
      res.status(201).json({
        success: true,
        message: "Product created successfully.",
        data: populatedProduct,
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
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format." });
    }

    const user = await User.findById(req.user.id).select("comp_id").lean();

    const product = await Product.findOne({
      _id: id,
      comp_id: user.comp_id,
    })
      .populate({
        path: "product_detail_id",
        populate: {
          path: "masters.master_id",
          select: "master_name master_type master_color code", // เลือกเฉพาะที่ใช้
        },
      })
      .populate("comp_id", "comp_name")
      .lean();

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    const attributes = {};

    if (product.product_detail_id && product.product_detail_id.masters) {
      product.product_detail_id.masters.forEach((m) => {
        if (m.master_id) {
          const type = m.master_id.master_type;

          attributes[type] = {
            _id: m.master_id._id,
            name: m.master_id.master_name,
            code: m.master_id.code,
            qty: m.qty,
            weight: m.weight,
          };
        }
      });
    }

    product.attributes = attributes;

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

    const { category, search } = req.query;

    let query = { comp_id: user.comp_id };

    if (category) query.category = { $in: category.split(",") };

    if (search) {
      query.$or = [
        { product_name: { $regex: search, $options: "i" } },
        { product_code: { $regex: search, $options: "i" } },
      ];
    }

    const [products, total] = await Promise.all([
      Product.find(query)
        .select("product_name product_code file category createdAt")
        .populate({
          path: "product_detail_id",
          select: "masters size unit",
          populate: {
            path: "masters.master_id",
            select: "master_name master_type",
          },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Product.countDocuments(query),
    ]);

    const formattedProducts = products.map((p) => {
      let foundItemType = "";
      let foundStone = "";
      let metal = "";
      let color = "";
      let size = "";

      if (p.product_detail_id) {
        const detail = p.product_detail_id;

        if (detail.size) {
          size = `${detail.size} ${detail.unit || ""}`.trim();
        }

        if (detail.masters) {
          detail.masters.forEach((m) => {
            if (m.master_id) {
              const name = m.master_id.master_name;
              const type = m.master_id.master_type;

              if (type === "metal") metal = name;
              else if (type === "metal_color" || type === "color") color = name;
              else if (type === "item_type") foundItemType = name;
              else if (type === "stone_name") foundStone = name;
            }
          });
        }
      }

      const finalTypeStone = foundItemType || foundStone || "";

      return {
        _id: p._id,
        code: p.product_code,
        name: p.product_name,
        image: p.file && p.file.length > 0 ? p.file[0] : "",
        category: p.category,

        type_stone: finalTypeStone,
        size: size,
        metal: metal,
        color: color,
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

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const data = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }

    const user = await User.findById(userId).select("comp_id");
    const currentProduct = await Product.findOne({
      _id: id,
      comp_id: user.comp_id,
    });

    if (!currentProduct) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    let imageFilename = undefined;

    if (req.file) {
      const oldImages = currentProduct.file || [];

      if (oldImages.length > 0) {
        oldImages.forEach((img) => {
          const oldPath = path.join(__dirname, "../uploads", img);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        });
      }

      imageFilename = req.file.filename;
    }

    const currentDetail = await ProductDetail.findById(
      currentProduct.product_detail_id
    ).lean();

    const oldMastersMap = {};
    if (currentDetail && currentDetail.masters) {
      const populatedDetail = await ProductDetail.findById(
        currentProduct.product_detail_id
      )
        .populate("masters.master_id")
        .lean();

      populatedDetail.masters.forEach((m) => {
        if (m.master_id) {
          oldMastersMap[m.master_id.master_type] = {
            id: m.master_id._id.toString(),
            qty: m.qty,
            weight: m.weight,
          };
        }
      });
    }

    const getVal = (newVal, oldType) => {
      if (newVal) return newVal;
      if (oldMastersMap[oldType]) return oldMastersMap[oldType].id; // ถ้าไม่มี ใช้ค่าเก่า
      return null;
    };

    const mastersArray = [];
    const pushMaster = (masterId, qty = 0, weight = 0) => {
      if (masterId) mastersArray.push({ master_id: masterId, qty, weight });
    };

    pushMaster(getVal(data.item_type, "item_type"), 1);

    const finalMetal = getVal(data.metal, "metal");
    if (finalMetal) {
      const finalNetWt =
        data.net_weight !== undefined
          ? data.net_weight
          : currentDetail.net_weight || 0;
      pushMaster(finalMetal, 1, finalNetWt);
      pushMaster(getVal(data.metal_color, "metal_color"), 1);
    }

    const finalStone = getVal(data.stone_name, "stone_name");
    if (!finalMetal && finalStone) {
      const stoneWt =
        data.net_weight !== undefined
          ? data.net_weight
          : currentDetail.net_weight || 0;
      pushMaster(finalStone, 1, stoneWt);
    } else {
      pushMaster(finalStone, 1, 0);
    }

    pushMaster(getVal(data.shape, "shape"));
    pushMaster(getVal(data.size, "size"));
    pushMaster(getVal(data.color, "color"));
    pushMaster(getVal(data.cutting, "cutting"));
    pushMaster(getVal(data.quality, "quality"));
    pushMaster(getVal(data.clarity, "clarity"));

    const detailUpdate = {
      unit: data.unit,
      size: data.product_size || data.size,
      gross_weight: data.gross_weight,
      net_weight: data.net_weight,
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
    };

    if (imageFilename) {
      productUpdate.file = [imageFilename];
    }

    Object.keys(productUpdate).forEach(
      (key) => productUpdate[key] === undefined && delete productUpdate[key]
    );

    const updatedProduct = await Product.findByIdAndUpdate(id, productUpdate, {
      new: true,
    });

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (err) {
    console.log("Error update product:", err);
    if (req.file) {
      const tempPath = path.join(__dirname, "../uploads", req.file.filename);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
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

    const user = await User.findById(req.user.id).select("comp_id");

    const product = await Product.findOne({ _id: id, comp_id: user.comp_id });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบสินค้านี้ หรือ คุณไม่มีสิทธิ์ลบ",
      });
    }

    if (product.file && product.file.length > 0) {
      product.file.forEach((fileName) => {
        const imagePath = path.join(__dirname, "../uploads", fileName);

        fs.unlink(imagePath, (err) => {
          if (err)
            console.log(
              `Failed to delete local image (${fileName}):`,
              err.message
            );
          else console.log(`Successfully deleted local image: ${fileName}`);
        });
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

exports.removeAllProducts = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("comp_id");

    const products = await Product.find({ comp_id: user.comp_id });

    if (!products.length) {
      return res
        .status(404)
        .json({ success: false, message: "ไม่พบสินค้าที่จะลบ" });
    }

    const detailIds = [];

    products.forEach((product) => {
      if (product.product_detail_id) {
        detailIds.push(product.product_detail_id);
      }

      if (product.file && product.file.length > 0) {
        product.file.forEach((fileName) => {
          const imagePath = path.join(__dirname, "../uploads", fileName);

          fs.unlink(imagePath, (err) => {
            if (err)
              console.log(
                `Failed to delete local image (${fileName}):`,
                err.message
              );
          });
        });
      }
    });

    if (detailIds.length > 0) {
      await ProductDetail.deleteMany({ _id: { $in: detailIds } });
    }

    await Product.deleteMany({ comp_id: user.comp_id });

    res.status(200).json({
      success: true,
      message: `Deleted ${products.length} products and related data successfully.`,
    });
  } catch (error) {
    console.log("Error remove all products:", error);
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
      { new: true }
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
