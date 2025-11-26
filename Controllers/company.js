const Company = require("../models/Company");
const User = require("../models/User");
const Warehouse = require("../models/Warehouse");
const Product = require("../models/Product");

exports.createCompany = async (req, res) => {
  try {
    const adminId = req.user.id;

    const {
      comp_name,
      comp_addr,
      comp_subdist,
      comp_dist,
      comp_prov,
      comp_zip,
      comp_email,
      comp_taxid,
      comp_phone,
      comp_person_name,
      comp_person_phone,
    } = req.body;

    const requiredFields = [
      "comp_name",
      "comp_addr",
      "comp_subdist",
      "comp_dist",
      "comp_prov",
      "comp_zip",
      "comp_email",
      "comp_taxid",
      "comp_phone",
      "comp_person_name",
      "comp_person_phone",
    ];

    const missingFields = requiredFields.filter((field) => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Please complete all fields (Missing fields: ${missingFields.join(
          ", "
        )})`,
      });
    }

    const existingComp = await Company.findOne({
      $or: [{ comp_email }, { comp_taxid }],
    });

    if (existingComp) {
      return res.status(400).json({
        success: false,
        message: "Email or Tax ID already exists.",
      });
    }

    const newCompany = await Company.create({
      comp_name,
      comp_addr,
      comp_subdist,
      comp_dist,
      comp_prov,
      comp_zip,
      comp_email,
      comp_taxid,
      comp_phone,
      comp_person_name,
      comp_person_phone,
    });

    const updatedUser = await User.findByIdAndUpdate(
      adminId,
      { comp_id: newCompany._id },
      { new: true }
    );

    res.status(201).json({
      success: true,
      message: "Setup Company Successful",
      company: newCompany,
      user: {
        user_name: updatedUser.user_name,
        comp_id: updatedUser.comp_id,
      },
    });
  } catch (error) {
    console.log("Error create company:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getOneCompany = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    const company = await Company.findById(id).select("-__v").lean();

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found.",
      });
    }

    res.status(200).json({
      success: true,
      data: company,
    });
  } catch (error) {
    console.error("Error getting company:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

exports.list = async (req, res) => {
  try {
    const companies = await Company.find()
      .select("-__v")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: companies,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.updateCompany = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format.",
      });
    }

    const allowedFields = [
      "comp_name",
      "comp_addr",
      "comp_subdist",
      "comp_dist",
      "comp_prov",
      "comp_zip",
      "comp_email",
      "comp_taxid",
      "comp_phone",
      "comp_person_name",
      "comp_person_phone",
    ];

    let updateData = {};
    allowedFields.forEach((key) => {
      if (req.body[key] !== undefined) {
        updateData[key] = req.body[key];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please specify data to update",
      });
    }

    const checkOr = [];
    if (updateData.comp_email)
      checkOr.push({ comp_email: updateData.comp_email });
    if (updateData.comp_taxid)
      checkOr.push({ comp_taxid: updateData.comp_taxid });

    if (checkOr.length > 0) {
      const exists = await Company.findOne({
        _id: { $ne: id },
        $or: checkOr,
      });

      if (exists) {
        return res.status(400).json({
          success: false,
          message: "Email or Tax ID already exists",
        });
      }
    }

    const updatedCompany = await Company.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updatedCompany) {
      return res.status(404).json({
        success: false,
        message: "Company not found.",
      });
    }

    // 7. ส่ง Response
    res.status(200).json({
      success: true,
      message: "Company updated successfully.",
      data: updatedCompany,
    });
  } catch (error) {
    console.log("Error update company:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.removeOneCompany = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format.",
      });
    }

    const companyToDelete = await Company.findById(id);
    if (!companyToDelete) {
      return res.status(404).json({
        success: false,
        message: "Company not found.",
      });
    }

    const deletedUsers = await User.deleteMany({ comp_id: id });
    console.log(`Deleted ${deletedUsers.deletedCount} users.`);

    await Warehouse.deleteMany({ comp_id: id });

    await Product.deleteMany({ comp_id: id });

    await Company.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: `Company "${companyToDelete.comp_name}" and all related data deleted successfully.`,
      details: {
        deletedCompanyId: id,
        deletedUsersCount: deletedUsers.deletedCount,
      },
    });
  } catch (error) {
    console.log("Error remove company:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
