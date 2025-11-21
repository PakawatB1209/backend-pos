const Group = require("../models/Group");

exports.createItemtype = async (req, res) => {
  try {
    console.log(req.body);
    const group = await new Group(req.body).save();
    res.send(group);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server error");
  }
};

exports.getOneItemtype = async (req, res) => {
  try {
    const id = req.params.id;
    const group = await Group.findOne({ _id: id });
    res.send(group);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};

exports.listItemtype = async (req, res) => {
  try {
    const group = await Group.find();
    res.send(group);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};
