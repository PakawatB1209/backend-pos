const mongoose = require("mongoose");
const Purchase = require("../models/Purchase");
const Stock = require("../models/Stock");
const StockTransaction = require("../models/StockTransaction");
const User = require("../models/User");
const XLSX = require("xlsx");
const ExcelJS = require("exceljs");
const Warehouse = require("../models/Warehouse");
const Product = require("../models/Product");
const fs = require("fs");
const path = require("path");

const generatePurchaseNumber = async () => {
  const date = new Date();
  const year = date.getFullYear();

  const lastPurchase = await Purchase.findOne({
    purchase_number: { $regex: `^${year}` },
  })
    .sort({ purchase_number: -1 })
    .select("purchase_number");

  let nextSeq = 1;

  if (lastPurchase) {
    const lastSeqStr = lastPurchase.purchase_number.substring(4);
    const lastSeq = parseInt(lastSeqStr);
    nextSeq = lastSeq + 1;
  }

  const seqStr = nextSeq.toString().padStart(6, "0");

  return `${year}${seqStr}`;
};

exports.createPurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const { date, vendor_name, ref1, ref2, note, items } = req.body;

    const user = await User.findById(userId).select("comp_id");
    if (!user || !user.comp_id)
      throw new Error("User not associated with company");

    let defaultWarehouse = await Warehouse.findOne({
      comp_id: user.comp_id,
      warehouse_name: { $regex: /^others$/i },
    });

    if (!defaultWarehouse) {
      defaultWarehouse = await Warehouse.findOne({ comp_id: user.comp_id });
    }

    if (!defaultWarehouse) {
      throw new Error(
        "No Warehouse found. Please create at least one warehouse.",
      );
    }

    const autoPurchaseNumber = await generatePurchaseNumber(user.comp_id);
    const totalAmount = items.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0,
    );

    // 2. Map Items
    const finalItems = items.map((item) => {
      return {
        ...item,
        warehouse_id: item.warehouse_id || defaultWarehouse._id,
      };
    });

    const newPurchase = new Purchase({
      comp_id: user.comp_id,
      created_by: userId,
      purchase_number: autoPurchaseNumber,
      date,
      vendor_name,
      ref1,
      ref2,
      note,
      total_amount: totalAmount,
      items: finalItems,
    });

    await newPurchase.save({ session });

    // 🟢 Loop Update Stock (แก้ไขใหม่: คำนวณต้นทุนเฉลี่ย)
    for (const item of finalItems) {
      const qty = Number(item.quantity);
      const incomingCost = Number(item.cost); // ราคาต้นทุนของรอบนี้ (ทุนใหม่)

      const totalGwToAdd = (Number(item.gross_weight) || 0) * qty;
      const totalNwToAdd = (Number(item.net_weight) || 0) * qty;
      const totalSwToAdd = (Number(item.stone_weight) || 0) * qty;

      // 🟡 1. ค้นหา Stock เดิมก่อน (เพื่อเอามาคำนวณ)
      let stock = await Stock.findOne({
        comp_id: user.comp_id,
        warehouse_id: item.warehouse_id,
        product_id: item.product_id,
      }).session(session);

      // ตั้งค่าเริ่มต้น: ถ้าไม่มีของเดิม ให้ใช้ราคาใหม่เลย
      let newCost = incomingCost;

      // 🟡 2. ถ้ามีของเดิม -> คำนวณถัวเฉลี่ย (Weighted Average)
      if (stock) {
        const currentQty = stock.quantity;
        const currentCost = stock.cost; // ทุนเดิม

        // สูตร: (มูลค่าเดิม + มูลค่าใหม่) / จำนวนรวม
        const totalOldValue = currentQty * currentCost;
        const totalNewValue = qty * incomingCost;
        const totalQty = currentQty + qty;

        if (totalQty > 0) {
          newCost = (totalOldValue + totalNewValue) / totalQty;
        }
      }

      // 🟡 3. อัปเดตลง Database
      const updatedStock = await Stock.findOneAndUpdate(
        {
          comp_id: user.comp_id,
          warehouse_id: item.warehouse_id,
          product_id: item.product_id,
        },
        {
          $inc: {
            quantity: qty,
            total_gross_weight: totalGwToAdd,
            total_net_weight: totalNwToAdd,
            total_stone_weight: totalSwToAdd,
          },
          $set: {
            cost: newCost, // ✅ บันทึกต้นทุนเฉลี่ยใหม่ (ที่คำนวณแล้ว)
            price: Number(item.price),
          },
        },
        { new: true, upsert: true, session },
      );

      // 🟡 4. บันทึก Transaction
      await StockTransaction.create(
        [
          {
            comp_id: user.comp_id,
            product_id: item.product_id,
            warehouse_id: item.warehouse_id,
            type: "in",
            action_type: "purchase",
            document_ref: newPurchase._id,
            qty: qty,

            cost: incomingCost, // ✅ ใน Transaction เก็บราคา "ที่ซื้อจริงรอบนี้" (ไม่ใช่ราคาเฉลี่ย)

            balance_after: updatedStock.quantity,
            created_by: userId,
            note: `Purchase Ref: ${autoPurchaseNumber} from ${vendor_name || "Vendor"}`,
          },
        ],
        { session },
      );
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: "Purchase saved successfully",
      data: newPurchase,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Purchase Error:", error);
    res
      .status(500)
      .json({ success: false, message: error.message || "Server Error" });
  }
};

exports.importPreview = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const user = await User.findById(req.user.id).select("comp_id");
    if (!user || !user.comp_id)
      return res
        .status(400)
        .json({ success: false, message: "User has no company" });

    const { warehouseMap, fallbackId, othersWarehouseId } =
      await buildWarehouseMap(user.comp_id);
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const localBaseUrl = `${req.protocol}://${req.get("host")}/uploads/product/`;

    const allSheetData = getAllSheetData(workbook);
    const productMap = await getProductMap(user.comp_id, allSheetData);

    const processedItems = [];
    const errorRows = [];

    for (const { row } of allSheetData) {
      const codeStr =
        row["Code"] || row["code"]
          ? String(row["Code"] || row["code"]).trim()
          : "";

      const validationError = validateRow(row, codeStr, productMap);
      if (validationError) {
        errorRows.push({ ...row, Error_Reason: validationError });
        continue;
      }

      const product = productMap.get(codeStr);
      const validItem = mapValidItem(
        row,
        product,
        warehouseMap,
        fallbackId,
        othersWarehouseId,
        localBaseUrl,
      );
      if (validItem) processedItems.push(validItem);
    }

    const errorFileName = await generateErrorFile(errorRows);

    res.json({
      success: true,
      count: processedItems.length,
      data: processedItems,
      hasError: errorRows.length > 0,
      errorCount: errorRows.length,
      errorFileName,
    });
  } catch (error) {
    console.error("Import Error:", error);
    res.status(500).json({ success: false, message: "Import failed" });
  }
};

async function buildWarehouseMap(comp_id) {
  const warehouses = await Warehouse.find({ comp_id });
  const map = {};
  let othersId = null,
    firstId = warehouses[0]?._id;

  warehouses.forEach((wh) => {
    const clean = wh.warehouse_name?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    if (wh.warehouse_type) map[wh.warehouse_type.trim().toLowerCase()] = wh._id;
    if (clean) map[clean] = wh._id;

    const nameLower = wh.warehouse_name?.trim().toLowerCase();
    if (nameLower === "others" || nameLower === "other") othersId = wh._id;
  });

  return {
    warehouseMap: map,
    fallbackId: othersId || firstId,
    othersWarehouseId: othersId,
  };
}

function getAllSheetData(workbook) {
  const allRows = [];
  workbook.SheetNames.forEach((name) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
      defval: "",
    });
    rows.forEach((row) => allRows.push({ sheetName: name, row }));
  });
  return allRows;
}

async function getProductMap(comp_id, allSheetData) {
  const codes = allSheetData
    .map(({ row }) => row["Code"] || row["code"])
    .filter((c) => c)
    .map((c) => String(c).trim());

  const products = await Product.find({ comp_id, product_code: { $in: codes } })
    .select(
      "product_name product_code file product_detail_id price unit category type",
    )
    .populate("product_detail_id");

  const map = new Map();
  products.forEach((p) => map.set(p.product_code.trim(), p));
  return map;
}

function validateRow(row, codeStr, productMap) {
  if (!codeStr) return "Missing Product Code";

  const product = productMap.get(codeStr);
  if (!product) return "Product Not Found in Database";

  const norm = (s) =>
    String(s || "")
      .trim()
      .toLowerCase();

  if (row["Name"] && norm(row["Name"]) !== norm(product.product_name))
    return `Name Mismatch (Excel: ${row["Name"]}, DB: ${product.product_name})`;

  const dbCat = product.category || product.product_detail_id?.category;
  if (row["Category"] && norm(row["Category"]) !== norm(dbCat))
    return `Category Mismatch`;

  const dbType = product.type || product.product_detail_id?.type;
  if (row["Type"] && norm(row["Type"]) !== norm(dbType)) return `Type Mismatch`;

  const excelUnit = row["Product Unit"] || row["Purchase Unit"];
  if (excelUnit && norm(excelUnit) !== norm(product.unit))
    return `Unit Mismatch`;

  const ps = product.product_detail_id?.primary_stone || {};
  if (row["Main Stone"] && norm(row["Main Stone"]) !== norm(ps.stone_name))
    return `Main Stone Mismatch`;
  if (row["Main Shape"] && norm(row["Main Shape"]) !== norm(ps.shape))
    return `Main Shape Mismatch`;
  if (row["Main Color"] && norm(row["Main Color"]) !== norm(ps.color))
    return `Main Color Mismatch`;
  if (row["Main Clarity"] && norm(row["Main Clarity"]) !== norm(ps.clarity))
    return `Main Clarity Mismatch`;

  if (row["Main Qty"]) {
    if (parseNum(row["Main Qty"]) !== (Number(ps.stone_qty) || 0))
      return `Main Qty Mismatch`;
  }
  if (row["Main Weight"]) {
    if (
      parseNum(row["Main Weight"]).toFixed(2) !==
      (Number(ps.weight) || 0).toFixed(2)
    )
      return `Main Weight Mismatch`;
  }

  return null;
}

function mapValidItem(
  row,
  product,
  warehouseMap,
  fallbackId,
  othersId,
  baseUrl,
) {
  const qty = parseNum(row["QTY"] || row["Qty"]);
  if (qty <= 0) return null;

  let image = "";
  if (product.file?.length > 0) {
    image = product.file[0].startsWith("http")
      ? product.file[0]
      : `${baseUrl}${product.file[0]}`;
  }

  const detail = product.product_detail_id || {};
  const whName = row["Warehouse"] || row["Category"] || "";
  const whKey = whName
    .toString()
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
  const whId = warehouseMap[whKey] || fallbackId;

  return {
    product_id: product._id,
    code: product.product_code,
    name: product.product_name,
    image,
    warehouse_id: whId,
    warehouse_name: whId === othersId ? "Others (Auto)" : whName,
    quantity: qty,
    cost: parseNum(row["Cost"]),
    price: parseNum(row["Price"], product.price),
    amount: qty * parseNum(row["Cost"]),
    gross_weight: parseNum(row["Gross Weight (g)"]),
    net_weight: parseNum(row["Net Weight (g)"], detail.net_weight),
    stone_weight: detail.primary_stone?.weight || 0,
    unit: row["Purchase Unit"] || product.unit || "pcs",
  };
}

async function generateErrorFile(errorRows) {
  if (errorRows.length === 0) return null;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Error Rows");
  const headers = Object.keys(errorRows[0]);

  sheet.columns = headers.map((h) => ({ header: h, key: h, width: 15 }));
  sheet.addRows(errorRows);

  const editableFields = [
    "QTY",
    "Qty",
    "Cost",
    "Price",
    "Gross Weight (g)",
    "Net Weight (g)",
    "Purchase Unit",
    "Product Unit",
  ];

  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, size: 12 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };

    if (editableFields.includes(cell.value)) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFF0000" },
      };
      cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    } else if (cell.value === "Error_Reason") {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFF00" },
      };
    } else {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEEEEEE" },
      };
    }
  });

  sheet.columns.forEach((col) => {
    let max = 0;
    col.eachCell(
      { includeEmpty: true },
      (c) => (max = Math.max(max, c.value ? c.value.toString().length : 10)),
    );
    col.width = max + 2;
  });

  const fileName = `Error_${Date.now()}_${Math.round(Math.random() * 1000)}.xlsx`;
  const dir = path.join(__dirname, "../storage/exports");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  await workbook.xlsx.writeFile(path.join(dir, fileName));
  return fileName;
}

const parseNum = (v, def = 0) => {
  if (v == null) return def;
  const n = Number(String(v).trim().replace(/,/g, ""));
  return isNaN(n) ? def : n;
};

exports.downloadErrorFile = async (req, res) => {
  try {
    const { filename } = req.params;

    const filePath = path.join(__dirname, "../storage/exports", filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found or expired" });
    }

    res.download(filePath, "Error_Items_List.xlsx", (err) => {
      if (err) {
        console.error("Download warning/error:", err);
      }

      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error("Error deleting file:", unlinkErr);
        } else {
          console.log(`Deleted temporary file: ${filename}`);
        }
      });
    });
  } catch (error) {
    console.error("Download Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
