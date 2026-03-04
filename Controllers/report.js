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
    // 1. ตรวจสอบสิทธิ์การใช้งาน (ต้องล็อกอินและมี Company ID)
    if (!req.user || !req.user.comp_id) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: Missing Company ID" });
    }

    // 2. รับค่าพารามิเตอร์จากหน้าบ้าน (Query String)
    // order_type = ประเภทบิล ("Sell" หรือ "Custom")
    // page = หน้าที่ต้องการดู (ค่าเริ่มต้นคือหน้า 1)
    // limit = จำนวนรายการต่อหน้า (ค่าเริ่มต้นคือ 20)
    const { order_type, page = 1, limit = 20 } = req.query;

    // 3. คำนวณสำหรับการแบ่งหน้า (Pagination)
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber; // คำนวณว่าต้องข้ามข้อมูลไปกี่ตัว

    // 4. สร้างเงื่อนไขในการค้นหา (Query Condition)
    const query = { comp_id: req.user.comp_id }; // ดึงเฉพาะข้อมูลของบริษัทตัวเอง

    if (order_type) {
      query.order_type = order_type; // ถ้าหน้าบ้านส่ง order_type มา ให้กรองตามประเภทนั้นๆ
    }

    // 5. นับจำนวนบิลทั้งหมดที่ตรงเงื่อนไข (เพื่อเอาไปทำปุ่มเปลี่ยนหน้าในหน้าบ้าน)
    const totalOrders = await Order.countDocuments(query);

    // 6. ดึงข้อมูลจาก Database พร้อมเชื่อมโยง (Populate) ข้อมูลจากตารางอื่นๆ
    const orders = await Order.find(query)
      .populate("customer_id", "name") // ดึงชื่อลูกค้ามาจากตาราง Customer
      .populate("sale_staff_id", "username") // ดึงชื่อพนักงานขาย
      // กลุ่ม Populate ดึงชื่อ Master Data จาก ID ที่เก็บไว้ใน Spec
      .populate("items.custom_spec.item_type_id", "master_name")
      .populate("items.custom_spec.metal_id", "master_name")
      .populate("items.custom_spec.stone_name_id", "master_name")
      .populate("items.custom_spec.stone_shape_id", "master_name")
      .populate("items.custom_spec.cutting", "master_name")
      .populate("items.custom_spec.quality", "master_name")
      .populate("items.custom_spec.clarity", "master_name")
      .sort({ createdAt: -1 }) // เรียงลำดับจากวันที่สร้างล่าสุดขึ้นก่อน (ใหม่ไปเก่า)
      .skip(skip) // ข้ามข้อมูลหน้าก่อนหน้า
      .limit(limitNumber); // จำกัดจำนวนข้อมูลตาม limit ที่ตั้งไว้

    // 7. แปลงรูปแบบข้อมูล (Format Data) ให้ตรงกับโครงสร้างตาราง (DataGrid) ของหน้าบ้าน
    const formattedOrders = orders.map((order) => {
      // 7.1 กำหนดยอดเงินที่จะโชว์ในแถวหลัก (แถวที่ยังไม่กดขยาย)
      // - ถ้าระบบสั่งทำ (Custom) จะโชว์ยอด "มัดจำรวม" (total_deposit)
      // - ถ้าระบบขายปกติ (Sell) จะโชว์ยอด "ขายรวม" (grand_total)
      const headerAmount =
        order.order_type === "Custom"
          ? order.total_deposit || 0
          : order.grand_total || 0;

      // 7.2 แปลงข้อมูลสินค้ารายชิ้น (แถวที่กดลูกศรขยายลงมาดูรายละเอียด)
      const formattedItems = order.items.map((item) => {
        const spec = item.custom_spec || {};

        return {
          _id: item._id,
          // --- ข้อมูลทั่วไปของบิล ---
          sell_id: order.order_no, // เลขที่บิล (อ้างอิงจากหัวบิล)
          customer: order.customer_id?.name || "-", // ชื่อลูกค้า
          date: order.order_date, // วันที่ขาย

          // --- ข้อมูลสินค้า ---
          image: item.image, // รูปสินค้า
          code: item.product_code, // รหัสสินค้า
          product_name: item.product_name, // ชื่อสินค้า

          // --- สเปกของตัวเรือน (ดึงออกจากก้อน custom_spec ให้อยู่ชั้นนอกสุด เพื่อให้หน้าบ้านใช้ง่าย) ---
          category: spec.item_type_name || "-",
          item_type: spec.item_type_name || "-",
          product_size: spec.size || spec.product_size || "-", // ขนาดแหวน/ตัวเรือน
          metal: spec.metal_name || "-", // ชนิดทอง (เช่น 18K)
          metal_color: spec.metal_color || "-", // สีทอง (เช่น Rose Gold)
          gwt: spec.gwt || 0, // น้ำหนักรวม
          nwt: spec.nwt || 0, // น้ำหนักสุทธิ

          // --- สเปกของพลอย (Stone) ---
          stone_name: spec.stone_name || "-",
          shape: spec.stone_shape_name || "-",
          size: spec.stone_size || "-", // ขนาดพลอย
          s_weight: spec.s_weight || 0, // น้ำหนักพลอย
          color: spec.stone_color || "-", // สีพลอย
          cutting: spec.cutting_name || "-",
          quality: spec.quality_name || "-",
          clarity: spec.clarity_name || "-",

          // --- ราคาและส่วนลด ---
          qty: item.qty || 1, // จำนวนชิ้น
          tax: order.tax_rate ? `${order.tax_rate}%` : "0%", // เติม % ให้ค่าภาษี
          price: item.original_price || item.unit_price || 0, // ราคาตั้งต้น

          // เช็คว่าส่วนลดเป็น % หรือจำนวนเงิน แล้วแปลงให้อ่านง่าย
          discount:
            item.discount_percent && item.discount_percent > 0
              ? `${item.discount_percent}%`
              : item.discount_amount || 0,

          // กำหนดยอดเงินรายชิ้น (Custom โชว์ Deposit ชิ้นนั้น / Sell โชว์ราคารวมชิ้นนั้น)
          amount:
            order.order_type === "Custom"
              ? item.deposit || 0
              : item.total_item_price || 0,
        };
      });

      // 7.3 ประกอบร่างข้อมูลหัวบิล เข้ากับ ข้อมูลรายชิ้น
      return {
        _id: order._id,
        order_no: order.order_no,
        order_date: order.order_date,
        customer_name: order.customer_id?.name || "-",
        total_items: order.total_items || 0,
        header_amount: headerAmount, // ยอดเงินสำหรับแถวหลัก
        order_type: order.order_type,
        items: formattedItems, // โยนข้อมูลสินค้ารายชิ้นที่จัดระเบียบแล้วใส่เข้าไป
      };
    });

    // 8. ส่งข้อมูลกลับไปให้หน้าบ้าน (Frontend)
    res.json({
      success: true,
      count: formattedOrders.length, // จำนวนรายการในหน้านี้
      total: totalOrders, // จำนวนรายการทั้งหมดใน Database
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(totalOrders / limitNumber), // คำนวณจำนวนหน้าทั้งหมด
        limit: limitNumber,
      },
      data: formattedOrders, // ข้อมูลตารางพร้อมวาดขึ้นจอ
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
    if (!req.user || !req.user.comp_id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { order_type } = req.query; // รับค่ามาว่าจะเป็น Sell หรือ Custom
    const query = { comp_id: req.user.comp_id };

    if (order_type) {
      query.order_type = order_type;
    }

    // 1. ดึงข้อมูลทั้งหมดมา (ไม่ใส่ skip, ไม่ใส่ limit)
    const orders = await Order.find(query)
      .populate("customer_id", "name")
      .populate("sale_staff_id", "username")
      .populate("items.custom_spec.item_type_id", "master_name")
      .populate("items.custom_spec.metal_id", "master_name")
      .populate("items.custom_spec.stone_name_id", "master_name")
      .populate("items.custom_spec.stone_shape_id", "master_name")
      .populate("items.custom_spec.cutting", "master_name")
      .populate("items.custom_spec.quality", "master_name")
      .populate("items.custom_spec.clarity", "master_name")
      .sort({ createdAt: -1 });

    // 2. สร้างไฟล์ Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${order_type || "All"}_Report`);

    // 3. กำหนดหัวคอลัมน์ (Header) ให้ตรงกับหน้า UI
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

    // 4. วนลูปยัดข้อมูลใส่ Excel (แปลงข้อมูลให้อยู่ในรูปแบบบรรทัดเดียว Flat Data)
    orders.forEach((order) => {
      // ยอดรวมบิล
      const headerAmount =
        order.order_type === "Custom"
          ? order.total_deposit || 0
          : order.grand_total || 0;

      // เนื่องจาก 1 บิลมีหลายชิ้น เราจึงต้องวนลูป items เพื่อสร้างบรรทัดใน Excel
      order.items.forEach((item) => {
        const spec = item.custom_spec || {};

        const discountStr =
          item.discount_percent && item.discount_percent > 0
            ? `${item.discount_percent}%`
            : item.discount_amount || 0;

        const itemAmount =
          order.order_type === "Custom"
            ? item.deposit || 0
            : item.total_item_price || 0;

        worksheet.addRow({
          order_no: order.order_no,
          date: order.order_date
            ? new Date(order.order_date).toLocaleString("en-GB")
            : "-",
          customer: order.customer_id?.name || "-",
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
          total_order_amount: headerAmount, // ใส่ยอดรวมหัวบิลแนบไปด้วยทุกบรรทัด
        });
      });
    });

    // 5. ปรับแต่ง Header เล็กน้อยให้ตัวหนา
    worksheet.getRow(1).font = { bold: true };

    // 6. ตั้งค่า Header สำหรับส่งไฟล์กลับไปให้เบราว์เซอร์ดาวน์โหลด
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${order_type || "Order"}_Report.xlsx`,
    );

    // 7. ส่งไฟล์ออกไป
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export Excel Error:", error);
    res.status(500).json({ success: false, message: "Export failed" });
  }
};
