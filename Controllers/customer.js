const mongoose = require("mongoose");
const User = require("../models/User");
const Customer = require("../models/Customer");
const Counter = require("../models/Counter");
const PNF = require("google-libphonenumber").PhoneNumberFormat;
const phoneUtil =
  require("google-libphonenumber").PhoneNumberUtil.getInstance();

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

// const generateCustomerID = async () => {
//   const lastCustomer = await Customer.findOne().sort({ createdAt: -1 });
//   let newId = "CUS-00001";

//   if (lastCustomer && lastCustomer.customer_id) {
//     const lastId = lastCustomer.customer_id;
//     const numberPart = parseInt(lastId.split("-")[1]);
//     const nextNumber = numberPart + 1;
//     newId = `CUS-${String(nextNumber).padStart(5, "0")}`;
//   }
//   return newId;
// };
// exports.createCustomer = async (req, res) => {
//   try {
//     if (!req.user || !req.user.id) {
//       return res
//         .status(401)
//         .json({ success: false, message: "Unauthorized access." });
//     }

//     const user = await User.findById(req.user.id).select("comp_id");

//     if (!user || !user.comp_id) {
//       return res.status(403).json({
//         success: false,
//         message: "User is not assigned to any company.",
//       });
//     }

//     const {
//       customer_name,
//       customer_addr,
//       customer_subdist_business,
//       customer_date,
//       customer_email,
//       customer_phone,
//       customer_tax_id,
//       customer_gender,
//       note,
//       tax_addr,
//       contact_person,
//       company_name,
//     } = req.body;

//     if (!customer_name || !customer_phone) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Please fill required fields." });
//     }

//     const existing = await Customer.findOne({
//       customer_name: customer_name,
//       comp_id: user.comp_id,
//     });

//     if (existing) {
//       return res.status(400).json({
//         success: false,
//         message: `Customer "${customer_name}" already exists in your company.`,
//       });
//     }
//     const newCustomerID = await generateCustomerID(user.comp_id);

//     const newCustomer = new Customer({
//       customer_id: newCustomerID,
//       customer_name,
//       customer_addr,
//       customer_subdist_business,
//       customer_date,
//       customer_email,
//       customer_phone,
//       customer_tax_id,
//       customer_gender,
//       note,
//       tax_addr,
//       contact_person,
//       company_name,
//       comp_id: user.comp_id,
//     });

//     await newCustomer.save();

//     res.status(201).json({
//       success: true,
//       message: "Customer added successfully.",
//       data: newCustomer,
//     });
//   } catch (err) {
//     console.error("Create Customer Error:", err);
//     res
//       .status(500)
//       .json({ success: false, message: "Server Error", error: err.message });
//   }
// };

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

      addr_province,
      addr_district,
      addr_sub_district,
      addr_zipcode,

      customer_date,
      customer_email,
      customer_phone,
      customer_tax_id,
      customer_gender,
      note,
      tax_addr,
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
        const number = phoneUtil.parseAndKeepRawInput(customer_phone, TH);

        if (!phoneUtil.isValidNumber(number)) {
          return res.status(400).json({
            success: false,
            message: "Invalid phone number format (เบอร์โทรศัพท์ไม่ถูกต้อง)",
          });
        }

        finalPhone = phoneUtil.format(number, PNF.E164);
      } catch (error) {
        console.log("Phone parse error:", error.message);
        return res.status(400).json({
          success: false,
          message: "Unable to parse phone number (รูปแบบเบอร์โทรศัพท์ผิดพลาด)",
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
      { new: true, upsert: true }
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
      tax_addr,
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

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { search } = req.query;

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i"); // สร้าง Regex ที่ปลอดภัย
      query.$or = [
        { customer_name: regex },
        { customer_id: regex },
        { customer_phone: regex },
        { company_name: regex },
        { contact_person: regex },
        { email: regex },
      ];
    }

    const customers = await Customer.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Customer.countDocuments(query);

    res.json({
      success: true,
      count: customers.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
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
      addr_province,
      addr_district,
      addr_sub_district,
      addr_zipcode,

      customer_date,
      customer_email,
      customer_phone,
      customer_tax_id,
      customer_gender,
      note,
      tax_addr,
    } = req.body;

    let finalPhone = customer_phone;

    if (customer_phone) {
      try {
        const number = phoneUtil.parseAndKeepRawInput(customer_phone, "TH");

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

      ...(addr_province && { "address.province": addr_province }),
      ...(addr_district && { "address.district": addr_district }),
      ...(addr_sub_district && { "address.sub_district": addr_sub_district }),
      ...(addr_zipcode && { "address.zipcode": addr_zipcode }),

      ...(customer_date && { customer_date: new Date(customer_date) }),
      ...(customer_email && { customer_email }),
      ...(customer_phone && { customer_phone: finalPhone }),
      ...(customer_tax_id && { customer_tax_id }),
      ...(customer_gender && { customer_gender }),
      ...(note !== undefined && { note }),
      ...(tax_addr && { tax_addr }),

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
      { new: true, runValidators: true }
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
