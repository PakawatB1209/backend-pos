const multer = require("multer");

const storage = multer.memoryStorage();

const multerUpload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
      // "image/svg+xml",
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only .png, .jpg, .webp"), false);
    }
  },
}).array("files", 9);

exports.upload = (req, res, next) => {
  multerUpload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    next();
  });
};
