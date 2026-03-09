const Order = require("../models/Order");
const Counter = require("../models/Counter");
const User = require("../models/User");
const Stock = require("../models/Stock");
const CustomSession = require("../models/CustomSession");

// exports.createOrder = async (req, res) => {
//   try {
//     // 1. รับค่าที่ส่งมาจากหน้าบ้าน (ลูกค้า, สินค้า, ส่วนลด)
//     const { customer_id, items, discount_total, remark } = req.body;

//     // 2. ตรวจสอบ User คนที่ทำรายการ เพื่อดึง Company ID (แยกข้อมูลตามบริษัท)
//     const user = await User.findById(req.user.id).select("comp_id").lean();
//     if (!user)
//       return res
//         .status(401)
//         .json({ success: false, message: "User not found" });

//     const comp_id = user.comp_id;

//     // 3. สร้างเลขที่เอกสาร (Running Number) รูปแบบ SO-YYYYMM-XXXX
//     const date = new Date();
//     const yearMonth = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, "0")}`;
//     const counterKey = `order_${comp_id}_${yearMonth}`;

//     // อัปเดตตัวนับลำดับเอกสาร (ถ้าไม่มีให้สร้างใหม่, ถ้ามีให้บวก 1)
//     const counter = await Counter.findOneAndUpdate(
//       { name: counterKey },
//       { $inc: { seq: 1 } },
//       { upsert: true, new: true },
//     );

//     const orderNo = `SO-${yearMonth}-${counter.seq.toString().padStart(4, "0")}`;

//     // 4. เตรียมข้อมูลสินค้าและคำนวณราคา
//     let subTotal = 0;
//     const stockMap = {}; // ตัวแปรสำหรับรวมยอดสินค้าแต่ละตัว (เผื่อมีการส่งสินค้าตัวเดิมมาซ้ำหลายรอบใน list)

//     const formattedItems = items.map((item) => {
//       const itemTotal = item.qty * item.unit_price;
//       subTotal += itemTotal; // บวกราคาเข้ายอดรวม

//       // รวมจำนวนสินค้าที่ต้องใช้ (Group by Product ID)
//       const pid = item.product_id;
//       if (!stockMap[pid]) {
//         stockMap[pid] = 0;
//       }
//       stockMap[pid] += item.qty;

//       // จัด Format รายการสินค้าที่จะบันทึก
//       return {
//         product_id: item.product_id,
//         product_code: item.product_code,
//         product_name: item.product_name,
//         qty: item.qty,
//         unit_price: item.unit_price,
//         total_item_price: itemTotal,
//         custom_spec: item.custom_spec || {},
//       };
//     });

//     // คำนวณยอดสุทธิ (ยอดรวม - ส่วนลด)
//     const grandTotal = subTotal - (discount_total || 0);

//     // 5. เช็คสต็อกสินค้า "ก่อน" บันทึก (Validate Stock)
//     // วนลูปเช็คทีละตัวว่าของพอไหม ถ้าไม่พอให้ Error กลับไปเลย ไม่บันทึก
//     for (const [pid, requiredQty] of Object.entries(stockMap)) {
//       const stock = await Stock.findOne({
//         product_id: pid,
//         comp_id: comp_id,
//         // warehouse_id: 'xxxx' // <-- ควรระบุคลังสินค้าด้วยถ้ามีหลายคลัง
//       });

//       if (!stock || stock.quantity < requiredQty) {
//         return res.status(400).json({
//           success: false,
//           message: `สินค้า ${pid} มีไม่พอ (ต้องการ ${requiredQty} แต่มี ${stock ? stock.quantity : 0})`,
//         });
//       }
//     }

//     // 6. บันทึกออเดอร์ลงฐานข้อมูล (Create Order)
//     const newOrder = new Order({
//       comp_id,
//       sale_staff_id: req.user.id,
//       customer_id,
//       order_no: orderNo,
//       items: formattedItems,
//       sub_total: subTotal,
//       discount_total: discount_total || 0,
//       grand_total: grandTotal,
//       remark,
//       order_status: "Pending", // สถานะเริ่มต้น
//       payment_status: "Unpaid", // สถานะการจ่ายเงินเริ่มต้น
//     });

//     await newOrder.save();

//     // 7. ตัดสต็อกจริงออกจากระบบ (Deduct Stock)
//     // ถึงตรงนี้แปลว่าออเดอร์ถูกสร้างแล้ว จึงทำการลบจำนวนสินค้าออกจาก Stock
//     for (const [pid, qtyToCut] of Object.entries(stockMap)) {
//       await Stock.findOneAndUpdate(
//         {
//           product_id: pid,
//           comp_id: comp_id,
//           // warehouse_id: 'xxxx' // <-- อย่าลืมใส่ warehouse_id ให้ตรงกับตอนเช็ค
//         },
//         { $inc: { quantity: -qtyToCut } }, // ใช้ $inc ติดลบเพื่อลดจำนวน
//       );
//     }

//     // 8. ส่งผลลัพธ์กลับไปบอก Client ว่าสำเร็จ
//     res.status(201).json({
//       success: true,
//       message: "Order created successfully",
//       order_no: orderNo,
//       data: newOrder,
//     });
//   } catch (error) {
//     // ดักจับ Error กรณี Server มีปัญหา
//     console.error("Create Order Error:", error);
//     res.status(500).json({ success: false, message: "Server Error" });
//   }
// };

exports.createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customer_id, items, discount_total, remark } = req.body;

    // 1. ตรวจสอบ User & Company
    const user = await User.findById(req.user.id).select("comp_id").lean();
    if (!user) throw new Error("User not found");
    const comp_id = user.comp_id;

    // 2. สร้างเลขที่เอกสาร (Running Number)
    const date = new Date();
    const yearMonth = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, "0")}`;
    const counterKey = `order_${comp_id}_${yearMonth}`;

    const counter = await Counter.findOneAndUpdate(
      { name: counterKey },
      { $inc: { seq: 1 } },
      { upsert: true, new: true, session },
    );
    const orderNo = `SO-${yearMonth}-${counter.seq.toString().padStart(4, "0")}`;

    // 3. เตรียมข้อมูลสินค้าและคำนวณราคา
    let subTotal = 0;
    const stockMap = {}; // ใช้รวมยอดสินค้า (Group by Product ID อย่างเดียว)

    const formattedItems = items.map((item) => {
      const itemTotal = item.qty * item.unit_price;
      subTotal += itemTotal;

      // ไม่แยก Warehouse แล้ว รวมยอดตาม Product ID เลย
      const pid = item.product_id;
      if (!stockMap[pid]) {
        stockMap[pid] = 0;
      }
      stockMap[pid] += item.qty;

      return {
        product_id: item.product_id,
        // warehouse_id: เอาออกตามที่ขอ
        product_code: item.product_code,
        product_name: item.product_name,
        qty: item.qty,
        unit_price: item.unit_price,
        total_item_price: itemTotal,
        custom_spec: item.custom_spec || {},
      };
    });

    const grandTotal = subTotal - (discount_total || 0);

    // 4. วนลูปเช็คสต็อกและตัดของ (Process Stock)
    for (const [pid, requiredQty] of Object.entries(stockMap)) {
      // ค้นหาสต็อกของสินค้านี้ (โดยไม่สน Warehouse)
      // ระบบจะหาเองว่าสินค้านี้อยู่ที่ Warehouse ไหน
      const stock = await Stock.findOne({
        product_id: pid,
        comp_id: comp_id,
      }).session(session);

      // Validate: ของพอไหม?
      if (!stock || stock.quantity < requiredQty) {
        throw new Error(
          `สินค้า ${pid} มีไม่พอ (ต้องการ ${requiredQty} มี ${stock ? stock.quantity : 0})`,
        );
      }

      // ตัดสต็อก (Deduct)
      // ใช้ _id ของ stock ที่เพิ่งหาเจอ เพื่อความชัวร์ว่าตัดถูกตัว
      await Stock.findByIdAndUpdate(
        stock._id,
        { $inc: { quantity: -requiredQty } },
        { session },
      );
    }

    // 5. บันทึกออเดอร์ (Create Order)
    const newOrder = new Order({
      comp_id,
      sale_staff_id: req.user.id,
      customer_id,
      order_no: orderNo,
      items: formattedItems,
      sub_total: subTotal,
      discount_total: discount_total || 0,
      grand_total: grandTotal,
      remark,
      order_status: "Pending",
      payment_status: "Unpaid",
    });

    await newOrder.save({ session });

    // 6. ปลดล็อก Custom Session (สำคัญ!)
    // ลบใบจองของสินค้าทุกตัวในบิลนี้
    const allProductIds = items.map((i) => i.product_id);
    await CustomSession.deleteMany(
      {
        product_id: { $in: allProductIds },
        comp_id: comp_id,
      },
      { session },
    );

    // 7. จบการทำงาน
    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      order_no: orderNo,
      data: newOrder,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Create Order Error:", error);
    res
      .status(500)
      .json({ success: false, message: error.message || "Server Error" });
  } finally {
    session.endSession();
  }
};
