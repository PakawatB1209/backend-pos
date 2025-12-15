const mongoose = require("mongoose");
const User = require("../models/User");
const Customer = require("../models/Customer");
const Counter = require("../models/Counter");

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
      customer_addr,
      customer_subdist_business,
      customer_date,
      customer_email,
      customer_phone,
      customer_tax_id,
      customer_gender,
      note,
      tax_addr,
      contact_person,
      company_name,
    } = req.body;

    if (!customer_name || !customer_phone) {
      return res
        .status(400)
        .json({ success: false, message: "Please fill required fields." });
    }

    const counterName = `customer_id_${user.comp_id}`;

    const counter = await Counter.findByIdAndUpdate(
      { _id: counterName },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const seqStr = counter.seq.toString().padStart(4, "0"); // เติม 0 ข้างหน้าให้ครบ 4 หลัก
    const newCustomerID = `CUS-${seqStr}`;

    const newCustomer = new Customer({
      customer_id: newCustomerID,
      customer_name,
      customer_addr,
      customer_subdist_business,
      customer_date,
      customer_email,
      customer_phone,
      customer_tax_id,
      customer_gender,
      note,
      tax_addr,
      contact_person,
      company_name,

      comp_id: user.comp_id,
    });

    await newCustomer.save();

    res.status(201).json({
      success: true,
      message: "Customer added successfully.",
      data: newCustomer,
    });
  } catch (err) {
    console.error("Create Customer Error:", err);
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

    const { search } = req.query;

    if (search) {
      query.$or = [
        { customer_name: { $regex: search, $options: "i" } },
        { customer_id: { $regex: search, $options: "i" } },
        { customer_phone: { $regex: search, $options: "i" } },
        { company_name: { $regex: search, $options: "i" } },
        { contact_person: { $regex: search, $options: "i" } },
      ];
    }

    const customers = await Customer.find(query).sort({ createdAt: -1 }).lean();

    res.json({
      success: true,
      count: customers.length,
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
      customer_addr,
      customer_subdist_business,
      customer_date,
      customer_email,
      customer_phone,
      customer_tax_id,
      customer_gender,
      note,
      tax_addr,
      contact_person,
      company_name,
    } = req.body;

    const updateFields = {
      customer_name,
      customer_addr,
      customer_subdist_business,
      customer_date,
      customer_email,
      customer_phone,
      customer_tax_id,
      customer_gender,
      note,
      tax_addr,
      contact_person,
      company_name,
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
    const deleted = await Customer.findByIdAndDelete(id);

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found." });
    }

    res.json({ success: true, message: "Customer deleted successfully." });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
