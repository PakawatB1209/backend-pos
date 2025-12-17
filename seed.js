require("dotenv").config();
const mongoose = require("mongoose");
const Permission = require("./models/Permission");

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

const seedPermissions = async () => {
  try {
    console.log("Connecting to Database...");
    await mongoose.connect(
      "mongodb+srv://SA:$ystem64@poscooperativeeducation.jwqfqk0.mongodb.net/?retryWrites=true&w=majority&appName=poscooperativeeducation"
    );
    console.log("Database Connected!");

    console.log("Start creating permissions...");

    let count = 0;
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
          console.log(`Created: ${menu} -> ${action}`);
          count++;
        }
      }
    }

    console.log(`\n Done! Created ${count} new permissions.`);
    process.exit();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

seedPermissions();
