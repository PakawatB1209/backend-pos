const ProductDetail = require("../models/Product_detail");
const User = require("../models/User");

// exports.createProductDetail = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const user = await User.findById(userId).select("comp_id");

//     if (!user || !user.comp_id) {
//       return res
//         .status(400)
//         .json({ success: false, message: "User has no company." });
//     }

//     const data = req.body;
//     const mastersArray = [];

//     const pushMaster = (masterId, qty = 0, weight = 0) => {
//       if (masterId) {
//         mastersArray.push({
//           master_id: masterId,
//         });
//       }
//     };

//     pushMaster(data.item_type, 1);

//     pushMaster(data.metal, 1, data.net_weight || 0);
//     pushMaster(data.metal_color, 1);

//     let stoneWeight = 0;

//     if (!data.metal && data.stone_name) {
//       stoneWeight = data.net_weight || 0;
//     }
//     pushMaster(data.stone_name, 1, stoneWeight);
//     pushMaster(data.shape);
//     pushMaster(data.cutting);
//     pushMaster(data.clarity);
//     pushMaster(data.color);
//     pushMaster(data.quality);

//     const newProductDetail = await ProductDetail.create({
//       unit: data.unit || "pcs",
//       color: data.color || data.metal_color,
//       size: data.product_size || data.size,

//       quality: data.quality,
//       gross_weight: data.gross_weight || 0,
//       net_weight: data.net_weight || data.weight || 0,

//       cost: data.cost,
//       price: data.sale_price,
//       labor_cost: 0,

//       masters: mastersArray,

//       description: data.description,
//       comp_id: user.comp_id,
//     });

//     res.status(201).json({
//       success: true,
//       message: "Product Saved Successfully",
//       data: newProductDetail,
//     });
//   } catch (err) {
//     console.log("Error create product:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

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
