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
    const { category } = req.query;

    if (!category) {
      return res
        .status(400)
        .json({ success: false, message: "Category is required" });
    }

    /* resolve category slug → ObjectId */

    const masterCategory = await Masters.findOne({
      master_name: { $regex: new RegExp(`^${category}$`, "i") },
      comp_id: comp_id,
    }).select("_id");

    if (!masterCategory) {
      return res.status(400).json({
        success: false,
        message: "Invalid category",
      });
    }

    const categoryId = masterCategory._id;

    /* query product */

    const products = await Product.find({
      product_category: categoryId,
      comp_id: comp_id,
      is_active: true,
    }).lean();

    // 1. ดึง Product ออกมาทั้งหมดแบบดิบๆ
    // const products = await Product.find({
    //   product_category: category_id,
    //   comp_id: comp_id,
    //   is_active: true,
    // }).lean();

    // 2. ดึง ProductDetail ทั้งหมดที่เกี่ยวข้อง (ดึงแยกตารางมาเลย ชัวร์กว่า)
    const detailIds = products
      .map((p) => p.product_detail_id)
      .filter((id) => id);
    const details = await ProductDetail.find({
      _id: { $in: detailIds },
    }).lean();

    // 3. ดึง Masters ทั้งหมดมาตุนไว้ (เผื่อต้องแปลง ID เป็นชื่อ)
    const masters = await Masters.find({ comp_id: comp_id }).lean();

    const baseUrl = `${req.protocol}://${req.get("host")}/uploads/product/`;
    const grouped = {};

    // 4. วนลูปจับคู่ข้อมูลด้วย Javascript (วิธีนี้ฉลาดและไม่มีบั๊ก)
    products.forEach((p) => {
      // เอา Product จับคู่กับ Detail
      const detail =
        details.find(
          (d) => d._id.toString() === p.product_detail_id?.toString(),
        ) || {};

      // 🔍 กวาดหาชื่อหิน/ชื่อประเภท จากทุกซอกทุกมุมของตาราง
      let rawName =
        p.type_stone ||
        detail.type_stone ||
        p.stone_name ||
        detail.stone_name ||
        p.item_type ||
        detail.item_type ||
        p.product_item_type ||
        detail.product_item_type ||
        detail.primary_stone?.stone_name; // เผื่อซ่อนลึก

      // 🛠️ ถ้าสิ่งที่ดึงมาได้ ดันเป็น ObjectId (ยาว 24 ตัว) ให้วิ่งไปหาชื่อสวยๆ ในตาราง Master
      if (rawName) {
        const rawStr = rawName.toString();
        if (/^[0-9a-fA-F]{24}$/.test(rawStr)) {
          const master = masters.find((m) => m._id.toString() === rawStr);
          if (master) rawName = master.master_name;
        }
      }

      // ถ้าหาจนสุดทางแล้วยังว่างเปล่า ค่อยให้เป็น Uncategorized
      if (!rawName || rawName.toString().trim() === "") {
        rawName = "Uncategorized";
      } else {
        rawName = rawName.toString().trim();
      }

      // 📁 เริ่มจัดกลุ่ม (เอาชื่อที่ได้มาสร้าง Folder)
      if (!grouped[rawName]) {
        let img = p.file && p.file.length > 0 ? p.file[0] : null;
        if (img && !img.startsWith("http")) img = `${baseUrl}${img}`;

        grouped[rawName] = {
          _id: rawName,
          name: rawName,
          image: img,
          count: 0,
        };
      }
      grouped[rawName].count += 1;
    });

    // 5. แปลงข้อมูลส่งกลับหน้าบ้าน สวยๆ
    const formattedData = Object.values(grouped).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    res.json({ success: true, data: formattedData });
  } catch (error) {
    console.error("Get Menu Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// list Product ของ catalog
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

    // let targetWarehouseId = null;
    // if (category) {
    //   const masterCat = await Masters.findById(category);
    //   if (masterCat) {
    //     const nameMap = {
    //       "Product Master": "productmaster",
    //       Stone: "stone",
    //       "Stone/Diamond": "stone",
    //       "Semi-Mount": "semimount",
    //       Accessories: "accessory",
    //       Others: "others",
    //     };
    //     const warehouseType =
    //       nameMap[masterCat.master_name] ||
    //       masterCat.master_name.toLowerCase().replace(/ /g, "");
    //     const warehouse = await Warehouse.findOne({
    //       comp_id,
    //       warehouse_type: warehouseType,
    //     });
    //     if (warehouse) targetWarehouseId = warehouse._id;
    //   }
    // }

    const query = { comp_id, is_active: true };

    let categoryObjectId = null;

    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
        categoryObjectId = category;
      } else {
        const masterCat = await Masters.findOne({
          master_name: { $regex: new RegExp(`^${category}$`, "i") },
          comp_id,
        });

        if (masterCat) categoryObjectId = masterCat._id;
      }
    }

    if (categoryObjectId) {
      query.product_category = categoryObjectId;
    }

    // if (category) query.product_category = category;

    // 🟢 ระบบค้นหาขั้นเทพ: สลับร่าง String -> ID เพื่อค้นหาหิน
    const andConditions = [];

    if (item_type) {
      const cleanType = item_type.trim();
      const isObjId = /^[0-9a-fA-F]{24}$/.test(cleanType); // เช็คว่าเป็น ID ไหม

      let targetIds = [];

      if (isObjId) {
        // 💍 ถ้าหน้าบ้านส่ง ID มา (พวกแหวน) ก็เอา ID ไปใช้เลย
        targetIds.push(cleanType);
      } else {
        // 💎 ถ้าหน้าบ้านส่งชื่อหินมา (Aquamarine) ต้องวิ่งไปแปลเป็น ID จาก Master ก่อน
        const masterRecords = await Masters.find({
          master_name: cleanType,
          comp_id: comp_id,
        })
          .select("_id")
          .lean();
        targetIds = masterRecords.map((m) => m._id.toString());
      }

      // ถ้าหน้าบ้านส่งชื่อแปลกๆ มา แล้วหาใน Master ไม่เจอเลย ให้ผลลัพธ์เป็น 0 ไปเลย
      if (targetIds.length > 0) {
        // มุดลงไปหาใน ProductDetail ด้วย ID ที่แปลมาได้
        const matchedDetails = await ProductDetail.find({
          $or: [
            { "primary_stone.stone_name": { $in: targetIds } }, // <--- ข้อมูลจริงซ่อนอยู่ตรงนี้!
            { type_stone: { $in: targetIds } },
            { stone_name: { $in: targetIds } },
            { item_type: { $in: targetIds } },
          ],
        })
          .select("_id")
          .lean();

        const detailIds = matchedDetails.map((d) => d._id);

        const typeConditions = [
          { product_item_type: { $in: targetIds } }, // หาจากเปลือกนอกสุด
        ];

        // ถ้ามุดเจอใน ProductDetail ก็เอามามัดรวมกัน
        if (detailIds.length > 0) {
          typeConditions.push({ product_detail_id: { $in: detailIds } });
        }

        andConditions.push({ $or: typeConditions });
      } else {
        // หาไม่เจอ = ให้ query เป็น false เพื่อตีกลับ []
        andConditions.push({ _id: null });
      }
    }

    // ระบบค้นหาข้อความ
    if (search) {
      andConditions.push({
        $or: [
          { product_code: { $regex: search, $options: "i" } },
          { product_name: { $regex: search, $options: "i" } },
        ],
      });
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    if (view_mode === "inventory") {
      const stockQueryFilter = { comp_id, quantity: { $gt: 0 } };
      if (targetWarehouseId) stockQueryFilter.warehouse_id = targetWarehouseId;
      const stockRecords = await Stock.find(stockQueryFilter)
        .select("product_id")
        .lean();

      if (query.$and) {
        query.$and.push({
          _id: { $in: stockRecords.map((s) => s.product_id) },
        });
      } else {
        query._id = { $in: stockRecords.map((s) => s.product_id) };
      }
    }

    const total = await Product.countDocuments(query);

    const products = await Product.find(query)
      .populate("product_detail_id") // ดึงสเปกมาทั้งหมด
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

      return {
        _id: product._id,
        product_code: product.product_code,
        product_name: product.product_name,
        image: coverImage,
        unit: displayUnit,
        size: product.product_detail_id?.size || product.size || "-",
        metal: product.metal || "-",
        metal_color: product.color || "-",
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
