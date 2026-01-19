const Purchase = require("../models/Purchase");
const Stock = require("../models/Stock");
const StockTransaction = require("../models/StockTransaction");
const User = require("../models/User");
const XLSX = require("xlsx");
const Product = require("../models/Product");

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
    if (!user || !user.comp_id) {
      throw new Error("User not associated with company");
    }

    const autoPurchaseNumber = await generatePurchaseNumber(user.comp_id);

    const totalAmount = items.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0,
    );

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
      items: items,
    });

    await newPurchase.save({ session });

    for (const item of items) {
      if (!item.warehouse_id) {
        throw new Error(`Product ${item.product_id} missing warehouse_id`);
      }

      const totalGwToAdd = (Number(item.gross_weight) || 0) * Number(item.qty);
      const totalNwToAdd = (Number(item.net_weight) || 0) * Number(item.qty);
      const totalSwToAdd = (Number(item.stone_weight) || 0) * Number(item.qty);

      const updatedStock = await Stock.findOneAndUpdate(
        {
          comp_id: user.comp_id,
          warehouse_id: item.warehouse_id,
          product_id: item.product_id,
        },
        {
          $inc: {
            quantity: Number(item.qty),
            total_gross_weight: totalGwToAdd,
            total_net_weight: totalNwToAdd,
            total_stone_weight: totalSwToAdd,
          },
          $set: {
            cost: Number(item.cost),
            price: Number(item.price),
          },
        },
        { new: true, upsert: true, session },
      );

      await StockTransaction.create(
        [
          {
            comp_id: user.comp_id,
            product_id: item.product_id,
            warehouse_id: item.warehouse_id,
            type: "in",
            action_type: "purchase",
            document_ref: newPurchase._id,
            qty: Number(item.qty),
            cost: Number(item.cost),

            balance_qty: updatedStock.quantity,

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
      message: "Purchase saved and stock updated successfully",
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

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    // defval: "" เพื่อกัน error กรณีช่องว่าง
    const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: "",
    });

    const processedItems = [];
    const localBaseUrl = `${req.protocol}://${req.get("host")}/uploads/product/`;

    for (const row of rawData) {
      // 1. อ่าน Code (รองรับทั้ง Code และ code ตัวเล็กตัวใหญ่)
      const productCode = row["Code"] || row["code"];

      if (!productCode) continue; // ถ้าไม่มี code ข้ามบรรทัดนี้

      // หา Product ใน DB
      const product = await Product.findOne({
        product_code: productCode.toString().trim(),
        comp_id: req.user.comp_id,
      })
        .select("product_name product_code file product_detail_id price unit")
        .populate("product_detail_id");

      if (product) {
        // จัดการรูปภาพ
        let finalImage = "";
        if (product.file && product.file.length > 0) {
          finalImage = product.file[0].startsWith("http")
            ? product.file[0]
            : `${localBaseUrl}${product.file[0]}`;
        }

        const detail = product.product_detail_id || {};

        // 2. ดึงค่าจาก Excel (ตามชื่อหัวคอลัมน์ในรูปเป๊ะๆ)
        // ถ้าใน Excel ไม่กรอกมา ให้เป็น 0 หรือค่า Default
        const excelQty = Number(row["QTY"]) || Number(row["Qty"]) || 1;
        const excelCost = Number(row["Cost"]) || 0;
        const excelPrice = Number(row["Price"]) || product.price || 0;

        // น้ำหนัก: ถ้า Excel กรอกมาให้ใช้ Excel, ถ้าไม่กรอกให้ดึงจาก Master
        const excelGw = Number(row["Gross Weight (g)"]) || 0;
        const excelNw = Number(row["Net Weight (g)"]) || detail.weight || 0;

        // หมายเหตุ: S.Weight (Swt) ใน Excel รูปนี้ไม่มี ถ้ามีคอลัมน์เพิ่มก็ใส่ row["Stone Weight"] ได้

        processedItems.push({
          product_id: product._id,
          code: product.product_code,
          name: product.product_name,
          image: finalImage,

          qty: excelQty,
          cost: excelCost,
          price: excelPrice,

          // ส่งค่าที่ map ได้กลับไป
          gross_weight: excelGw,
          net_weight: excelNw,
          stone_weight: detail.primary_stone?.weight || 0, // ดึงจาก Master ไปก่อนถ้าใน Excel ไม่มี

          unit: row["Unit"] || product.unit || "pcs",
        });
      }
    }

    res.json({
      success: true,
      count: processedItems.length,
      data: processedItems,
    });
  } catch (error) {
    console.error("Import Error:", error);
    res.status(500).json({ success: false, message: "Import failed" });
  }
};
