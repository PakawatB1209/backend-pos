const Company = require("../models/Company");
const User = require("../models/User");
const Warehouse = require("../models/Warehouse");
const Product = require("../models/Product");
const Masters = require("../models/masters");
const mongoose = require("mongoose");

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
      comp_person_email,
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
      "comp_person_email",
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
      comp_person_email,
    });

    //default warehouse
    const warehouseTemplates = [
      { name: "Product Master", type: "productmaster" },
      { name: "Stone", type: "stone" },
      { name: "Semi-mount", type: "semimount" },
      { name: "Accessory", type: "accessory" },
      { name: "Others", type: "others" },
    ];

    const warehousesToSave = warehouseTemplates.map((template) => ({
      warehouse_name: template.name,
      warehouse_type: template.type,
      comp_id: newCompany._id,
    }));
    await Warehouse.insertMany(warehousesToSave);

    //default masters
    const masterTemplates = [
      { master_name: "Ring", master_type: "item_type" },
      { master_name: "Necklace", master_type: "item_type" },
      { master_name: "Earrings", master_type: "item_type" },
      { master_name: "Bracelet", master_type: "item_type" },
      { master_name: "Bangle", master_type: "item_type" },
      { master_name: "Pendant", master_type: "item_type" },

      {
        master_name: "10K Gold",
        master_type: "metal",
        master_color: "Yellow",
      },
      {
        master_name: "14K Gold",
        master_type: "metal",
        master_color: "Yellow",
      },
      {
        master_name: "18K Gold",
        master_type: "metal",
        master_color: "Yellow",
      },
      {
        master_name: "22K Gold",
        master_type: "metal",
        master_color: "Yellow",
      },
      {
        master_name: "24K Gold",
        master_type: "metal",
        master_color: "Yellow",
      },
      {
        master_name: "White Gold",
        master_type: "metal",
        master_color: "White",
      },
      {
        master_name: "Rose Gold",
        master_type: "metal",
        master_color: "Rose",
      },
      {
        master_name: "Platinum",
        master_type: "metal",
        master_color: "Platinum",
      },
      {
        master_name: "Silver",
        master_type: "metal",
        master_color: "Silver",
      },

      { master_name: "Round Brilliant", master_type: "shape" },
      { master_name: "Princess", master_type: "shape" },
      { master_name: "Cushion", master_type: "shape" },
      { master_name: "Oval", master_type: "shape" },
      { master_name: "Pear", master_type: "shape" },
      { master_name: "Marquise", master_type: "shape" },
      { master_name: "Emerald", master_type: "shape" },
      { master_name: "Asscher", master_type: "shape" },
      { master_name: "Heart", master_type: "shape" },
      { master_name: "Trilliant", master_type: "shape" },
      { master_name: "Old European", master_type: "shape" },
      { master_name: "Radiant", master_type: "shape" },

      { master_name: "Excellent", master_type: "cuting" },
      { master_name: "Very Good", master_type: "cuting" },
      { master_name: "Good", master_type: "cuting" },
      { master_name: "Fair", master_type: "cuting" },
      { master_name: "Poor", master_type: "cuting" },
      { master_name: "n/a", master_type: "cuting" },

      { master_name: "FL (Flawless)", master_type: "clarity" },
      { master_name: "IF (Internally Flawless)", master_type: "clarity" },
      { master_name: "VVS1", master_type: "clarity" },
      { master_name: "VVS2", master_type: "clarity" },
      { master_name: "VS1", master_type: "clarity" },
      { master_name: "VS2", master_type: "clarity" },
      { master_name: "SI1", master_type: "clarity" },
      { master_name: "SI2", master_type: "clarity" },
      { master_name: "I1", master_type: "clarity" },
      { master_name: "I2", master_type: "clarity" },
      { master_name: "I3", master_type: "clarity" },

      // Precious
      {
        master_name: "Diamond",
        master_type: "stone_name",
        master_color: "White",
      },
      {
        master_name: "Ruby",
        master_type: "stone_name",
        master_color: "Red",
      },
      {
        master_name: "Blue Sapphire",
        master_type: "stone_name",
        master_color: "Blue",
      },
      {
        master_name: "Yellow Sapphire",
        master_type: "stone_name",
        master_color: "Yellow",
      },
      {
        master_name: "Emerald",
        master_type: "stone_name",
        master_color: "Green",
      },

      // กลุ่ม Semi-Precious
      {
        master_name: "Amethyst",
        master_type: "stone_name",
        master_color: "Purple",
      },
      {
        master_name: "Garnet",
        master_type: "stone_name",
        master_color: "Dark Red",
      },
      {
        master_name: "Peridot",
        master_type: "stone_name",
        master_color: "Green",
      },
      {
        master_name: "Topaz",
        master_type: "stone_name",
        master_color: "Yellow",
      },
      {
        master_name: "Blue Topaz",
        master_type: "stone_name",
        master_color: "Light Blue",
      },
      {
        master_name: "Citrine",
        master_type: "stone_name",
        master_color: "Yellow",
      },
      {
        master_name: "Aquamarine",
        master_type: "stone_name",
        master_color: "Light Blue",
      },
      {
        master_name: "Tourmaline",
        master_type: "stone_name",
        master_color: "Pink",
      },
      {
        master_name: "Opal",
        master_type: "stone_name",
        master_color: "White",
      },
      {
        master_name: "Spinel",
        master_type: "stone_name",
        master_color: "Red",
      },
      {
        master_name: "Zircon",
        master_type: "stone_name",
        master_color: "Blue",
      },
      {
        master_name: "Tanzanite",
        master_type: "stone_name",
        master_color: "Violet",
      },
      {
        master_name: "Turquoise",
        master_type: "stone_name",
        master_color: "Turquoise",
      },
      {
        master_name: "Jade",
        master_type: "stone_name",
        master_color: "Green",
      },
      {
        master_name: "Onyx",
        master_type: "stone_name",
        master_color: "Black",
      },

      // กลุ่ม Organic
      {
        master_name: "Pearl",
        master_type: "stone_name",
        master_color: "White",
      },
    ];

    const mastersToSave = masterTemplates.map((t) => ({
      master_name: t.master_name,
      master_type: t.master_type,
      master_color: t.master_color,
      comp_id: newCompany._id,
    }));

    await Masters.insertMany(mastersToSave);

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

    await Warehouse.deleteMany({ comp_id: id });

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
