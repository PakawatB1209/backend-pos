const Masters = require("../models/masters");

exports.createmasters = async (req, res) => {
  try {
    console.log(req.body);
    const masters = await new Masters(req.body).save();
    res.send(masters);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server error");
  }
};

exports.getOnemasters = async (req, res) => {
  try {
    const id = req.params.id;
    const masters = await Masters.findOne({ _id: id });
    res.send(masters);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};

exports.list = async (req, res) => {
  try {
    const masters = await Masters.find();
    res.send(masters);
  } catch (error) {
    console.log(err);
    res.status(500).send("Server error");
  }
};

// exports.removeOneCompany = async (req, res) => {
//   try {
//     const id = req.params.id;
//     const remove = await Company.findOneAndDelete({ _id: id });
//     res.send(remove);
//   } catch (error) {
//     console.log(err);
//     res.status(500).send("Server error");
//   }
// };
