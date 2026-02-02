const Purchase = require("../models/Purchase");
// 👇 เพิ่มบรรทัดนี้เข้าไปครับ (สำคัญมาก)
const User = require("../models/User");

exports.getDayBookList = async (req, res) => {
  try {
    // 1. ตรวจสอบ User
    const user = await User.findById(req.user.id).select("comp_id");

    if (!user || !user.comp_id) {
      return res
        .status(400)
        .json({ success: false, message: "User not associated with company" });
    }

    const comp_id = user.comp_id;

    // 2. สร้าง Query
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
        "purchase_number date vendor_name total_amount note items created_by",
      )
      .populate("created_by", "username")
      .sort({ date: -1, createdAt: -1 });

    const formattedData = purchases.map((item) => {
      return {
        _id: item._id,
        purchase_number: item.purchase_number,
        date: item.date,
        vendor: item.vendor_name || "-",
        currency: "THB", // Fix เป็น THB ตามโจทย์
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
