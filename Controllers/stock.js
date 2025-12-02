const Stock = require("../models/Stock");
//const StockTransaction = require("../models/StockTransaction");
const User = require("../models/User");

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
      { new: true, upsert: true }
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
    const id = req.params.id;
    const stock = await Stock.findOne({ _id: id });
    res.send(stock);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};

exports.list = async (req, res) => {
  try {
    const stock = await Stock.find();
    res.send(stock);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};

exports.updateStock = async (req, res) => {
  try {
    const id = req.params.id;
    const update_stock = await Stock.findOneAndUpdate({ _id: id }, req.body, {
      new: true,
    });
    res.send(update_stock);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};

exports.removeOneStock = async (req, res) => {
  try {
    const id = req.params.id;
    const remove_stock = await Stock.findOneAndDelete({ _id: id });
    res.send(remove_stock);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};
