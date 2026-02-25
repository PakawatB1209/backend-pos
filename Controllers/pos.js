const Product = require("../models/Product");
const ProductDetail = require("../models/Product_detail");
const User = require("../models/User");
const Masters = require("../models/masters");
const mongoose = require("mongoose");
const Stock = require("../models/Stock");
const Warehouse = require("../models/Warehouse");
const CustomSession = require("../models/CustomSession");

// ค้นหาและเลือกสินค้า (Catalog)
exports.getPosItemTypes = async (req, res) => {
  try {
    // --- 🟢 ส่วนเช็คสิทธิ์ (เพิ่มใหม่) ---
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const user = await User.findById(req.user.id).select("comp_id").lean();
    if (!user || !user.comp_id) {
      return res
        .status(400)
        .json({ success: false, message: "User not associated with company." });
    }
    const comp_id = user.comp_id; // ✅

    const { category_id } = req.query;
    if (!category_id) {
      return res
        .status(400)
        .json({ success: false, message: "Category ID is required" });
    }

    const itemTypes = await Product.aggregate([
      // 1. กรองสินค้า (เพิ่ม comp_id เพื่อความปลอดภัย ไม่ให้เห็นของบริษัทอื่น)
      {
        $match: {
          product_category: new mongoose.Types.ObjectId(category_id),
          comp_id: comp_id, // ✅ เพิ่มบรรทัดนี้: กรองเฉพาะสินค้าของบริษัทตัวเอง
          is_active: true,
        },
      },
      // 2. เรียงของใหม่สุด
      { $sort: { createdAt: -1 } },

      // ... (Logic เดิม: แปลง ID/String Lookup Master) ...
      {
        $addFields: {
          convertedId: {
            $convert: {
              input: "$product_item_type",
              to: "objectId",
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $lookup: {
          from: "masters",
          localField: "convertedId",
          foreignField: "_id",
          as: "master_info",
        },
      },
      {
        $addFields: {
          foundName: { $arrayElemAt: ["$master_info.master_name", 0] },
        },
      },
      {
        $addFields: {
          finalName: { $ifNull: ["$foundName", "$product_item_type"] },
        },
      },
      {
        $group: {
          _id: "$finalName",
          originalId: { $first: "$convertedId" },
          cover_image: { $first: { $arrayElemAt: ["$file", 0] } },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: { $ifNull: ["$originalId", "$_id"] },
          name: "$_id",
          image: "$cover_image",
          count: 1,
        },
      },
      { $sort: { name: 1 } },
    ]);

    const baseUrl = `${req.protocol}://${req.get("host")}/uploads/product/`;
    const formattedData = itemTypes.map((type) => ({
      ...type,
      image: type.image
        ? type.image.startsWith("http")
          ? type.image
          : `${baseUrl}${type.image}`
        : null,
    }));

    res.json({ success: true, data: formattedData });
  } catch (error) {
    console.error("Get Menu Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
}; // list แสดงหวมดหมู่
exports.getPosProducts = async (req, res) => {
  try {
    // -----------------------------------------------------------
    // 1. Check Auth & Company
    // -----------------------------------------------------------
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const user = await User.findById(req.user.id).select("comp_id").lean();
    if (!user || !user.comp_id) {
      return res
        .status(400)
        .json({ success: false, message: "User not associated with company." });
    }
    const comp_id = user.comp_id;

    // -----------------------------------------------------------
    // 2. Prepare Variables
    // -----------------------------------------------------------
    const {
      category,
      item_type,
      search,
      page = 1,
      limit = 20,
      view_mode = "master",
    } = req.query;
    const baseUrl = `${req.protocol}://${req.get("host")}/uploads/product/`;

    // -----------------------------------------------------------
    // 3. Find Target Warehouse
    // -----------------------------------------------------------
    let targetWarehouseId = null;
    if (category) {
      const masterCat = await Masters.findById(category);
      if (masterCat) {
        const nameMap = {
          "Product Master": "productmaster",
          Stone: "stone",
          "Semi-Mount": "semimount",
          Accessories: "accessory",
          Others: "others",
        };
        const warehouseType =
          nameMap[masterCat.master_name] ||
          masterCat.master_name.toLowerCase().replace(/ /g, "");

        const warehouse = await Warehouse.findOne({
          comp_id,
          warehouse_type: warehouseType,
        });
        if (warehouse) targetWarehouseId = warehouse._id;
      }
    }

    // -----------------------------------------------------------
    // 4. Build Product Query
    // -----------------------------------------------------------
    const query = { comp_id, is_active: true };

    if (category) query.product_category = category;
    if (item_type) query.product_item_type = item_type;

    if (search) {
      query.$or = [
        { product_code: { $regex: search, $options: "i" } },
        { product_name: { $regex: search, $options: "i" } },
      ];
    }

    // -----------------------------------------------------------
    // 🟢 4.5 กรองโหมด Inventory (เอาเฉพาะตัวที่เคยเข้าคลัง)
    // -----------------------------------------------------------
    if (view_mode === "inventory") {
      const stockQueryFilter = { comp_id };
      if (targetWarehouseId) stockQueryFilter.warehouse_id = targetWarehouseId;

      // หา Record ใน Stock ทั้งหมด (ไม่สนว่า quantity จะเป็น 0 หรือไม่)
      const stockRecords = await Stock.find(stockQueryFilter)
        .select("product_id")
        .lean();

      // ดึงเฉพาะ ID ของสินค้าที่เจอในคลัง
      const productIdsInStock = stockRecords.map((s) => s.product_id);

      // บังคับให้ Query Product หาแค่สินค้าที่อยู่ใน Array นี้
      query._id = { $in: productIdsInStock };
    }

    // -----------------------------------------------------------
    // 5. Fetch Products
    // -----------------------------------------------------------
    // นับ Total ก่อนที่จะไป Populate เพื่อความรวดเร็ว
    const total = await Product.countDocuments(query);

    const products = await Product.find(query)
      .populate("product_detail_id", "unit size price")
      .select(
        "product_code product_name file product_detail_id product_category",
      )
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    // -----------------------------------------------------------
    // 6. Fetch Stock
    // -----------------------------------------------------------
    let stocks = [];
    if (products.length > 0) {
      const productIds = products.map((p) => p._id);

      const stockQuery = {
        product_id: { $in: productIds },
        comp_id: comp_id,
      };

      if (targetWarehouseId) {
        stockQuery.warehouse_id = targetWarehouseId;
      }

      stocks = await Stock.find(stockQuery).lean();
    }

    // -----------------------------------------------------------
    // 7. Merge Data
    // -----------------------------------------------------------
    const mergedProducts = products.map((product) => {
      const productStocks = stocks.filter(
        (s) => s.product_id.toString() === product._id.toString(),
      );

      const totalQuantity = productStocks.reduce(
        (sum, s) => sum + s.quantity,
        0,
      );

      const stockPrice =
        productStocks.length > 0 ? productStocks[0].price : null;

      let coverImage = null;
      if (product.file && product.file.length > 0) {
        coverImage = product.file[0].startsWith("http")
          ? product.file[0]
          : `${baseUrl}${product.file[0]}`;
      }

      return {
        _id: product._id,
        product_code: product.product_code,
        product_name: product.product_name,
        image: coverImage,

        unit: product.product_detail_id?.unit || "",
        size: product.product_detail_id?.size || "",

        price:
          stockPrice !== null
            ? stockPrice
            : product.product_detail_id?.price || 0,

        quantity: totalQuantity,
        warehouse_id: targetWarehouseId,
      };
    });

    // -----------------------------------------------------------
    // 8. Final Response
    // -----------------------------------------------------------
    res.json({
      success: true,
      data: mergedProducts,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get POS Products Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
}; // list Product ของ catalog

//ระบบจองสินค้า (Badge System)
exports.addToCustomSession = async (req, res) => {
  try {
    const { product_id } = req.body; // รับแค่ ID สินค้า
    const user = await User.findById(req.user.id).select("comp_id").lean();

    // 1. สร้างรายการจอง (Session) เข้าตะกร้าของพนักงานคนนี้ทันที
    const newSession = await CustomSession.create({
      comp_id: user.comp_id,
      sales_staff_id: req.user.id, // 🟢 ผูกตะกร้ากับพนักงานที่ล็อกอิน
      product_id: product_id,
      customer_id: null, // ปล่อยว่างไว้ก่อน ไปเลือกตอนหน้า Custom
    });

    // 2. นับจำนวนสินค้าในตะกร้าของพนักงานคนนี้ เพื่อส่งไปโชว์ที่ Badge
    const count = await CustomSession.countDocuments({
      comp_id: user.comp_id,
      sales_staff_id: req.user.id, // 🟢 นับจากตะกร้าพนักงาน
    });

    return res.json({
      success: true,
      status: "ADDED",
      badge_count: count,
      session_id: newSession._id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
}; // กดปุ่ม Custom (หน้า List)
exports.getCustomSessionList = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("comp_id").lean();

    // 1. ดึงรายการจากตะกร้าของพนักงานที่กำลังใช้งานอยู่
    const items = await CustomSession.find({
      comp_id: user.comp_id,
      sales_staff_id: req.user.id, // 🟢 หาจากตะกร้าของพนักงาน
    })
      .populate({
        path: "product_id",
        select:
          "product_code product_name file price product_detail_id product_category product_item_type",
        populate: [
          { path: "product_category", select: "master_name" },
          { path: "product_item_type", select: "master_name" },
        ],
      })
      .sort({ createdAt: -1 });

    const baseUrl = `${req.protocol}://${req.get("host")}/uploads/product/`;

    const formattedData = items.map((item) => {
      const prod = item.product_id || {};
      let imgUrl = null;
      if (prod.file && prod.file.length > 0) {
        imgUrl = prod.file[0].startsWith("http")
          ? prod.file[0]
          : `${baseUrl}${prod.file[0]}`;
      }

      return {
        session_id: item._id,
        product_id: prod._id,
        product_code: prod.product_code,
        product_name: prod.product_name,
        image: imgUrl,
        is_saved: item.is_saved,
        item_type: prod.product_item_type?.master_name || "-",
        category: prod.product_category?.master_name || "-",
      };
    });

    // 🟢 ส่งข้อมูลกลับไป หน้าบ้านจัดการ Dropdown ลูกค้าเองได้เลย
    res.json({
      success: true,
      count: formattedData.length,
      data: formattedData,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
}; // แสดง List ซ้ายมือ (หน้า Editor)
exports.clearCustomSession = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findById(req.user.id).select("comp_id").lean();

    // 🟢 1. หา Session ที่ค้างอยู่ "เฉพาะของพนักงานคนนี้"
    const activeSessions = await CustomSession.find({
      comp_id: user.comp_id,
      sales_staff_id: req.user.id, // ป้องกันไปลบตะกร้าคนอื่น
    });

    for (const s of activeSessions) {
      const productId = s.product_id;

      // 2. ลบสินค้า (Product) และรายละเอียด
      const product = await Product.findById(productId);
      if (product && product.is_custom) {
        // 🟢 ดักไว้หน่อยว่าลบเฉพาะตัวที่สร้าง custom แล้ว
        if (product.product_detail_id) {
          await ProductDetail.findByIdAndDelete(product.product_detail_id, {
            session,
          });
        }
        await Product.findByIdAndDelete(productId, { session });
      }

      // 3. ลบ Session ทิ้ง
      await CustomSession.findByIdAndDelete(s._id, { session });
    }

    await session.commitTransaction();
    res.json({ success: true, message: "ล้างรายการเก่าเรียบร้อย" });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: "Error clearing session" });
  } finally {
    session.endSession();
  }
}; // ล้างสินค้า custom เก่าทั้งหมด
exports.deleteCustomSessionItem = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { session_id } = req.params;
    const user = await User.findById(req.user.id).select("comp_id").lean();

    const targetSession = await CustomSession.findById(session_id);
    if (!targetSession) {
      return res
        .status(404)
        .json({ success: false, message: "ไม่พบรายการที่ต้องการลบ" });
    }

    const productId = targetSession.product_id;

    // ลบสินค้าตัว Custom ทิ้ง (ถ้ามี)
    const product = await Product.findById(productId);
    if (product && product.is_custom) {
      if (product.product_detail_id) {
        await ProductDetail.findByIdAndDelete(product.product_detail_id, {
          session,
        });
      }
      await Product.findByIdAndDelete(productId, { session });
    }

    // ลบ Session ทิ้ง
    await CustomSession.findByIdAndDelete(session_id, { session });

    // 🟢 คำนวณจำนวนที่เหลือใหม่ จากตะกร้าของพนักงานคนนี้
    const remainingCount = await CustomSession.countDocuments({
      comp_id: user.comp_id,
      sales_staff_id: req.user.id,
    }).session(session);

    await session.commitTransaction();

    res.json({
      success: true,
      message: "ลบรายการเรียบร้อย",
      badge_count: remainingCount,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Delete Item Error:", error);
    res.status(500).json({ success: false, message: "Error deleting item" });
  } finally {
    session.endSession();
  }
}; // ล้างสินค้า custom ที่ละตัว

//ปรับแต่งและบันทึก (Editor)
exports.getPosProductDetail = async (req, res) => {
  try {
    // ---------------------------------------------------
    // 1. Check Auth & Company
    // ---------------------------------------------------
    if (!req.user || !req.user.id)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const user = await User.findById(req.user.id).select("comp_id").lean();
    if (!user || !user.comp_id)
      return res
        .status(400)
        .json({ success: false, message: "User not associated with company." });

    const comp_id = user.comp_id;
    const { id } = req.params;
    const baseUrl = `${req.protocol}://${req.get("host")}/uploads/product/`;

    // ---------------------------------------------------
    // 2. Query Data & Populate
    // ---------------------------------------------------
    const product = await Product.findOne({ _id: id, comp_id })
      .populate("product_category", "master_name")
      .populate("product_item_type", "master_name")
      .populate({
        path: "product_detail_id",
        populate: [
          // ดึง Master ทั้งหมดออกมา (รวม Metal, Color ไว้ในนี้)
          { path: "masters.master_id", select: "master_name master_type" },

          // Populate Stone Details
          { path: "primary_stone.stone_name", select: "master_name" },
          { path: "primary_stone.shape", select: "master_name" },
          { path: "primary_stone.clarity", select: "master_name" },
          { path: "primary_stone.quality", select: "master_name" },
          { path: "primary_stone.cutting", select: "master_name" },
        ],
      })
      .lean();

    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });

    const detail = product.product_detail_id || {};

    // ---------------------------------------------------
    // 3. 🔍 Logic: แงะหา Metal และ Color จาก Array "masters"
    // ---------------------------------------------------
    let metalObj = null;
    let metalColorObj = null;

    if (detail.masters && detail.masters.length > 0) {
      detail.masters.forEach((item) => {
        const m = item.master_id;
        if (!m) return;

        const name = m.master_name || "";

        // 1. หา Metal (เช่น 18K, 14K, Platinum)
        if (
          name.includes("18K") ||
          name.includes("14K") ||
          name.includes("9K") ||
          name.includes("Platinum")
        ) {
          metalObj = m;
        }
        // 2. หา Color (เช่น White Gold, Rose Gold)
        else if (
          name.includes("White") ||
          name.includes("Rose") ||
          name.includes("Yellow")
        ) {
          metalColorObj = m;
        }
      });
    }

    const metalName = metalObj ? metalObj.master_name : "-";
    const metalColorName = metalColorObj
      ? metalColorObj.master_name
      : detail.color || "-";

    // ---------------------------------------------------
    // 🟢 4. Get Stock Price/Qty (ส่วนที่เพิ่มใหม่)
    // ---------------------------------------------------
    let price = detail.price || 0;
    let quantity = 0; // ตั้งต้นเป็น 0

    // 4.1 หา Warehouse ที่ถูกต้องก่อน (ตาม Category)
    let targetWarehouseId = null;
    if (product.product_category) {
      // เช็คว่า product_category เป็น Object (Populate แล้ว) หรือ String ID
      const catName = product.product_category.master_name || "";

      // ถ้า Populate ไม่ติด ให้ลองไปหาจาก Masters ใหม่ (Optional safety check)
      let masterName = catName;
      if (!masterName && product.product_category) {
        const m = await Masters.findById(product.product_category).select(
          "master_name",
        );
        if (m) masterName = m.master_name;
      }

      if (masterName) {
        const nameMap = {
          "Product Master": "productmaster",
          Stone: "stone",
          "Semi-Mount": "semimount",
          Accessories: "accessory",
          Others: "others",
        };
        // แปลงชื่อ Category เป็น warehouse_type (เช่น "Product Master" -> "productmaster")
        const warehouseType =
          nameMap[masterName] || masterName.toLowerCase().replace(/ /g, "");

        // ค้นหา Warehouse ID ของบริษัทนี้
        const warehouse = await Warehouse.findOne({
          comp_id,
          warehouse_type: warehouseType,
        });
        if (warehouse) targetWarehouseId = warehouse._id;
      }
    }

    // 4.2 ดึงข้อมูล Stock จริงจาก DB โดยใช้ Warehouse ID
    if (targetWarehouseId) {
      const stockItem = await Stock.findOne({
        product_id: product._id,
        comp_id: comp_id,
        warehouse_id: targetWarehouseId,
      }).select("quantity price");

      if (stockItem) {
        quantity = stockItem.quantity;
        // price = stockItem.price; // เปิดบรรทัดนี้ถ้าต้องการใช้ราคาจาก Stock
      }
    } else {
      // กรณีหา Warehouse ไม่เจอ (เช่นสินค้าเก่า) ให้รวม Stock ทั้งหมดที่มี
      const allStocks = await Stock.find({
        product_id: product._id,
        comp_id: comp_id,
      });
      quantity = allStocks.reduce((sum, s) => sum + s.quantity, 0);
    }

    // ---------------------------------------------------
    // 5. 🎨 Attributes (Formatted)
    // ---------------------------------------------------
    let attributes = { main_info: [], stone_info: [] };
    const categoryName = product.product_category?.master_name || "";
    const catLower = categoryName.toLowerCase();
    const itemTypeName = product.product_item_type?.master_name || "-";

    if (catLower.includes("stone") || catLower.includes("diamond")) {
      // 💎 กรณีเป็นหิน/เพชร
      attributes.main_info = null;
      const stone = detail.primary_stone || {};
      attributes.stone_info = [
        { label: "Code", value: product.product_code },
        { label: "Stone Name", value: stone.stone_name?.master_name || "-" },
        { label: "Shape", value: stone.shape?.master_name || "-" },
        { label: "Color", value: stone.color || "-" },
        { label: "Clarity", value: stone.clarity?.master_name || "-" },
        { label: "Cutting", value: stone.cutting?.master_name || "-" },
        { label: "Quality", value: stone.quality?.master_name || "-" },
        { label: "Weight", value: stone.weight ? `${stone.weight} cts` : "-" },
        { label: "Size", value: stone.size || "-" },
      ];
    } else {
      // 💍 กรณีเป็นเครื่องประดับ (Jewelry)
      attributes.main_info = [
        { label: "Code", value: product.product_code },
        { label: "Category", value: categoryName },
        { label: "Item type", value: itemTypeName },
        { label: "Metal", value: metalName },
        { label: "Metal Color", value: metalColorName },
        {
          label: "Nwt",
          value: detail.net_weight ? `${detail.net_weight} g` : "-",
        },
        {
          label: "Gwt",
          value: detail.gross_weight ? `${detail.gross_weight} g` : "-",
        },
        { label: "Size", value: detail.size || "-" },
        { label: "Prod. Size", value: detail.product_size || "-" },
      ];

      const stone = detail.primary_stone || {};
      attributes.stone_info = [
        { label: "Stone Name", value: stone.stone_name?.master_name || "-" },
        { label: "Shape", value: stone.shape?.master_name || "-" },
        { label: "Size", value: stone.size || "-" },
        {
          label: "S.Weight",
          value: stone.weight ? `${stone.weight} cts` : "-",
        },
        { label: "Color", value: stone.color || "-" },
        { label: "Cutting", value: stone.cutting?.master_name || "-" },
        { label: "Quality", value: stone.quality?.master_name || "-" },
        { label: "Clarity", value: stone.clarity?.master_name || "-" },
      ];
    }

    // ---------------------------------------------------
    // 6. 🛠️ Raw Data (For Custom Page)
    // ---------------------------------------------------
    const raw_data = {
      product_detail_id: detail._id,
      item_type_id: product.product_item_type?._id,
      metal_id: metalObj ? metalObj._id : null,
      metal_color: metalColorName,
      size: detail.size,
      product_size: detail.product_size,
      nwt: detail.net_weight,
      gwt: detail.gross_weight,
      description: detail.description,
      stone: {
        name_id: detail.primary_stone?.stone_name?._id,
        shape_id: detail.primary_stone?.shape?._id,
        clarity_id: detail.primary_stone?.clarity?._id,
        quality_id: detail.primary_stone?.quality?._id,
        cutting_id: detail.primary_stone?.cutting?._id,
        size: detail.primary_stone?.size,
        weight: detail.primary_stone?.weight,
        color: detail.primary_stone?.color,
      },
    };

    // ---------------------------------------------------
    // 7. Response
    // ---------------------------------------------------
    const images = (product.file || []).map((img) =>
      img.startsWith("http") ? img : `${baseUrl}${img}`,
    );

    res.json({
      success: true,
      data: {
        _id: product._id,
        product_code: product.product_code,
        product_name: product.product_name,
        description: detail.description || "-",
        images,
        cover_image: images[0] || null,
        price,
        quantity, // ✅ ค่านี้ตอนนี้มาจาก Stock จริงแล้ว
        unit: detail.unit || "pcs",
        attributes,
        raw_data,
      },
    });
  } catch (error) {
    console.error("Get Detail Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
}; // คลิกสินค้าใน List เพื่อดูสเปก
exports.saveCustomProduct = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { session_id, customer_id, product_data, detail_data } = req.body;

    // 🚨 1. ดักจับตรงนี้เลย! บังคับว่าต้องมีลูกค้านะ ถึงจะยอมให้ Save
    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: "กรุณาเลือกลูกค้าก่อนบันทึกรายการ (Customer is required)",
      });
    }

    const user = await User.findById(req.user.id).select("comp_id");

    // สร้าง Product Detail ใหม่
    const newDetail = new ProductDetail({
      ...detail_data,
      comp_id: user.comp_id,
    });
    await newDetail.save({ session });

    // สร้าง Product ใหม่ (Custom)
    const newProduct = new Product({
      ...product_data,
      comp_id: user.comp_id,
      product_detail_id: newDetail._id,
      is_custom: true,
      is_active: true,
    });
    await newProduct.save({ session });

    // อัปเดตใบจอง (Session) ผูกกับลูกค้า
    await CustomSession.findByIdAndUpdate(
      session_id,
      {
        product_id: newProduct._id,
        is_saved: true,
        customer_id: customer_id, // 🟢 ผูกชื่อลูกค้าลงตะกร้าอย่างสมบูรณ์
      },
      { session },
    );

    await session.commitTransaction();
    res.json({ success: true, data: newProduct });
  } catch (error) {
    await session.abortTransaction();
    console.error(error);
    res.status(500).json({ success: false, message: "Save Failed" });
  } finally {
    session.endSession();
  }
}; // เรียกตอนกด "Save" ในหน้า Editor

const generateOrderNumber = async (comp_id) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const prefix = `${year}${month}${day}`; // 20260223

  const lastOrder = await Order.findOne({
    comp_id,
    order_no: { $regex: `^${prefix}` },
  }).sort({ order_no: -1 });

  let nextSeq = 1;
  if (lastOrder) {
    const lastSeqStr = lastOrder.order_no.split("-")[1]; // ตัดเอา 0001 มา
    nextSeq = parseInt(lastSeqStr, 10) + 1;
  }
  return `${prefix}-${String(nextSeq).padStart(4, "0")}`;
};
exports.finishCustomOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("comp_id").lean();

    // 🟢 1. รับค่าจากหน้าบ้าน (Frontend ต้องส่งมาเป็น Array)
    const {
      customer_id,
      items, // Array ของสินค้าที่แต่งสเปกเสร็จแล้ว
      sub_total,
      discount_total,
      grand_total,
      remark,
    } = req.body;

    if (!customer_id) throw new Error("กรุณาเลือกลูกค้าก่อนทำรายการ");
    if (!items || items.length === 0) throw new Error("ไม่มีสินค้าในรายการ");

    const orderNo = await generateOrderNumber(user.comp_id);
    let orderItems = [];

    // 🟢 2. วนลูปสร้างสินค้า Custom ทีละชิ้น
    for (const item of items) {
      // 2.1 สร้าง ProductDetail ใหม่ (เก็บสเปก)
      const newDetail = new ProductDetail({
        ...item.custom_spec,
        comp_id: user.comp_id,
      });
      await newDetail.save({ session });

      // 🟢 2.1.5 สร้างรหัสสินค้า Custom ให้ไม่ซ้ำ (เช่น ER-1005-C8192)
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const customProductCode = `${item.product_code}-C${randomSuffix}`;

      // 2.2 สร้าง Product ใหม่ (is_custom: true)
      const newProduct = new Product({
        product_code: customProductCode, // 🟢 ใช้รหัสที่ป้องกันการซ้ำแล้ว
        product_name: `${item.product_name} (Custom)`, // 🟢 เติมคำว่า Custom ท้ายชื่อให้ดูง่ายในตาราง
        file: item.image ? [item.image.replace(/^.*\/\/[^\/]+/, "")] : [], // ตัด baseUrl ทิ้งเพื่อเก็บเฉพาะ path
        product_category: item.category_id,
        product_item_type: item.custom_spec.item_type_id,
        comp_id: user.comp_id,
        product_detail_id: newDetail._id,
        is_custom: true,
        is_active: true,
      });
      await newProduct.save({ session });

      // 2.3 เตรียมก้อนข้อมูลยัดใส่ใบ Order
      orderItems.push({
        product_id: newProduct._id,
        product_code: newProduct.product_code, // ใช้รหัสใหม่ที่เพิ่งสร้าง
        product_name: newProduct.product_name, // ใช้ชื่อใหม่
        image: item.image, // URL รูปภาพ
        custom_spec: item.custom_spec,
        qty: item.qty || 1,
        unit_price: item.unit_price,
        total_item_price: (item.qty || 1) * item.unit_price,
      });

      // 2.4 ลบรายการนี้ออกจากตะกร้า CustomSession (เคลียร์ตะกร้า)
      if (item.session_id) {
        await CustomSession.findByIdAndDelete(item.session_id, { session });
      }
    }

    // 🟢 3. สร้างใบ Order บันทึกลงฐานข้อมูล
    const newOrder = new Order({
      comp_id: user.comp_id,
      sale_staff_id: userId,
      customer_id,
      order_no: orderNo,
      items: orderItems,
      sub_total: sub_total || 0,
      discount_total: discount_total || 0,
      grand_total: grand_total,
      remark,
    });
    await newOrder.save({ session });

    await session.commitTransaction();
    res.json({
      success: true,
      message: "Order created successfully",
      order_no: orderNo,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Finish Order Error:", error);
    res
      .status(500)
      .json({ success: false, message: error.message || "Server Error" });
  } finally {
    session.endSession();
  }
};

// exports.getPosProductsByIds = async (req, res) => {
//   try {
//     if (!req.user || !req.user.id) {
//       return res.status(401).json({ success: false, message: "Unauthorized" });
//     }
//     const user = await User.findById(req.user.id).select("comp_id").lean();
//     if (!user || !user.comp_id) {
//       return res
//         .status(400)
//         .json({ success: false, message: "User not associated with company." });
//     }
//     const comp_id = user.comp_id;

//     const { ids } = req.body;

//     if (!ids || !Array.isArray(ids) || ids.length === 0) {
//       return res.status(400).json({ success: false, message: "IDs required" });
//     }

//     // 2. ค้นหาสินค้าทั้งหมดที่มี ID ตรงกับใน Array
//     const products = await Product.find({
//       _id: { $in: ids },
//       comp_id: comp_id, // อย่าลืมเช็คว่าเป็นของบริษัทตัวเอง
//       is_active: true,
//     })
//       .select("product_code product_name file product_detail_id price") // เอา field เท่าที่จำเป็น
//       .populate("product_detail_id", "price unit") // ถ้าต้องการราคา/หน่วย
//       .lean();

//     // 3. จัด Format รูปภาพ (เหมือนฟังก์ชันอื่น)
//     const baseUrl = `${req.protocol}://${req.get("host")}/uploads/product/`;
//     const data = products.map((p) => ({
//       _id: p._id,
//       product_code: p.product_code,
//       product_name: p.product_name,
//       price: p.product_detail_id?.price || 0,
//       image:
//         p.file && p.file.length > 0
//           ? p.file[0].startsWith("http")
//             ? p.file[0]
//             : `${baseUrl}${p.file[0]}`
//           : null,
//     }));

//     res.json({ success: true, data });
//   } catch (error) {
//     console.error("Bulk Fetch Error:", error);
//     res.status(500).json({ success: false, message: "Server Error" });
//   }
// };
