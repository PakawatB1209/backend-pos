const Product = require("../models/Product");
const ProductDetail = require("../models/Product_detail");
const User = require("../models/User");
const Masters = require("../models/masters");
const mongoose = require("mongoose");
const Stock = require("../models/Stock");
const Warehouse = require("../models/Warehouse");

// ==========================================================
// 1. ค้นหาและเลือกสินค้า (Catalog)
// ==========================================================

// list แสดงหมวดหมู่
exports.getPosItemTypes = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const user = await User.findById(req.user.id).select("comp_id").lean();
    const comp_id = user.comp_id;

    const { category_id } = req.query;
    if (!category_id) {
      return res
        .status(400)
        .json({ success: false, message: "Category ID is required" });
    }

    const itemTypes = await Product.aggregate([
      {
        $match: {
          product_category: new mongoose.Types.ObjectId(category_id),
          comp_id: comp_id,
          is_active: true,
        },
      },
      {
        $addFields: {
          // 🟢 จุดสำคัญ: รวมศูนย์การดึงชื่อประเภทสินค้า (รองรับทั้งพลอยและสินค้าทั่วไป)
          // มันจะหาจาก item_type ก่อน ถ้าไม่มีไปหา product_item_type และ stone_name ตามลำดับ
          rawType: {
            $ifNull: ["$item_type", "$product_item_type", "$stone_name"],
          },
        },
      },
      {
        $addFields: {
          // พยายามแปลงเป็น ObjectId เพื่อไป Lookup ชื่อสวยๆ จากตาราง Masters
          convertedId: {
            $convert: {
              input: "$rawType",
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
          // ถ้ามีข้อมูลใน Masters ให้เอา master_name มาโชว์ ถ้าไม่มีให้ใช้ชื่อดิบที่พิมพ์ไว้
          finalName: {
            $ifNull: [
              { $arrayElemAt: ["$master_info.master_name", 0] },
              "$rawType",
              "Uncategorized", // Fallback สุดท้ายถ้าไม่มีชื่อเลย
            ],
          },
        },
      },
      {
        $group: {
          _id: "$finalName",
          originalId: { $first: "$convertedId" },
          // ดึงรูปแรกของสินค้าในกลุ่มนี้มาเป็นหน้าปก (เช่น รูปเพชร หรือ รูปแหวน)
          cover_image: { $first: { $arrayElemAt: ["$file", 0] } },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          // ถ้าเป็น ID ให้ส่ง ID กลับไป ถ้าไม่มีให้ส่งชื่อ (String) กลับไปเป็น ID แทน
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

    const {
      category,
      item_type,
      search,
      page = 1,
      limit = 20,
      view_mode = "master",
    } = req.query;
    const baseUrl = `${req.protocol}://${req.get("host")}/uploads/product/`;

    let targetWarehouseId = null;
    if (category) {
      const masterCat = await Masters.findById(category);
      if (masterCat) {
        const nameMap = {
          "Product Master": "productmaster",
          Stone: "stone",
          "Stone/Diamond": "stone",
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

    const query = { comp_id, is_active: true };
    if (category) query.product_category = category;

    if (item_type) {
      query.$or = [
        { product_item_type: item_type },
        { item_type: item_type },
        { stone_name: item_type },
      ];
    }

    if (search) {
      query.$or = [
        { product_code: { $regex: search, $options: "i" } },
        { product_name: { $regex: search, $options: "i" } },
      ];
    }

    if (view_mode === "inventory") {
      const stockQueryFilter = { comp_id, quantity: { $gt: 0 } };
      if (targetWarehouseId) stockQueryFilter.warehouse_id = targetWarehouseId;
      const stockRecords = await Stock.find(stockQueryFilter)
        .select("product_id")
        .lean();
      query._id = { $in: stockRecords.map((s) => s.product_id) };
    }

    const total = await Product.countDocuments(query);

    // 🟢 แก้ไข: ยกเลิก Populate ซ้อน (เอาออกได้เลยเพราะเราดึงจาก Product โดยตรง)
    const products = await Product.find(query)
      .populate("product_detail_id", "size price unit") // ดึงมาแค่ข้อมูลที่จำเป็นพอ
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    let stocks = [];
    if (products.length > 0) {
      const productIds = products.map((p) => p._id);
      const stockQuery = {
        product_id: { $in: productIds },
        comp_id: comp_id,
        ...(targetWarehouseId && { warehouse_id: targetWarehouseId }),
      };
      stocks = await Stock.find(stockQuery).lean();
    }

    const mergedProducts = products.map((product) => {
      const productStocks = stocks.filter(
        (s) => s.product_id.toString() === product._id.toString(),
      );

      const totalQuantity = productStocks.reduce(
        (sum, s) => sum + s.quantity,
        0,
      );
      const totalWeight = productStocks.reduce(
        (sum, s) => sum + (s.total_gross_weight || 0),
        0,
      );

      const displayPrice =
        productStocks.length > 0 && productStocks[0].price
          ? productStocks[0].price
          : product.product_detail_id?.price || 0;

      const displayUnit =
        productStocks.length > 0 && productStocks[0].unit
          ? productStocks[0].unit
          : product.unit || product.product_detail_id?.unit || "Pcs";

      let coverImage = null;
      if (product.file && product.file.length > 0) {
        coverImage = product.file[0].startsWith("http")
          ? product.file[0]
          : `${baseUrl}${product.file[0]}`;
      }

      // 🟢 ส่งข้อมูลไปให้ครบจบในที่เดียว ดึง metal และ color จากระดับนอกสุดได้เลย!
      return {
        _id: product._id,
        product_code: product.product_code,
        product_name: product.product_name,
        image: coverImage,
        unit: displayUnit,

        // ข้อมูล สเปกพื้นฐาน สำหรับโชว์ในการ์ดสินค้า (รูปภาพ 2)
        size: product.product_detail_id?.size || product.size || "-",
        metal: product.metal || "-", // ดึงตรงๆ จาก Product
        metal_color: product.color || "-", // ดึงตรงๆ จาก Product (ถ้าชื่อฟิลด์เป็น metal_color ก็เปลี่ยนตามชื่อคุณ)

        price: displayPrice,
        quantity: totalQuantity,
        total_weight: totalWeight,
        warehouse_id: targetWarehouseId,
      };
    });

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
// คลิกสินค้าใน List เพื่อดูสเปก (โหลดไปโชว์ในหน้า Editor / Details)
exports.getPosProductDetail = async (req, res) => {
  try {
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

    const product = await Product.findOne({ _id: id, comp_id })
      .populate("product_category", "master_name")
      .populate("product_item_type", "master_name")
      .populate({
        path: "product_detail_id",
        populate: [
          { path: "masters.master_id", select: "master_name master_type" },
          //พลอยหลัก
          { path: "primary_stone.stone_name", select: "master_name" },
          { path: "primary_stone.shape", select: "master_name" },
          { path: "primary_stone.clarity", select: "master_name" },
          { path: "primary_stone.quality", select: "master_name" },
          { path: "primary_stone.cutting", select: "master_name" },
          //พลอยรอง
          { path: "additional_stones.stone_name", select: "master_name" },
          { path: "additional_stones.shape", select: "master_name" },
          { path: "additional_stones.clarity", select: "master_name" },
          { path: "additional_stones.quality", select: "master_name" },
          { path: "additional_stones.cutting", select: "master_name" },
        ],
      })
      .lean();

    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });

    const detail = product.product_detail_id || {};

    // ---ค้นหา Metal และ Color จาก Array "masters" ---
    let metalObj = null;
    let metalColorObj = null;

    if (detail.masters && detail.masters.length > 0) {
      detail.masters.forEach((item) => {
        const m = item.master_id;
        if (!m) return;

        const name = m.master_name || "";

        if (
          name.includes("18K") ||
          name.includes("14K") ||
          name.includes("9K") ||
          name.includes("Platinum")
        ) {
          metalObj = m;
        } else if (
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

    let price = detail.price || 0;
    let quantity = 0;

    // --- ค้นหาข้อมูล Stock & Warehouse ---
    let targetWarehouseId = null;
    if (product.product_category) {
      const catName = product.product_category.master_name || "";
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
        const warehouseType =
          nameMap[masterName] || masterName.toLowerCase().replace(/ /g, "");

        const warehouse = await Warehouse.findOne({
          comp_id,
          warehouse_type: warehouseType,
        });
        if (warehouse) targetWarehouseId = warehouse._id;
      }
    }

    if (targetWarehouseId) {
      const stockItem = await Stock.findOne({
        product_id: product._id,
        comp_id: comp_id,
        warehouse_id: targetWarehouseId,
      }).select("quantity price");

      if (stockItem) {
        quantity = stockItem.quantity;
      }
    } else {
      const allStocks = await Stock.find({
        product_id: product._id,
        comp_id: comp_id,
      });
      quantity = allStocks.reduce((sum, s) => sum + s.quantity, 0);
    }

    // จัดการ Attributes สำหรับแสดงผลในหน้า UI (โชว์ข้อมูลสวยๆ)
    const categoryName = product.product_category?.master_name || "";
    const catLower = categoryName.toLowerCase();
    const itemTypeName = product.product_item_type?.master_name || "-";

    let attributes = {
      main_info: [],
      stone_info: [],
      additional_stones: [], // กล่องใหม่ สำหรับเก็บ Array ของพลอยรองแต่ละชุด
    };

    if (catLower.includes("stone") || catLower.includes("diamond")) {
      // กรณีเป็นเพชรร่วง / พลอยร่วง
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
      // กรณีเป็นเครื่องประดับ (เรียงตาม UI)
      attributes.main_info = [
        { label: "Code", value: product.product_code },
        { label: "Category", value: categoryName },
        { label: "Item type", value: itemTypeName },
        { label: "Product size", value: detail.product_size || "-" },
        { label: "Metal", value: metalName },
        { label: "Metal color", value: metalColorName },
        {
          label: "Nwt",
          value: detail.net_weight ? `${detail.net_weight} g` : "-",
        },
        {
          label: "Gwt",
          value: detail.gross_weight ? `${detail.gross_weight} g` : "-",
        },
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

    //สร้างตารางพลอยรอง (Additional Stones) แบบจัดเต็ม
    if (detail.additional_stones && detail.additional_stones.length > 0) {
      detail.additional_stones.forEach((as) => {
        attributes.additional_stones.push([
          { label: "Stone Name", value: as.stone_name?.master_name || "-" },
          { label: "Shape", value: as.shape?.master_name || "-" },
          { label: "Size", value: as.size || "-" },
          { label: "S.Weight", value: as.weight ? `${as.weight} cts` : "-" },
          { label: "Color", value: as.color || "-" },
          { label: "Cutting", value: as.cutting?.master_name || "-" },
          { label: "Quality", value: as.quality?.master_name || "-" },
          { label: "Clarity", value: as.clarity?.master_name || "-" },
          { label: "Qty", value: as.qty ? `${as.qty}` : "-" },
        ]);
      });
    }

    // Raw Data สำหรับส่งไปแปะใน Input Form (หน้า Editor)
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
      additional_stones: (detail.additional_stones || []).map((as) => ({
        stone_name_id: as.stone_name?._id || as.stone_name,
        stone_shape_id: as.shape?._id || as.shape,
        stone_size: as.size,
        s_weight: as.weight,
        stone_color: as.color,
        cutting: as.cutting?._id || as.cutting,
        quality: as.quality?._id || as.quality,
        clarity: as.clarity?._id || as.clarity,
        qty: as.qty,
      })),
    };

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
        quantity,
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

// ดึงข้อมูลสินค้าทีละหลายๆ ID (Bulk Fetch)
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

    const products = await Product.find({
      _id: { $in: ids },
      comp_id: comp_id,
      is_active: true,
    })
      .select("product_code product_name file product_detail_id price")
      .populate("product_detail_id", "price unit")
      .lean();

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
