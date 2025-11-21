const Product = require("../models/Product");
const ProductDetail = require("../models/Product_detail");

// exports.createProduct = async (req, res) => {
//   try {
//     const { product_code, product_name, product_detail_id, product_Image } =
//       req.body;
//     const newProduct = await Product.create({
//       product_code,
//       product_name,
//       product_detail_id,
//       product_Image,
//     });
//     return res.status(200).json({
//       message: "Product created",
//       newProduct,
//     });
//   } catch (err) {
//     console.log("Server Error:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// };

exports.createProduct = async (req, res) => {
  try {
    const { product_detail, ...product_data } = req.body;

    // 1) Create Product Detail
    const detail = await ProductDetail.create(product_detail);

    // 2) Create Product and link product_detail_id
    const newProduct = await Product.create({
      ...product_data,
      product_detail_id: detail._id,
    });

    return res.status(201).json({
      message: "Product created successfully",
      product: newProduct,
      product_detail: detail,
    });
  } catch (err) {
    console.log("Server Error:", err);
    return res.status(500).json({ error: "Server error" });
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
