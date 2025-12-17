const express = require("express");
const router = express.Router();

const {
  getOnePermission,
  list,
  createPermission,
  remove,
  removeByMenu,
  updatePermission,
} = require("../Controllers/permission");

router.get("/permission", list);

router.get("/getone-permission/:id", getOnePermission);

router.post("/create-permission", createPermission);

router.put("/update-permission/:id", updatePermission);

router.delete("/remove-permission/menu", removeByMenu);

router.delete("/remove-permission/:id", remove);

module.exports = router;
