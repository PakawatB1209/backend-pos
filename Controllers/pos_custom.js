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

    let totalItems = 0;
    let totalDeposit = 0;

    const formattedData = items.map((item) => {
      const prod = item.product_id || {};
      let imgUrl = null;
      if (prod.file && prod.file.length > 0) {
        imgUrl = prod.file[0].startsWith("http")
          ? prod.file[0]
          : `${baseUrl}${prod.file[0]}`;
      }
      const qty = item.qty || 1;
      const deposit = item.deposit || 0;
      return {
        session_id: item._id,
        product_id: prod._id,
        product_code: prod.product_code,
        product_name: prod.product_name,
        image: imgUrl,
        is_saved: item.is_saved,
        item_type: prod.product_item_type?.master_name || "-",
        category: prod.product_category?.master_name || "-",
        qty: qty,
        deposit: deposit,
      };
    });

    res.json({
      success: true,
      summary: {
        current_date: new Date(), // ส่งวันที่ปัจจุบันไปให้โชว์
        total_items: totalItems,
        total_deposit: totalDeposit,
      },
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

exports.getCustomSessionDetail = async (req, res) => {
  try {
    const { session_id } = req.params;
    const user = await User.findById(req.user.id).select("comp_id").lean();
    if (!user || !user.comp_id) {
      return res
        .status(400)
        .json({ success: false, message: "User not associated with company." });
    }

    const comp_id = user.comp_id;
    const baseUrl = `${req.protocol}://${req.get("host")}/uploads/product/`;

    // 1. ค้นหา Session และดึงข้อมูล Product เชิงลึก (เหมือน getPosProductDetail)
    const sessionItem = await CustomSession.findOne({
      _id: session_id,
      comp_id: comp_id,
      sales_staff_id: req.user.id,
    })
      .populate({
        path: "product_id",
        populate: [
          { path: "product_category", select: "master_name" },
          { path: "product_item_type", select: "master_name" },
          {
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
          },
        ],
      })
      .lean();

    if (!sessionItem || !sessionItem.product_id) {
      return res
        .status(404)
        .json({ success: false, message: "Session or Product not found" });
    }

    const product = sessionItem.product_id;
    const detail = product.product_detail_id || {};

    // --- ค้นหา Metal และ Color จาก Array "masters" ---
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

    // จัดการ Attributes สำหรับแสดงผลในหน้า UI
    const categoryName = product.product_category?.master_name || "";
    const catLower = categoryName.toLowerCase();
    const itemTypeName = product.product_item_type?.master_name || "-";

    let attributes = {
      main_info: [],
      stone_info: [],
      additional_stones: [],
    };

    if (catLower.includes("stone") || catLower.includes("diamond")) {
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

    // Raw Data (สเปกตั้งต้นจาก Master) สำหรับส่งไปแปะใน Input Form
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
        session_id: sessionItem._id,
        customer_id: sessionItem.customer_id,
        is_saved: sessionItem.is_saved,

        // ข้อมูลสินค้า (เอาไว้แสดงรูป ชื่อ รหัส)
        _id: product._id,
        product_code: product.product_code,
        product_name: product.product_name,
        images,
        cover_image: images[0] || null,
        price: detail.price || 0,
        qty: sessionItem.qty || 1,
        deposit: sessionItem.deposit || 0,

        // ข้อมูลสำหรับโชว์ตารางรายละเอียด
        attributes,

        // สเปกตั้งต้น (จากฐานข้อมูลหลัก)
        raw_data,

        // 🟢 สเปกที่พนักงาน Custom ไว้ล่าสุด (ถ้าว่างจะเป็น {})
        // หน้าบ้านต้องเอา custom_spec ตัวนี้ไปเขียนทับ raw_data ก่อนโชว์ในช่อง Input ครับ
        custom_spec: sessionItem.custom_spec || {},
      },
    });
  } catch (error) {
    console.error("Get Custom Detail Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

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

exports.updateCustomSessionItem = async (req, res) => {
  try {
    const { session_id } = req.params;
    const { qty, deposit } = req.body;

    let updateData = {};
    if (qty !== undefined) {
      if (qty < 1)
        return res
          .status(400)
          .json({ success: false, message: "จำนวนต้องไม่น้อยกว่า 1" });
      updateData.qty = qty;
    }
    if (deposit !== undefined) {
      updateData.deposit = Number(deposit);
    }

    await CustomSession.findByIdAndUpdate(session_id, { $set: updateData });

    res.json({ success: true, message: "อัปเดตข้อมูลเรียบร้อย" });
  } catch (error) {
    console.error("Update Custom Qty Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
}; // อัปเดตจำนวน (Qty) ในหน้าตะกร้า Custom (ปุ่ม + / -)/อัปเดทค่า Deposit มัดจำ

const generateOrderNumber = async (comp_id, typeCode = "ORD") => {
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
exports.generateOrderNumber = generateOrderNumber;

exports.previewNextOrderNumber = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("comp_id").lean();
    if (!user || !user.comp_id) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }

    // เรียกใช้ฟังก์ชันเดิมของคุณ โดยส่ง "CST" (หรือ "ORD") ไป
    const nextOrderNo = await generateOrderNumber(user.comp_id, "CST");

    res.json({
      success: true,
      order_no: nextOrderNo,
    });
  } catch (error) {
    console.error("Preview Order Number Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
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
      total_deposit,
      grand_total,
      remark,
    } = req.body;

    if (!customer_id) throw new Error("กรุณาเลือกลูกค้าก่อนทำรายการ");
    if (!items || items.length === 0)
      throw new Error("ไม่มีสินค้าในรายการตะกร้า");

    const orderNo = await generateOrderNumber(user.comp_id, "CST");
    let calculatedTotalItems = 0;
    let orderItems = [];

    for (const item of items) {
      let finalCustomSpec = {};

      // 🟢 1. ดึงสเปกต้นฉบับจาก Product (เผื่อพนักงานไม่ได้แก้อะไรเลย จะได้มีของเดิมไปโชว์)
      const productRecord = await mongoose
        .model("product")
        .findById(item.product_id)
        .populate("product_item_type", "master_name")
        .populate({
          path: "product_detail_id",
          populate: [
            { path: "masters.master_id", select: "master_name" },
            { path: "primary_stone.stone_name", select: "master_name" },
            { path: "primary_stone.shape", select: "master_name" },
            { path: "primary_stone.cutting", select: "master_name" },
            { path: "primary_stone.quality", select: "master_name" },
            { path: "primary_stone.clarity", select: "master_name" },
          ],
        })
        .session(session);

      let baseSpec = {};
      if (productRecord) {
        const detail = productRecord.product_detail_id || {};
        let metalObj = null;
        let metalColorObj = null;

        if (detail.masters && detail.masters.length > 0) {
          detail.masters.forEach((mItem) => {
            const m = mItem.master_id;
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

        baseSpec = {
          item_type_id: productRecord.product_item_type?._id,
          item_type_name: productRecord.product_item_type?.master_name,
          metal_id: metalObj?._id,
          metal_name: metalObj?.master_name,
          metal_color: metalColorObj?.master_name || detail.color,
          size: detail.size || detail.product_size,
          nwt: detail.net_weight || 0,
          gwt: detail.gross_weight || 0,
          stone_name_id: detail.primary_stone?.stone_name?._id,
          stone_name: detail.primary_stone?.stone_name?.master_name,
          stone_shape_id: detail.primary_stone?.shape?._id,
          stone_shape_name: detail.primary_stone?.shape?.master_name,
          stone_size: detail.primary_stone?.size,
          s_weight: detail.primary_stone?.weight || 0,
          stone_color: detail.primary_stone?.color,
          cutting: detail.primary_stone?.cutting?._id,
          cutting_name: detail.primary_stone?.cutting?.master_name,
          quality: detail.primary_stone?.quality?._id,
          quality_name: detail.primary_stone?.quality?.master_name,
          clarity: detail.primary_stone?.clarity?._id,
          clarity_name: detail.primary_stone?.clarity?.master_name,
        };
      }

      // 🟢 2. ดึง Custom Spec ที่พนักงานแก้ไขจากตะกร้า
      let customOverrides = {};
      if (item.session_id) {
        const sessionData = await CustomSession.findById(
          item.session_id,
        ).session(session);
        if (sessionData && sessionData.custom_spec) {
          customOverrides = sessionData.custom_spec; // หน้าตาจะเป็นแบบ raw_data
        }
        await CustomSession.findByIdAndDelete(item.session_id, { session });
      }

      // 🟢 3. แปลง ID ที่แก้มา ให้กลับเป็นชื่อ Master (เพราะ Database เก็บเป็น ID)
      const stoneOverrides = customOverrides.stone || {};
      const idsToFetch = [
        customOverrides.item_type_id,
        customOverrides.metal_id,
        stoneOverrides.name_id,
        stoneOverrides.shape_id,
        stoneOverrides.clarity_id,
        stoneOverrides.quality_id,
        stoneOverrides.cutting_id,
      ].filter((id) => id && mongoose.isValidObjectId(id));

      const mastersMap = {};
      if (idsToFetch.length > 0) {
        const mastersList = await mongoose
          .model("masters")
          .find({ _id: { $in: idsToFetch } })
          .select("master_name")
          .lean();
        mastersList.forEach(
          (m) => (mastersMap[m._id.toString()] = m.master_name),
        );
      }

      // 🟢 4. ผสมข้อมูล (เอาที่แก้ทับของเดิมให้สมบูรณ์)
      finalCustomSpec = {
        item_type_id: customOverrides.item_type_id || baseSpec.item_type_id,
        item_type_name:
          mastersMap[customOverrides.item_type_id] || baseSpec.item_type_name,

        metal_id: customOverrides.metal_id || baseSpec.metal_id,
        metal_name: mastersMap[customOverrides.metal_id] || baseSpec.metal_name,
        metal_color: customOverrides.metal_color || baseSpec.metal_color,

        size:
          customOverrides.size || customOverrides.product_size || baseSpec.size,
        nwt: customOverrides.nwt || baseSpec.nwt,
        gwt: customOverrides.gwt || baseSpec.gwt,

        stone_name_id: stoneOverrides.name_id || baseSpec.stone_name_id,
        stone_name: mastersMap[stoneOverrides.name_id] || baseSpec.stone_name,

        stone_shape_id: stoneOverrides.shape_id || baseSpec.stone_shape_id,
        stone_shape_name:
          mastersMap[stoneOverrides.shape_id] || baseSpec.stone_shape_name,

        stone_size: stoneOverrides.size || baseSpec.stone_size,
        s_weight: stoneOverrides.weight || baseSpec.s_weight,
        stone_color: stoneOverrides.color || baseSpec.stone_color,

        cutting: stoneOverrides.cutting_id || baseSpec.cutting,
        cutting_name:
          mastersMap[stoneOverrides.cutting_id] || baseSpec.cutting_name,

        quality: stoneOverrides.quality_id || baseSpec.quality,
        quality_name:
          mastersMap[stoneOverrides.quality_id] || baseSpec.quality_name,

        clarity: stoneOverrides.clarity_id || baseSpec.clarity,
        clarity_name:
          mastersMap[stoneOverrides.clarity_id] || baseSpec.clarity_name,
      };

      const itemQty = item.qty || 1;
      calculatedTotalItems += itemQty;
      const itemDeposit = item.deposit || 0;

      orderItems.push({
        product_id: item.product_id,
        product_code: item.product_code,
        product_name: item.product_name,
        image: item.image,
        qty: item.qty || 1,
        original_price: item.original_price || item.unit_price || 0,
        unit_price: item.unit_price || 0,
        total_item_price: (item.qty || 1) * (item.unit_price || 0),
        deposit: itemDeposit,
        total_deposit: item.total_deposit || itemQty * itemDeposit,
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
      total_deposit: total_deposit,
      sub_total: sub_total || 0,
      discount_total: discount_total || 0,
      grand_total: grand_total,
      total_items: calculatedTotalItems,
      remark,
      order_status: "Pending",
      payment_status: "Partial",
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
