const Product = require("../models/Product");
const ProductDetail = require("../models/Product_detail");
const User = require("../models/User");
const Masters = require("../models/masters");
const mongoose = require("mongoose");
const Stock = require("../models/Stock");
const Warehouse = require("../models/Warehouse");
// list แสดงหวมดหมู่
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
};

// list Product ของ catalog
exports.getPosProducts = async (req, res) => {
  try {
    // -----------------------------------------------------------
    // 1. Check Auth & Company (ตรวจสอบสิทธิ์)
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
    const comp_id = user.comp_id; // ✅ ใช้ comp_id นี้ในการ Query

    // -----------------------------------------------------------
    // 2. Prepare Variables
    // -----------------------------------------------------------
    const { category, item_type, search, page = 1, limit = 20 } = req.query;
    const baseUrl = `${req.protocol}://${req.get("host")}/uploads/product/`;

    // -----------------------------------------------------------
    // 3. Find Target Warehouse (ถ้ามีการเลือก Category มา)
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
        // แปลงชื่อ Category เป็น warehouse_type เพื่อหา ID คลัง
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
    // 5. Fetch Products (ดึงสินค้า)
    // -----------------------------------------------------------
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
    // 🟢 6. Fetch Stock (ส่วนที่แก้ไข: ดึงสต็อกแม้ไม่มี Warehouse ID)
    // -----------------------------------------------------------
    let stocks = [];
    if (products.length > 0) {
      const productIds = products.map((p) => p._id);

      const stockQuery = {
        product_id: { $in: productIds },
        comp_id: comp_id,
      };

      // ✅ ถ้าเจาะจง Warehouse (เลือก Tab) ให้กรองเฉพาะคลังนั้น
      // ❌ ถ้าไม่เจาะจง (All) ให้ดึงมาทั้งหมด เดี๋ยวไปรวมยอดเอา
      if (targetWarehouseId) {
        stockQuery.warehouse_id = targetWarehouseId;
      }

      stocks = await Stock.find(stockQuery).lean();
    }

    // -----------------------------------------------------------
    // 🟢 7. Merge Data (รวมข้อมูลสินค้า + สต็อก + รูปภาพ)
    // -----------------------------------------------------------
    const mergedProducts = products.map((product) => {
      // หาสต็อกทั้งหมดที่เป็นของสินค้านี้
      const productStocks = stocks.filter(
        (s) => s.product_id.toString() === product._id.toString(),
      );

      // 7.1 รวมจำนวนสินค้า (Sum Quantity)
      // กรณี All Products: สินค้าชิ้นนี้อาจมีวางอยู่หลายคลัง ให้รวมยอดทั้งหมด
      const totalQuantity = productStocks.reduce(
        (sum, s) => sum + s.quantity,
        0,
      );

      // 7.2 หาราคา (Prioritize Stock Price)
      // ถ้าเจอราคาใน Stock ให้ใช้ราคานั้น (เอาตัวแรกที่เจอ) ถ้าไม่มีให้ใช้ราคา Master
      const stockPrice =
        productStocks.length > 0 ? productStocks[0].price : null;

      // 7.3 จัดการรูปภาพ
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

        // ✅ ใช้ราคาจาก Stock ก่อน ถ้าไม่มีใช้ราคาจาก Product Detail
        price:
          stockPrice !== null
            ? stockPrice
            : product.product_detail_id?.price || 0,

        // ✅ ใช้ยอดรวมที่คำนวณมา
        quantity: totalQuantity,

        // ส่ง warehouse_id กลับไปเฉพาะกรณีที่ระบุ Category มา (เอาไว้ใช้ตอนตัดสต็อกถ้าจำเป็น)
        warehouse_id: targetWarehouseId,
      };
    });

    // -----------------------------------------------------------
    // 8. Final Response
    // -----------------------------------------------------------
    const total = await Product.countDocuments(query);

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
};

// show datail and custom
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
};

// list ของ หน้า custom
exports.getPosProductsByIds = async (req, res) => {
  try {
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

    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "IDs required" });
    }

    // 2. ค้นหาสินค้าทั้งหมดที่มี ID ตรงกับใน Array
    const products = await Product.find({
      _id: { $in: ids },
      comp_id: comp_id, // อย่าลืมเช็คว่าเป็นของบริษัทตัวเอง
      is_active: true,
    })
      .select("product_code product_name file product_detail_id price") // เอา field เท่าที่จำเป็น
      .populate("product_detail_id", "price unit") // ถ้าต้องการราคา/หน่วย
      .lean();

    // 3. จัด Format รูปภาพ (เหมือนฟังก์ชันอื่น)
    const baseUrl = `${req.protocol}://${req.get("host")}/uploads/product/`;
    const data = products.map((p) => ({
      _id: p._id,
      product_code: p.product_code,
      product_name: p.product_name,
      price: p.product_detail_id?.price || 0,
      image:
        p.file && p.file.length > 0
          ? p.file[0].startsWith("http")
            ? p.file[0]
            : `${baseUrl}${p.file[0]}`
          : null,
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error("Bulk Fetch Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
