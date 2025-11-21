const ProductDetail = require("../models/Product_detail");

exports.createProductDetail = async (req, res) => {
  try {
    const {
      unit,
      color,
      size,
      metal_id,
      itemtype_id,
      shape_id,
      group_id,
      cuting_id,
      clarity_id,
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
      metal_id,
      itemtype_id,
      shape_id,
      group_id,
      cuting_id,
      clarity_id,
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
      newProductDetail,
    });
  } catch (err) {
    console.log("Server Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getOneProductDetail = async (req, res) => {
  try {
    const id = req.params.id;
    const productdetail = await ProductDetail.findOne({ _id: id })
      .populate("metal_id")
      .populate("itemtype_id")
      .populate("shape_id")
      .populate("group_id")
      .populate("cuting_id")
      .populate("clarity_id");
    res.send(productdetail);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};
