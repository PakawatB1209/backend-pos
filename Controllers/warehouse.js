const Warehouse = require("../models/Warehouse");

exports.createWarehouse = async (req, res) => {
  try {
    console.log(req.body);
    const warehouse = await new Warehouse(req.body).save();
    res.send(warehouse);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server error");
  }
};

exports.getOneWarehouse = async (req, res) => {
  try {
    const id = req.params.id;
    const warehouse = await Warehouse.findOne({ _id: id });
    res.send(warehouse);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};

exports.list = async (req, res) => {
  try {
    const warehouses = await Warehouse.find();
    res.send(warehouses);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};

exports.updateWarehouse = async (req, res) => {
  try {
    const id = req.params.id;
    const update_warehouse = await Warehouse.findOneAndUpdate(
      { _id: id },
      req.body,
      { new: true }
    );
    res.send(update_warehouse);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};

exports.removeOneWarehouse = async (req, res) => {
  try {
    const id = req.params.id;
    const remove_warehouse = await Warehouse.findOneAndDelete({ _id: id });
    res.send(remove_warehouse);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};
