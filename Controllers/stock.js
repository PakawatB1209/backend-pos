const Stock = require("../models/Stock");
const StockTransaction = require("../models/StockTransaction");
const User = require("../models/User");
const Product = require("../models/Product");
const Warehouse = require("../models/Warehouse");
const excelJS = require("exceljs");

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
          last_in_date: date || new Date(),
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
        // 🟢 ดึงข้อมูลสินค้าที่จำเป็นมาแสดงผลร่วมด้วย
        select: "product_code product_name file price",
      })
      .populate({
        path: "warehouse_id",
        select: "warehouse_name",
      })
      .lean({ virtuals: true }); // 🟢 ใช้ lean เพื่อความเร็ว และเปิด virtuals ให้ทำงาน

    if (!stock) {
      return res
        .status(404)
        .json({ success: false, message: "Stock not found" });
    }

    // --- จัด Format ข้อมูลให้ตรงกับระบบราคาเฉลี่ย ---
    const product = stock.product_id || {};

    const formattedData = {
      ...stock,
      // 🟢 ดึงราคาขายเฉลี่ยจาก Stock เป็นหลัก ถ้าไม่มีค่อยใช้ราคา Master
      price: stock.price || product.price || 0,

      // 🟢 ใช้วันที่นำเข้าล่าสุด
      date: stock.last_in_date || stock.updatedAt,

      // 🟢 รวมยอดต้นทุน (จำนวน x ทุนเฉลี่ย)
      total_cost_amount: (stock.quantity || 0) * (stock.cost || 0),

      // 🟢 รวมยอดราคาขาย (จำนวน x ราคาขายเฉลี่ย)
      total_sale_amount: (stock.quantity || 0) * (stock.price || 0),
    };

    res.status(200).json({
      success: true,
      data: formattedData,
    });
  } catch (error) {
    console.log("Error getOneStock:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
//ของใน stock ทั้งหมด
exports.list = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("comp_id").lean();

    if (!user || !user.comp_id) {
      return res
        .status(403)
        .json({ success: false, message: "User not associated with company" });
    }

    // 🟢 1. รับค่า Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const { search, category, warehouse, start_date, end_date, status } =
      req.query;
    let stockQuery = { comp_id: user.comp_id };

    if (warehouse) stockQuery.warehouse_id = warehouse;

    if (start_date && end_date) {
      stockQuery.last_in_date = {
        $gte: new Date(start_date),
        $lte: new Date(new Date(end_date).setHours(23, 59, 59, 999)),
      };
    }

    if (status) {
      if (status === "In Stock") stockQuery.quantity = { $gt: 0 };
      else if (status === "Out of Stock") stockQuery.quantity = { $lte: 0 };
    }

    if (search || category) {
      const productQuery = { comp_id: user.comp_id };

      if (category && category !== "All")
        productQuery.product_category = category;

      if (search) {
        const safeSearch = escapeRegex(String(search)); // ต้องมีฟังก์ชัน escapeRegex ข้างบนด้วยนะ
        productQuery.$or = [
          { product_name: { $regex: safeSearch, $options: "i" } },
          { product_code: { $regex: safeSearch, $options: "i" } },
        ];
      }

      const matchingProducts = await Product.find(productQuery)
        .select("_id")
        .lean();

      if (matchingProducts.length === 0) {
        // 🎯 ส่ง Response มาตรฐาน (กรณีหาไม่เจอ)
        return res.status(200).json({
          success: true,
          count: 0,
          total_record: 0,
          total_page: 0,
          current_page: page,
          limit: limit,
          data: [],
        });
      }

      stockQuery.product_id = { $in: matchingProducts.map((p) => p._id) };
    }

    // 🚀 2. รัน Query คู่ขนาน
    const [stocks, total] = await Promise.all([
      Stock.find(stockQuery)
        .populate({
          path: "product_id",
          select: "product_code product_name file unit product_category",
          populate: { path: "product_category", select: "master_name" },
        })
        .populate({ path: "warehouse_id", select: "warehouse_name" })
        .sort({ last_in_date: -1 })
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),
      Stock.countDocuments(stockQuery),
    ]);

    const baseUrl = `${req.protocol}://${req.get("host")}/uploads/product/`;

    const formattedData = stocks.map((item) => {
      const product = item.product_id || {};
      const warehouse = item.warehouse_id || {};
      const catObj = product.product_category || {};

      let imageUrl = "";
      if (product.file && product.file.length > 0) {
        imageUrl = product.file[0].startsWith("http")
          ? product.file[0]
          : `${baseUrl}${product.file[0]}`;
      }

      const qty = item.quantity || 0;
      const cost = item.cost || 0;

      return {
        _id: item._id,
        image: imageUrl,
        code: product.product_code || "-",
        product_name: product.product_name || "-",
        category: catObj.master_name || "-",
        warehouse: warehouse.warehouse_name || "Unknown",
        date: item.last_in_date || item.updatedAt,
        unit: product.unit || "Pcs",
        qty: qty,
        cost: cost,
        amount: qty * cost,
        sale_price: item.price || 0,
        total_gross_weight: item.total_gross_weight || 0,
        status: qty > 0 ? "In Stock" : "Out of Stock",
      };
    });

    // 🎯 3. ส่ง Response มาตรฐาน (ถอดก้อน Pagination ออกแล้ว)
    res.status(200).json({
      success: true,
      count: formattedData.length,
      total_record: total,
      total_page: Math.ceil(total / limit),
      current_page: page,
      limit: limit,
      data: formattedData,
    });
  } catch (error) {
    console.log("Inventory List Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// exports.list = async (req, res) => {
//   try {
//     // 1. ตรวจสอบสิทธิ์ผู้ใช้งาน
//     const userId = req.user.id;
//     const user = await User.findById(userId).select("comp_id").lean();

//     if (!user || !user.comp_id) {
//       return res
//         .status(400)
//         .json({ success: false, message: "User not associated with company" });
//     }

//     // 2. ตั้งค่า Pagination
//     const page = Number.parseInt(req.query.page) || 1;
//     const limit = Number.parseInt(req.query.limit) || 10;
//     const skip = (page - 1) * limit;

//     const { search, category, warehouse, start_date, end_date, status } =
//       req.query;
//     let stockQuery = { comp_id: user.comp_id };

//     // 3. กรองตาม Search หรือ Category
//     if (search || category) {
//       const productQuery = { comp_id: user.comp_id };
//       if (category && category !== "All")
//         productQuery.product_category = category;
//       if (search) {
//         productQuery.$or = [
//           { product_name: { $regex: search, $options: "i" } },
//           { product_code: { $regex: search, $options: "i" } },
//         ];
//       }
//       const matchingProducts = await Product.find(productQuery).select("_id");
//       stockQuery.product_id = { $in: matchingProducts.map((p) => p._id) };
//     }

//     // 4. กรองตาม Warehouse และ วันที่ (ใช้ last_in_date แทนเพื่อให้แม่นยำตามการนำเข้า)
//     if (warehouse) stockQuery.warehouse_id = warehouse;
//     if (start_date && end_date) {
//       stockQuery.last_in_date = {
//         // 🟢 เปลี่ยนจาก updatedAt เป็น last_in_date
//         $gte: new Date(start_date),
//         $lte: new Date(new Date(end_date).setHours(23, 59, 59)),
//       };
//     }

//     // 5. กรองตามสถานะ
//     if (status) {
//       if (status === "In Stock") stockQuery.quantity = { $gt: 0 };
//       else if (status === "Out of Stock") stockQuery.quantity = { $lte: 0 };
//     }

//     // 6. ดึงข้อมูล
//     const [stocks, total] = await Promise.all([
//       Stock.find(stockQuery)
//         .populate({
//           path: "product_id",
//           select: "product_code product_name file unit product_category",
//           populate: { path: "product_category", select: "master_name" },
//         })
//         .populate({ path: "warehouse_id", select: "warehouse_name" })
//         .sort({ last_in_date: -1 }) // 🟢 เรียงตามวันนำเข้าล่าสุด
//         .skip(skip)
//         .limit(limit)
//         .lean({ virtuals: true }),
//       Stock.countDocuments(stockQuery),
//     ]);

//     const baseUrl = `${req.protocol}://${req.get("host")}/uploads/product/`;

//     // 7. จัดรูปแบบข้อมูล
//     const formattedData = stocks.map((item) => {
//       const product = item.product_id || {};
//       const warehouse = item.warehouse_id || {};
//       const catObj = product.product_category || {};

//       let imageUrl = "";
//       if (product.file && product.file.length > 0) {
//         imageUrl = product.file[0].startsWith("http")
//           ? product.file[0]
//           : `${baseUrl}${product.file[0]}`;
//       }

//       const qty = item.quantity || 0;
//       const cost = item.cost || 0;
//       const sale_price = item.price || 0;

//       return {
//         _id: item._id,
//         image: imageUrl,
//         code: product.product_code || "-",
//         product_name: product.product_name || "-",
//         category: catObj.master_name || "-",
//         warehouse: warehouse.warehouse_name || "Unknown",

//         // 🟢 เปลี่ยนมาใช้วันที่นำเข้าล่าสุด
//         date: item.last_in_date || item.updatedAt,

//         unit: product.unit || "Pcs",
//         qty: qty,

//         // Cost Information
//         cost: cost,
//         amount: qty * cost,

//         // Sale Information
//         sale_price: sale_price,

//         // 🟢 เพิ่มน้ำหนักรวมส่งออกไปให้หน้าบ้าน
//         total_gross_weight: item.total_gross_weight || 0,

//         status: qty > 0 ? "In Stock" : "Out of Stock",
//       };
//     });

//     // 8. ส่ง Response
//     res.status(200).json({
//       success: true,
//       data: formattedData,
//       pagination: {
//         total_record: total,
//         total_page: Math.ceil(total / limit),
//         current_page: page,
//         limit: limit,
//       },
//     });
//   } catch (error) {
//     console.log("Inventory List Error:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

exports.getStockDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const stock = await Stock.findById(id)
      .populate({
        path: "warehouse_id",
        select: "warehouse_name",
      })
      .populate({
        path: "product_id",
        populate: [
          {
            path: "product_detail_id",
            populate: [
              { path: "masters.master_id", select: "master_name master_type" },
              { path: "primary_stone.stone_name", select: "master_name" },
              { path: "primary_stone.shape", select: "master_name" },
              { path: "primary_stone.size", select: "master_name" },
              { path: "primary_stone.color", select: "master_name" },
              { path: "primary_stone.cutting", select: "master_name" },
              { path: "primary_stone.quality", select: "master_name" },
              { path: "primary_stone.clarity", select: "master_name" },
            ],
          },
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

    // --- Helper Functions ---
    const getMasterName = (obj) =>
      obj && obj.master_name ? obj.master_name : "-";
    const findMaster = (type) => {
      if (!detail.masters) return "-";
      const found = detail.masters.find(
        (m) => m.master_id && m.master_id.master_type === type,
      );
      return found ? found.master_id.master_name : "-";
    };

    // --- จัด Format ข้อมูล (อัปเดตตาม Logic ใหม่) ---
    const responseData = {
      _id: stock._id,

      // 🟢 1. เปลี่ยนมาแสดงวันที่นำเข้าล่าสุด (ถ้าไม่มีให้ใช้ updatedAt)
      date: stock.last_in_date || stock.updatedAt,

      unit: detail.unit || "Pcs",
      qty: stock.quantity || 0,

      // 🟢 2. ต้นทุนเฉลี่ย (Weighted Average Cost)
      avg_cost: stock.cost || 0,
      total_cost_amount: (stock.quantity || 0) * (stock.cost || 0),

      // 🟢 3. ราคาขายเฉลี่ย (Weighted Average Price) - ดึงจาก Stock เป็นหลัก
      sale_price: stock.price || product.price || 0,
      total_sale_amount: (stock.quantity || 0) * (stock.price || 0),

      // 🟢 4. เพิ่มน้ำหนักรวมในคลัง (Total Weight)
      total_gross_weight: stock.total_gross_weight || 0,

      status: (stock.quantity || 0) > 0 ? "In Stock" : "Out of Stock",

      product_details: {
        category: product.product_category || "-",
        code: product.product_code || "-",
        product_name: product.product_name || "-",
        item_type: findMaster("item_type"),
        product_size: detail.size || "-",
        metal: findMaster("metal"),
        metal_color: findMaster("metal_color"),
        description: detail.description || "-",
        nwt: detail.net_weight || 0,
        gwt: detail.gross_weight || 0, // น้ำหนักต่อชิ้น (จาก Master)
      },

      stone_details: {
        stone_name: getMasterName(detail.primary_stone?.stone_name),
        shape: getMasterName(detail.primary_stone?.shape),
        size: getMasterName(detail.primary_stone?.size),
        s_weight: detail.primary_stone?.weight || 0,
        color: getMasterName(detail.primary_stone?.color),
        cutting: getMasterName(detail.primary_stone?.cutting),
        quality: getMasterName(detail.primary_stone?.quality),
        clarity: getMasterName(detail.primary_stone?.clarity),
      },

      accessories: (product.related_accessories || []).map((acc) => {
        const accProd = acc.product_id;
        const accDetail = accProd?.product_detail_id || {};
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

    res.status(200).json({ success: true, data: responseData });
  } catch (error) {
    console.log("Get Inventory Detail Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}; //เเสดงรายละเอียดของ Stock นั้นๆ

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

exports.exportStocksExcel = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id).select("comp_id");
    if (!currentUser || !currentUser.comp_id) {
      return res
        .status(403)
        .json({ success: false, message: "Company not found" });
    }

    const { warehouse_type } = req.query;
    let queryCondition = { comp_id: currentUser.comp_id };

    if (warehouse_type) {
      const warehouses = await Warehouse.find({
        comp_id: currentUser.comp_id,
        warehouse_type: warehouse_type,
      }).select("_id");

      const warehouseIds = warehouses.map((w) => w._id);
      queryCondition.warehouse_id = { $in: warehouseIds };
    }

    // 🟢 1. ดึง product_code มาด้วยใน .populate()
    const stocks = await Stock.find(queryCondition)
      .populate("warehouse_id", "warehouse_name warehouse_type")
      .populate("product_id", "product_name product_code")
      .sort({ createdAt: -1 });

    if (stocks.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No stocks found to export." });
    }

    const workbook = new excelJS.Workbook();
    const sheetName = warehouse_type
      ? `Stocks - ${warehouse_type}`
      : "All Stocks";
    const worksheet = workbook.addWorksheet(sheetName);

    // 🟢 2. เพิ่มคอลัมน์ Product Code ใน Excel
    worksheet.columns = [
      { header: "Warehouse Type", key: "warehouse_type", width: 15 },
      { header: "Warehouse Name", key: "warehouse_name", width: 20 },
      { header: "Product Code", key: "product_code", width: 20 },
      { header: "Product Name", key: "product_name", width: 35 },
      { header: "Quantity", key: "quantity", width: 15 },
      { header: "Total Gross Weight", key: "total_gross_weight", width: 20 },
      { header: "Avg Cost", key: "cost", width: 15 },
      { header: "Total Cost Amount", key: "amount", width: 20 },
      { header: "Avg Price", key: "price", width: 15 },
      { header: "Total Sale Price", key: "total_sale_price", width: 20 },
      { header: "Last In Date", key: "last_in_date", width: 20 },
    ];

    worksheet.getRow(1).font = { bold: true };

    // 🟢 3. ดึงค่า product_code มาใส่ในแต่ละบรรทัด
    stocks.forEach((stock) => {
      worksheet.addRow({
        warehouse_type: stock.warehouse_id?.warehouse_type || "-",
        warehouse_name: stock.warehouse_id?.warehouse_name || "-",

        product_code: stock.product_id?.product_code || "-", // เพิ่มตรงนี้
        product_name: stock.product_id?.product_name || "-",

        quantity: stock.quantity,
        total_gross_weight: stock.total_gross_weight,
        cost: stock.cost,
        amount: stock.amount,
        price: stock.price,
        total_sale_price: stock.total_sale_price,

        last_in_date: stock.last_in_date
          ? new Date(stock.last_in_date).toLocaleDateString("th-TH")
          : "-",
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Stocks_${warehouse_type || "All"}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (err) {
    console.error("Export Stocks Excel Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error during export" });
  }
};
