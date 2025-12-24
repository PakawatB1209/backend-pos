const Product = require("../models/Product");
const ProductDetail = require("../models/Product_detail");
const User = require("../models/User");
const Masters = require("../models/masters");
const mongoose = require("mongoose");

const fs = require("fs");
const sharp = require("sharp");
const path = require("path");

// exports.createProduct = async (req, res) => {
//   let filesArray = [];
//   try {
//     const userId = req.user.id;
//     const user = await User.findById(userId).select("comp_id");

//     if (!user || !user.comp_id) {
//       return res.status(400).json({
//         success: false,
//         message: "User is not associated with a company.",
//       });
//     }

//     const data = req.body;
//     if (typeof data.stones === "string") {
//       try {
//         data.stones = JSON.parse(data.stones);
//       } catch (e) {
//         data.stones = [];
//       }
//     }

//     if (typeof data.related_accessories === "string") {
//       try {
//         data.related_accessories = JSON.parse(data.related_accessories);
//       } catch (e) {
//         data.related_accessories = [];
//       }
//     }

//     const existingProduct = await Product.findOne({
//       product_code: data.code,
//       comp_id: user.comp_id,
//     });

//     if (existingProduct) {
//       return res.status(400).json({
//         success: false,
//         message: `Product Code "${data.code}" already exists.`,
//       });
//     }

//     if (
//       data.related_accessories &&
//       Array.isArray(data.related_accessories) &&
//       data.related_accessories.length > 0
//     ) {
//       for (const item of data.related_accessories) {
//         if (!mongoose.isValidObjectId(item.product_id)) {
//           return res.status(400).json({
//             success: false,
//             message: `Invalid Accessory ID format: ${item.product_id}`,
//           });
//         }
//         const accessoryExists = await Product.exists({
//           _id: item.product_id,
//           comp_id: user.comp_id,
//         });

//         if (!accessoryExists) {
//           return res.status(400).json({
//             success: false,
//             message: `Accessory product not found: ${item.product_id}`,
//           });
//         }
//       }
//     }

//     if (req.files && req.files.length > 0) {
//       const uploadDir = "./uploads/product";
//       if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

//       await Promise.all(
//         req.files.map(async (file, index) => {
//           const filename = `product-${Date.now()}-${Math.round(
//             Math.random() * 1e9
//           )}-${index}.jpeg`;
//           const outputPath = path.join(uploadDir, filename);

//           await sharp(file.buffer)
//             .resize(1200, 1200, {
//               fit: sharp.fit.inside,
//               withoutEnlargement: true,
//             })
//             .toFormat("jpeg", { quality: 80 })
//             .toFile(outputPath);

//           filesArray.push(filename);
//         })
//       );
//     }

//     // debug const getMasterId = async (name, fieldName) => {
//     //   if (!name) return null;

//     //   // ค้นหาโดยดูทั้ง ชื่อ และ comp_id
//     //   const master = await Masters.findOne({
//     //     master_name: name,
//     //     comp_id: user.comp_id,
//     //   }).lean();

//     //   // 🚨 LOG จับผิด: ดูว่าหาเจอไหม
//     //   if (!master) {
//     //     console.log(
//     //       `❌ ไม่พบ Master: "${name}" (ในฟิลด์: ${fieldName}) | Comp ID: ${user.comp_id}`
//     //     );
//     //   } else {
//     //     console.log(`✅ พบ Master: "${name}" -> ID: ${master._id}`);
//     //   }

//     //   return master ? master._id : null;
//     // };
//     const getMasterId = async (name) => {
//       if (!name) return null;

//       const master = await Masters.findOne({
//         master_name: name,
//         comp_id: user.comp_id,
//       }).lean();

//       return master ? master._id : null;
//     };

//     const mastersArray = [];
//     const pushMaster = (masterId, qty = 0, weight = 0) => {
//       if (masterId) mastersArray.push({ master_id: masterId, qty, weight });
//     };

//     const itemTypeId = await getMasterId(data.item_type);
//     pushMaster(itemTypeId, 1);

//     if (data.metal) {
//       const metalId = await getMasterId(data.metal);
//       const metalColorId = await getMasterId(data.metal_color);
//       pushMaster(metalId, 1, data.net_weight || 0);
//       pushMaster(metalColorId, 1);
//     }

//     if (data.stones && Array.isArray(data.stones) && data.stones.length > 0) {
//       for (const stone of data.stones) {
//         const stoneNameId = await getMasterId(stone.stone_name);
//         const shapeId = await getMasterId(stone.shape);
//         const sizeId = await getMasterId(stone.size);
//         const colorId = await getMasterId(stone.color);
//         const cuttingId = await getMasterId(stone.cutting);
//         const qualityId = await getMasterId(stone.quality);
//         const clarityId = await getMasterId(stone.clarity);

//         const qty = stone.qty ? Number(stone.qty) : 1;
//         const weight = stone.weight ? Number(stone.weight) : 0;

//         pushMaster(stoneNameId, qty, weight);
//         pushMaster(shapeId);
//         pushMaster(sizeId);
//         pushMaster(colorId);
//         pushMaster(cuttingId);
//         pushMaster(qualityId);
//         pushMaster(clarityId);
//       }
//     } else if (data.stone_name) {
//       const stoneQty = data.stone_qty ? Number(data.stone_qty) : 1;
//       let stoneWeight = 0;
//       if (data.stone_weight) {
//         stoneWeight = Number(data.stone_weight);
//       } else if (!data.metal) {
//         stoneWeight = data.net_weight || data.weight || 0;
//       }

//       const stoneNameId = await getMasterId(data.stone_name);
//       pushMaster(stoneNameId, stoneQty, stoneWeight);

//       const shapeId = await getMasterId(data.shape);
//       const sizeId = await getMasterId(data.size);
//       const colorId = await getMasterId(data.color);
//       const cuttingId = await getMasterId(data.cutting);
//       const qualityId = await getMasterId(data.quality);
//       const clarityId = await getMasterId(data.clarity);

//       pushMaster(shapeId);
//       pushMaster(sizeId);
//       pushMaster(colorId);
//       pushMaster(cuttingId);
//       pushMaster(qualityId);
//       pushMaster(clarityId);
//     }

//     const newDetail = await ProductDetail.create({
//       unit: data.unit || "pcs",
//       size: data.product_size || data.size,
//       gross_weight: data.gross_weight || 0,
//       net_weight: data.net_weight || 0,
//       weight: data.weight || 0,
//       masters: mastersArray,
//       description: data.description,
//       comp_id: user.comp_id,
//     });

//     try {
//       const newProduct = await Product.create({
//         product_code: data.code,
//         product_name: data.product_name,
//         product_detail_id: newDetail._id,
//         comp_id: user.comp_id,
//         file: filesArray,
//         product_category: data.category,
//         product_item_type: data.item_type,
//         related_accessories: Array.isArray(data.related_accessories)
//           ? data.related_accessories
//           : [],
//       });
//       const populatedProduct = await Product.findById(newProduct._id).populate({
//         path: "product_detail_id",
//         populate: {
//           path: "masters.master_id",
//           select: "master_name master_type",
//         },
//       });
//       res.status(201).json({
//         success: true,
//         message: "Product created successfully.",
//         data: populatedProduct,
//         file: filesArray,
//       });
//     } catch (productError) {
//       console.log("Error creating main product, rolling back detail...");
//       await ProductDetail.findByIdAndDelete(newDetail._id);
//       if (filesArray.length > 0) {
//         filesArray.forEach((file) => {
//           const filePath = path.join("./uploads/product", file);
//           if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
//         });
//       }
//       throw productError;
//     }
//   } catch (err) {
//     console.log("Error create product:", err);
//     if (filesArray.length > 0) {
//       filesArray.forEach((file) => {
//         const filePath = path.join("./uploads/product", file);
//         if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
//       });
//     }
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

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

    // --- Parse JSON Strings ---
    if (typeof data.stones === "string") {
      try {
        data.stones = JSON.parse(data.stones);
      } catch (e) {
        data.stones = [];
      }
    }
    if (typeof data.related_accessories === "string") {
      try {
        data.related_accessories = JSON.parse(data.related_accessories);
      } catch (e) {
        data.related_accessories = [];
      }
    }

    // --- Check Duplicate Code ---
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

    // --- Validate Accessories ---
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

    // --- Handle File Uploads ---
    if (req.files && req.files.length > 0) {
      const uploadDir = "./uploads/product";
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

    // ==========================================================
    // 🟠 จุดที่ 1: เปลี่ยน getMasterId เป็น ensureMasterId (Auto-Create)
    // ==========================================================
    const ensureMasterId = async (name, type) => {
      // ถ้าไม่มีค่าส่งมา ให้ข้าม
      if (!name || (typeof name === "string" && name.trim() === ""))
        return null;

      // 1. ค้นหา (Case Insensitive) โดยระบุ Type และ Company
      let master = await Masters.findOne({
        master_name: { $regex: new RegExp(`^${name}$`, "i") },
        master_type: type, // ต้องระบุ Type เพื่อไม่ให้ข้อมูลตีกัน
        comp_id: user.comp_id,
      });

      // 2. ถ้าหาไม่เจอ -> ให้สร้างใหม่ (Create)
      if (!master) {
        master = await Masters.create({
          master_name: name,
          master_type: type,
          comp_id: user.comp_id,
          master_color: null,
        });
        console.log(`✅ Auto-created Master: [${type}] ${name}`);
      }

      return master._id;
    };

    const mastersArray = [];
    const pushMaster = (masterId, qty = 0, weight = 0) => {
      if (masterId) mastersArray.push({ master_id: masterId, qty, weight });
    };

    // ==========================================================
    // 🟠 จุดที่ 2: เรียกใช้ ensureMasterId โดยระบุ Type ("...")
    // ==========================================================

    // 1. Item Type
    const itemTypeId = await ensureMasterId(data.item_type, "item_type");
    pushMaster(itemTypeId, 1);

    // 2. Metal & Color
    if (data.metal) {
      const metalId = await ensureMasterId(data.metal, "metal");
      const metalColorId = await ensureMasterId(
        data.metal_color,
        "metal_color"
      ); // หรือ 'color' ตาม DB คุณ
      pushMaster(metalId, 1, data.net_weight || 0);
      pushMaster(metalColorId, 1);
    }

    // 3. Loop Stones
    if (data.stones && Array.isArray(data.stones) && data.stones.length > 0) {
      for (const stone of data.stones) {
        // ใส่ Type กำกับทุกอัน
        const stoneNameId = await ensureMasterId(
          stone.stone_name,
          "stone_name"
        );
        const shapeId = await ensureMasterId(stone.shape, "shape");
        const sizeId = await ensureMasterId(stone.size, "size");
        const colorId = await ensureMasterId(stone.color, "color");
        const cuttingId = await ensureMasterId(stone.cutting, "cutting");
        const qualityId = await ensureMasterId(stone.quality, "quality");
        const clarityId = await ensureMasterId(stone.clarity, "clarity");

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
    }
    // 4. Single Stone (Legacy support)
    else if (data.stone_name) {
      const stoneQty = data.stone_qty ? Number(data.stone_qty) : 1;
      let stoneWeight = 0;
      if (data.stone_weight) {
        stoneWeight = Number(data.stone_weight);
      } else if (!data.metal) {
        stoneWeight = data.net_weight || data.weight || 0;
      }

      const stoneNameId = await ensureMasterId(data.stone_name, "stone_name");
      pushMaster(stoneNameId, stoneQty, stoneWeight);

      const shapeId = await ensureMasterId(data.shape, "shape");
      const sizeId = await ensureMasterId(data.size, "size");
      const colorId = await ensureMasterId(data.color, "color");
      const cuttingId = await ensureMasterId(data.cutting, "cutting");
      const qualityId = await ensureMasterId(data.quality, "quality");
      const clarityId = await ensureMasterId(data.clarity, "clarity");

      pushMaster(shapeId);
      pushMaster(sizeId);
      pushMaster(colorId);
      pushMaster(cuttingId);
      pushMaster(qualityId);
      pushMaster(clarityId);
    }

    // --- Create Product Detail ---
    const newDetail = await ProductDetail.create({
      unit: data.unit || "pcs",
      size: data.product_size || data.size,
      gross_weight: data.gross_weight || 0,
      net_weight: data.net_weight || 0,
      weight: data.weight || 0,
      masters: mastersArray,
      description: data.description,
      comp_id: user.comp_id,
    });

    try {
      // --- Create Product ---
      const newProduct = await Product.create({
        product_code: data.code,
        product_name: data.product_name,
        product_detail_id: newDetail._id,
        comp_id: user.comp_id,
        file: filesArray,
        product_category: data.category,
        product_item_type: data.item_type,
        related_accessories: Array.isArray(data.related_accessories)
          ? data.related_accessories
          : [],
      });

      const populatedProduct = await Product.findById(newProduct._id).populate({
        path: "product_detail_id",
        populate: {
          path: "masters.master_id",
          select: "master_name master_type",
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

    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format." });
    }

    const user = await User.findById(req.user.id).select("comp_id").lean();
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    const product = await Product.findOne({
      _id: id,
      comp_id: user.comp_id,
    })
      .populate({
        path: "product_detail_id",
        populate: {
          path: "masters.master_id",
          select: "master_name master_type master_color code",
        },
      })
      .populate({
        path: "related_accessories.product_id",
        select: "product_code product_name file product_detail_id",
        populate: {
          path: "product_detail_id",
          select: "weight unit",
        },
      })
      .populate("comp_id", "comp_name")
      .lean();

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}/uploads/product/`;

    if (product.file && product.file.length > 0) {
      product.file = product.file.map((fileName) => `${baseUrl}${fileName}`);
    }

    const attributes = {};
    if (product.product_detail_id && product.product_detail_id.masters) {
      product.product_detail_id.masters.forEach((m) => {
        if (m.master_id) {
          const type = m.master_id.master_type;
          const itemData = {
            _id: m.master_id._id,
            name: m.master_id.master_name,
            code: m.master_id.code,
            qty: m.qty,
            weight: m.weight,
          };

          if (attributes[type]) {
            if (Array.isArray(attributes[type])) {
              attributes[type].push(itemData);
            } else {
              attributes[type] = [attributes[type], itemData];
            }
          } else {
            attributes[type] = itemData;
          }
        }
      });
    }

    const formattedAccessories = (product.related_accessories || [])
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

          weight:
            acc.weight ||
            (master.product_detail_id ? master.product_detail_id.weight : 0),

          size: acc.size || "",
          metal: acc.metal || "",
          color: acc.color || "",
          description: acc.description || "",

          unit:
            acc.unit ||
            (master.product_detail_id ? master.product_detail_id.unit : "pcs"),
        };
      })
      .filter((item) => item !== null);

    product.attributes = attributes;
    product.related_accessories = formattedAccessories;

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

    if (category) query.product_category = { $in: category.split(",") };

    if (search) {
      query.$or = [
        { product_name: { $regex: search, $options: "i" } },
        { product_code: { $regex: search, $options: "i" } },
      ];
    }

    const [products, total] = await Promise.all([
      Product.find(query)
        .select(
          "product_name product_code file product_category createdAt related_accessories is_active"
        )
        .populate({
          path: "product_detail_id",
          select: "masters size unit",
          populate: {
            path: "masters.master_id",
            select: "master_name master_type",
          },
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
            weight:
              acc.weight ||
              (master.product_detail_id ? master.product_detail_id.weight : 0),
            unit:
              acc.unit ||
              (master.product_detail_id
                ? master.product_detail_id.unit
                : "pcs"),

            // (Option) ถ้าหน้า List อยากโชว์ size/metal ที่เลือกด้วย ก็เพิ่มตรงนี้ได้
            // size: acc.size || ""
          };
        })
        .filter((item) => item !== null); // กรองตัว null ทิ้ง

      return {
        _id: p._id,
        code: p.product_code,
        name: p.product_name,
        image: p.file && p.file.length > 0 ? `${baseUrl}${p.file[0]}` : "",

        category: p.product_category,
        is_active: p.is_active,

        type_stone: finalTypeStone,
        size: size,
        metal: metal,
        color: color,

        accessories: formattedAccessories,
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
      { new: true }
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

// exports.updateProduct = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const userId = req.user.id;
//     const data = req.body;

//     if (!mongoose.isValidObjectId(id)) {
//       return res.status(400).json({ success: false, message: "Invalid ID" });
//     }

//     const user = await User.findById(userId).select("comp_id");
//     const currentProduct = await Product.findOne({
//       _id: id,
//       comp_id: user.comp_id,
//     });

//     if (!currentProduct) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Product not found" });
//     }

//     let newFiles = [];
//     if (req.files && req.files.length > 0) {
//       newFiles = req.files.map((f) => f.filename);
//       if (currentProduct.file && currentProduct.file.length > 0) {
//         currentProduct.file.forEach((img) => {
//           const oldPath = path.join(__dirname, "../uploads", img);
//           if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
//         });
//       }
//     }

//     const currentDetail = await ProductDetail.findById(
//       currentProduct.product_detail_id
//     ).lean();
//     const oldMastersMap = {};
//     if (currentDetail && currentDetail.masters) {
//       const populatedDetail = await ProductDetail.findById(
//         currentProduct.product_detail_id
//       )
//         .populate("masters.master_id")
//         .lean();

//       populatedDetail.masters.forEach((m) => {
//         if (m.master_id) {
//           oldMastersMap[m.master_id.master_type] = {
//             id: m.master_id._id.toString(),
//             qty: m.qty,
//             weight: m.weight,
//           };
//         }
//       });
//     }

//     const getVal = (newVal, oldType) => {
//       if (newVal) return newVal;
//       if (oldMastersMap[oldType]) return oldMastersMap[oldType].id;
//       return null;
//     };

//     const mastersArray = [];
//     const pushMaster = (masterId, qty = 0, weight = 0) => {
//       if (masterId) mastersArray.push({ master_id: masterId, qty, weight });
//     };

//     pushMaster(getVal(data.item_type, "item_type"), 1);
//     const finalMetal = getVal(data.metal, "metal");
//     if (finalMetal) {
//       const finalNetWt =
//         data.net_weight !== undefined
//           ? data.net_weight
//           : currentDetail.net_weight || 0;
//       pushMaster(finalMetal, 1, finalNetWt);
//       pushMaster(getVal(data.metal_color, "metal_color"), 1);
//     }
//     const finalStone = getVal(data.stone_name, "stone_name");
//     if (!finalMetal && finalStone) {
//       const stoneWt =
//         data.net_weight !== undefined
//           ? data.net_weight
//           : currentDetail.net_weight || 0;
//       pushMaster(finalStone, 1, stoneWt);
//     } else {
//       pushMaster(finalStone, 1, 0);
//     }
//     pushMaster(getVal(data.shape, "shape"));
//     pushMaster(getVal(data.size, "size"));
//     pushMaster(getVal(data.color, "color"));
//     pushMaster(getVal(data.cutting, "cutting"));
//     pushMaster(getVal(data.quality, "quality"));
//     pushMaster(getVal(data.clarity, "clarity"));

//     const detailUpdate = {
//       unit: data.unit,
//       size: data.product_size || data.size,
//       gross_weight: data.gross_weight,
//       net_weight: data.net_weight,

//       weight: data.weight,

//       description: data.description,
//       masters: mastersArray,
//     };

//     Object.keys(detailUpdate).forEach(
//       (key) => detailUpdate[key] === undefined && delete detailUpdate[key]
//     );

//     await ProductDetail.findByIdAndUpdate(
//       currentProduct.product_detail_id,
//       detailUpdate,
//       { new: true }
//     );

//     const productUpdate = {
//       product_code: data.code,
//       product_name: data.product_name,
//       product_category: data.category,
//     };

//     if (newFiles.length > 0) {
//       productUpdate.file = newFiles;
//     }

//     if (data.related_accessories) {
//       productUpdate.related_accessories = Array.isArray(
//         data.related_accessories
//       )
//         ? data.related_accessories
//         : [data.related_accessories];
//     } else if (data.related_accessories === "") {
//       productUpdate.related_accessories = [];
//     }

//     Object.keys(productUpdate).forEach(
//       (key) => productUpdate[key] === undefined && delete productUpdate[key]
//     );

//     const updatedProduct = await Product.findByIdAndUpdate(id, productUpdate, {
//       new: true,
//     });

//     res.status(200).json({
//       success: true,
//       message: "Product updated successfully",
//       data: updatedProduct,
//     });
//   } catch (err) {
//     console.log("Error update product:", err);
//     if (req.files) {
//       req.files.forEach((f) => {
//         const tempPath = path.join(__dirname, "../uploads", f.filename);
//         if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
//       });
//     }
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

exports.updateProduct = async (req, res) => {
  let newFilesArray = [];

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

    if (typeof data.related_accessories === "string") {
      try {
        data.related_accessories = JSON.parse(data.related_accessories);
      } catch (e) {
        data.related_accessories = [];
      }
    }
    if (typeof data.stones === "string") {
      try {
        data.stones = JSON.parse(data.stones);
      } catch (e) {
        data.stones = [];
      }
    }

    if (req.files && req.files.length > 0) {
      const uploadDir = "./uploads/product";
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

          newFilesArray.push(filename);
        })
      );

      if (currentProduct.file && currentProduct.file.length > 0) {
        currentProduct.file.forEach((oldFile) => {
          const oldPath = path.join(uploadDir, oldFile);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        });
      }
    }

    const getMasterId = async (name) => {
      if (!name) return null;
      const master = await Masters.findOne({
        master_name: name,
        comp_id: user.comp_id,
      }).lean();
      return master ? master._id : null;
    };

    const currentDetail = await ProductDetail.findById(
      currentProduct.product_detail_id
    ).populate("masters.master_id");

    const oldMastersMap = {};
    if (currentDetail && currentDetail.masters) {
      currentDetail.masters.forEach((m) => {
        if (m.master_id)
          oldMastersMap[m.master_id.master_type] = m.master_id.master_name;
      });
    }

    const resolveName = (newName, type) => {
      if (newName !== undefined) return newName;
      return oldMastersMap[type];
    };

    const mastersArray = [];
    const pushMaster = (masterId, qty = 0, weight = 0) => {
      if (masterId) mastersArray.push({ master_id: masterId, qty, weight });
    };

    const itemTypeName = resolveName(data.item_type, "item_type");
    pushMaster(await getMasterId(itemTypeName), 1);

    const metalName = resolveName(data.metal, "metal");
    if (metalName) {
      // Net Weight Logic
      let finalNetWt = 0;
      if (data.net_weight !== undefined) finalNetWt = Number(data.net_weight);
      else finalNetWt = currentDetail.net_weight || 0;

      pushMaster(await getMasterId(metalName), 1, finalNetWt);
      pushMaster(
        await getMasterId(resolveName(data.metal_color, "metal_color")),
        1
      );
    }

    const stoneName = resolveName(data.stone_name, "stone_name");
    if (stoneName) {
      let stoneWt = 0;
      if (!metalName) {
        if (data.net_weight !== undefined) stoneWt = Number(data.net_weight);
        else stoneWt = currentDetail.net_weight || 0;
      }
      pushMaster(await getMasterId(stoneName), 1, stoneWt);
    }

    pushMaster(await getMasterId(resolveName(data.shape, "shape")));
    pushMaster(await getMasterId(resolveName(data.size, "size")));
    pushMaster(await getMasterId(resolveName(data.color, "color")));
    pushMaster(await getMasterId(resolveName(data.cutting, "cutting")));
    pushMaster(await getMasterId(resolveName(data.quality, "quality")));
    pushMaster(await getMasterId(resolveName(data.clarity, "clarity")));

    const detailUpdate = {
      unit: data.unit || currentDetail.unit,
      size: data.product_size || data.size || currentDetail.size,
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
      masters: mastersArray,
    };

    await ProductDetail.findByIdAndUpdate(
      currentProduct.product_detail_id,
      detailUpdate,
      { new: true }
    );

    const productUpdate = {
      product_code: data.code || currentProduct.product_code,
      product_name: data.product_name || currentProduct.product_name,
      product_category: data.category || currentProduct.product_category,
      product_item_type: data.item_type || currentProduct.product_item_type,
    };

    if (newFilesArray.length > 0) {
      productUpdate.file = newFilesArray;
    }

    if (data.related_accessories) {
      productUpdate.related_accessories = Array.isArray(
        data.related_accessories
      )
        ? data.related_accessories
        : [];
    }

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
    if (newFilesArray.length > 0) {
      newFilesArray.forEach((f) => {
        const tempPath = path.join("./uploads/product", f);
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// exports.removeOneProduct = async (req, res) => {
//   try {
//     const { id } = req.params;

//     if (!mongoose.isValidObjectId(id)) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Invalid ID format" });
//     }

//     const user = await User.findById(req.user.id).select("comp_id");
//     const product = await Product.findOne({ _id: id, comp_id: user.comp_id });

//     if (!product) {
//       return res.status(404).json({
//         success: false,
//         message:
//           "Product not found or you do not have permission to delete it.",
//       });
//     }

//     await Product.updateMany(
//       { related_accessories: id },
//       { $pull: { related_accessories: id } }
//     );

//     if (product.file && product.file.length > 0) {
//       product.file.forEach((fileName) => {
//         const imagePath = path.join(__dirname, "../uploads", fileName);

//         if (fs.existsSync(imagePath)) {
//           fs.unlink(imagePath, (err) => {
//             if (err) console.log(`Failed delete img: ${err.message}`);
//             else console.log(`Deleted img: ${fileName}`);
//           });
//         }
//       });
//     }

//     if (product.product_detail_id) {
//       await ProductDetail.findByIdAndDelete(product.product_detail_id);
//     }

//     await Product.findByIdAndDelete(id);

//     res.status(200).json({
//       success: true,
//       message: "Product and related data deleted successfully.",
//       deletedId: id,
//     });
//   } catch (error) {
//     console.log("Error remove product:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

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
      return res.status(404).json({ success: false, message: "ไม่พบสินค้า" });
    }

    const usedAsAccessory = await Product.findOne({
      "related_accessories.product_id": id,
      comp_id: user.comp_id,
    }).select("product_code product_name");

    if (usedAsAccessory) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete! This product is used as a component in: ${usedAsAccessory.product_name} (${usedAsAccessory.product_code})`,
      });
    }
    if (product.file && product.file.length > 0) {
      product.file.forEach((fileName) => {
        const imagePath = path.join(__dirname, "../uploads/product", fileName);

        if (fs.existsSync(imagePath)) {
          fs.unlink(imagePath, (err) => {
            if (err) console.log(`Delete Img Error: ${err.message}`);
          });
        }
      });
    }

    if (product.product_detail_id) {
      await ProductDetail.findByIdAndDelete(product.product_detail_id);
    }

    await Product.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message:
        "Product deleted successfully (This product is unused and can be deleted.).",
      deletedId: id,
    });
  } catch (error) {
    console.log("Error remove product:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// exports.removeAllProducts = async (req, res) => {
//   try {
//     const user = await User.findById(req.user.id).select("comp_id");

//     const products = await Product.find({ comp_id: user.comp_id });

//     if (!products.length) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Product not found." });
//     }

//     const detailIds = [];

//     products.forEach((product) => {
//       if (product.product_detail_id) {
//         detailIds.push(product.product_detail_id);
//       }

//       if (product.file && product.file.length > 0) {
//         product.file.forEach((fileName) => {
//           const imagePath = path.join(__dirname, "../uploads", fileName);

//           if (fs.existsSync(imagePath)) {
//             fs.unlink(imagePath, (err) => {
//               if (err) console.log(`Failed delete img: ${err.message}`);
//             });
//           }
//         });
//       }
//     });

//     if (detailIds.length > 0) {
//       await ProductDetail.deleteMany({ _id: { $in: detailIds } });
//     }

//     await Product.deleteMany({ comp_id: user.comp_id });

//     res.status(200).json({
//       success: true,
//       message: `Deleted ${products.length} products and related data successfully.`,
//     });
//   } catch (error) {
//     console.log("Error remove all products:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

exports.removeAllProducts = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("comp_id");

    const usedAsAccessoryIds = await Product.distinct(
      "related_accessories.product_id",
      {
        comp_id: user.comp_id,
      }
    );

    const deleteQuery = {
      comp_id: user.comp_id,
      _id: { $nin: usedAsAccessoryIds },

      // StockTransaction (อนาคต)
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
          const imagePath = path.join(
            __dirname,
            "../uploads/product",
            fileName
          );

          if (fs.existsSync(imagePath)) {
            fs.unlink(imagePath, (err) => {
              if (err) console.log(`Failed delete img: ${err.message}`);
            });
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

// exports.removeAllProducts = async (req, res) => {
//   try {
//     const user = await User.findById(req.user.id).select("comp_id");

//     const usedAsAccessoryIds = await Product.distinct("related_accessories", {
//       comp_id: user.comp_id,
//     });

//     const deleteQuery = {
//       comp_id: user.comp_id,
//       _id: { $nin: usedAsAccessoryIds },

//       // StockTransaction
//       // _id: { $nin: [...usedAsAccessoryIds, ...usedInStockIds] }
//     };

//     const productsToDelete = await Product.find(deleteQuery);

//     if (productsToDelete.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message:
//           "No deletable products found. (All remaining products are currently in use.)",
//       });
//     }

//     const productIds = productsToDelete.map((p) => p._id);
//     const detailIds = productsToDelete
//       .filter((p) => p.product_detail_id)
//       .map((p) => p.product_detail_id);

//     productsToDelete.forEach((product) => {
//       if (product.file && product.file.length > 0) {
//         product.file.forEach((fileName) => {
//           const imagePath = path.join(__dirname, "../uploads", fileName);
//           if (fs.existsSync(imagePath)) {
//             fs.unlink(imagePath, (err) => {
//               if (err) console.log(`Failed delete img: ${err.message}`);
//             });
//           }
//         });
//       }
//     });

//     if (detailIds.length > 0) {
//       await ProductDetail.deleteMany({ _id: { $in: detailIds } });
//     }

//     await Product.deleteMany({ _id: { $in: productIds } });

//     res.status(200).json({
//       success: true,
//       message: `Cleanup successful! Deleted ${productsToDelete.length} unused products. (Products in use were not deleted.)`,
//     });
//   } catch (error) {
//     console.log("Error clear unused products:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

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
