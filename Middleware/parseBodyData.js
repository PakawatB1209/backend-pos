// const parseBodyData = (req, res, next) => {
//   req.body = req.body || {};
//   if (req.body.stones && typeof req.body.stones === "string") {
//     try {
//       req.body.stones = JSON.parse(req.body.stones);
//     } catch (e) {
//       req.body.stones = [];
//     }
//   }

//   if (
//     req.body.related_accessories &&
//     typeof req.body.related_accessories === "string"
//   ) {
//     try {
//       req.body.related_accessories = JSON.parse(req.body.related_accessories);
//     } catch (e) {
//       req.body.related_accessories = [];
//     }
//   }

//   next();
// };

// module.exports = parseBodyData;

const parseBodyData = (req, res, next) => {
  req.body = req.body || {};

  const tryParse = (fieldName, defaultValue) => {
    if (req.body[fieldName] && typeof req.body[fieldName] === "string") {
      try {
        req.body[fieldName] = JSON.parse(req.body[fieldName]);
      } catch (e) {
        req.body[fieldName] = defaultValue;
      }
    }
  };

  //  Primary Stone
  tryParse("primary_stone", null);

  //  Additional Stones (ชื่อใหม่)
  tryParse("additional_stones", []);

  //  Related Accessories
  tryParse("related_accessories", []);

  next();
};

module.exports = parseBodyData;
