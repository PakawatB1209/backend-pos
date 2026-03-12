const Purchase = require("../models/Purchase");
const User = require("../models/User");
const ExchangeRate = require("../models/ExchangeRate");
const Order = require("../models/Order");
const Customer = require("../models/Customer");
const Masters = require("../models/masters");
const Product = require("../models/Product");
const ExcelJS = require("exceljs");

exports.getDayBookList = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("comp_id");
    if (!user || !user.comp_id)
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    const comp_id = user.comp_id;

    const { search, startDate, endDate } = req.query;
    let query = { comp_id };

    if (search) {
      query.$or = [
        { purchase_number: { $regex: search, $options: "i" } },
        { vendor_name: { $regex: search, $options: "i" } },
        { note: { $regex: search, $options: "i" } },
      ];
    }

    if (startDate && endDate) {
      query.date = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    const purchases = await Purchase.find(query)
      .select(
        "purchase_number date vendor_name total_amount currency note items",
      )
      .populate("created_by", "username")
      .sort({ date: -1, createdAt: -1 });

    const formattedData = purchases.map((item) => {
      return {
        _id: item._id,
        purchase_number: item.purchase_number,
        date: item.date,
        vendor: item.vendor_name || "-",
        currency: item.currency || "THB",
        amount: item.total_amount || 0,
        note: item.note || "-",
        items_count: item.items ? item.items.length : 0,
      };
    });

    res.status(200).json({
      success: true,
      count: formattedData.length,
      data: formattedData,
    });
  } catch (error) {
    console.error("Report Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error getting day book report",
      error: error.message,
    });
  }
};

exports.getOrderReport = async (req, res) => {
  try {
    // 1. ตรวจสอบสิทธิ์การใช้งาน (ต้องล็อกอิน)
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: No User ID" });
    }

    const currentUser = await User.findById(req.user.id)
      .select("comp_id")
      .lean();
    if (!currentUser || !currentUser.comp_id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing Company ID in DB",
      });
    }
    const comp_id = currentUser.comp_id; // ได้ comp_id มาแล้ว!

    // 2. รับค่าพารามิเตอร์จากหน้าบ้าน
    const { order_type, page = 1, limit = 20 } = req.query;

    // 3. คำนวณสำหรับการแบ่งหน้า
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // 4. สร้างเงื่อนไขในการค้นหา (ใช้ comp_id ที่หามาได้)
    const query = { comp_id: comp_id };

    if (order_type) {
      query.order_type = order_type;
    }

    // 5. นับจำนวนบิลทั้งหมด
    const totalOrders = await Order.countDocuments(query);

    // 6. ดึงข้อมูลจาก Database พร้อมเชื่อมโยง
    const orders = await Order.find(query)
      .populate("customer_id", "customer_name")
      .populate("sale_staff_id", "username")
      .populate("items.custom_spec.item_type_id", "master_name")
      .populate("items.custom_spec.metal_id", "master_name")
      .populate("items.custom_spec.stone_name_id", "master_name")
      .populate("items.custom_spec.stone_shape_id", "master_name")
      .populate("items.custom_spec.cutting", "master_name")
      .populate("items.custom_spec.quality", "master_name")
      .populate("items.custom_spec.clarity", "master_name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber);
    // 7. แปลงรูปแบบข้อมูลให้ตรงกับ DataGrid
    const formattedOrders = orders.map((order) => {
      const headerAmount =
        order.order_type === "Custom"
          ? order.total_deposit || 0
          : order.grand_total || 0;

      const formattedItems = order.items.map((item) => {
        const spec = item.custom_spec || {};
        return {
          _id: item._id,
          sell_id: order.order_no,
          customer: order.customer_id?.customer_name || "-",
          date: order.order_date,

          image: item.image,
          code: item.product_code,
          product_name: item.product_name,

          category: spec.item_type_name || "-",
          item_type: spec.item_type_name || "-",
          product_size: spec.size || spec.product_size || "-",
          metal: spec.metal_name || "-",
          metal_color: spec.metal_color || "-",
          gwt: spec.gwt || 0,
          nwt: spec.nwt || 0,

          stone_name: spec.stone_name || "-",
          shape: spec.stone_shape_name || "-",
          size: spec.stone_size || "-",
          s_weight: spec.s_weight || 0,
          color: spec.stone_color || "-",
          cutting: spec.cutting_name || "-",
          quality: spec.quality_name || "-",
          clarity: spec.clarity_name || "-",

          qty: item.qty || 1,
          tax: order.tax_rate ? `${order.tax_rate}%` : "0%",
          price: item.original_price || item.unit_price || 0,
          discount:
            item.discount_percent && item.discount_percent > 0
              ? `${item.discount_percent}%`
              : item.discount_amount || 0,
          deposit: item.deposit || 0,
          total_deposit: item.total_deposit || item.qty * (item.deposit || 0),
          amount:
            order.order_type === "Custom"
              ? item.total_deposit || item.qty * (item.deposit || 0)
              : item.total_item_price || 0,
        };
      });

      return {
        _id: order._id,
        order_no: order.order_no,
        order_date: order.order_date,
        customer_name: order.customer_id?.customer_name || "-",
        total_items: order.total_items || 0,
        header_amount: headerAmount,
        order_type: order.order_type,
        items: formattedItems,
      };
    });

    // 8. ส่งข้อมูลกลับไปให้หน้าบ้าน
    res.json({
      success: true,
      count: formattedOrders.length,
      total: totalOrders,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(totalOrders / limitNumber) || 1, // กันกรณีหาร 0 แล้วได้ Infinity
        limit: limitNumber,
      },
      data: formattedOrders,
    });
  } catch (error) {
    console.error("Get Custom Order Report Error:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

exports.exportOrderReportExcel = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: No User ID" });
    }
    const currentUser = await User.findById(req.user.id)
      .select("comp_id")
      .lean();
    if (!currentUser || !currentUser.comp_id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing Company ID in Database",
      });
    }
    const comp_id = currentUser.comp_id;

    // รับค่า order_type จาก URL (เช่น ?order_type=Sell หรือ ?order_type=Custom)
    const { order_type } = req.query;
    const query = { comp_id: comp_id };

    if (order_type) {
      query.order_type = order_type;
    }

    const orders = await Order.find(query)
      .populate("customer_id", "customer_name") // 🟢 แก้เป็น customer_name ให้แล้ว
      .populate("sale_staff_id", "username")
      .populate("items.custom_spec.item_type_id", "master_name")
      .populate("items.custom_spec.metal_id", "master_name")
      .populate("items.custom_spec.stone_name_id", "master_name")
      .populate("items.custom_spec.stone_shape_id", "master_name")
      .populate("items.custom_spec.cutting", "master_name")
      .populate("items.custom_spec.quality", "master_name")
      .populate("items.custom_spec.clarity", "master_name")
      .sort({ createdAt: -1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${order_type || "All"}_Report`);

    worksheet.columns = [
      { header: "Order ID", key: "order_no", width: 15 },
      { header: "Date", key: "date", width: 20 },
      { header: "Customer", key: "customer", width: 25 },
      { header: "Product Code", key: "code", width: 15 },
      { header: "Product Name", key: "product_name", width: 30 },
      { header: "Category", key: "category", width: 15 },
      { header: "Item Type", key: "item_type", width: 15 },
      { header: "Metal", key: "metal", width: 15 },
      { header: "Metal Color", key: "metal_color", width: 15 },
      { header: "Stone Name", key: "stone_name", width: 15 },
      { header: "Shape", key: "shape", width: 15 },
      { header: "Qty", key: "qty", width: 10 },
      { header: "Price", key: "price", width: 15 },
      { header: "Discount", key: "discount", width: 15 },
      { header: "Amount", key: "amount", width: 15 },
      { header: "Total Order Amount", key: "total_order_amount", width: 20 },
    ];

    orders.forEach((order) => {
      const headerAmount =
        order.order_type === "Custom"
          ? order.total_deposit || 0
          : order.grand_total || 0;

      order.items.forEach((item) => {
        const spec = item.custom_spec || {};

        const discountStr =
          item.discount_percent && item.discount_percent > 0
            ? `${item.discount_percent}%`
            : item.discount_amount || 0;

        // 🟢 แก้ไขยอด Amount รายชิ้น ให้ดึง total_deposit มาใช้ (ถ้าเป็น Custom)
        const itemAmount =
          order.order_type === "Custom"
            ? item.total_deposit || item.qty * item.deposit || 0
            : item.total_item_price || 0;

        worksheet.addRow({
          order_no: order.order_no,
          date: order.order_date
            ? new Date(order.order_date).toLocaleString("en-GB")
            : "-",
          customer: order.customer_id?.customer_name || "-", // 🟢 แก้เป็น customer_name
          code: item.product_code,
          product_name: item.product_name,
          category: spec.item_type_name || "-",
          item_type: spec.item_type_name || "-",
          metal: spec.metal_name || "-",
          metal_color: spec.metal_color || "-",
          stone_name: spec.stone_name || "-",
          shape: spec.stone_shape_name || "-",
          qty: item.qty || 1,
          price: item.original_price || item.unit_price || 0,
          discount: discountStr,
          amount: itemAmount,
          total_order_amount: headerAmount,
        });
      });
    });

    worksheet.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${order_type || "Order"}_Report.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export Excel Error:", error);
    res.status(500).json({ success: false, message: "Export failed" });
  }
};
