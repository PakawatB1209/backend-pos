require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// ⚠️ Import Models (ต้องมีไฟล์เหล่านี้ในโฟลเดอร์ models)
const Permission = require("./models/Permission");
const Company = require("./models/Company");
const User = require("./models/User");
const Masters = require("./models/Masters"); // 🔥 เพิ่ม Model Masters
const Warehouse = require("./models/Warehouse"); // 🔥 เพิ่ม Model Warehouse

// Config Permissions
const menus = [
  "User Management",
  "Product Master",
  "Stone",
  "Semi-Mount",
  "Accessories",
  "Others",
  "Product List",
  "Customer",
];
const actions = ["view", "add", "update", "delete", "print"];

const seedData = async () => {
  try {
    console.log("🔥 Connecting to Database (POS-jewely)...");
    await mongoose.connect(
      "mongodb+srv://SA:$ystem64@poscooperativeeducation.jwqfqk0.mongodb.net/POS-jewely?retryWrites=true&w=majority&appName=poscooperativeeducation"
    );
    console.log("✅ Database Connected!");

    // // ==========================================
    // // 1. สร้าง Permissions
    // // ==========================================
    // console.log("Seeding Permissions...");
    // let permCount = 0;
    // for (const menu of menus) {
    //   for (const action of actions) {
    //     const exists = await Permission.findOne({
    //       permission_menu: menu,
    //       permission_action: action,
    //     });
    //     if (!exists) {
    //       await Permission.create({
    //         permission_name: `${action.toUpperCase()} ${menu}`,
    //         permission_menu: menu,
    //         permission_action: action,
    //       });
    //       permCount++;
    //     }
    //   }
    // }
    // console.log(`-> Added ${permCount} new permissions.`);
    // // ==========================================
    // // 3. สร้าง Admin User
    // // ==========================================
    console.log("Seeding Admin User...");
    const adminEmail = "testsemail@gmail.com";
    const userExists = await User.findOne({ user_email: adminEmail });

    if (!userExists) {
      const allPermissions = await Permission.find({});
      const permissionIds = allPermissions.map((p) => p._id);
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("123456", salt);

      await User.create({
        user_name: "Admin6",
        user_email: adminEmail,
        user_password: hashedPassword,
        user_role: "Admin",
        user_phone: "081-000-0000",
        comp_id: null,
        permissions: permissionIds,
        status: true,
      });
      console.log(`   -> Created Admin: ${adminEmail} (Pass: 123456)`);
    } else {
      console.log(`   -> Admin user already exists.`);
    }

    console.log("\n🎉 ALL DONE! System is ready with Full Data.");
    process.exit();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

seedData();
