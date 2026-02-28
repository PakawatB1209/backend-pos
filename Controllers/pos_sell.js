const SellSession = require("../models/SellSession");
const Product = require("../models/Product");
const User = require("../models/User");
const Stock = require("../models/Stock");
const Order = require("../models/Order");
const mongoose = require("mongoose");
const { generateOrderNumber } = require("./pos_custom");

exports.searchProductsForSell = async (req, res) => {
  try {
    if (!req.user || !req.user.comp_id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { keyword } = req.query; // คำที่พิมพ์ในช่องค้นหา
    const comp_id = req.user.comp_id;

    //หาเฉพาะสินค้าที่ Active และตรงกับบริษัท
    let query = {
      comp_id: comp_id,
      is_active: true,
    };

    if (keyword) {
      query.$or = [
        { product_name: { $regex: keyword, $options: "i" } },
        { product_code: { $regex: keyword, $options: "i" } },
      ];
    }

    // ค้นหาจากตาราง Product
    const products = await Product.find(query)
      .populate("product_category", "master_name")
      .select("product_code product_name file product_category")
      .limit(20)
      .lean();

    // เอา ID สินค้าที่หาเจอ ไปควานหาในตาราง Stock ต่อ
    const productIds = products.map((p) => p._id);
    const stocks = await Stock.find({
      comp_id: comp_id,
      product_id: { $in: productIds },
    }).lean();

    const baseUrl = `${req.protocol}://${req.get("host")}/uploads/product/`;

    // แปลงข้อมูลและแนบจำนวน/ราคาจาก Stock เข้าไปด้วย
    let formattedData = products.map((prod) => {
      let coverImage = null;
      if (prod.file && prod.file.length > 0) {
        coverImage = prod.file[0].startsWith("http")
          ? prod.file[0]
          : `${baseUrl}${prod.file[0]}`;
      }

      // หาสต็อกของสินค้านี้
      const prodStock = stocks.find(
        (s) => s.product_id.toString() === prod._id.toString(),
      );

      return {
        product_id: prod._id,
        product_code: prod.product_code,
        product_name: prod.product_name,
        category_name: prod.product_category?.master_name || "-",
        image: coverImage,
        // แนบ Stock และ Price ไปให้หน้าบ้าน
        qty_in_stock: prodStock ? prodStock.quantity : 0,
        unit_price: prodStock ? prodStock.price : 0,
      };
    });

    // (Optional) ถ้าอยากให้ซ่อนสินค้าที่สต็อกหมด (qty = 0) ไม่ให้โชว์ใน Dropdown เลย ให้เปิดคอมเมนต์บรรทัดนี้ครับ:
    // formattedData = formattedData.filter((item) => item.qty_in_stock > 0);

    res.json({ success: true, data: formattedData });
  } catch (error) {
    console.error("Search Products Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// กดปุ่ม Sell เพื่อเพิ่มลงตะกร้า (จากหน้า Inventory)
exports.addToSellSession = async (req, res) => {
  try {
    const { product_id, unit_price = 0, original_price = 0 } = req.body; // รับ unit_price มาด้วย (เผื่อหน้าบ้านส่งมา)
    const user = await User.findById(req.user.id).select("comp_id").lean();

    const existingItem = await SellSession.findOne({
      comp_id: user.comp_id,
      sales_staff_id: req.user.id,
      product_id: product_id,
    });

    if (existingItem) {
      // ถ้ามีแล้ว ให้บวกจำนวน (qty) เพิ่มขึ้น 1
      existingItem.qty += 1;
      // 🟢 อย่าลืมอัปเดตราคารวมด้วย
      existingItem.total_item_price =
        existingItem.qty * existingItem.unit_price;
      await existingItem.save();
    } else {
      // ถ้ายังไม่มี ให้สร้างรายการใหม่ในตะกร้า
      await SellSession.create({
        comp_id: user.comp_id,
        sales_staff_id: req.user.id,
        product_id: product_id,
        qty: 1,
        original_price: Number(original_price) || Number(unit_price),
        // 🟢 ต้องเก็บราคาต่อหน่วยและราคารวมด้วยครับ
        unit_price: Number(unit_price),
        total_item_price: Number(unit_price),
      });
    }

    const count = await SellSession.countDocuments({
      comp_id: user.comp_id,
      sales_staff_id: req.user.id,
    });

    res.json({ success: true, status: "ADDED", badge_count: count });
  } catch (error) {
    console.error("Add to Sell Session Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ดึงข้อมูลมาแสดงในหน้า Order Details (ดึงรายการในตะกร้า)
exports.getSellSessionList = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("comp_id").lean();
    const baseUrl = `${req.protocol}://${req.get("host")}/uploads/product/`;

    const items = await SellSession.find({
      comp_id: user.comp_id,
      sales_staff_id: req.user.id,
    })
      .populate({
        path: "product_id",
        select: "product_code product_name file product_detail_id",
        populate: {
          path: "product_detail_id",
          select: "price size primary_stone color",
          populate: [
            { path: "primary_stone.stone_name", select: "master_name" },
            { path: "masters.master_id", select: "master_name" },
          ],
        },
      })
      .sort({ createdAt: -1 })
      .lean();

    // ดึงสต็อกมาเพื่อตรวจสอบและส่งราคาที่แท้จริงกลับไป
    const productIds = items.map((i) => i.product_id?._id).filter(Boolean);
    const stocks = await Stock.find({
      comp_id: user.comp_id,
      product_id: { $in: productIds },
    }).lean();

    const formattedData = items.map((item) => {
      const prod = item.product_id || {};
      const detail = prod.product_detail_id || {};

      // จัดการรูปภาพ
      let imgUrl = null;
      if (prod.file && prod.file.length > 0) {
        imgUrl = prod.file[0].startsWith("http")
          ? prod.file[0]
          : `${baseUrl}${prod.file[0]}`;
      }

      // หา ราคา และ จำนวนในสต็อกปัจจุบัน
      const prodStocks = stocks.filter(
        (s) => s.product_id.toString() === prod._id.toString(),
      );
      const stockPrice =
        prodStocks.length > 0 ? prodStocks[0].price : detail.price || 0;
      const maxStockQty = prodStocks.reduce((sum, s) => sum + s.quantity, 0);

      // ดึงรายละเอียดเพื่อแสดงใต้ชื่อ (เช่น Ruby Gold 18mm)
      const stoneName = detail.primary_stone?.stone_name?.master_name || "";
      const color = detail.color || ""; // หน้าบ้านอาจจะต้องผสมสีเอง
      const size = detail.size || "";
      const subtitle = `${stoneName} ${color} ${size}`.trim();

      return {
        session_id: item._id,
        customer_id: item.customer_id,
        product_id: prod._id,
        product_code: prod.product_code,
        product_name: prod.product_name,
        subtitle: subtitle, // สำหรับแสดงข้อความสีเทาๆ ใต้ชื่อสินค้า
        image: imgUrl,

        qty: item.qty,
        max_qty: maxStockQty, // ส่งไปบอกหน้าบ้านว่ากดบวกเพิ่มได้สูงสุดกี่ชิ้น

        unit_price: stockPrice,
        discount_percent: item.discount_percent,
        discount_amount: item.discount_amount,
      };
    });

    const subTotal = formattedData.reduce(
      (sum, i) => sum + i.qty * i.unit_price,
      0,
    );

    res.json({
      success: true,
      data: formattedData,
      summary: {
        sub_total: subTotal,
        tax_rate: 7,
      },
    });
  } catch (error) {
    console.error("Get Sell Session Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// อัปเดตข้อมูลรายชิ้น (เพิ่ม/ลด Qty หรือ ใส่ส่วนลด)
exports.updateSellSessionItem = async (req, res) => {
  try {
    const { session_id } = req.params;
    const { qty, discount_percent, discount_amount } = req.body;

    const updateData = {};
    if (qty !== undefined) updateData.qty = qty;
    if (discount_percent !== undefined)
      updateData.discount_percent = discount_percent;
    if (discount_amount !== undefined)
      updateData.discount_amount = discount_amount;

    await SellSession.findByIdAndUpdate(session_id, { $set: updateData });

    res.json({ success: true, message: "Item updated" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ลบสินค้า 1 ชิ้น (กดไอคอนถังขยะ)
exports.deleteSellSessionItem = async (req, res) => {
  try {
    const { session_id } = req.params;
    await SellSession.findByIdAndDelete(session_id);
    res.json({ success: true, message: "Item removed" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ล้างตะกร้าทั้งหมด (กดปุ่ม Clear มุมซ้ายล่าง)
exports.clearSellSession = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("comp_id").lean();
    await SellSession.deleteMany({
      comp_id: user.comp_id,
      sales_staff_id: req.user.id,
    });
    res.json({ success: true, message: "Cart cleared" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// กดปุ่ม Check out (ออกบิลขาย และ ตัดสต็อก)
exports.finishSellOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("comp_id user_name").lean();
    const {
      customer_id,
      items,
      sub_total,
      discount_total,
      tax_rate = 7,
      tax_amount,
      grand_total,
      remark,
    } = req.body;

    if (!customer_id) throw new Error("กรุณาเลือกลูกค้าก่อนทำรายการ");
    if (!items || items.length === 0) throw new Error("ไม่มีสินค้าในตะกร้า");

    const orderNo = await generateOrderNumber(user.comp_id, "ORD");
    let orderItems = [];

    for (const item of items) {
      // ตัดสต็อก
      const stockItem = await Stock.findOne({
        product_id: item.product_id,
        comp_id: user.comp_id,
      }).session(session);

      if (!stockItem || stockItem.quantity < item.qty) {
        throw new Error(
          `สินค้า ${item.product_name} คงเหลือไม่พอ (เหลือ ${stockItem ? stockItem.quantity : 0})`,
        );
      }

      stockItem.quantity -= item.qty;
      await stockItem.save({ session });

      // ดึงข้อมูลสินค้าต้นทางมาทำ Snapshot ให้ Sell Order
      const productDetail = await mongoose
        .model("product")
        .findById(item.product_id)
        .populate("item_type_id", "master_name")
        .populate("metal_id", "master_name")
        .session(session);

      let sellSpec = {};
      if (productDetail) {
        sellSpec = {
          item_type_id: productDetail.item_type_id?._id,
          item_type_name: productDetail.item_type_id?.master_name,
          metal_id: productDetail.metal_id?._id,
          metal_name: productDetail.metal_id?.master_name,
          metal_color: productDetail.metal_color,
          size: productDetail.size,
        };
      } else if (item.custom_spec) {
        sellSpec = item.custom_spec; // กรณีหน้าบ้านส่งมาครบ
      }

      orderItems.push({
        product_id: item.product_id,
        product_code: item.product_code,
        product_name: item.product_name,
        image: item.image,
        qty: item.qty,
        original_price: item.original_price || item.unit_price,
        discount_percent: item.discount_percent || 0,
        discount_amount: item.discount_amount || 0,
        unit_price: item.unit_price,
        total_item_price: item.qty * item.unit_price,
        custom_spec: sellSpec, // ยัดสเปกที่ดึงมาใส่บิล
      });
    }

    const newOrder = new Order({
      comp_id: user.comp_id,
      sale_staff_id: userId,
      sale_staff_name: user.user_name,
      customer_id,
      order_no: orderNo,
      order_type: "Sell",
      items: orderItems,
      sub_total,
      discount_total,
      tax_total: tax_amount || 0,
      tax_rate: tax_rate,
      grand_total,
      remark,
      order_status: "Completed",
      payment_status: "Paid",
    });

    await newOrder.save({ session });
    await SellSession.deleteMany({
      comp_id: user.comp_id,
      sales_staff_id: userId,
    }).session(session);
    await session.commitTransaction();

    res.json({ success: true, message: "ขายสำเร็จ", order_no: orderNo });
  } catch (error) {
    await session.abortTransaction();
    console.error("Check out Error:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};
