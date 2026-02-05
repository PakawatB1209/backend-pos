const Purchase = require("../models/Purchase");
const User = require("../models/User");
const ExchangeRate = require("../models/ExchangeRate");

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
