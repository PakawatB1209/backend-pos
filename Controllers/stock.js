const Stock = require("../models/Stock");
const StockTransaction = require("../models/StockTransaction");
const User = require("../models/User");
const Product = require("../models/Product");
const Warehouse = require("../models/Warehouse");

const mongoose = require("mongoose");

exports.createStock = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select("comp_id");
    if (!user || !user.comp_id) {
      return res.status(400).json({
        success: false,
        message: "User is not associated with a company.",
      });
    }

    const { warehouse_id, product_id, quantity } = req.body;

    if (!warehouse_id || !product_id || !quantity) {
      return res.status(400).json({
        success: false,
        message: "Please specify Warehouse, Product, and Quantity.",
      });
    }

    const updatedStock = await Stock.findOneAndUpdate(
      {
        warehouse_id: warehouse_id,
        product_id: product_id,
        comp_id: user.comp_id,
      },
      {
        $inc: { quantity: quantity },
        $setOnInsert: {
          comp_id: user.comp_id,
          warehouse_id: warehouse_id,
          product_id: product_id,
        },
      },
      { new: true, upsert: true },
    );

    // await StockTransaction.create({
    //   product_id: product_id,
    //   from_warehouse_id: null, // รับเข้า (ไม่มีต้นทาง)
    //   to_warehouse_id: warehouse_id,
    //   quantity: quantity,
    //   action_type: "IN", // IN = รับเข้า
    //   by_user_id: userId,
    //   comp_id: user.comp_id,
    //   remark: "Stock In",
    // });

    res.status(200).json({
      success: true,
      message: "Stock added successfully.",
      data: updatedStock,
    });
  } catch (error) {
    console.log("Error create stock:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getOneStock = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format" });
    }

    const user = await User.findById(userId).select("comp_id");
    if (!user || !user.comp_id) {
      return res
        .status(400)
        .json({ success: false, message: "User not associated with company" });
    }
    const stock = await Stock.findOne({
      _id: id,
      comp_id: user.comp_id,
    })
      .populate({
        path: "product_id",
        select: "product_code product_name file price",
      })
      .populate({
        path: "warehouse_id",
        select: "warehouse_name",
      });

    if (!stock) {
      return res
        .status(404)
        .json({ success: false, message: "Stock not found" });
    }

    res.status(200).json({
      success: true,
      data: stock,
    });
  } catch (error) {
    console.log("Error getOneStock:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.list = async (req, res) => {
  try {
    // -------------------------------------------------------
    // 1. ตรวจสอบสิทธิ์ผู้ใช้งาน (Auth & Company Check)
    // -------------------------------------------------------
    const userId = req.user.id;
    const user = await User.findById(userId).select("comp_id").lean();

    // ถ้าไม่มี User หรือ User ไม่ได้สังกัดบริษัทใดๆ ให้ Error
    if (!user || !user.comp_id) {
      return res
        .status(400)
        .json({ success: false, message: "User not associated with company" });
    }

    // -------------------------------------------------------
    // 2. ตั้งค่า Pagination (หน้า, จำนวนต่อหน้า)
    // -------------------------------------------------------
    const page = Number.parseInt(req.query.page) || 1;
    const limit = Number.parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // รับค่า Filter ต่างๆ จาก Query String
    const { search, category, warehouse, start_date, end_date, status } =
      req.query;

    // เริ่มต้น Query โดยบังคับเลือกเฉพาะ comp_id ของ User เท่านั้น (เพื่อความปลอดภัย)
    let stockQuery = { comp_id: user.comp_id };

    // -------------------------------------------------------
    // 3. กรองตาม Search หรือ Category (ต้องหา Product ID ก่อน)
    // -------------------------------------------------------
    if (search || category) {
      const productQuery = { comp_id: user.comp_id };

      // ถ้ามีการเลือก Category (และไม่ใช่ All)
      if (category && category !== "All") {
        productQuery.product_category = category;
      }

      // ถ้ามีการพิมพ์ Search (ค้นหาจากชื่อ หรือ รหัสสินค้า)
      if (search) {
        productQuery.$or = [
          { product_name: { $regex: search, $options: "i" } },
          { product_code: { $regex: search, $options: "i" } },
        ];
      }

      // หา Product ที่ตรงเงื่อนไข แล้วดึงเฉพาะ _id ออกมา
      const matchingProducts = await Product.find(productQuery).select("_id");
      const productIds = matchingProducts.map((p) => p._id);

      // เอา ID สินค้าที่ได้ ไปกรองในตาราง Stock
      stockQuery.product_id = { $in: productIds };
    }

    // -------------------------------------------------------
    // 4. กรองตาม Warehouse และ วันที่
    // -------------------------------------------------------
    if (warehouse) {
      stockQuery.warehouse_id = warehouse;
    }

    if (start_date && end_date) {
      stockQuery.updatedAt = {
        $gte: new Date(start_date),
        $lte: new Date(new Date(end_date).setHours(23, 59, 59)), // สิ้นสุดวัน
      };
    }

    // -------------------------------------------------------
    // 5. กรองตามสถานะ (In Stock / Out of Stock)
    // -------------------------------------------------------
    if (status) {
      if (status === "In Stock") {
        stockQuery.quantity = { $gt: 0 }; // มากกว่า 0
      } else if (status === "Out of Stock") {
        stockQuery.quantity = { $lte: 0 }; // น้อยกว่าหรือเท่ากับ 0
      }
    }

    // -------------------------------------------------------
    // 6. ดึงข้อมูลจาก Database (Query & Populate)
    // -------------------------------------------------------
    // ใช้ Promise.all เพื่อดึงข้อมูลสินค้า (find) และนับจำนวนทั้งหมด (count) พร้อมกัน
    const [stocks, total] = await Promise.all([
      Stock.find(stockQuery)
        .populate({
          path: "product_id",
          select:
            "product_code product_name file price unit cost product_category",
          // 🟢 Nested Populate: เจาะเข้าไปใน product_category เพื่อเอา "ชื่อหมวดหมู่ (master_name)" ออกมา
          populate: {
            path: "product_category",
            select: "master_name", // ถ้าไม่ทำตรงนี้จะได้เป็น ID ยาวๆ
          },
        })
        .populate({
          path: "warehouse_id",
          select: "warehouse_name",
        })
        .sort({ updatedAt: -1 }) // เรียงจากอัปเดตล่าสุด
        .skip(skip)
        .limit(limit)
        .lean(), // แปลงเป็น JSON Object ธรรมดา (เพื่อความเร็ว)
      Stock.countDocuments(stockQuery),
    ]);

    const baseUrl = `${req.protocol}://${req.get("host")}/uploads/product/`;

    // -------------------------------------------------------
    // 7. จัดรูปแบบข้อมูล (Format Data) ก่อนส่งกลับหน้าบ้าน
    // -------------------------------------------------------
    const formattedData = stocks.map((item) => {
      const product = item.product_id || {};
      const warehouse = item.warehouse_id || {};
      const catObj = product.product_category || {}; // รับค่าเป็น Object จากการ Populate ซ้อน

      // จัดการ URL รูปภาพ
      let imageUrl = "";
      if (product.file && product.file.length > 0) {
        imageUrl = product.file[0].startsWith("http")
          ? product.file[0]
          : `${baseUrl}${product.file[0]}`;
      }

      const qty = item.quantity || 0;
      const cost = item.cost || 0;
      const amount = qty * cost;

      return {
        _id: item._id,
        image: imageUrl,
        code: product.product_code || "-",
        product_name: product.product_name || "-",

        // ดึงชื่อหมวดหมู่จาก Object (master_name)
        category: catObj.master_name || "-",

        warehouse: warehouse.warehouse_name || "Unknown",
        date: item.updatedAt,
        unit: product.unit || "Pcs",
        qty: qty,
        cost: cost,
        amount: amount,
        sale_price: product.price || 0,

        // Status: ถ้ามีของ > 0 คือ In Stock, ถ้า <= 0 คือ Out of Stock
        status: qty > 0 ? "In Stock" : "Out of Stock",
      };
    });

    // -------------------------------------------------------
    // 8. ส่ง Response กลับ
    // -------------------------------------------------------
    res.status(200).json({
      success: true,
      data: formattedData,
      pagination: {
        total_record: total,
        total_page: Math.ceil(total / limit),
        current_page: page,
        limit: limit,
      },
    });
  } catch (error) {
    console.log("Inventory List Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getStockDetail = async (req, res) => {
  try {
    const { id } = req.params; // รับ id ของ Inventory (Stock ID)

    // 1. ดึงข้อมูล Stock พร้อม Populate ข้อมูล Product ลึกๆ
    const stock = await Stock.findById(id)
      .populate({
        path: "warehouse_id",
        select: "warehouse_name",
      })
      .populate({
        path: "product_id",
        populate: [
          // 1.1 ดึง Detail หลัก
          {
            path: "product_detail_id",
            populate: [
              // 1.2 ดึง Master Data (Metal, Color, etc.)
              {
                path: "masters.master_id",
                select: "master_name master_type",
              },
              // 1.3 ดึงข้อมูล Stone (ที่เป็น Master)
              { path: "primary_stone.stone_name", select: "master_name" },
              { path: "primary_stone.shape", select: "master_name" },
              { path: "primary_stone.size", select: "master_name" },
              { path: "primary_stone.color", select: "master_name" },
              { path: "primary_stone.cutting", select: "master_name" },
              { path: "primary_stone.quality", select: "master_name" },
              { path: "primary_stone.clarity", select: "master_name" },
            ],
          },
          // 1.4 ดึง Accessories
          {
            path: "related_accessories.product_id",
            select: "product_code product_name product_detail_id",
            populate: {
              path: "product_detail_id",
              select: "size weight unit masters",
              populate: {
                path: "masters.master_id",
                select: "master_name master_type",
              },
            },
          },
        ],
      })
      .lean();

    if (!stock) {
      return res
        .status(404)
        .json({ success: false, message: "Stock not found" });
    }

    const product = stock.product_id || {};
    const detail = product.product_detail_id || {};
    const baseUrl = `${req.protocol}://${req.get("host")}/uploads/product/`;

    // --- Helper: ดึงชื่อ Master Data ---
    const getMasterName = (obj) =>
      obj && obj.master_name ? obj.master_name : "-";

    // หาค่าจาก Array Masters (เช่น Metal, Item Type)
    const findMaster = (type) => {
      if (!detail.masters) return "-";
      const found = detail.masters.find(
        (m) => m.master_id && m.master_id.master_type === type,
      );
      return found ? found.master_id.master_name : "-";
    };

    // --- จัด Format ข้อมูลตามหน้า UI ---
    const responseData = {
      // 🟢 Header Section
      _id: stock._id,
      date: stock.updatedAt,
      unit: detail.unit,
      qty: stock.quantity || 0,
      cost: stock.cost || 0,
      amount: (stock.quantity || 0) * (stock.cost || 0),
      price: product.price || stock.price || 0, // Sale Price
      status: (stock.quantity || 0) > 0 ? "In Stock" : "Out of Stock",

      // 🟢 Product Details Section
      product_details: {
        category: product.product_category || "-",
        code: product.product_code || "-",
        product_name: product.product_name || "-",
        item_type: findMaster("item_type"),
        product_size: detail.size || "-",
        metal: findMaster("metal"),
        metal_color: findMaster("metal_color"), // หรือ "color" แล้วแต่ Database
        description: detail.description || "-",
        nwt: detail.net_weight || 0, // Net Weight
        gwt: detail.gross_weight || 0, // Gross Weight
      },

      // 🟢 Stone Details Section
      stone_details: {
        stone_name: getMasterName(detail.primary_stone?.stone_name),
        shape: getMasterName(detail.primary_stone?.shape),
        size: getMasterName(detail.primary_stone?.size),
        s_weight: detail.primary_stone?.weight || 0, // Stone Weight
        color: getMasterName(detail.primary_stone?.color),
        cutting: getMasterName(detail.primary_stone?.cutting),
        quality: getMasterName(detail.primary_stone?.quality),
        clarity: getMasterName(detail.primary_stone?.clarity),
      },

      // 🟢 Accessories Section
      accessories: (product.related_accessories || []).map((acc) => {
        const accProd = acc.product_id;
        const accDetail = accProd?.product_detail_id || {};

        // หา Metal ของ Accessory (ซับซ้อนหน่อยเพราะมันซ้อนอยู่)
        let accMetal = "-";
        if (accDetail.masters) {
          const m = accDetail.masters.find(
            (m) => m.master_id && m.master_id.master_type === "metal",
          );
          if (m) accMetal = m.master_id.master_name;
        }

        return {
          code: accProd?.product_code || "-",
          product_name: accProd?.product_name || "-",
          weight: acc.weight || accDetail.weight || 0,
          size: accDetail.size || "-",
          metal: accMetal,
          description: acc.description || "-",
        };
      }),
    };

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.log("Get Inventory Detail Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.removeOneStock = async (req, res) => {
  try {
    const id = req.params.id;
    const comp_id = req.user.comp_id;

    const remove_stock = await Stock.findOneAndDelete({
      _id: id,
      comp_id: comp_id,
    });

    if (!remove_stock) {
      return res
        .status(404)
        .send(
          "Data not found or you do not have permission to delete this item.",
        );
    }

    res.send(remove_stock);
  } catch (err) {
    console.log(err);
    res.status(500).send("Server error");
  }
};

exports.removeStockAll = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await User.findById(req.user.id).select("comp_id");
    if (!user || !user.comp_id) {
      return res
        .status(400)
        .json({ success: false, message: "User has no company" });
    }
    const comp_id = user.comp_id;
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).send("Please provide an array of IDs.");
    }

    const result = await Stock.deleteMany({
      _id: { $in: ids },
      comp_id: comp_id,
    });

    if (result.deletedCount === 0) {
      return res
        .status(404)
        .send(
          "Data not found or you do not have permission to delete these items.",
        );
    }

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} items successfully.`,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Server error: " + err.message);
  }
};

exports.getStockTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("comp_id");

    if (!user || !user.comp_id) {
      return res
        .status(400)
        .json({ success: false, message: "User has no company" });
    }

    let query = { comp_id: user.comp_id };

    if (req.query.product_id) {
      query.product_id = req.query.product_id;
    }

    if (req.query.warehouse_id) {
      query.warehouse_id = req.query.warehouse_id;
    }

    if (req.query.type) {
      query.type = req.query.type; // in, out, adjust
    }
    const transactions = await StockTransaction.find(query)
      .populate({
        path: "comp_id",
        select: "comp_name",
      })
      .populate({
        path: "product_id",
        select: "product_code product_name image unit",
      })
      .populate({
        path: "warehouse_id",
        select: "warehouse_name",
      })
      .populate({
        path: "created_by",
        select: "user_name user_email",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    console.error("Get Transaction Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
