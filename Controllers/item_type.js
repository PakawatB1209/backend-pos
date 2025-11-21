const Itemtype = require("../models/Item_type");

exports.createItemtype = async (req, res) => {
  try {
    console.log(req.body);
    const itemtype = await new Itemtype(req.body).save();
    res.send(itemtype);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server error");
  }
};

exports.getOneItemtype = async (req, res) => {
  try {
    const id = req.params.id;
    const itemtype = await Itemtype.findOne({ _id: id });
    res.send(itemtype);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};

exports.listItemtype = async (req, res) => {
  try {
    const itemtype = await Itemtype.find();
    res.send(itemtype);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};
