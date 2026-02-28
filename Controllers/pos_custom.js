const Product = require("../models/Product");
const ProductDetail = require("../models/Product_detail");
const User = require("../models/User");
const mongoose = require("mongoose");
const CustomSession = require("../models/CustomSession");
const Order = require("../models/Order");

//ระบบจองสินค้า (Badge System)
exports.addToCustomSession = async (req, res) => {
  try {
    const { product_id } = req.body;
    const user = await User.findById(req.user.id).select("comp_id").lean();

    const newSession = await CustomSession.create({
      comp_id: user.comp_id,
      sales_staff_id: req.user.id,
      product_id: product_id,
      customer_id: null,
    });

    const count = await CustomSession.countDocuments({
      comp_id: user.comp_id,
      sales_staff_id: req.user.id,
    });

    return res.json({
      success: true,
      status: "ADDED",
      badge_count: count,
      session_id: newSession._id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
}; // กดปุ่ม Custom (หน้า List)

exports.getCustomSessionList = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("comp_id").lean();

    const items = await CustomSession.find({
      comp_id: user.comp_id,
      sales_staff_id: req.user.id,
    })
      .populate({
        path: "product_id",
        select:
          "product_code product_name file price product_detail_id product_category product_item_type",
        populate: [
          { path: "product_category", select: "master_name" },
          { path: "product_item_type", select: "master_name" },
        ],
      })
      .sort({ createdAt: -1 });

    const baseUrl = `${req.protocol}://${req.get("host")}/uploads/product/`;

    const formattedData = items.map((item) => {
      const prod = item.product_id || {};
      let imgUrl = null;
      if (prod.file && prod.file.length > 0) {
        imgUrl = prod.file[0].startsWith("http")
          ? prod.file[0]
          : `${baseUrl}${prod.file[0]}`;
      }

      return {
        session_id: item._id,
        product_id: prod._id,
        product_code: prod.product_code,
        product_name: prod.product_name,
        image: imgUrl,
        is_saved: item.is_saved,
        item_type: prod.product_item_type?.master_name || "-",
        category: prod.product_category?.master_name || "-",
      };
    });

    res.json({
      success: true,
      count: formattedData.length,
      data: formattedData,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
}; // แสดง List ซ้ายมือ (หน้า Editor)

exports.clearCustomSession = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findById(req.user.id).select("comp_id").lean();

    const activeSessions = await CustomSession.find({
      comp_id: user.comp_id,
      sales_staff_id: req.user.id,
    });

    for (const s of activeSessions) {
      const productId = s.product_id;

      const product = await Product.findById(productId);
      if (product && product.is_custom) {
        if (product.product_detail_id) {
          await ProductDetail.findByIdAndDelete(product.product_detail_id, {
            session,
          });
        }
        await Product.findByIdAndDelete(productId, { session });
      }

      await CustomSession.findByIdAndDelete(s._id, { session });
    }

    await session.commitTransaction();
    res.json({ success: true, message: "ล้างรายการเก่าเรียบร้อย" });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: "Error clearing session" });
  } finally {
    session.endSession();
  }
}; // ล้างสินค้า custom เก่าทั้งหมด

exports.deleteCustomSessionItem = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { session_id } = req.params;
    const user = await User.findById(req.user.id).select("comp_id").lean();

    const targetSession = await CustomSession.findById(session_id);
    if (!targetSession) {
      return res
        .status(404)
        .json({ success: false, message: "ไม่พบรายการที่ต้องการลบ" });
    }

    const productId = targetSession.product_id;

    const product = await Product.findById(productId);
    if (product && product.is_custom) {
      if (product.product_detail_id) {
        await ProductDetail.findByIdAndDelete(product.product_detail_id, {
          session,
        });
      }
      await Product.findByIdAndDelete(productId, { session });
    }

    await CustomSession.findByIdAndDelete(session_id, { session });

    const remainingCount = await CustomSession.countDocuments({
      comp_id: user.comp_id,
      sales_staff_id: req.user.id,
    }).session(session);

    await session.commitTransaction();

    res.json({
      success: true,
      message: "ลบรายการเรียบร้อย",
      badge_count: remainingCount,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Delete Item Error:", error);
    res.status(500).json({ success: false, message: "Error deleting item" });
  } finally {
    session.endSession();
  }
}; // ล้างสินค้า custom ที่ละตัว

exports.saveCustomProduct = async (req, res) => {
  try {
    const { session_id, customer_id, detail_data } = req.body;

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        message: "กรุณาเลือกลูกค้าก่อนบันทึกรายการ (Customer is required)",
      });
    }

    // บันทึก JSON สเปกลงใน CustomSession เท่านั้น (ไม่ยุ่งกับ Product Master)
    const updatedSession = await CustomSession.findByIdAndUpdate(
      session_id,
      {
        is_saved: true,
        customer_id: customer_id,
        custom_spec: detail_data || {},
      },
      { new: true },
    );

    res.json({
      success: true,
      message: "บันทึกสเปกลงตะกร้าเรียบร้อย",
      data: updatedSession,
    });
  } catch (error) {
    console.error("Save Custom Error:", error);
    res.status(500).json({ success: false, message: "Save Failed" });
  }
}; // เรียกตอนกด "Save" ในหน้า Editor

exports.updateCustomSessionQty = async (req, res) => {
  try {
    const { session_id } = req.params;
    const { qty } = req.body;

    if (qty === undefined || qty < 1) {
      return res
        .status(400)
        .json({ success: false, message: "จำนวนต้องไม่น้อยกว่า 1" });
    }

    await CustomSession.findByIdAndUpdate(session_id, { $set: { qty: qty } });

    res.json({ success: true, message: "อัปเดตจำนวนเรียบร้อย" });
  } catch (error) {
    console.error("Update Custom Qty Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
}; // อัปเดตจำนวน (Qty) ในหน้าตะกร้า Custom (ปุ่ม + / -)

exports.generateOrderNumber = async (comp_id, typeCode = "ORD") => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const prefix = `${typeCode}${year}${month}${day}`;

  const lastOrder = await Order.findOne({
    comp_id,
    order_no: { $regex: `^${prefix}` },
  }).sort({ order_no: -1 });

  let nextSeq = 1;
  if (lastOrder) {
    const lastSeqStr = lastOrder.order_no.split("-")[1];
    nextSeq = parseInt(lastSeqStr, 10) + 1;
  }

  return `${prefix}-${String(nextSeq).padStart(4, "0")}`;
};

exports.finishCustomOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("comp_id").lean();
    const {
      customer_id,
      items,
      sub_total,
      discount_total,
      grand_total,
      remark,
    } = req.body;

    if (!customer_id) throw new Error("กรุณาเลือกลูกค้าก่อนทำรายการ");
    if (!items || items.length === 0)
      throw new Error("ไม่มีสินค้าในรายการตะกร้า");

    const orderNo = await generateOrderNumber(user.comp_id, "CST");
    let orderItems = [];

    for (const item of items) {
      let finalCustomSpec = {};

      if (item.session_id) {
        // ดึงข้อมูลตะกร้า + Populate Master ทุกตัวที่ต้องใช้
        const sessionData = await CustomSession.findById(item.session_id)
          .populate("custom_spec.item_type_id", "master_name")
          .populate("custom_spec.metal_id", "master_name")
          .populate("custom_spec.stone_name_id", "master_name")
          .populate("custom_spec.stone_shape_id", "master_name")
          .populate("custom_spec.cutting", "master_name")
          .populate("custom_spec.quality", "master_name")
          .populate("custom_spec.clarity", "master_name")
          // Populate พลอยรองด้วย
          .populate(
            "custom_spec.additional_stones.stone_name_id",
            "master_name",
          )
          .populate(
            "custom_spec.additional_stones.stone_shape_id",
            "master_name",
          )
          .populate("custom_spec.additional_stones.cutting", "master_name")
          .populate("custom_spec.additional_stones.quality", "master_name")
          .populate("custom_spec.additional_stones.clarity", "master_name")
          .session(session);

        if (sessionData && sessionData.custom_spec) {
          const spec = sessionData.custom_spec;

          finalCustomSpec = {
            ...(spec.toObject ? spec.toObject() : spec), // ดึงข้อมูลดิบทั้งหมดมาก่อน

            // ยัดชื่อ String สำหรับพลอยหลักและ General
            item_type_name: spec.item_type_id?.master_name,
            item_type_id: spec.item_type_id?._id || spec.item_type_id,

            metal_name: spec.metal_id?.master_name,
            metal_id: spec.metal_id?._id || spec.metal_id,

            stone_name: spec.stone_name_id?.master_name,
            stone_name_id: spec.stone_name_id?._id || spec.stone_name_id,

            stone_shape_name: spec.stone_shape_id?.master_name,
            stone_shape_id: spec.stone_shape_id?._id || spec.stone_shape_id,

            cutting_name: spec.cutting?.master_name,
            cutting: spec.cutting?._id || spec.cutting,

            quality_name: spec.quality?.master_name,
            quality: spec.quality?._id || spec.quality,

            clarity_name: spec.clarity?.master_name,
            clarity: spec.clarity?._id || spec.clarity,
          };

          // ยัดชื่อ String สำหรับพลอยรอง (ถ้ามี)
          if (
            finalCustomSpec.additional_stones &&
            finalCustomSpec.additional_stones.length > 0
          ) {
            finalCustomSpec.additional_stones =
              finalCustomSpec.additional_stones.map((astone) => ({
                ...astone,
                stone_name: astone.stone_name_id?.master_name,
                stone_name_id:
                  astone.stone_name_id?._id || astone.stone_name_id,
                stone_shape_name: astone.stone_shape_id?.master_name,
                stone_shape_id:
                  astone.stone_shape_id?._id || astone.stone_shape_id,
                cutting_name: astone.cutting?.master_name,
                cutting: astone.cutting?._id || astone.cutting,
                quality_name: astone.quality?.master_name,
                quality: astone.quality?._id || astone.quality,
                clarity_name: astone.clarity?.master_name,
                clarity: astone.clarity?._id || astone.clarity,
              }));
          }
        }
        await CustomSession.findByIdAndDelete(item.session_id, { session });
      }

      orderItems.push({
        product_id: item.product_id,
        product_code: item.product_code,
        product_name: item.product_name,
        image: item.image,
        qty: item.qty || 1,
        unit_price: item.unit_price || 0,
        total_item_price: (item.qty || 1) * (item.unit_price || 0),
        custom_spec: finalCustomSpec,
      });
    }

    const newOrder = new Order({
      comp_id: user.comp_id,
      sale_staff_id: userId,
      customer_id,
      order_no: orderNo,
      order_type: "Custom",
      items: orderItems,
      sub_total: sub_total || 0,
      discount_total: discount_total || 0,
      grand_total: grand_total,
      remark,
      order_status: "Pending",
      payment_status: "Pending",
    });

    await newOrder.save({ session });
    await session.commitTransaction();
    res.json({
      success: true,
      message: "Order created successfully",
      order_no: orderNo,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Finish Order Error:", error);
    res
      .status(500)
      .json({ success: false, message: error.message || "Server Error" });
  } finally {
    session.endSession();
  }
}; //บันทึกทุกตัวลงไปที่ Order อยู่ใน Report
