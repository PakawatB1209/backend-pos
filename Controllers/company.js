const Company = require("../models/Company");
const User = require("../models/User");
const Warehouse = require("../models/Warehouse");
const Product = require("../models/Product");
const ProductDetail = require("../models/Product_detail");
const Masters = require("../models/masters");
const mongoose = require("mongoose");

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const PNF = require("google-libphonenumber").PhoneNumberFormat;
const phoneUtil =
  require("google-libphonenumber").PhoneNumberUtil.getInstance();

exports.createCompany = async (req, res) => {
  try {
    const adminId = req.user.id;

    const {
      comp_name,
      comp_addr,
      comp_subdist,
      comp_dist,
      comp_prov,
      comp_zip,
      comp_email,
      comp_taxid,
      comp_phone,
      comp_person_name,
      comp_person_phone,
      comp_person_email,
    } = req.body;

    const requiredFields = [
      "comp_name",
      "comp_addr",
      "comp_subdist",
      "comp_dist",
      "comp_prov",
      "comp_zip",
      "comp_email",
      "comp_taxid",
      "comp_phone",
      "comp_person_name",
      "comp_person_phone",
      "comp_person_email",
    ];

    const missingFields = requiredFields.filter((field) => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Please complete all fields (Missing fields: ${missingFields.join(
          ", "
        )})`,
      });
    }

    const validatePhone = (phoneNumber, fieldName) => {
      try {
        const number = phoneUtil.parseAndKeepRawInput(phoneNumber, "TH");
        if (!phoneUtil.isValidNumber(number)) {
          throw new Error(`${fieldName}: Invalid format (เบอร์ไม่ถูกต้อง)`);
        }
        return phoneUtil.format(number, PNF.E164);
      } catch (error) {
        throw new Error(`${fieldName}: Parsing error (รูปแบบผิดพลาด)`);
      }
    };

    let finalCompPhone = comp_phone;
    let finalPersonPhone = comp_person_phone;

    try {
      finalCompPhone = validatePhone(comp_phone, "Company Phone");
      finalPersonPhone = validatePhone(
        comp_person_phone,
        "Contact Person Phone"
      );
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    const existingComp = await Company.findOne({
      $or: [{ comp_email }, { comp_taxid }],
    });

    if (existingComp) {
      return res.status(400).json({
        success: false,
        message: "Email or Tax ID already exists.",
      });
    }

    let imageFileName = null;

    // if (req.files && req.files.length > 0) {
    //   const file = req.files[0];
    //   const uploadDir = "./uploads/companyprofile";

    //   if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

    //   const baseName = `comp-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    //   // SVG
    //   // if (file.mimetype === "image/svg+xml") {
    //   //   imageFileName = `${baseName}.svg`;
    //   //   const outputPath = path.join(uploadDir, imageFileName);

    //   //   await fs.promises.writeFile(outputPath, file.buffer);
    //   // } else {
    //   //   let fileExtension = ".jpeg";
    //   //   let formatType = "jpeg";
    //   //   let formatOptions = { quality: 80 };

    //   //   if (file.mimetype === "image/png") {
    //   //     fileExtension = ".png";
    //   //     formatType = "png";
    //   //     formatOptions = { compressionLevel: 8, quality: 80 };
    //   //   } else if (file.mimetype === "image/webp") {
    //   //     fileExtension = ".webp";
    //   //     formatType = "webp";
    //   //     formatOptions = { quality: 80 };
    //   //   } else if (file.mimetype === "image/jpeg") {
    //   //     fileExtension = ".jpeg";
    //   //     formatType = "jpeg";
    //   //     formatOptions = { quality: 80, mozjpeg: true };
    //   //   }

    //   //   imageFileName = `${baseName}${fileExtension}`;
    //   //   const outputPath = path.join(uploadDir, imageFileName);

    //   //   await sharp(file.buffer)
    //   //     .resize(300, 300, {
    //   //       fit: sharp.fit.inside,
    //   //       withoutEnlargement: true,
    //   //     })
    //   //     .toFormat(formatType, formatOptions)
    //   //     .toFile(outputPath);
    //   // }

    //   let fileExtension = ".jpeg";
    //   let formatType = "jpeg";
    //   let formatOptions = { quality: 80 };

    //   if (file.mimetype === "image/png") {
    //     fileExtension = ".png";
    //     formatType = "png";
    //     formatOptions = { compressionLevel: 8, quality: 80 };
    //   } else if (file.mimetype === "image/webp") {
    //     fileExtension = ".webp";
    //     formatType = "webp";
    //     formatOptions = { quality: 80 };
    //   } else if (file.mimetype === "image/jpeg") {
    //     fileExtension = ".jpeg";
    //     formatType = "jpeg";
    //     formatOptions = { quality: 80, mozjpeg: true };
    //   }

    //   imageFileName = `${baseName}${fileExtension}`;
    //   const outputPath = path.join(uploadDir, imageFileName);

    //   await sharp(file.buffer)
    //     .resize(300, 300, {
    //       fit: sharp.fit.inside,
    //       withoutEnlargement: true,
    //     })
    //     .toFormat(formatType, formatOptions)
    //     .toFile(outputPath);
    // }

    if (req.files?.length) {
      const file = req.files[0];
      const uploadDir = "./uploads/companyprofile";
      if (!fs.existsSync(uploadDir))
        fs.mkdirSync(uploadDir, { recursive: true });

      const baseName = `comp-${Date.now()}-${Math.round(Math.random() * 1e9)}`;

      const formats = {
        "image/jpeg": {
          ext: ".jpeg",
          type: "jpeg",
          options: { quality: 80, mozjpeg: true },
        },
        "image/png": {
          ext: ".png",
          type: "png",
          options: { compressionLevel: 8, quality: 80 },
        },
        "image/webp": { ext: ".webp", type: "webp", options: { quality: 80 } },
      };

      const format = formats[file.mimetype] || formats["image/jpeg"];
      imageFileName = `${baseName}${format.ext}`;
      const outputPath = path.join(uploadDir, imageFileName);

      await sharp(file.buffer)
        .resize(300, 300, {
          fit: sharp.fit.inside,
          withoutEnlargement: true,
        })
        .toFormat(format.type, format.options)
        .toFile(outputPath);
    }

    const newCompany = await Company.create({
      comp_name,
      comp_addr,
      comp_subdist,
      comp_dist,
      comp_prov,
      comp_zip,
      comp_email,
      comp_taxid,
      comp_phone: finalCompPhone,
      comp_person_name,
      comp_person_phone: finalPersonPhone,
      comp_person_email,
      comp_file: imageFileName,
    });

    //default warehouse
    const warehouseTemplates = [
      { name: "Product Master", type: "productmaster" },
      { name: "Stone", type: "stone" },
      { name: "Semi-mount", type: "semimount" },
      { name: "Accessory", type: "accessory" },
      { name: "Others", type: "others" },
    ];

    const warehousesToSave = warehouseTemplates.map((template) => ({
      warehouse_name: template.name,
      warehouse_type: template.type,
      comp_id: newCompany._id,
    }));
    await Warehouse.insertMany(warehousesToSave);

    //default masters
    const masterTemplates = [
      { master_name: "Ring", master_type: "item_type" },
      { master_name: "Necklace", master_type: "item_type" },
      { master_name: "Earrings", master_type: "item_type" },
      { master_name: "Bracelet", master_type: "item_type" },
      { master_name: "Bangle", master_type: "item_type" },
      { master_name: "Pendant", master_type: "item_type" },

      {
        master_name: "10K Gold",
        master_type: "metal",
        master_color: "Yellow",
      },
      {
        master_name: "14K Gold",
        master_type: "metal",
        master_color: "Yellow",
      },
      {
        master_name: "18K Gold",
        master_type: "metal",
        master_color: "Yellow",
      },
      {
        master_name: "22K Gold",
        master_type: "metal",
        master_color: "Yellow",
      },
      {
        master_name: "24K Gold",
        master_type: "metal",
        master_color: "Yellow",
      },
      {
        master_name: "White Gold",
        master_type: "metal",
        master_color: "White",
      },
      {
        master_name: "Rose Gold",
        master_type: "metal",
        master_color: "Rose",
      },
      {
        master_name: "Platinum",
        master_type: "metal",
        master_color: "Platinum",
      },
      {
        master_name: "Silver",
        master_type: "metal",
        master_color: "Silver",
      },

      { master_name: "Round Brilliant", master_type: "shape" },
      { master_name: "Princess", master_type: "shape" },
      { master_name: "Cushion", master_type: "shape" },
      { master_name: "Oval", master_type: "shape" },
      { master_name: "Pear", master_type: "shape" },
      { master_name: "Marquise", master_type: "shape" },
      { master_name: "Emerald", master_type: "shape" },
      { master_name: "Asscher", master_type: "shape" },
      { master_name: "Heart", master_type: "shape" },
      { master_name: "Trilliant", master_type: "shape" },
      { master_name: "Old European", master_type: "shape" },
      { master_name: "Radiant", master_type: "shape" },

      { master_name: "Excellent", master_type: "cuting" },
      { master_name: "Very Good", master_type: "cuting" },
      { master_name: "Good", master_type: "cuting" },
      { master_name: "Fair", master_type: "cuting" },
      { master_name: "Poor", master_type: "cuting" },
      { master_name: "n/a", master_type: "cuting" },

      { master_name: "FL (Flawless)", master_type: "clarity" },
      { master_name: "IF (Internally Flawless)", master_type: "clarity" },
      { master_name: "VVS1", master_type: "clarity" },
      { master_name: "VVS2", master_type: "clarity" },
      { master_name: "VS1", master_type: "clarity" },
      { master_name: "VS2", master_type: "clarity" },
      { master_name: "SI1", master_type: "clarity" },
      { master_name: "SI2", master_type: "clarity" },
      { master_name: "I1", master_type: "clarity" },
      { master_name: "I2", master_type: "clarity" },
      { master_name: "I3", master_type: "clarity" },

      // Precious
      {
        master_name: "Diamond",
        master_type: "stone_name",
        master_color: "White",
      },
      {
        master_name: "Ruby",
        master_type: "stone_name",
        master_color: "Red",
      },
      {
        master_name: "Sapphire",
        master_type: "stone_name",
        master_color: null,
      },

      {
        master_name: "Emerald",
        master_type: "stone_name",
        master_color: "Green",
      },

      // กลุ่ม Semi-Precious
      {
        master_name: "Amethyst",
        master_type: "stone_name",
        master_color: "Purple",
      },
      {
        master_name: "Garnet",
        master_type: "stone_name",
        master_color: "Dark Red",
      },
      {
        master_name: "Peridot",
        master_type: "stone_name",
        master_color: "Green",
      },
      {
        master_name: "Topaz",
        master_type: "stone_name",
        master_color: null,
      },
      {
        master_name: "Citrine",
        master_type: "stone_name",
        master_color: "Yellow",
      },
      {
        master_name: "Aquamarine",
        master_type: "stone_name",
        master_color: "Light Blue",
      },
      {
        master_name: "Tourmaline",
        master_type: "stone_name",
        master_color: "Pink",
      },
      {
        master_name: "Opal",
        master_type: "stone_name",
        master_color: "White",
      },
      {
        master_name: "Spinel",
        master_type: "stone_name",
        master_color: "Red",
      },
      {
        master_name: "Zircon",
        master_type: "stone_name",
        master_color: "Blue",
      },
      {
        master_name: "Tanzanite",
        master_type: "stone_name",
        master_color: "Violet",
      },
      {
        master_name: "Turquoise",
        master_type: "stone_name",
        master_color: "Turquoise",
      },
      {
        master_name: "Jade",
        master_type: "stone_name",
        master_color: "Green",
      },
      {
        master_name: "Onyx",
        master_type: "stone_name",
        master_color: "Black",
      },
      {
        master_name: "Pearl",
        master_type: "stone_name",
        master_color: "White",
      },
      {
        master_name: "Morganite",
        master_type: "stone_name",
        master_color: "Pink",
      },
      {
        master_name: "Moonstone",
        master_type: "stone_name",
        master_color: "White",
      },
      {
        master_name: "Labradorite",
        master_type: "stone_name",
        master_color: "Grey",
      },
      {
        master_name: "Rose Quartz",
        master_type: "stone_name",
        master_color: "Pink",
      },
      {
        master_name: "Alexandrite",
        master_type: "stone_name",
        master_color: null,
      },
      {
        master_name: "Tsavorite",
        master_type: "stone_name",
        master_color: "Green",
      },
      {
        master_name: "Chrysoberyl",
        master_type: "stone_name",
        master_color: "Yellowish Green",
      },
      {
        master_name: "Lapis Lazuli",
        master_type: "stone_name",
        master_color: "Blue",
      },
      {
        master_name: "Malachite",
        master_type: "stone_name",
        master_color: "Green",
      },
      {
        master_name: "Tiger's Eye",
        master_type: "stone_name",
        master_color: "Brown",
      },
      {
        master_name: "Agate",
        master_type: "stone_name",
        master_color: null,
      },
      {
        master_name: "Amber",
        master_type: "stone_name",
        master_color: "Yellow",
      },
      {
        master_name: "Coral",
        master_type: "stone_name",
        master_color: "Red",
      },
      {
        master_name: "Mother of Pearl",
        master_type: "stone_name",
        master_color: "White",
      },
      {
        master_name: "Moissanite",
        master_type: "stone_name",
        master_color: "White",
      },
      {
        master_name: "Cubic Zirconia",
        master_type: "stone_name",
        master_color: "White",
      },
      {
        master_name: "Synthetic Diamond",
        master_type: "stone_name",
        master_color: "White",
      },
      {
        master_name: "Crystal",
        master_type: "stone_name",
        master_color: null,
      },
    ];

    const mastersToSave = masterTemplates.map((t) => ({
      master_name: t.master_name,
      master_type: t.master_type,
      master_color: t.master_color,
      comp_id: newCompany._id,
    }));

    await Masters.insertMany(mastersToSave);

    const updatedUser = await User.findByIdAndUpdate(
      adminId,
      { comp_id: newCompany._id },
      { new: true }
    );

    res.status(201).json({
      success: true,
      message: "Setup Company Successful",
      company: newCompany,
      user: {
        user_name: updatedUser.user_name,
        comp_id: updatedUser.comp_id,
      },
    });
  } catch (error) {
    console.log("Error create company:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getOneCompany = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    const company = await Company.findById(id).select("-__v").lean();

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found.",
      });
    }

    if (company.comp_file) {
      company.comp_file = `${req.protocol}://${req.get(
        "host"
      )}/uploads/companyprofile/${company.comp_file}`;
    }

    res.status(200).json({
      success: true,
      data: company,
    });
  } catch (error) {
    console.error("Error getting company:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

exports.list = async (req, res) => {
  try {
    const companies = await Company.find()
      .select("-__v")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: companies,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const removeFile = req.body.removeFile === "true";

    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format." });
    }

    const allowedFields = [
      "comp_name",
      "comp_addr",
      "comp_subdist",
      "comp_dist",
      "comp_prov",
      "comp_zip",
      "comp_email",
      "comp_taxid",
      "comp_phone",
      "comp_person_name",
      "comp_person_phone",
      "comp_person_email",
    ];

    let updateData = {};
    allowedFields.forEach((key) => {
      if (req.body[key] !== undefined) {
        updateData[key] = req.body[key];
      }
    });

    const validatePhone = (phoneNumber) => {
      const number = phoneUtil.parseAndKeepRawInput(phoneNumber, "TH"); // ใส่ 'TH'
      if (!phoneUtil.isValidNumber(number)) {
        throw new Error("Invalid phone number format");
      }
      return phoneUtil.format(number, PNF.E164);
    };

    try {
      if (updateData.comp_phone) {
        updateData.comp_phone = validatePhone(updateData.comp_phone);
      }
      if (updateData.comp_person_phone) {
        updateData.comp_person_phone = validatePhone(
          updateData.comp_person_phone
        );
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format (เบอร์โทรศัพท์ไม่ถูกต้อง)",
      });
    }

    // REMOVE OLD LOGO
    if (removeFile && !(req.files && req.files.length > 0)) {
      const uploadDir = "./uploads/companyprofile";

      const oldCompany = await Company.findById(id).select("comp_file");
      if (oldCompany && oldCompany.comp_file) {
        const oldImagePath = path.join(uploadDir, oldCompany.comp_file);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      updateData.comp_file = null;
    }

    if (req.files && req.files.length > 0) {
      const file = req.files[0];

      // 1️. กัน error ไฟล์พัง
      if (!file || !file.buffer) {
        return res.status(400).json({ message: "Invalid image file" });
      }

      const uploadDir = "./uploads/companyprofile";
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // 2️. map format ตาม mimetype
      const formats = {
        "image/jpeg": {
          ext: ".jpeg",
          type: "jpeg",
          options: { quality: 80, mozjpeg: true },
        },
        "image/png": {
          ext: ".png",
          type: "png",
          options: { compressionLevel: 8 },
        },
        "image/webp": {
          ext: ".webp",
          type: "webp",
          options: { quality: 80 },
        },
      };

      const format = formats[file.mimetype];
      if (!format) {
        return res.status(400).json({ message: "Unsupported image format" });
      }

      // 3️. ตั้งชื่อไฟล์ตาม format จริง
      const newFileName = `logo-${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}${format.ext}`;

      const outputPath = path.join(uploadDir, newFileName);

      // 4️. sharp ใช้ format จริง (ไม่ hardcode jpeg)
      await sharp(file.buffer)
        .resize(500, 500, {
          fit: sharp.fit.inside,
          withoutEnlargement: true,
        })
        .toFormat(format.type, format.options)
        .toFile(outputPath);

      // 5️. เซฟชื่อไฟล์ลง DB
      updateData.comp_file = newFileName;

      // 6️. ลบรูปเก่า
      const oldCompany = await Company.findById(id).select("comp_file");
      if (oldCompany && oldCompany.comp_file) {
        const oldImagePath = path.join(uploadDir, oldCompany.comp_file);
        if (fs.existsSync(oldImagePath)) {
          fs.unlink(oldImagePath, (err) => {
            if (err) console.log("Failed to delete old logo:", err);
          });
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please specify data to update",
      });
    }

    const checkOr = [];
    if (updateData.comp_email)
      checkOr.push({ comp_email: updateData.comp_email });
    if (updateData.comp_taxid)
      checkOr.push({ comp_taxid: updateData.comp_taxid });

    if (checkOr.length > 0) {
      const exists = await Company.findOne({
        _id: { $ne: id },
        $or: checkOr,
      });

      if (exists) {
        if (updateData.comp_file) {
          const newImgPath = path.join(
            "./uploads/companyprofile",
            updateData.comp_file
          );
          if (fs.existsSync(newImgPath)) fs.unlinkSync(newImgPath);
        }

        return res.status(400).json({
          success: false,
          message: "Email or Tax ID already exists",
        });
      }
    }

    const updatedCompany = await Company.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updatedCompany) {
      return res
        .status(404)
        .json({ success: false, message: "Company not found." });
    }

    let responseData = updatedCompany.toObject();
    if (responseData.comp_file) {
      responseData.comp_file = `${req.protocol}://${req.get(
        "host"
      )}/uploads/companyprofile/${responseData.comp_file}`;
    }

    res.status(200).json({
      success: true,
      message: "Company updated successfully.",
      data: responseData,
    });
  } catch (error) {
    console.log("Error update company:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.removeOneCompany = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format." });
    }

    const companyToDelete = await Company.findById(id);
    if (!companyToDelete) {
      return res
        .status(404)
        .json({ success: false, message: "Company not found." });
    }

    if (companyToDelete.comp_file) {
      const logoPath = path.join(
        "./uploads/companyprofile",
        companyToDelete.comp_file
      );
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }
    }

    const products = await Product.find({ comp_id: id });
    const productDetailIds = [];

    if (products.length > 0) {
      products.forEach((product) => {
        if (product.product_detail_id) {
          productDetailIds.push(product.product_detail_id);
        }

        if (product.file && product.file.length > 0) {
          product.file.forEach((fileName) => {
            const imgPath = path.join("./uploads", fileName);
            if (fs.existsSync(imgPath)) {
              fs.unlink(imgPath, (err) => {
                if (err) console.log("Del img err:", err);
              });
            }
          });
        }
      });

      if (productDetailIds.length > 0) {
        await ProductDetail.deleteMany({ _id: { $in: productDetailIds } });
      }
      await Product.deleteMany({ comp_id: id });
    }

    await Masters.deleteMany({ comp_id: id });

    await Warehouse.deleteMany({ comp_id: id });

    const deletedUsers = await User.deleteMany({ comp_id: id });

    await Company.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: `Company "${companyToDelete.comp_name}" and ALL related data (Files, Products, Users, Masters) deleted successfully.`,
      details: {
        deletedCompanyId: id,
        deletedUsersCount: deletedUsers.deletedCount,
        deletedProductsCount: products.length,
      },
    });
  } catch (error) {
    console.log("Error remove company:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
