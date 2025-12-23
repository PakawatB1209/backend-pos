const Masters = require("../models/masters");
const User = require("../models/User");

exports.createmasters = async (req, res) => {
  try {
    const { master_name, master_type, master_color } = req.body;

    const userId = req.user.id;

    if (!master_name || !master_type) {
      return res.status(400).json({
        success: false,
        message: "Please specify Name and Type.",
      });
    }

    const user = await User.findById(userId).select("comp_id");
    if (!user || !user.comp_id) {
      return res.status(400).json({
        success: false,
        message: "No company assigned. Cannot create Master Data.",
      });
    }

    const existingMaster = await Masters.findOne({
      comp_id: user.comp_id,
      master_type: master_type,
      master_name: master_name,
    });

    if (existingMaster) {
      return res.status(400).json({
        success: false,
        message: `"${master_name}" already exists in "${master_type}".`,
      });
    }

    const newMaster = await Masters.create({
      master_name,
      master_type,
      master_color,
      comp_id: user.comp_id,
    });

    res.status(201).json({
      success: true,
      message: "Master Data created successfully.",
      data: newMaster,
    });
  } catch (error) {
    console.log("Error create masters:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getOnemasters = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format.",
      });
    }

    const masters = await Masters.findById(id).lean();

    if (!masters) {
      return res.status(404).json({
        success: false,
        message: "Master Data not found.",
      });
    }

    res.status(200).json({
      success: true,
      data: masters,
    });
  } catch (error) {
    console.log("Error get master:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.list = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select("comp_id");

    if (!user || !user.comp_id) {
      return res.status(400).json({
        success: false,
        message:
          "User is not associated with a company (Cannot view Master Data).",
      });
    }

    const { type } = req.query;

    let query = { comp_id: user.comp_id };

    if (type) {
      const typeList = type.split(",");
      query.master_type = { $in: typeList };
    }

    const masters = await Masters.find(query).sort({
      master_type: 1,
      master_name: 1,
    });

    res.status(200).json({
      success: true,
      count: masters.length,
      data: masters,
    });
  } catch (error) {
    console.log("Error list masters:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
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
