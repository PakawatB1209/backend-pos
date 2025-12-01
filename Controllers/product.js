const Product = require("../models/Product");
const ProductDetail = require("../models/Product_detail");
const User = require("../models/User");
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
      stoneWeight = data.net_weight || 0;
    }
    pushMaster(data.stone_name, 1, stoneWeight);
    pushMaster(data.shape);
    pushMaster(data.size);
    pushMaster(data.weight);
    pushMaster(data.color);
    pushMaster(data.cutting);
    pushMaster(data.quality);
    pushMaster(data.clarity);

    const newDetail = await ProductDetail.create({
      unit: data.unit || "pcs",
      size: data.product_size || data.size,
      color: data.color,
      gross_weight: data.gross_weight || 0,
      net_weight: data.net_weight || 0,
      weight: data.weight || 0,
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
        product_Image: data.image || "",
        sale_price: data.sale_price,

        product_detail_id: newDetail._id,

        comp_id: user.comp_id,
      });

      res.status(201).json({
        success: true,
        message: "Product created successfully.",
        data: newProduct,
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
    const id = req.params.id;
    const product = await Product.findOne({ _id: id }).populate(
      "product_detail_id"
    );
    res.send(product);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};

exports.list = async (req, res) => {
  try {
    const product = await Product.find().populate("product_detail_id");
    res.send(product);
  } catch (error) {
    console.log(err);
    res.status(500).send("server error");
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const id = req.params.id;

    // แยกข้อมูล
    const { product_detail, ...product_data } = req.body;

    // 1) Update Product
    const product = await Product.findOneAndUpdate({ _id: id }, product_data, {
      new: true,
    });

    if (!product) return res.status(404).json({ error: "Product not found" });

    // 2) Update Product Detail
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
    const id = req.params.id;
    const remove_product = await Product.findOneAndDelete({ _id: id });
    res.send(remove_product);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};
