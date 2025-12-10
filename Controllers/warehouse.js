const Warehouse = require("../models/Warehouse");
const User = require("../models/User");

// create warehoues at company

// exports.createWarehouse = async (req, res) => {
//   try {
//     console.log(req.body);
//     const warehouse = await new Warehouse(req.body).save();
//     res.send(warehouse);
//   } catch (error) {
//     console.log(error);
//     res.status(500).send("Server error");
//   }
// };

// exports.createWarehouse = async (req, res) => {
//   try {
//     const { warehouse_name, warehouse_type } = req.body;

//     if (!warehouse_name || !warehouse_type) {
//       return res.status(400).json({
//         success: false,
//         message: "Please specify the warehouse name and type.",
//       });
//     }

//     const existingWarehouse = await Warehouse.findOne({
//       warehouse_name: warehouse_name,
//     });

//     if (existingWarehouse) {
//       return res.status(400).json({
//         success: false,
//         message: `Warehouse name "${warehouse_name}" already exists.`,
//       });
//     }

//     const newWarehouse = await Warehouse.create({
//       warehouse_name,
//       warehouse_type,
//     });

//     res.status(201).json({
//       success: true,
//       message: "Warehouse created successfully.",
//       data: newWarehouse,
//     });
//   } catch (error) {
//     console.log("Error create warehouse:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// };

exports.getOneWarehouse = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    const warehouse = await Warehouse.findById(id).lean();

    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: "Warehouse not found.",
      });
    }

    res.status(200).json({
      success: true,
      data: warehouse,
    });
  } catch (error) {
    console.log("Error get warehouse:", error);
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
        message: "User has no company. Cannot view warehouses.",
      });
    }
    const warehouses = await Warehouse.find({ comp_id: user.comp_id })
      .sort({ createdAt: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: warehouses,
    });
  } catch (error) {
    console.log("Error list warehouses:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// exports.updateWarehouse = async (req, res) => {
//   try {
//     const id = req.params.id;
//     const update_warehouse = await Warehouse.findOneAndUpdate(
//       { _id: id },
//       req.body,
//       { new: true }
//     );
//     res.send(update_warehouse);
//   } catch (error) {
//     console.log(err);
//     res.status(500).send("Server error");
//   }
// };

// exports.removeOneWarehouse = async (req, res) => {
//   try {
//     const id = req.params.id;
//     const remove_warehouse = await Warehouse.findOneAndDelete({ _id: id });
//     res.send(remove_warehouse);
//   } catch (error) {
//     console.log(err);
//     res.status(500).send("Server error");
//   }
// };
