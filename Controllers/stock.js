const Stock = require("../models/Stock");

exports.createStock = async (req, res) => {
  try {
    console.log(req.body);
    const stock = await new Stock(req.body).save();
    res.send(stock);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server error");
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
