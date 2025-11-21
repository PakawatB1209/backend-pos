const Clarity = require("../models/Clarity");

exports.createShape = async (req, res) => {
  try {
    console.log(req.body);
    const clarity = await new Clarity(req.body).save();
    res.send(clarity);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server error");
  }
};

exports.getOneShape = async (req, res) => {
  try {
    const id = req.params.id;
    const clarity = await Clarity.findOne({ _id: id });
    res.send(clarity);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};

exports.listShape = async (req, res) => {
  try {
    const clarity = await Clarity.find();
    res.send(clarity);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};
