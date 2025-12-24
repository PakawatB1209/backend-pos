const parseBodyData = (req, res, next) => {
  if (req.body.stones && typeof req.body.stones === "string") {
    try {
      req.body.stones = JSON.parse(req.body.stones);
    } catch (e) {
      req.body.stones = [];
    }
  }

  if (
    req.body.related_accessories &&
    typeof req.body.related_accessories === "string"
  ) {
    try {
      req.body.related_accessories = JSON.parse(req.body.related_accessories);
    } catch (e) {
      req.body.related_accessories = [];
    }
  }

  next();
};

module.exports = parseBodyData;
