const Shape = require("../models/Shape");

exports.createShape = async (req, res) => {
  try {
    console.log(req.body);
    const shape = await new Shape(req.body).save();
    res.send(shape);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server error");
  }
};

exports.getOneShape = async (req, res) => {
  try {
    const id = req.params.id;
    const shape = await Shape.findOne({ _id: id });
    res.send(shape);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};

exports.listShape = async (req, res) => {
  try {
    const shape = await Shape.find();
    res.send(shape);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};
