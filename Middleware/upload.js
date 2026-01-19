const multer = require("multer");

const storage = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/png", "image/jpeg", "image/webp"];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only .png, .jpg, .webp"), false);
  }
};

const multerImage = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: imageFilter,
}).array("files", 9);

const excelFilter = (req, file, cb) => {
  if (
    file.mimetype.includes("excel") ||
    file.mimetype.includes("spreadsheetml") ||
    file.originalname.endsWith(".xlsx") ||
    file.originalname.endsWith(".xls")
  ) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Please upload only Excel file (.xlsx, .xls)",
      ),
      false,
    );
  }
};

const multerExcel = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: excelFilter,
});

exports.upload = (req, res, next) => {
  multerImage(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

exports.uploadExcel = multerExcel;
