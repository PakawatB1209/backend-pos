const express = require("express");
const router = express.Router();

const {
  getOne,
  list,
  create,
  remove,
  update,
} = require("../Controllers/permission");

router.get("/permission", list);

router.get("/permission/:id", getOne);

router.post("/permission", create);

router.put("/permission/:id", update);

router.delete("/permission/:id", remove);

module.exports = router;
