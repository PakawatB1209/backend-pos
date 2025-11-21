const Metal = require("../models/Metal");

exports.createMetal = async (req, res) => {
  try {
    console.log(req.body);
    const metal = await new Metal(req.body).save();
    res.send(metal);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server error");
  }
};

exports.getOneMetal = async (req, res) => {
  try {
    const id = req.params.id;
    const metal = await Metal.findOne({ _id: id });
    res.send(metal);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};

exports.listMetal = async (req, res) => {
  try {
    const metal = await Metal.find();
    res.send(metal);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};
