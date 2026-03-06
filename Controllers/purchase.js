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
const Company = require("../models/Company"); // เพิ่ม Import

const { getCurrentRate } = require("../Controllers/exchangeRate");

const generatePurchaseNumber = async (compId) => {
  const date = new Date();
  const year = date.getFullYear();

  const lastPurchase = await Purchase.findOne({
    comp_id: compId,
    purchase_number: { $regex: `^${year}` },
  })
    .sort({ purchase_number: -1 })
    .select("purchase_number");

  let nextSeq = 1;

  if (lastPurchase) {
    const lastSeqStr = lastPurchase.purchase_number.substring(4);
    const lastSeq = Number.parseInt(lastSeqStr);
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
    const {
      date,
      vendor_name,
      ref1,
      ref2,
      note,
      items,
      currency,
      manual_rate,
      warehouse_id: headerWarehouseId,
    } = req.body;

    // 1. ตรวจสอบ User & Company
    const user = await User.findById(userId).select("comp_id");
    if (!user || !user.comp_id)
      throw new Error("User not associated with company");

    const company = await Company.findById(user.comp_id)
      .select("main_currency")
      .lean();
    const mainCurrency = company?.main_currency || "THB";

    // สร้าง Warehouse Map เพื่อใช้ Auto-select ตามประเภทสินค้า
    const warehouses = await Warehouse.find({ comp_id: user.comp_id }).lean();
    const warehouseTypeMap = {};
    let defaultWarehouseId = null;

    warehouses.forEach((wh) => {
      if (wh.warehouse_type) {
        warehouseTypeMap[wh.warehouse_type.toLowerCase().replace(/\s+/g, "")] =
          wh._id;
      }
      if (wh.warehouse_name?.toLowerCase().includes("others")) {
        defaultWarehouseId = wh._id;
      }
    });
    if (!defaultWarehouseId) defaultWarehouseId = warehouses[0]?._id;

    //ดึงข้อมูลหมวดหมู่สินค้าทั้งหมดในบิลนี้มาเตรียมไว้
    const productIds = items.map((i) => i.product_id);
    const productData = await Product.find({ _id: { $in: productIds } })
      .select("product_category")
      .populate("product_category", "master_name")
      .lean();

    const productCatMap = {};
    productData.forEach((p) => {
      productCatMap[p._id.toString()] = p.product_category?.master_name
        ?.toLowerCase()
        .replace(/\s+/g, "");
    });

    // -------------------------------------------------------------
    // 3. คำนวณอัตราแลกเปลี่ยน (Exchange Rate Logic)
    // -------------------------------------------------------------
    let finalRate = 1;
    const selectedCurrency = currency || mainCurrency;

    if (manual_rate && Number(manual_rate) > 0) {
      // ใช้เรทที่ผู้ใช้กรอกเองโดยตรง
      finalRate = Number(manual_rate);
    } else if (selectedCurrency !== mainCurrency) {
      // 🧮 สูตร: เรทสกุลเงินที่ซื้อ หารด้วย เรทสกุลเงินหลักของบริษัท
      const ratePurchaseToTHB = await getCurrentRate(selectedCurrency, date);
      const rateBaseToTHB = await getCurrentRate(mainCurrency, date);
      finalRate = ratePurchaseToTHB / rateBaseToTHB;
    }

    // -------------------------------------------------------------
    // 4. เตรียมข้อมูล Item และคำนวณค่าเงินรายชิ้น (Unit Conversion)
    // -------------------------------------------------------------
    const processedItems = items.map((item) => {
      const qty = Number(item.quantity) || 0;
      const gwt = Number(item.gross_weight) || 0;
      const swt = Number(item.stone_weight) || 0;
      const costForeign = Number(item.cost);

      const costMain = costForeign * finalRate;
      const unit = String(item.unit || "")
        .trim()
        .toLowerCase();

      // --- 🎯 Logic: ค้นหาคลังที่เหมาะสม (Auto-select) ---
      const productCategory = productCatMap[item.product_id.toString()];
      const autoSelectedWarehouseId = warehouseTypeMap[productCategory];

      const finalWarehouseId =
        item.warehouse_id || // 1. ถ้าพนักงานเลือกมารายชิ้น
        autoSelectedWarehouseId || // 2. ถ้าตรงกับประเภทสินค้า
        headerWarehouseId || // 3. ถ้าเลือกมาจากหัวบิล
        defaultWarehouseId; // 4. คลัง Others (Fallback)

      // --- 🧮 Logic: คิด Amount และ น้ำหนักรวม ตาม Unit ---
      let calculatedAmountForeign = 0;
      let calculatedAmountMain = 0;
      let finalGrossWeight = 0; // 🟢 ต้องสร้างตัวแปรนี้เพิ่ม

      if (unit === "g" || unit === "gram" || unit === "grams") {
        calculatedAmountForeign = costForeign * gwt;
        calculatedAmountMain = costMain * gwt;
        finalGrossWeight = gwt;
      } else if (unit === "cts" || unit === "ct" || unit === "carat") {
        const weightInGrams = swt * 0.2; // ใช้ stone_weight มาแปลงกะรัตเป็นกรัม
        calculatedAmountForeign = costForeign * weightInGrams;
        calculatedAmountMain = costMain * weightInGrams;
        finalGrossWeight = weightInGrams;
      } else {
        calculatedAmountForeign = costForeign * qty;
        calculatedAmountMain = costMain * qty;
        finalGrossWeight = gwt * qty;
      }

      return {
        ...item,
        warehouse_id: finalWarehouseId, // 🟢 ใช้คลังที่ผ่าน Logic แล้ว
        quantity: qty,
        cost_foreign: costForeign,
        amount_foreign: calculatedAmountForeign,
        amount: Number(calculatedAmountMain.toFixed(4)),
        cost: Number(costMain.toFixed(4)),

        _calculated_total_gross: finalGrossWeight,

        price: Number(item.price) || 0,
        stone_weight: swt,
        gross_weight: gwt,
        net_weight: Number(item.net_weight) || 0,
        unit: item.unit || "Pcs",
      };
    });

    // -------------------------------------------------------------
    // คำนวณยอดรวมหัวบิล (Header Totals Calculation)
    // ใช้ reduce เพื่อรวมยอด เงิน, จำนวน และ น้ำหนัก จากทุกรายการ
    // -------------------------------------------------------------
    const totals = processedItems.reduce(
      (acc, item) => {
        acc.amount += item.amount; // รวมยอดเงินทั้งหมด
        acc.qty += item.quantity; // รวมจำนวนชิ้นทั้งหมด
        acc.gross += item.gross_weight * item.quantity; // รวมน้ำหนัก (น้ำหนักต่อชิ้น x จำนวน)
        return acc;
      },
      { amount: 0, qty: 0, gross: 0 }, // ค่าเริ่มต้น
    );

    const autoPurchaseNumber = await generatePurchaseNumber(user.comp_id);

    // 5. บันทึกใบ Purchase (Header)
    const newPurchase = new Purchase({
      comp_id: user.comp_id,
      created_by: userId,
      purchase_number: autoPurchaseNumber,
      date: date || new Date(),
      vendor_name,
      ref1,
      ref2,
      note,
      currency: selectedCurrency,
      exchange_rate: finalRate,

      // บันทึกค่าที่คำนวณได้ลงหัวบิล
      total_amount: totals.amount,
      total_quantity: totals.qty,
      total_gross_weight: totals.gross,

      items: processedItems,
    });

    await newPurchase.save({ session });

    // -------------------------------------------------------------
    // 6. วนลูปอัปเดต Stock และคำนวณค่าเฉลี่ย (Weighted Average Calculation)
    // -------------------------------------------------------------
    for (const item of processedItems) {
      const qty = item.quantity;
      const newCostPerUnit = item.cost;
      const newPricePerUnit = item.price;

      // ค้นหาสต็อกเดิม
      let stock = await Stock.findOne({
        comp_id: user.comp_id,
        warehouse_id: item.warehouse_id,
        product_id: item.product_id,
      }).session(session);

      let finalAvgCost = newCostPerUnit;
      let finalAvgPrice = newPricePerUnit;

      if (stock) {
        const oldQty = stock.quantity;
        const totalQty = oldQty + qty; // จำนวนรวมทั้งหมดหลังรับเข้า

        if (totalQty > 0) {
          // สูตรที่ 1: ต้นทุนเฉลี่ยถ่วงน้ำหนัก (Weighted Average Cost)
          // สูตร: ((จำนวนเดิม x ทุนเดิม) + (จำนวนใหม่ x ทุนใหม่)) / จำนวนรวม
          const totalOldCostVal = oldQty * stock.cost;
          const totalNewCostVal = qty * newCostPerUnit;
          finalAvgCost = (totalOldCostVal + totalNewCostVal) / totalQty;

          // สูตรที่ 2: ราคาขายเฉลี่ยถ่วงน้ำหนัก (Weighted Average Sale Price)
          // สูตร: ((จำนวนเดิม x ราคาขายเดิม) + (จำนวนใหม่ x ราคาขายใหม่)) / จำนวนรวม
          const oldPrice = stock.price || 0;
          const totalOldSaleVal = oldQty * oldPrice;
          const totalNewSaleVal = qty * newPricePerUnit;
          finalAvgPrice = (totalOldSaleVal + totalNewSaleVal) / totalQty;
        }
      }

      // อัปเดตข้อมูลลง Stock
      // $inc: บวกเพิ่มจำนวนและน้ำหนักรวมเข้าไปในของเดิม
      // $set: ทับค่าเดิมด้วยค่าเฉลี่ยที่คำนวณใหม่
      const updatedStock = await Stock.findOneAndUpdate(
        {
          comp_id: user.comp_id,
          warehouse_id: item.warehouse_id,
          product_id: item.product_id,
        },
        {
          $inc: {
            quantity: qty,
            total_gross_weight: item._calculated_total_gross,
          },
          $set: {
            cost: finalAvgCost,
            price: finalAvgPrice,
            last_in_date: date || new Date(),
          },
        },
        { new: true, upsert: true, session },
      );

      // -------------------------------------------------------------
      // 7. สร้าง Stock Transaction (ประวัติการเคลื่อนไหว)
      // -------------------------------------------------------------
      await StockTransaction.create(
        [
          {
            comp_id: user.comp_id,
            product_id: item.product_id,
            warehouse_id: item.warehouse_id,
            type: "in",
            action_type: "purchase",
            document_ref: newPurchase._id,
            document_number: autoPurchaseNumber,
            qty: qty,

            total_gross_weight: item._calculated_total_gross,

            cost: newCostPerUnit,
            price: newPricePerUnit,

            //  ดึงยอด Amount ที่ผ่านการเช็คหน่วย (g, cts, pcs) มาบันทึกเลย
            amount: item.amount,

            balance_after: updatedStock.quantity,
            created_by: userId,
            note: `Purchase Ref: ${autoPurchaseNumber}`,
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
    // หากเกิด Error ให้ยกเลิกข้อมูลทั้งหมดที่พยายามบันทึก (Rollback)
    if (session) await session.abortTransaction();
    if (session) session.endSession();
    console.error("Purchase Error:", error);
    res
      .status(500)
      .json({ success: false, message: error.message || "Server Error" });
  }
};

const parseNum = (v, def = 0) => {
  if (v == null) return def;
  const n = Number(String(v).trim().replaceAll(/,/g, ""));
  return Number.isNaN(n) ? def : n;
};

async function buildWarehouseMap(comp_id) {
  const warehouses = await Warehouse.find({ comp_id });
  const map = {};
  let othersId = null,
    firstId = warehouses[0]?._id;

  warehouses.forEach((wh) => {
    const clean = wh.warehouse_name
      ?.replaceAll(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
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
    .map(({ row }) => String(row["Code"] || row["code"] || "").trim())
    .filter(Boolean);

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
    .replaceAll(/[^a-zA-Z0-9]/g, "")
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

      // 🛑 ตรวจสอบ Error
      const validationError = validateRow(row, codeStr, productMap);

      if (validationError) {
        // ถ้าผิด เก็บข้อมูลลง errorRows เพื่อส่งกลับไป Frontend
        errorRows.push({
          ...row,
          Error_Reason: validationError, // สาเหตุที่ผิด
          isError: true, // Flag บอกหน้าบ้านว่าเป็นแถวแดง
        });
        continue;
      }

      // ✅ ถ้าผ่าน นำไป map ข้อมูล
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

    // ไม่มีการสร้างไฟล์ Excel (generateErrorFile) แล้ว

    // ส่งข้อมูลกลับไปทั้ง 2 ส่วน (ผ่าน และ ไม่ผ่าน)
    res.json({
      success: true,
      count: processedItems.length,
      data: processedItems, // ข้อมูลที่ถูกต้อง (สีเขียว/ปกติ)

      hasError: errorRows.length > 0,
      errorCount: errorRows.length,
      errorData: errorRows, // ข้อมูลที่ผิดพลาด (Frontend เอาไปวนลูปแสดงสีแดง)
    });
  } catch (error) {
    console.error("Import Error:", error);
    res.status(500).json({ success: false, message: "Import failed" });
  }
};

exports.getNextPurchaseNumber = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select("comp_id");
    if (!user || !user.comp_id) {
      return res
        .status(400)
        .json({ success: false, message: "User not associated with company" });
    }

    const nextNumber = await generatePurchaseNumber(user.comp_id);

    res.status(200).json({
      success: true,
      data: nextNumber,
    });
  } catch (error) {
    console.error("Error generating purchase number:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ดึงข้อมูลใบสั่งซื้อ 1 ใบ ตาม ID ทำมาดูข้อมูล
exports.getPurchaseById = async (req, res) => {
  try {
    const { id } = req.params; // รับ ID ของใบสั่งซื้อมาจาก URL

    // ไปค้นหาบิลในตาราง Purchase
    const purchase = await Purchase.findById(id)
      .populate("items.product_id", "product_code product_name file") // ดึงชื่อและรูปสินค้ามาด้วย
      .populate("items.warehouse_id", "warehouse_name") // ดึงชื่อคลังมาด้วย
      .populate("created_by", "name email") // ดึงชื่อคนสร้างบิลมาด้วย
      .lean();

    if (!purchase) {
      return res
        .status(404)
        .json({ success: false, message: "Purchase not found" });
    }

    // ส่งข้อมูลกลับไปให้หน้าบ้าน
    res.status(200).json({
      success: true,
      data: purchase,
    });
  } catch (error) {
    console.error("Get Purchase Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
//ดูยอดรวมทุกบิล
exports.getProductPurchaseHistory = async (req, res) => {
  try {
    const { productId } = req.params;
    const user = await User.findById(req.user.id).select("comp_id").lean();
    const historyData = await StockTransaction.aggregate([
      {
        $match: {
          comp_id: user.comp_id,
          product_id: new mongoose.Types.ObjectId(productId),
          type: "in", // เอาเฉพาะขาเข้า
          action_type: "purchase", // เอาเฉพาะที่มาจากการ "ซื้อ" (ไม่เอารับคืนจากลูกค้า)
        },
      },
      {
        $group: {
          _id: "$product_id",
          total_qty_purchased: { $sum: "$qty" }, // รวมจำนวนชิ้นที่เคยซื้อทั้งหมด
          total_amount_spent: { $sum: "$amount" }, // 🟢 รวมจำนวนเงินที่เคยจ่ายไปทั้งหมด (100 + 100 = 200)
        },
      },
    ]);

    // ถ้าไม่มีประวัติการซื้อเลย
    if (!historyData || historyData.length === 0) {
      return res.json({
        success: true,
        data: {
          total_qty_purchased: 0,
          total_amount_spent: 0,
        },
      });
    }

    res.json({
      success: true,
      data: historyData[0], // พ่นก้อนที่รวมยอดแล้วกลับไปให้หน้าบ้าน
    });
  } catch (error) {
    console.error("History Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
