const Purchase = require("../models/Purchase");
const User = require("../models/User");
const ExchangeRate = require("../models/ExchangeRate");
const Order = require("../models/Order");
const Customer = require("../models/Customer");
const Masters = require("../models/masters");
const Product = require("../models/Product");

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

exports.getCustomOrderReport = async (req, res) => {
  try {
    if (!req.user || !req.user.comp_id) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: Missing Company ID" });
    }

    // รับค่า page และ limit จาก query (ถ้าไม่ส่งมา ให้ค่าเริ่มต้นเป็น หน้า 1 หน้าละ 20 รายการ)
    const { order_type, page = 1, limit = 20 } = req.query;

    // แปลงเป็นตัวเลข
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    // คำนวณข้าม (Skip) ข้อมูลของหน้าก่อนๆ
    const skip = (pageNumber - 1) * limitNumber;

    const query = { comp_id: req.user.comp_id };

    if (order_type) {
      query.order_type = order_type;
    }

    // นับจำนวนออเดอร์ทั้งหมดก่อน (เพื่อให้หน้าบ้านรู้ว่ามีกี่หน้า)
    const totalOrders = await Order.countDocuments(query);

    // ดึงข้อมูลพร้อมใส่ .skip() และ .limit()
    const orders = await Order.find(query)
      .populate("customer_id", "name")
      .populate("sale_staff_id", "username")
      .populate("items.custom_spec.item_type_id", "master_name")
      .populate("items.custom_spec.metal_id", "master_name")
      .populate("items.custom_spec.stone_name_id", "master_name")
      .populate("items.custom_spec.stone_shape_id", "master_name")
      .populate("custom_spec.cutting", "master_name")
      .populate("items.custom_spec.quality", "master_name")
      .populate("items.custom_spec.clarity", "master_name")
      .populate(
        "items.custom_spec.additional_stones.stone_name_id",
        "master_name",
      )
      .populate(
        "items.custom_spec.additional_stones.stone_shape_id",
        "master_name",
      )
      .populate("items.custom_spec.additional_stones.cutting", "master_name")
      .populate("items.custom_spec.additional_stones.quality", "master_name")
      .populate("items.custom_spec.additional_stones.clarity", "master_name")
      .sort({ createdAt: -1 })
      .skip(skip) // ข้ามข้อมูลหน้าก่อนหน้า
      .limit(limitNumber); // ดึงมาแค่จำนวน limit ที่กำหนด

    // ส่งข้อมูลกลับไปพร้อม Meta Data สำหรับทำปุ่มเปลี่ยนหน้า
    res.json({
      success: true,
      count: orders.length, // จำนวนรายการในหน้านี้
      total: totalOrders, // จำนวนออเดอร์ทั้งหมดในระบบ (ที่ตรงเงื่อนไข)
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(totalOrders / limitNumber), // หารปัดเศษขึ้นเพื่อหาจำนวนหน้าทั้งหมด
        limit: limitNumber,
      },
      data: orders,
    });
  } catch (error) {
    console.error("Get Custom Order Report Error:", error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงข้อมูลรายงาน",
      error: error.message,
    });
  }
};
