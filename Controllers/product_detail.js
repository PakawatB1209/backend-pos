const ProductDetail = require("../models/Product_detail");

exports.createProductDetail = async (req, res) => {
  try {
    const {
      unit,
      color,
      size,
      masters,
      quality,
      gross_weight,
      net_weight,
      weight,
      price,
      cost,
      description,
    } = req.body;

    const newProductDetail = await ProductDetail.create({
      unit,
      color,
      size,
      masters,
      quality,
      gross_weight,
      net_weight,
      weight,
      price,
      cost,
      description,
    });

    return res.status(200).json({
      message: "ProductDetail created",
      data: newProductDetail,
    });
  } catch (err) {
    console.log("Server Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getOneProductDetail = async (req, res) => {
  try {
    const id = req.params.id;
    const productdetail = await ProductDetail.findOne({ _id: id }).populate(
      "masters"
    );
    res.send(productdetail);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};
