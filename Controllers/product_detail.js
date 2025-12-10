const ProductDetail = require("../models/Product_detail");
const User = require("../models/User");

exports.getOneProductDetail = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format.",
      });
    }

    const productDetail = await ProductDetail.findById(id)
      .populate("comp_id", "comp_name")
      .populate({
        path: "masters.master_id",
        select: "master_name master_type master_color",
      })
      .lean();

    if (!productDetail) {
      return res.status(404).json({
        success: false,
        message: "ProductDetail not found.",
      });
    }

    res.status(200).json({
      success: true,
      data: productDetail,
    });
  } catch (error) {
    console.log("Error get product detail:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
