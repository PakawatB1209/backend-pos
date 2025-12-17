const mongoose = require("mongoose");
const Permission = require("../models/Permission");
const User = require("../models/User");

exports.createPermission = async (req, res) => {
  try {
    const { permission_name, permission_menu, permission_action } = req.body;

    if (!permission_menu || !permission_action) {
      return res.status(400).json({
        success: false,
        message: "Invalid Menu/Action.",
      });
    }

    const allowedActions = [
      "add",
      "view",
      "update",
      "delete",
      "export",
      "print",
    ];
    if (!allowedActions.includes(permission_action)) {
      return res.status(400).json({
        success: false,
        message: `Invalid Action! Allowed values: ${allowedActions.join(", ")}`,
      });
    }

    const existingPermission = await Permission.findOne({
      permission_menu: permission_menu,
      permission_action: permission_action,
    });

    if (existingPermission) {
      return res.status(400).json({
        success: false,
        message: `Permission (${permission_menu} -> ${permission_action}) already exists.`,
      });
    }

    const newPermission = await Permission.create({
      permission_name,
      permission_menu,
      permission_action,
    });

    res.status(201).json({
      success: true,
      message: "Successfully created",
      data: newPermission,
    });
  } catch (error) {
    console.log("Error create permission:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getOnePermission = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    const permission = await Permission.findById(id).select("-__v").lean();

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: "Not found permission",
      });
    }
    res.status(200).json({
      success: true,
      data: permission,
    });
  } catch (error) {
    console.log("Error get permission:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.list = async (req, res) => {
  try {
    const permissions = await Permission.find().select("-__v").lean();

    res.status(200).json({
      success: true,
      count: permissions.length,
      data: permissions,
    });
  } catch (error) {
    console.log("Error list permissions:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.updatePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const { permission_name, permission_menu, permission_action } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    const currentPermission = await Permission.findById(id);
    if (!currentPermission) {
      return res.status(404).json({
        success: false,
        message: "Not found permission",
      });
    }

    const newMenu = permission_menu || currentPermission.permission_menu;
    const newAction = permission_action || currentPermission.permission_action;

    const duplicateCheck = await Permission.findOne({
      permission_menu: newMenu,
      permission_action: newAction,
      _id: { $ne: id },
    });

    if (duplicateCheck) {
      return res.status(400).json({
        success: false,
        message: `Cannot update. Permission (${newMenu} -> ${newAction}) already exists.`,
      });
    }

    const updatedPermission = await Permission.findByIdAndUpdate(
      id,
      { permission_name, permission_menu, permission_action },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Update successful.",
      data: updatedPermission,
    });
  } catch (error) {
    console.log("Error update permission:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }
    const deletedPermission = await Permission.findByIdAndDelete(id);

    if (!deletedPermission) {
      return res.status(404).json({
        success: false,
        message: "Permission not found (may have been deleted).",
      });
    }

    await User.updateMany({ permissions: id }, { $pull: { permissions: id } });

    res.status(200).json({
      success: true,
      message: "Permission deleted and removed from all users.",
      data: deletedPermission,
    });
  } catch (error) {
    console.log("Error remove permission:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.removeByMenu = async (req, res) => {
  try {
    const { permission_menu } = req.body;

    if (!permission_menu) {
      return res.status(400).json({
        success: false,
        message: "Please specify the permission_menu to delete.",
      });
    }

    const permissionsToDelete = await Permission.find({
      permission_menu,
    }).select("_id");

    if (permissionsToDelete.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Permission for menu "${permission_menu}" not found`,
      });
    }

    const idsToDelete = permissionsToDelete.map((p) => p._id);

    await User.updateMany(
      { permissions: { $in: idsToDelete } },
      { $pull: { permissions: { $in: idsToDelete } } }
    );

    const result = await Permission.deleteMany({ permission_menu });

    res.status(200).json({
      success: true,
      message: `Menu "${permission_menu}" and all related permissions (${result.deletedCount} items) deleted successfully.`,
      deletedIds: idsToDelete,
    });
  } catch (error) {
    console.log("Error remove by menu:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
