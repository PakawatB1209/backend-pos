const Cuting = require("../models/Cuting");

exports.createCuting = async (req, res) => {
  try {
    console.log(req.body);
    const cuting = await new Cuting(req.body).save();
    res.send(cuting);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server error");
  }
};

exports.getOneCuting = async (req, res) => {
  try {
    const id = req.params.id;
    const cuting = await Cuting.findOne({ _id: id });
    res.send(cuting);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};

exports.listCuting = async (req, res) => {
  try {
    const cuting = await Cuting.find();
    res.send(cuting);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};
