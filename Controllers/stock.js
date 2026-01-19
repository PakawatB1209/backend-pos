const Stock = require("../models/Stock");
const StockTransaction = require("../models/StockTransaction");
const User = require("../models/User");
const mongoose = require("mongoose");
const xlsx = require("xlsx-js-style");
const Product = require("../models/Product");

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
      { new: true, upsert: true },
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
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format" });
    }

    const user = await User.findById(userId).select("comp_id");
    if (!user || !user.comp_id) {
      return res
        .status(400)
        .json({ success: false, message: "User not associated with company" });
    }
    const stock = await Stock.findOne({
      _id: id,
      comp_id: user.comp_id,
    })
      .populate({
        path: "product_id",
        select: "product_code product_name file price",
      })
      .populate({
        path: "warehouse_id",
        select: "warehouse_name",
      });

    if (!stock) {
      return res
        .status(404)
        .json({ success: false, message: "Stock not found" });
    }

    res.status(200).json({
      success: true,
      data: stock,
    });
  } catch (error) {
    console.log("Error getOneStock:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.list = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select("comp_id");

    if (!user || !user.comp_id) {
      return res
        .status(400)
        .json({ success: false, message: "User not associated with company" });
    }

    const stock = await Stock.find({ comp_id: user.comp_id })
      .populate({
        path: "product_id",
        select: "product_code product_name file",
      })
      .populate({
        path: "warehouse_id",
        select: "warehouse_name",
      });

    res.status(200).json({
      success: true,
      data: stock,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.removeOneStock = async (req, res) => {
  try {
    const id = req.params.id;
    const comp_id = req.user.comp_id;

    const remove_stock = await Stock.findOneAndDelete({
      _id: id,
      comp_id: comp_id,
    });

    if (!remove_stock) {
      return res
        .status(404)
        .send(
          "Data not found or you do not have permission to delete this item.",
        );
    }

    res.send(remove_stock);
  } catch (err) {
    console.log(err);
    res.status(500).send("Server error");
  }
};

exports.removeStockAll = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await User.findById(req.user.id).select("comp_id");
    if (!user || !user.comp_id) {
      return res
        .status(400)
        .json({ success: false, message: "User has no company" });
    }
    const comp_id = user.comp_id;
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).send("Please provide an array of IDs.");
    }

    const result = await Stock.deleteMany({
      _id: { $in: ids },
      comp_id: comp_id,
    });

    if (result.deletedCount === 0) {
      return res
        .status(404)
        .send(
          "Data not found or you do not have permission to delete these items.",
        );
    }

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} items successfully.`,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Server error: " + err.message);
  }
};
