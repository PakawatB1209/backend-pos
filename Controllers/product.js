const Product = require("../models/Product");
const ProductDetail = require("../models/Product_detail");
const User = require("../models/User");
const fs = require("fs");
const mongoose = require("mongoose");

// exports.createProduct = async (req, res) => {
//   try {
//     const { product_detail, ...product_data } = req.body;

//     // 1) Create Product Detail
//     const detail = await ProductDetail.create(product_detail);

//     // 2) Create Product and link product_detail_id
//     const newProduct = await Product.create({
//       ...product_data,
//       product_detail_id: detail._id,
//     });

//     return res.status(201).json({
//       message: "Product created successfully",
//       product: newProduct,
//       product_detail: detail,
//     });
//   } catch (err) {
//     console.log("Server Error:", err);
//     return res.status(500).json({ error: "Server error" });
//   }
// };

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
    if (req.file) {
      data.file = req.file.filename;
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

    const mastersArray = [];
    const pushMaster = (masterId, qty = 0, weight = 0) => {
      if (masterId) {
        mastersArray.push({ master_id: masterId, qty, weight });
      }
    };

    pushMaster(data.item_type, 1);

    if (data.metal) {
      pushMaster(data.metal, 1, data.net_weight || 0);
      pushMaster(data.metal_color, 1);
    }

    let stoneWeight = 0;
    if (!data.metal && data.stone_name) {
      stoneWeight = data.net_weight || data.weight || 0;
    }

    pushMaster(data.stone_name, 1, stoneWeight);
    pushMaster(data.shape);
    pushMaster(data.size);
    pushMaster(data.color);
    pushMaster(data.cutting);
    pushMaster(data.quality);
    pushMaster(data.clarity);

    const newDetail = await ProductDetail.create({
      unit: data.unit || "pcs",
      size: data.product_size || data.size,

      gross_weight: data.gross_weight || data.weight || 0,
      net_weight: data.net_weight || data.weight || 0,

      cost: data.cost,
      price: data.sale_price,

      masters: mastersArray,
      description: data.description,
      comp_id: user.comp_id,
    });

    try {
      const newProduct = await Product.create({
        product_code: data.code,
        product_name: data.product_name,
        file: data.file || "",
        sale_price: data.sale_price,
        product_detail_id: newDetail._id,
        comp_id: user.comp_id,
      });

      res.status(201).json({
        success: true,
        message: "Product created successfully.",
        data: newProduct,
        file: data.file || "",
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

    const products = await Product.find({ comp_id: user.comp_id })
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
    const id = req.params.id;

    const { product_detail, ...product_data } = req.body;

    const product = await Product.findOneAndUpdate({ _id: id }, product_data, {
      new: true,
    });

    if (!product) return res.status(404).json({ error: "Product not found" });

    if (product_detail) {
      await ProductDetail.findByIdAndUpdate(
        product.product_detail_id,
        product_detail,
        { new: true }
      );
    }

    return res.json({
      message: "Product updated successfully",
      product,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Server error");
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
