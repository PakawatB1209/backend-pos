const Stock = require("../models/Stock");
const StockTransaction = require("../models/StockTransaction");
const User = require("../models/User");
const mongoose = require("mongoose");
const xlsx = require("xlsx-js-style");
const Product = require("../models/Product");

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
        select: "product_code product_name file price", // เลือกฟิลด์ที่หน้าบ้านต้องใช้
        // ถ้าต้องการ detail ลึกๆ เช่น size/unit ก็ซ้อน populate เข้าไปอีกได้
        // populate: { path: "product_detail_id" }
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
    const userId = req.user.id;
    const user = await User.findById(userId).select("comp_id");

    if (!user || !user.comp_id) {
      return res
        .status(400)
        .json({ success: false, message: "User not associated with company" });
    }

    const stock = await Stock.find({ comp_id: user.comp_id })
      .populate({
        path: "product_id",
        select: "product_code product_name file",
      })
      .populate({
        path: "warehouse_id",
        select: "warehouse_name",
      });

    res.status(200).json({
      success: true,
      data: stock,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.removeOneStock = async (req, res) => {
  try {
    const id = req.params.id;
    const comp_id = req.user.comp_id; // 1. ต้องเอา comp_id มาด้วยเสมอ

    // 2. ลบโดยระบุทั้ง ID และ Company ID (ป้องกันการลบข้ามบริษัท)
    const remove_stock = await Stock.findOneAndDelete({
      _id: id,
      comp_id: comp_id,
    });

    // 3. เช็คว่าเจอของให้ลบไหม
    if (!remove_stock) {
      return res
        .status(404)
        .send(
          "Data not found or you do not have permission to delete this item.",
        );
    }

    res.send(remove_stock);
  } catch (err) {
    // 4. 🟢 แก้ตรงนี้ให้ชื่อตรงกับข้างใน (เปลี่ยน error เป็น err)
    console.log(err);
    res.status(500).send("Server error");
  }
};

exports.removeStockAll = async (req, res) => {
  try {
    // 1. Auth & Get Comp ID
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

    // ------------------ 🔍 ZONE DEBUG (เริ่ม) ------------------
    console.log("\n====== DEBUG REMOVE ALL ======");
    console.log("1. User Comp ID:", comp_id, `(Type: ${typeof comp_id})`);
    console.log("2. IDs ที่ส่งมาลบ:", ids);

    // ลองค้นหา Stock ดูซิว่ามีของไหม (แบบไม่สน Comp ID)
    const checkStocks = await Stock.find({ _id: { $in: ids } });
    console.log(`3. พบสินค้าใน DB จำนวน: ${checkStocks.length} รายการ`);

    if (checkStocks.length > 0) {
      checkStocks.forEach((s, index) => {
        console.log(`   [รายการที่ ${index + 1}] ID: ${s._id}`);
        console.log(
          `   - Stock Comp ID: ${s.comp_id} (Type: ${typeof s.comp_id})`,
        );

        // เปรียบเทียบให้ดูชัดๆ (แปลงเป็น String ก่อนเทียบ)
        const isMatch = String(s.comp_id) === String(comp_id);
        console.log(
          `   - Comp ID ตรงกันไหม?: ${isMatch ? "✅ ตรง" : "❌ ไม่ตรง"}`,
        );
      });
    } else {
      console.log("❌ ไม่พบสินค้า ID เหล่านี้ในระบบเลย (ID ผิด)");
    }
    console.log("================================\n");
    // ------------------ 🔍 ZONE DEBUG (จบ) ------------------

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).send("Please provide an array of IDs.");
    }

    // คำสั่งลบจริง
    const result = await Stock.deleteMany({
      _id: { $in: ids },
      comp_id: comp_id, // <--- ตรงนี้แหละที่มันเช็คแล้วไม่ผ่าน
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
