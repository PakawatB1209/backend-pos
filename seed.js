require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Import Models
const Permission = require("./models/Permission");
const Company = require("./models/Company");
const User = require("./models/User");

// Config Data
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
    console.log("Connecting to Database (POS-jewely)...");

    await mongoose.connect(
      "mongodb+srv://SA:$ystem64@poscooperativeeducation.jwqfqk0.mongodb.net/POS-jewely?retryWrites=true&w=majority&appName=poscooperativeeducation"
    );
    console.log("Database Connected!");

    console.log(" Seeding Permissions...");
    let permCount = 0;
    for (const menu of menus) {
      for (const action of actions) {
        const exists = await Permission.findOne({
          permission_menu: menu,
          permission_action: action,
        });

        if (!exists) {
          await Permission.create({
            permission_name: `${action.toUpperCase()} ${menu}`,
            permission_menu: menu,
            permission_action: action,
          });
          permCount++;
        }
      }
    }
    console.log(`   -> Added ${permCount} new permissions.`);

    console.log(" Seeding Company...");
    let company = await Company.findOne({
      comp_email: "contact@jewelyshop.com",
    });

    if (!company) {
      company = await Company.create({
        comp_name: "Jewelry Shop (Head Office)",
        comp_addr: "123 Silom Road",
        comp_subdist: "Silom",
        comp_dist: "Bang Rak",
        comp_prov: "Bangkok",
        comp_zip: "10500",
        comp_email: "contact@jewelyshop.com",
        comp_taxid: "1234567890123",
        comp_phone: "02-123-4567",
        comp_person_name: "Manager Name",
        comp_person_phone: "081-999-9999",
        comp_person_email: "manager@jewelyshop.com",
      });
      console.log(`   -> Created Company: ${company.comp_name}`);
    } else {
      console.log(`   -> Company already exists: ${company.comp_name}`);
    }

    console.log(" Seeding Admin User...");
    const adminEmail = "admin@pos.com";
    const userExists = await User.findOne({ user_email: adminEmail });

    if (!userExists) {
      const allPermissions = await Permission.find({});
      const permissionIds = allPermissions.map((p) => p._id);

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("123456", salt);

      await User.create({
        user_name: "Super Admin",
        user_email: adminEmail,
        user_password: hashedPassword,
        user_role: "Admin",
        user_phone: "081-000-0000",
        permissions: permissionIds,
        comp_id: company._id,
        status: true,
      });
      console.log(`   -> Created Admin: ${adminEmail} (Pass: 123456)`);
    } else {
      console.log(`   -> Admin user already exists.`);
    }

    console.log("\n ALL DONE! System is ready.");
    process.exit();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

seedData();
