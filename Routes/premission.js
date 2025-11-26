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

router.get("/permission/:id", getOnePermission);

router.post("/permission", createPermission);

router.put("/permission/:id", updatePermission);

router.delete("/permission/menu", removeByMenu);

router.delete("/permission/:id", remove);

module.exports = router;
