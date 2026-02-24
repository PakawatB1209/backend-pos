const mongoose = require("mongoose");
const User = require("../models/User");
const Customer = require("../models/Customer");
const Counter = require("../models/Counter");
const PNF = require("google-libphonenumber").PhoneNumberFormat;
const excelJS = require("exceljs");
const phoneUtil =
  require("google-libphonenumber").PhoneNumberUtil.getInstance();

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

exports.createCustomer = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized access." });
    }
    const user = await User.findById(req.user.id).select("comp_id");

    if (!user || !user.comp_id) {
      return res.status(403).json({
        success: false,
        message: "User is not assigned to any company.",
      });
    }

    const {
      customer_name,
      business_type,
      company_name,
      contact_person,

      addr_line,
      addr_country,
      addr_province,
      addr_district,
      addr_sub_district,
      addr_zipcode,

      customer_date,
      customer_email,
      customer_phone,
      customer_country,
      customer_tax_id,
      customer_gender,
      note,
      tax_company_name,
      tax_addr_line,
      tax_addr_country,
      tax_addr_province,
      tax_addr_district,
      tax_addr_sub_district,
      tax_addr_zipcode,
    } = req.body;

    if (!customer_name || !customer_phone) {
      return res
        .status(400)
        .json({ success: false, message: "Please fill required fields." });
    }
    let finalPhone = customer_phone;
    // let countryCode = "Unknown";

    if (customer_phone) {
      try {
        const number = phoneUtil.parseAndKeepRawInput(
          customer_phone,
          customer_country || "TH",
        );

        if (!phoneUtil.isValidNumber(number)) {
          return res.status(400).json({
            success: false,
            message: "Invalid phone number",
          });
        }

        finalPhone = phoneUtil.format(number, PNF.E164);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Unable to parse phone number",
        });
      }
    }

    if (business_type === "Corporation" && !company_name) {
      return res.status(400).json({
        success: false,
        message: "Company name is required for Corporations.",
      });
    }

    const counterName = `customer_id_${user.comp_id}`;
    const counter = await Counter.findByIdAndUpdate(
      { _id: counterName },
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );

    const seqStr = counter.seq.toString().padStart(4, "0");
    const newCustomerID = `CUS-${seqStr}`;

    const newCustomer = new Customer({
      comp_id: user.comp_id,
      customer_id: newCustomerID,

      business_type: business_type || "Corporation",
      customer_name,

      company_name: business_type === "Individual" ? "" : company_name,
      contact_person,

      address: {
        address_line: addr_line,
        country: addr_country,
        province: addr_province,
        district: addr_district,
        sub_district: addr_sub_district,
        zipcode: addr_zipcode,
      },

      customer_date: customer_date ? new Date(customer_date) : null,

      customer_email,

      customer_phone: finalPhone,

      customer_tax_id,
      customer_gender,
      note,
      tax_addr: {
        company_name: tax_company_name,
        address_line: tax_addr_line,
        country: tax_addr_country,
        province: tax_addr_province,
        district: tax_addr_district,
        sub_district: tax_addr_sub_district,
        zipcode: tax_addr_zipcode,
      },
    });

    await newCustomer.save();

    res.status(201).json({
      success: true,
      message: "Customer added successfully.",
      data: newCustomer,
    });
  } catch (err) {
    console.error("Create Customer Error:", err);
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ success: false, message: "Customer name already exists." });
    }
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: err.message });
  }
};

exports.listCustomers = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("comp_id");

    if (!user || !user.comp_id) {
      return res.status(403).json({
        success: false,
        message: "User is not assigned to any company.",
      });
    }

    let query = { comp_id: user.comp_id };

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const { search, business_type } = req.query;

    if (business_type) query.business_type = String(business_type);

    if (search) {
      const safeSearch = escapeRegex(String(search));
      const regex = new RegExp(safeSearch, "i");
      query.$or = [
        { customer_name: regex },
        { customer_id: regex },
        { customer_phone: regex },
        { company_name: regex },
        { contact_person: regex },
        { email: regex },
      ];
    }

    const [customers, total] = await Promise.all([
      Customer.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: customers.length,
      total_record: total,
      total_page: Math.ceil(total / limit),
      current_page: page,
      limit: limit,
      data: customers,
    });
  } catch (err) {
    console.log("List Customer Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.getCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format." });
    }

    const user = await User.findById(req.user.id).select("comp_id");
    if (!user || !user.comp_id) {
      return res
        .status(403)
        .json({ success: false, message: "Access Denied." });
    }

    const customer = await Customer.findOne({
      _id: id,
      comp_id: user.comp_id,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found (or access denied).",
      });
    }

    res.json({ success: true, data: customer });
  } catch (err) {
    console.log("Get Customer Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format." });
    }

    const user = await User.findById(req.user.id).select("comp_id");
    if (!user || !user.comp_id) {
      return res
        .status(403)
        .json({ success: false, message: "Access Denied." });
    }

    const {
      customer_name,
      business_type,
      company_name,
      contact_person,

      addr_line,
      addr_country,
      addr_province,
      addr_district,
      addr_sub_district,
      addr_zipcode,

      tax_company_name,
      tax_addr_line,
      tax_addr_country,
      tax_addr_province,
      tax_addr_district,
      tax_addr_sub_district,
      tax_addr_zipcode,

      customer_date,
      customer_email,
      customer_phone,
      customer_country,
      customer_tax_id,
      customer_gender,
      note,
    } = req.body;

    let finalPhone = customer_phone;

    if (customer_phone) {
      try {
        const number = phoneUtil.parseAndKeepRawInput(
          customer_phone,
          customer_country || "TH",
        );

        if (!phoneUtil.isValidNumber(number)) {
          return res.status(400).json({
            success: false,
            message: "Invalid phone number format (เบอร์โทรศัพท์ไม่ถูกต้อง)",
          });
        }

        finalPhone = phoneUtil.format(number, PNF.E164);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: "Unable to parse phone number (รูปแบบเบอร์โทรศัพท์ผิดพลาด)",
        });
      }
    }

    const updateFields = {
      ...(customer_name && { customer_name }),
      ...(business_type && { business_type }),
      ...(company_name !== undefined && {
        company_name: business_type === "Individual" ? "" : company_name,
      }),
      ...(contact_person && { contact_person }),

      // อัปเดตที่อยู่หลัก
      ...(addr_line && { "address.address_line": addr_line }),
      ...(addr_country && { "address.country": addr_country }),
      ...(addr_province && { "address.province": addr_province }),
      ...(addr_district && { "address.district": addr_district }),
      ...(addr_sub_district && { "address.sub_district": addr_sub_district }),
      ...(addr_zipcode && { "address.zipcode": addr_zipcode }),

      // อัปเดตที่อยู่ภาษี
      ...(tax_company_name && { "tax_addr.company_name": tax_company_name }),
      ...(tax_addr_line && { "tax_addr.address_line": tax_addr_line }),
      ...(tax_addr_country && { "tax_addr.country": tax_addr_country }),
      ...(tax_addr_province && { "tax_addr.province": tax_addr_province }),
      ...(tax_addr_district && { "tax_addr.district": tax_addr_district }),
      ...(tax_addr_sub_district && {
        "tax_addr.sub_district": tax_addr_sub_district,
      }),
      ...(tax_addr_zipcode && { "tax_addr.zipcode": tax_addr_zipcode }),

      ...(customer_date && { customer_date: new Date(customer_date) }),
      ...(customer_email && { customer_email }),
      ...(customer_phone && { customer_phone: finalPhone }),
      ...(customer_tax_id && { customer_tax_id }),
      ...(customer_gender && { customer_gender }),
      ...(note !== undefined && { note }),

      updatedAt: new Date(),
    };

    if (customer_name) {
      const duplicate = await Customer.findOne({
        customer_name: customer_name,
        comp_id: user.comp_id,
        _id: { $ne: id },
      });

      if (duplicate) {
        return res
          .status(400)
          .json({ success: false, message: "Customer Name already exists." });
      }
    }

    const updatedCustomer = await Customer.findOneAndUpdate(
      { _id: id, comp_id: user.comp_id },
      { $set: updateFields },
      { new: true, runValidators: true },
    );

    if (!updatedCustomer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found or you don't have permission to edit.",
      });
    }

    res.json({
      success: true,
      message: "Customer updated successfully.",
      data: updatedCustomer,
    });
  } catch (err) {
    console.log("Update Customer Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format." });
    }

    const user = await User.findById(req.user.id).select("comp_id");
    if (!user || !user.comp_id) {
      return res
        .status(403)
        .json({ success: false, message: "Access Denied." });
    }

    const deleted = await Customer.findOneAndDelete({
      _id: id,
      comp_id: user.comp_id,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Customer not found or access denied.",
      });
    }

    res.json({ success: true, message: "Customer deleted successfully." });
  } catch (err) {
    console.log("Delete Customer Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.getPosCustomers = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("comp_id").lean();
    if (!user || !user.comp_id) {
      return res
        .status(400)
        .json({ success: false, message: "User company not found" });
    }

    // ปรับให้เหมือนกับ listCustomers
    const customers = await Customer.find({
      comp_id: user.comp_id,
      // 🟢 แนะนำให้เช็คใน DB ว่ามีฟิลด์ is_active จริงไหม ถ้าไม่มีให้เอาบรรทัดล่างออก
      // is_active: true
    })
      .select("customer_name customer_phone customer_id") // 🟢 ใช้ชื่อฟิลด์ที่ถูกต้องตาม Schema
      .sort({ customer_name: 1 });

    res.json({
      success: true,
      data: customers,
    });
  } catch (error) {
    console.error("Get Customers Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.exportCustomersExcel = async (req, res) => {
  try {
    // 1. หา comp_id ของคนที่กำลังกด Export
    const user = await User.findById(req.user.id).select("comp_id");
    if (!user || !user.comp_id) {
      return res
        .status(403)
        .json({ success: false, message: "Company not found" });
    }

    // 2. ดึงข้อมูลลูกค้า "เฉพาะของบริษัทนี้" เรียงจากใหม่ไปเก่า
    const customers = await Customer.find({ comp_id: user.comp_id }).sort({
      createdAt: -1,
    });

    if (customers.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No customers found to export." });
    }

    // 3. สร้าง Workbook (ไฟล์ Excel) และ Worksheet (แผ่นงาน)
    const workbook = new excelJS.Workbook();
    const worksheet = workbook.addWorksheet("Customers Data");

    // 4. กำหนดหัวตาราง (คอลัมน์) ให้ตรงกับ Schema ล่าสุดของคุณ
    worksheet.columns = [
      { header: "Customer ID", key: "customer_id", width: 15 },
      { header: "Business Type", key: "business_type", width: 15 },
      { header: "Customer Name", key: "customer_name", width: 25 },
      { header: "Company Name", key: "company_name", width: 25 },
      { header: "Contact Person", key: "contact_person", width: 20 },
      { header: "Email", key: "customer_email", width: 25 },
      { header: "Phone", key: "customer_phone", width: 15 },
      { header: "Gender", key: "customer_gender", width: 10 },
      { header: "Date", key: "customer_date", width: 15 },

      { header: "Address Line", key: "address_line", width: 30 },
      { header: "Country", key: "country", width: 15 },
      { header: "Province", key: "province", width: 20 },
      { header: "District", key: "district", width: 20 },
      { header: "Sub-District", key: "sub_district", width: 20 },
      { header: "Zipcode", key: "zipcode", width: 10 },

      { header: "Tax ID", key: "customer_tax_id", width: 20 },
      { header: "Tax Address", key: "tax_addr", width: 50 }, // 🟢 ขยายความกว้างเผื่อที่อยู่ยาว
      { header: "Note", key: "note", width: 25 },
    ];

    // ตกแต่งหัวตารางให้เป็นตัวหนา
    worksheet.getRow(1).font = { bold: true };

    // 5. นำข้อมูลจาก Database ยัดใส่แต่ละแถว
    customers.forEach((c) => {
      let formattedTaxAddr = "-";
      if (c.tax_addr) {
        // ดึงเฉพาะค่าที่มีอยู่จริงมาต่อกันด้วยลูกน้ำ (,)
        const taxParts = [
          c.tax_addr.address_line,
          c.tax_addr.sub_district,
          c.tax_addr.district,
          c.tax_addr.province,
          c.tax_addr.country,
          c.tax_addr.zipcode,
        ].filter(Boolean); // filter(Boolean) จะช่วยตัดค่าที่เป็น undefined, null, "" ทิ้งไป

        if (taxParts.length > 0) {
          formattedTaxAddr = taxParts.join(", ");
        }
      }

      worksheet.addRow({
        customer_id: c.customer_id,
        business_type: c.business_type,
        customer_name: c.customer_name,
        company_name: c.company_name || "-",
        contact_person: c.contact_person,
        customer_email: c.customer_email || "-",
        customer_phone: c.customer_phone,
        customer_gender: c.customer_gender || "-",

        // จัดฟอร์แมตวันที่ให้สวยงาม
        customer_date: c.customer_date
          ? new Date(c.customer_date).toLocaleDateString("th-TH")
          : "-",

        address_line: c.address?.address_line || "-",
        country: c.address?.country || "-",
        province: c.address?.province || "-",
        district: c.address?.district || "-",
        sub_district: c.address?.sub_district || "-",
        zipcode: c.address?.zipcode || "-",

        customer_tax_id: c.customer_tax_id || "-",
        tax_addr: formattedTaxAddr,
        note: c.note || "-",
      });
    });

    // 6. ตั้งค่า Header สำหรับให้ Browser สั่งดาวน์โหลดไฟล์
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Customers_Export.xlsx",
    );

    // 7. เขียนไฟล์และส่งออกไป
    await workbook.xlsx.write(res);
    res.status(200).end();
  } catch (err) {
    console.error("Export Excel Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error during export" });
  }
};
