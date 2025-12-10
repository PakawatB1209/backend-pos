const Customer = require("../models/Customer");

const generateCustomerID = async () => {
  const lastCustomer = await Customer.findOne().sort({ createdAt: -1 });
  let newId = "CUS-00001";

  if (lastCustomer && lastCustomer.customer_id) {
    const lastId = lastCustomer.customer_id;
    const numberPart = parseInt(lastId.split("-")[1]);
    const nextNumber = numberPart + 1;
    newId = `CUS-${String(nextNumber).padStart(5, "0")}`;
  }
  return newId;
};

exports.createCustomer = async (req, res) => {
  try {
    const data = req.body;

    const existing = await Customer.findOne({
      customer_name: data.customer_name,
    });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Customer Name already exists." });
    }

    if (!data.customer_id) {
      data.customer_id = await generateCustomerID();
    }

    const newCustomer = new Customer(data);
    await newCustomer.save();

    res.status(201).json({
      success: true,
      message: "Customer added successfully.",
      data: newCustomer,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.listCustomers = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { customer_name: { $regex: search, $options: "i" } },
        { customer_id: { $regex: search, $options: "i" } },
        { customer_phone: { $regex: search, $options: "i" } },
        { company_name: { $regex: search, $options: "i" } },
      ];
    }

    const customers = await Customer.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: customers.length,
      data: customers,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.getCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id);

    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found." });
    }

    res.json({ success: true, data: customer });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const updatedCustomer = await Customer.findByIdAndUpdate(id, data, {
      new: true,
    });

    if (!updatedCustomer) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found." });
    }

    res.json({
      success: true,
      message: "Customer updated successfully.",
      data: updatedCustomer,
    });
  } catch (err) {
    console.log(err);
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
