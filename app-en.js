const drugs = [
  {
    id: "bev",
    name: "Bevacizumab",
    vialStrengthMg: 100,
    pricePerVial: 1180,
    concentrationMgMl: 10,
    reconstitutionSolvent: "Water for Injection",
    solvent: "0.9% NaCl 100 mL",
    compatibleSolvents: ["0.9% NaCl 100 mL", "0.9% NaCl 250 mL"],
    stabilityHours: 8,
    minWithdrawMl: 0.5,
    lightSensitive: false,
    refrigerated: false,
    shareable: true,
    riskLevel: "Medium",
    rules: ["Use within 8 hours after opening", "Same drug and same diluent can be shared", "Cross-ward sharing allowed"]
  },
  {
    id: "pem",
    name: "Pemetrexed",
    vialStrengthMg: 500,
    pricePerVial: 1460,
    concentrationMgMl: 25,
    reconstitutionSolvent: "0.9% NaCl",
    solvent: "0.9% NaCl 100 mL",
    compatibleSolvents: ["0.9% NaCl 100 mL"],
    stabilityHours: 6,
    minWithdrawMl: 1,
    lightSensitive: false,
    refrigerated: false,
    shareable: true,
    riskLevel: "Medium",
    rules: ["Use within 6 hours after reconstitution", "Share within preparation batch", "Check renal-function-related order requirements"]
  },
  {
    id: "oxa",
    name: "Oxaliplatin",
    vialStrengthMg: 100,
    pricePerVial: 720,
    concentrationMgMl: 5,
    reconstitutionSolvent: "5% Glucose",
    solvent: "5% Glucose 250 mL",
    compatibleSolvents: ["5% Glucose 250 mL", "5% Glucose 500 mL"],
    stabilityHours: 6,
    minWithdrawMl: 0.5,
    lightSensitive: true,
    refrigerated: false,
    shareable: true,
    riskLevel: "High",
    rules: ["Chloride-containing diluents prohibited", "Protect from light during preparation", "Use within 6 hours after reconstitution"]
  },
  {
    id: "trial",
    name: "Blinded Clinical Trial Drug",
    vialStrengthMg: 80,
    pricePerVial: 0,
    concentrationMgMl: 8,
    reconstitutionSolvent: "Dedicated solvent",
    solvent: "Dedicated solvent 50 mL",
    compatibleSolvents: ["Dedicated solvent 50 mL"],
    stabilityHours: 2,
    minWithdrawMl: 0.5,
    lightSensitive: true,
    refrigerated: true,
    shareable: false,
    riskLevel: "High",
    rules: ["Blinded-drug management", "No sharing", "Prepare independently"]
  }
];

let orders = [];

let auditTrail = [];
let importedDynamicDrugIds = [];
let importSummary = [];
let importRejected = [];
let selectedBatchFilter = "all";
let selectedInstructionDrugId = null;
let selectedMaintenanceDrugId = null;
let drugKnowledgeSearchTerm = "";
let historyRecords = [];
let expandedHistoryId = null;
let lastArchivedSignature = null;
const confirmedDrugIds = new Set();
const HISTORY_STORAGE_KEY = "dosepilot_history_en";

const fmtMoney = value => `¥${Math.round(value).toLocaleString("en-US")}`;
const fmtDose = value => `${round(value)} mg`;
const fmtMl = value => `${round(value)} mL`;
const round = value => Number.parseFloat(value.toFixed(2)).toString();

const DRUG_NAME_EN = {
  "三氧化二砷针": "Arsenic Trioxide Injection",
  "伊匹木单抗注射液": "Ipilimumab Injection",
  "优替德隆注射液": "Utidelone Injection",
  "依托泊苷注射液": "Etoposide Injection",
  "信迪利单抗注射液": "Sintilimab Injection",
  "利妥昔单抗注射液": "Rituximab Injection",
  "卡度尼利单抗注射液": "Cadonilimab Injection",
  "卡铂注射液": "Carboplatin Injection",
  "培门冬酶注射液": "Pegaspargase Injection",
  "塞替派注射液": "Thiotepa Injection",
  "多柔比星脂质体注射液": "Doxorubicin Liposome Injection",
  "多西他赛注射液": "Docetaxel Injection",
  "奥沙利铂甘露醇注射液": "Oxaliplatin and Mannitol Injection",
  "帕博利珠单抗注射液": "Pembrolizumab Injection",
  "斯鲁利单抗注射液": "Serplulimab Injection",
  "替尼泊苷注射液": "Teniposide Injection",
  "氟尿嘧啶注射液": "Fluorouracil Injection",
  "注射用丝裂霉素": "Mitomycin for Injection",
  "注射用亮丙瑞林微球": "Leuprorelin Microspheres for Injection",
  "注射用伊尼妥单抗": "Inetetamab for Injection",
  "注射用伊达比星": "Idarubicin for Injection",
  "注射用卡铂": "Carboplatin for Injection",
  "注射用卡非佐米": "Carfilzomib for Injection",
  "注射用司妥昔单抗": "Siltuximab for Injection",
  "注射用地加瑞克": "Degarelix for Injection",
  "注射用地西他滨": "Decitabine for Injection",
  "注射用培美曲塞二钠": "Pemetrexed Disodium for Injection",
  "注射用奈达铂": "Nedaplatin for Injection",
  "注射用奥加伊妥珠单抗": "Inotuzumab Ozogamicin for Injection",
  "注射用奥沙利铂": "Oxaliplatin for Injection",
  "注射用异环磷酰胺": "Ifosfamide for Injection",
  "注射用德曲妥珠单抗": "Trastuzumab Deruxtecan for Injection",
  "注射用恩美曲妥珠单抗": "Trastuzumab Emtansine for Injection",
  "注射用曲妥珠单抗": "Trastuzumab for Injection",
  "注射用氟达拉滨": "Fludarabine for Injection",
  "注射用洛铂": "Lobaplatin for Injection",
  "注射用环磷酰胺": "Cyclophosphamide for Injection",
  "注射用盐酸伊达比星": "Idarubicin Hydrochloride for Injection",
  "注射用盐酸博来霉素": "Bleomycin Hydrochloride for Injection",
  "注射用盐酸吉西他滨": "Gemcitabine Hydrochloride for Injection",
  "注射用盐酸吡柔比星": "Pirarubicin Hydrochloride for Injection",
  "注射用盐酸多柔比星": "Doxorubicin Hydrochloride for Injection",
  "注射用盐酸柔红霉素": "Daunorubicin Hydrochloride for Injection",
  "注射用盐酸苯达莫司汀": "Bendamustine Hydrochloride for Injection",
  "注射用盐酸表柔比星": "Epirubicin Hydrochloride for Injection",
  "注射用硫酸长春地辛": "Vindesine Sulfate for Injection",
  "注射用硫酸长春新碱": "Vincristine Sulfate for Injection",
  "注射用硼替佐米": "Bortezomib for Injection",
  "注射用紫杉醇脂质体": "Paclitaxel Liposome for Injection",
  "注射用紫杉醇（白蛋白结合型）": "Paclitaxel for Injection (Albumin-bound)",
  "注射用维布妥昔单抗": "Brentuximab Vedotin for Injection",
  "注射用维泊妥珠单抗": "Polatuzumab Vedotin for Injection",
  "注射用维迪西妥单抗": "Disitamab Vedotin for Injection",
  "注射用贝林妥欧单抗": "Blinatumomab for Injection",
  "注射用达卡巴嗪": "Dacarbazine for Injection",
  "注射用阿扎胞苷": "Azacitidine for Injection",
  "注射用阿糖胞苷": "Cytarabine for Injection",
  "注射用雷替曲塞": "Raltitrexed for Injection",
  "注射用顺铂": "Cisplatin for Injection",
  "泽贝妥单抗注射液": "Zanidatamab Injection",
  "特瑞普利单抗注射液": "Toripalimab Injection",
  "甲氨蝶呤注射液": "Methotrexate Injection",
  "白消安注射液": "Busulfan Injection",
  "盐酸伊立替康注射液": "Irinotecan Hydrochloride Injection",
  "盐酸伊立替康脂质体注射液": "Irinotecan Hydrochloride Liposome Injection",
  "盐酸米托蒽醌脂质体注射液": "Mitoxantrone Hydrochloride Liposome Injection",
  "紫杉醇注射液": "Paclitaxel Injection",
  "纳武利尤单抗注射液": "Nivolumab Injection",
  "艾立布林注射液": "Eribulin Injection",
  "西妥昔单抗注射液": "Cetuximab Injection",
  "贝伐珠单抗注射液": "Bevacizumab Injection",
  "达雷妥尤单抗注射液": "Daratumumab Injection",
  "酒石酸长春瑞滨注射液": "Vinorelbine Tartrate Injection",
  "雷莫西尤单抗注射液": "Ramucirumab Injection",
  "顺铂注射液": "Cisplatin Injection",
  "高三尖杉酯碱注射液": "Homoharringtonine Injection"
};

const DRUG_ALIAS_EN = {
  "Bevacizumab": ["贝伐珠单抗", "Bevacizumab Injection"],
  "Pemetrexed": ["培美曲塞", "注射用培美曲塞二钠", "Pemetrexed Disodium"],
  "Oxaliplatin": ["奥沙利铂", "注射用奥沙利铂", "Oxaliplatin for Injection"],
  "Trastuzumab for Injection": ["曲妥珠单抗", "注射用曲妥珠单抗", "Trastuzumab"],
  "Gemcitabine Hydrochloride for Injection": ["吉西他滨", "注射用盐酸吉西他滨", "Gemcitabine"],
  "Rituximab Injection": ["利妥昔单抗", "Rituximab"],
  "Paclitaxel Injection": ["紫杉醇", "Paclitaxel"],
  "Carboplatin Injection": ["卡铂", "Carboplatin"],
  "Cisplatin Injection": ["顺铂", "Cisplatin"],
  "Docetaxel Injection": ["多西他赛", "Docetaxel"]
};

function englishDrugName(name) {
  return DRUG_NAME_EN[name] || name;
}

function englishValue(value) {
  return String(value || "")
    .replace(/注射用水（USP）/g, "Water for Injection (USP)")
    .replace(/无菌注射用水/g, "Sterile Water for Injection")
    .replace(/注射用水/g, "Water for Injection")
    .replace(/随药附带专用注射用溶剂/g, "dedicated injection solvent supplied with product")
    .replace(/专用溶媒/g, "dedicated solvent")
    .replace(/氯化钠注射液/g, "Sodium Chloride Injection")
    .replace(/葡萄糖注射液/g, "Glucose Injection")
    .replace(/同药同溶媒可共享/g, "same drug and same diluent can be shared")
    .replace(/可共享/g, "Shareable")
    .replace(/不共享/g, "Not shareable")
    .replace(/禁止共享/g, "No sharing")
    .replace(/仅用于静脉注射/g, "IV injection only")
    .replace(/静脉滴注/g, "IV infusion")
    .replace(/静脉注射/g, "IV injection")
    .replace(/皮下注射/g, "subcutaneous injection")
    .replace(/一般整支使用/g, "usually full-unit use")
    .replace(/避光/g, "protect from light")
    .replace(/冷藏/g, "refrigerated")
    .replace(/保存/g, "store")
    .replace(/立即使用/g, "use immediately")
    .replace(/小时/g, "h")
    .replace(/天/g, "days")
    .replace(/待维护/g, "Pending maintenance")
    .replace(/无/g, "None");
}

function drugSearchTerms(drug) {
  return [drug.name, drug.sourceName, englishDrugName(drug.sourceName), englishDrugName(drug.name), ...(drug.aliases || []), ...(DRUG_ALIAS_EN[drug.name] || [])]
    .filter(Boolean)
    .map(normalizeText);
}

function minutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function addMinutes(time, delta) {
  const total = minutes(time) + delta;
  const hour = Math.floor(total / 60).toString().padStart(2, "0");
  const minute = (total % 60).toString().padStart(2, "0");
  return `${hour}:${minute}`;
}

function formatRelativeTime(totalMinutes) {
  const day = Math.floor(totalMinutes / 1440);
  const timeOfDay = ((totalMinutes % 1440) + 1440) % 1440;
  const hour = Math.floor(timeOfDay / 60).toString().padStart(2, "0");
  const minute = (timeOfDay % 60).toString().padStart(2, "0");
  if (day === 0) return `${hour}:${minute}`;
  if (day === 1) return `Next day ${hour}:${minute}`;
  return `${day} days later ${hour}:${minute}`;
}

function relativeTimeAfter(time, delta) {
  const total = minutes(time) + delta;
  return {
    totalMinutes: total,
    label: formatRelativeTime(total)
  };
}

function formatNumberRanges(numbers) {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const ranges = [];
  let start = null;
  let end = null;
  for (const value of sorted) {
    if (start === null) {
      start = value;
      end = value;
    } else if (value === end + 1) {
      end = value;
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = value;
      end = value;
    }
  }
  if (start !== null) ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(", ");
}

function formatWholeVialRefs(vialNos) {
  const ranges = formatNumberRanges(vialNos);
  return ranges ? `whole vial ${ranges}` : "";
}

function batchOrder(batch) {
  const known = ["Batch 1", "Batch 2", "Batch 3", "Batch 4", "第一批", "第二批", "第三批", "第四批"];
  const index = known.indexOf(batch);
  return index >= 0 ? index : known.length;
}

function compareOrdersByBatch(a, b) {
  const batchCompare = batchOrder(a.batch) - batchOrder(b.batch) || String(a.batch || "").localeCompare(String(b.batch || ""), "en");
  if (batchCompare) return batchCompare;
  const prepCompare = minutes(a.prepTime || "09:00") - minutes(b.prepTime || "09:00");
  if (prepCompare) return prepCompare;
  const infusionCompare = minutes(a.infusionTime || a.prepTime || "10:00") - minutes(b.infusionTime || b.prepTime || "10:00");
  if (infusionCompare) return infusionCompare;
  return (a.importIndex ?? 0) - (b.importIndex ?? 0);
}

function byDrug(id) {
  return drugs.find(drug => drug.id === id);
}

function uniqueCount(items, keyFn) {
  return new Set(items.map(keyFn).filter(Boolean)).size;
}

function findDrugByName(name) {
  const normalized = normalizeText(name);
  return drugs.find(drug => drugSearchTerms(drug).some(term => normalized.includes(term) || term.includes(normalized)));
}

function findDrugByNameAndStrength(name, strength) {
  const normalized = normalizeText(name);
  const candidates = drugs.filter(drug => drugSearchTerms(drug).some(term => normalized.includes(term) || term.includes(normalized)));
  if (!strength) return candidates[0];
  return candidates.find(drug => Math.abs(drug.vialStrengthMg - strength) < 0.0001) || candidates[0];
}

function findExactDrugByNameAndStrength(name, strength) {
  const normalized = normalizeText(name);
  return drugs.find(drug =>
    Math.abs(drug.vialStrengthMg - strength) < 0.0001 &&
    drugSearchTerms(drug).some(term => term === normalized)
  );
}

function normalizeText(value) {
  return String(value || "").replace(/[（(].*?[）)]/g, "").replace(/\s+/g, "").toLowerCase();
}

function routeText(order) {
  return String(order?.route || "IV infusion").trim() || "IV infusion";
}

function isIvInjection(route) {
  const text = normalizeText(route);
  return text.includes("ivinjection") || text.includes("ivpush") || text.includes("ivbolus") || text.includes("静脉注射");
}

function isIvInfusion(route) {
  const text = normalizeText(route);
  return text.includes("ivinfusion") || text.includes("infusion") || text.includes("静脉滴注") || text.includes("静脉输注") || text.includes("输注") || text.includes("滴注");
}

function shareRuleText(drug) {
  return [drug?.shareableText, drug?.shareableStatus, ...(drug?.rules || [])].filter(Boolean).join("; ");
}

function hasRouteConditionalNoShare(drug) {
  const text = normalizeText(shareRuleText(drug));
  return (text.includes("不共享") || text.includes("notshareable")) && (text.includes("ivinjection") || text.includes("subcutaneous") || text.includes("皮下注射"));
}

function hasHardNoShare(drug) {
  const text = normalizeText(shareRuleText(drug));
  if (drug?.shareable === true) return false;
  if (hasRouteConditionalNoShare(drug)) return false;
  return !drug?.shareable || ["盲法", "特殊管理", "独立配置", "notshareable", "nosharing", "prepareindependently", "现配现用", "极不稳定"].some(keyword => text.includes(normalizeText(keyword)));
}

function evaluateOrderShareability(order, drug = byDrug(order?.drugId)) {
  const route = routeText(order);
  if (!drug) return { shareable: false, reason: "Drug dictionary missing" };
  if (isIvInjection(route)) return { shareable: false, reason: "IV injection order; handle as full-vial/independent preparation" };
  if (hasHardNoShare(drug)) return { shareable: false, reason: "Institutional rules prohibit sharing" };
  if (hasRouteConditionalNoShare(drug) && !isIvInfusion(route)) return { shareable: false, reason: "Current route is not suitable for sharing" };
  return { shareable: true, reason: hasRouteConditionalNoShare(drug) ? "IV infusion order; eligible for sharing calculation" : "Sharing allowed by rules" };
}

function stabilityLabel(text, hours) {
  if (text) return englishValue(text);
  if (Number.isFinite(hours) && hours > 0) return `${round(hours)} h`;
  return "Pharmacist review pending";
}

function formatReconstitutionVolume(drug) {
  if (drug?.requiresReconstitution === false) return "0 mL (no reconstitution required)";
  const volume = drug?.reconstitutionVolumeMl || (drug?.concentrationMgMl ? drug.vialStrengthMg / drug.concentrationMgMl : 0);
  return fmtMl(volume);
}

function getReconstitutedStabilityHours(drug) {
  return Number(drug?.reconstitutedStabilityHours || 0);
}

function getDilutedStabilityHours(drug) {
  return Number(drug?.dilutedStabilityHours || 0);
}

function getShareWindowMinutes(drug) {
  const hours = getReconstitutedStabilityHours(drug) || getDilutedStabilityHours(drug) || Number(drug?.stabilityHours || 0) || 6;
  return hours * 60;
}

function stabilityWarnings(order, drug) {
  const warnings = [];
  const dilutedHours = getDilutedStabilityHours(drug);
  if (dilutedHours > 0 && minutes(order.infusionTime) - minutes(order.prepTime) > dilutedHours * 60) {
    warnings.push(`Diluted stability exceeds ${round(dilutedHours)} h; review required`);
  }
  if (!getReconstitutedStabilityHours(drug) && !drug.reconstitutedStabilityText) warnings.push("Reconstituted stability pending maintenance");
  if (!getDilutedStabilityHours(drug) && !drug.dilutedStabilityText) warnings.push("Diluted stability pending maintenance");
  return warnings;
}

function getOrderIssues(order) {
  const drug = byDrug(order.drugId);
  const issues = [];
  const shareability = evaluateOrderShareability(order, drug);
  if (!drug) issues.push("Drug dictionary missing");
  if (drug && !shareability.shareable) issues.push(shareability.reason);
  if (order.auditStatus === "hold") issues.push(order.labFlag);
  if (order.auditStatus === "blocked") issues.push(order.labFlag || "Manual handling required");
  if (drug && !drug.compatibleSolvents.includes(drug.solvent)) issues.push("Diluent/volume not in rule base");
  if (drug && order.doseMg / drug.concentrationMgMl < drug.minWithdrawMl) issues.push("Withdrawal volume below minimum accurate volume");
  if (drug) issues.push(...stabilityWarnings(order, drug));
  if (order.status !== "active") issues.push("Inactive order");
  return issues;
}

function calculatePlan() {
  const activeOrders = orders.filter(order => order.status === "active");
  const eligibleOrders = activeOrders.filter(order => ["passed", "hold"].includes(order.auditStatus) && evaluateOrderShareability(order).shareable);
  const plans = [];

  drugs.forEach(drug => {
    const drugOrders = eligibleOrders
      .filter(order => order.drugId === drug.id)
      .sort(compareOrdersByBatch);

    if (drugOrders.length === 0) return;

    const vials = [];

    drugOrders.forEach(order => {
      const maxWindow = getShareWindowMinutes(drug);
      let remainingDose = order.doseMg;

      while (remainingDose > 0) {
        let placed = false;

        for (const vial of vials) {
          const windowOk = minutes(order.infusionTime) - minutes(vial.openTime) <= maxWindow;
          const batchOk = vial.batch === order.batch;
          const availableMg = Math.max(0, drug.vialStrengthMg - vial.usedMg);
          const doseToPlace = Math.min(remainingDose, availableMg);
          const capacityOk = doseToPlace > 0.0001 && vial.usedMg + doseToPlace <= drug.vialStrengthMg + 0.0001;
          if (windowOk && batchOk && capacityOk) {
            vial.orders.push({ ...order, doseMg: doseToPlace, originalDoseMg: order.doseMg });
            vial.usedMg += doseToPlace;
            vial.lastInfusionTime = order.infusionTime;
            placed = true;
            remainingDose -= doseToPlace;
            break;
          }
        }

        if (!placed) {
          const doseToPlace = Math.min(remainingDose, drug.vialStrengthMg);
          vials.push({
            id: `${drug.id}-${vials.length + 1}`,
            drug,
            batch: order.batch,
            openTime: order.prepTime,
            lastInfusionTime: order.infusionTime,
            usedMg: doseToPlace,
            orders: [{ ...order, doseMg: doseToPlace, originalDoseMg: order.doseMg }]
          });
          remainingDose -= doseToPlace;
        }
      }
    });

    vials.forEach(vial => {
      vial.wasteMg = Math.max(0, vial.drug.vialStrengthMg - vial.usedMg);
      vial.wasteAmount = vial.wasteMg / vial.drug.vialStrengthMg * vial.drug.pricePerVial;
      vial.shared = vial.orders.length > 1;
      vial.reconstitutionMl = vial.drug.reconstitutionVolumeMl || vial.drug.vialStrengthMg / vial.drug.concentrationMgMl;
      vial.expireTime = relativeTimeAfter(vial.openTime, getShareWindowMinutes(vial.drug));
      vial.requiresManualReview = vial.orders.some(order => order.auditStatus === "hold") || vial.drug.lightSensitive || vial.orders.some(order => order.doseMg / vial.drug.concentrationMgMl < vial.drug.minWithdrawMl) || vial.orders.some(order => stabilityWarnings(order, vial.drug).length);
    });

    plans.push({ drug, orders: drugOrders, vials });
  });

  return { activeOrders, eligibleOrders, plans };
}

function baselineVialsForOrders(activeOrders) {
  return activeOrders.reduce((sum, order) => {
    const drug = byDrug(order.drugId);
    if (!drug || !evaluateOrderShareability(order, drug).shareable || order.auditStatus === "blocked") return sum;
    return sum + (Number.isFinite(order.dispensedVials) && order.dispensedVials > 0 ? order.dispensedVials : Math.ceil(order.doseMg / drug.vialStrengthMg));
  }, 0);
}

function renderEmptyWorkState() {
  selectedInstructionDrugId = null;
  importSummary = [];
  document.querySelector("#savedAmount").textContent = "-";
  document.querySelector("#shareRate").textContent = "-";
  document.querySelector("#wasteRate").textContent = "-";
  document.querySelector("#patientCount").textContent = "-";
  document.querySelector("#runStatus").textContent = "Pending import";
  document.querySelector("#importMetrics").innerHTML = "";
  document.querySelector("#importSummaryRows").innerHTML = `<tr><td colspan="6">No daily prescriptions imported.</td></tr>`;
  document.querySelector("#currentBatch").innerHTML = `<option value="all">All batches</option>`;
  document.querySelector("#batchTimeline").innerHTML = `<tr><td colspan="7">No daily prescriptions imported.</td></tr>`;
  document.querySelector("#drugTasks").innerHTML = `<article class="task-card">No daily prescriptions imported.</article>`;
  document.querySelector("#instructionTitle").textContent = "Post-sharing Preparation Volume Conversion";
  document.querySelector("#instructionRows").innerHTML = `<tr><td colspan="5">No daily prescriptions imported.</td></tr>`;
  document.querySelector("#analyticsCards").innerHTML = "";
  renderHistoryRecords();
  renderDrugKnowledge();
}

function render() {
  if (!orders.length) {
    renderEmptyWorkState();
    return;
  }

  const result = calculatePlan();
  const visibleDrugIds = result.plans.map(plan => plan.drug.id);
  if (!visibleDrugIds.length) {
    selectedInstructionDrugId = null;
  } else if (!selectedInstructionDrugId || !visibleDrugIds.includes(selectedInstructionDrugId)) {
    selectedInstructionDrugId = visibleDrugIds[0];
  }
  const allVials = result.plans.flatMap(plan => plan.vials);
  const baselineVials = baselineVialsForOrders(result.activeOrders);
  const optimizedVials = allVials.length;
  const savedVials = Math.max(0, baselineVials - optimizedVials);
  const openedDose = allVials.reduce((sum, vial) => sum + vial.drug.vialStrengthMg, 0);
  const wasteDose = allVials.reduce((sum, vial) => sum + vial.wasteMg, 0);
  const savedAmount = result.plans.reduce((sum, plan) => {
    const baseline = plan.orders.reduce((vials, order) => vials + (Number.isFinite(order.dispensedVials) && order.dispensedVials > 0 ? order.dispensedVials : Math.ceil(order.doseMg / plan.drug.vialStrengthMg)), 0);
    return sum + Math.max(0, baseline - plan.vials.length) * plan.drug.pricePerVial;
  }, 0);

  document.querySelector("#savedAmount").textContent = fmtMoney(savedAmount);
  document.querySelector("#shareRate").textContent = allVials.length ? `${round(allVials.filter(v => v.shared).length / allVials.length * 100)}%` : "0%";
  document.querySelector("#wasteRate").textContent = openedDose ? `${round(wasteDose / openedDose * 100)}%` : "0%";
  document.querySelector("#patientCount").textContent = uniqueCount(result.activeOrders, order => order.patient);
  document.querySelector("#runStatus").textContent = `Calculated ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
  renderImportSummary(result);
  renderBatchTimeline(result.plans);
  renderTasks(result.plans);
  renderInstructions(result.plans);
  renderDrugKnowledge();
  renderAnalytics(result, savedVials, savedAmount, wasteDose, openedDose);
  renderHistoryRecords();
}

function formatLargeMoney(value) {
  const number = Number(value) || 0;
  if (number >= 10000) return `¥${round(number / 1000)}k`;
  return fmtMoney(number);
}

function formatCount(value) {
  return Math.round(Number(value) || 0).toLocaleString("en-US");
}


function getImportSampleText() {
  return [
    "Patient Name,Drug Name,Order Dose (mg),Vial Strength (mg),Price per Vial,Reconstituted Concentration (mg/mL),Route,Preparation Time,Infusion Time,Ward,Bed,Batch,Dispensed Vials",
    "Patient A,Bevacizumab,60,100,1180,10,IV infusion,09:00,10:00,Oncology Ward 1,12 Bed,Batch 1,1",
    "Patient B,Bevacizumab,35,100,1180,10,IV infusion,09:10,10:20,Oncology Ward 3,21 Bed,Batch 1,1",
    "Patient C,Bevacizumab,102,100,1180,10,IV infusion,09:30,11:00,Day Chemotherapy,Day 07,Batch 2,2",
    "Patient D,Bevacizumab,98,100,1180,10,IV infusion,09:45,11:20,Oncology Ward 2,18 Bed,Batch 2,1",
    "Patient E,Pemetrexed,720,500,1460,25,IV infusion,08:50,10:10,Oncology Ward 2,09 Bed,Batch 1,2",
    "Patient F,Pemetrexed,260,500,1460,25,IV infusion,09:05,10:40,Day Chemotherapy,Day 12,Batch 1,1",
    "Patient G,Oxaliplatin,85,100,720,5,IV infusion,09:20,10:30,Oncology Ward 1,06 Bed,Batch 1,1",
    "Patient H,Oxaliplatin,110,100,720,5,IV infusion,09:40,11:10,Oncology Ward 2,22 Bed,Batch 2,2"
  ].join("\n");
}

function splitDelimitedLine(line, delimiter) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseDelimitedText(text) {
  const clean = text.replace(/^\ufeff/, "").trim();
  if (!clean) return [];
  const lines = clean.split(/\r?\n/).filter(Boolean);
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = splitDelimitedLine(lines[0], delimiter).map(normalizeHeader);
  return lines.slice(1).map(line => {
    const values = splitDelimitedLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

async function readTableFileAsText(file) {
  if (/\.xlsx?$/i.test(file.name)) {
    if (!window.XLSX) {
      window.alert("The Excel parser has not finished loading. Try again shortly, or save Excel as CSV before importing.");
      return "";
    }
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return "";
    return window.XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheetName], { FS: ",", RS: "\n", blankrows: false });
  }

  const buffer = await file.arrayBuffer();
  const utf8Text = new TextDecoder("utf-8").decode(buffer);
  if (!utf8Text.includes("�")) return utf8Text;
  try {
    return new TextDecoder("gb18030").decode(buffer);
  } catch {
    return utf8Text;
  }
}

function normalizeHeader(header) {
  // Keep units inside parentheses: dose (mg) and concentration (mg/mL).
  const text = String(header || "").replace(/[\s（）()\/]/g, "").toLowerCase();
  const map = new Map([
    ["patient", "patientName"], ["patientname", "patientName"], ["name", "patientName"], ["患者", "patientName"], ["患者姓名", "patientName"], ["姓名", "patientName"],
    ["patientid", "patientId"], ["medicalrecordnumber", "patientId"], ["mrn", "patientId"], ["患者编号", "patientId"], ["病历号", "patientId"],
    ["drug", "drugName"], ["drugname", "drugName"], ["genericname", "drugName"], ["药品名称", "drugName"], ["药品通用名", "drugName"], ["药品", "drugName"],
    ["orderdosemg", "doseMg"], ["orderdose", "doseMg"], ["dosemg", "doseMg"], ["dose", "doseMg"], ["医嘱剂量mg", "doseMg"], ["剂量mg", "doseMg"], ["剂量", "doseMg"],
    ["actualusedvials", "actualUsedVials"], ["actualused", "actualUsedVials"], ["实际使用量", "actualUsedVials"], ["实际使用瓶", "actualUsedVials"],
    ["vialstrengthmg", "strengthMg"], ["vialstrength", "strengthMg"], ["strengthmg", "strengthMg"], ["strength", "strengthMg"], ["药品规格mg", "strengthMg"], ["规格mg", "strengthMg"],
    ["specification", "specText"], ["spec", "specText"], ["药品规格", "specText"], ["规格", "specText"],
    ["pricepervial", "price"], ["drugprice", "price"], ["price", "price"], ["药品单价", "price"], ["单价", "price"],
    ["reconstitutedconcentrationmgml", "concentration"], ["reconstitutedconcentration", "concentration"], ["concentrationmgml", "concentration"], ["concentration", "concentration"], ["复溶浓度", "concentration"],
    ["reconstitutionsolvent", "reconstitutionSolvent"], ["复溶溶媒", "reconstitutionSolvent"],
    ["reconstitutionvolume", "reconstitutionVolumeText"], ["reconstitutionvolumeml", "reconstitutionVolumeText"], ["复溶溶媒量", "reconstitutionVolumeText"], ["复溶加入溶媒量ml", "reconstitutionVolumeText"],
    ["diluentandvolume", "solvent"], ["diluent", "solvent"], ["solvent", "solvent"], ["溶媒类型及规格", "solvent"], ["稀释液及规格", "solvent"],
    ["stabilityhours", "stabilityHours"], ["openvialstabilityhours", "stabilityHours"], ["稳定性小时", "stabilityHours"],
    ["reconstitutedstability", "reconstitutedStabilityText"], ["reconstitutedstabilityhours", "reconstitutedStabilityHours"], ["复溶液稳定性", "reconstitutedStabilityText"],
    ["dilutedstability", "dilutedStabilityText"], ["dilutedstabilityhours", "dilutedStabilityHours"], ["稀释液稳定性", "dilutedStabilityText"], ["稀释液药品稳定性", "dilutedStabilityText"],
    ["minimumaccuratewithdrawalml", "minWithdrawMl"], ["minwithdrawml", "minWithdrawMl"], ["minimumwithdrawalml", "minWithdrawMl"], ["最小准确抽取ml", "minWithdrawMl"],
    ["shareable", "shareable"], ["sharingstatus", "shareable"], ["allowsharing", "shareable"], ["共享状态", "shareable"], ["是否共享", "shareable"],
    ["requiresreconstitution", "requiresReconstitution"], ["drugvolume", "drugVolumeText"], ["drugvolumeml", "drugVolumeText"], ["是否需要复溶", "requiresReconstitution"], ["药品体积", "drugVolumeText"],
    ["risklevel", "riskLevel"], ["risk", "riskLevel"], ["风险等级", "riskLevel"],
    ["sharingrules", "rules"], ["rulenotes", "rules"], ["sopnotes", "rules"], ["rules", "rules"], ["共享规则", "rules"], ["规则备注", "rules"], ["sop备注", "rules"],
    ["preparationtime", "prepTime"], ["preptime", "prepTime"], ["配置时间", "prepTime"], ["配液时间", "prepTime"],
    ["infusiontime", "infusionTime"], ["administrationtime", "infusionTime"], ["输注时间", "infusionTime"], ["给药时间", "infusionTime"],
    ["route", "route"], ["administrationroute", "route"], ["给药途径", "route"], ["用法", "route"], ["给药方式", "route"],
    ["ward", "ward"], ["department", "ward"], ["病区", "ward"], ["科室", "ward"],
    ["bed", "bed"], ["bedno", "bed"], ["床号", "bed"],
    ["batch", "batch"], ["批次", "batch"],
    ["dispensedvials", "dispensedVials"], ["allocatedvials", "dispensedVials"], ["issuedvials", "dispensedVials"], ["实际分配瓶数", "dispensedVials"], ["发药瓶数", "dispensedVials"], ["发药数量", "dispensedVials"]
  ]);
  return map.get(text) || text;
}

function parseNumber(value) {
  const match = String(value ?? "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function parseVolumeMl(value) {
  const text = String(value || "").replace(/μl/ig, "ul");
  const ul = text.match(/(\d+(?:\.\d+)?)\s*u[lL]/);
  if (ul) return Number(ul[1]) / 1000;
  const ml = text.match(/(\d+(?:\.\d+)?)\s*m[lL]/);
  if (ml) return Number(ml[1]);
  const cn = text.match(/(\d+(?:\.\d+)?)\s*毫升/);
  if (cn) return Number(cn[1]);
  return parseNumber(value);
}

function parseConcentrationMgMl(value) {
  const text = String(value || "").replace(/μg/ig, "ug");
  const ug = text.match(/(\d+(?:\.\d+)?)\s*ug\s*\/?\s*m[lL]/i);
  if (ug) return Number(ug[1]) / 1000;
  const mg = text.match(/(\d+(?:\.\d+)?)\s*mg\s*\/?\s*m[lL]/i);
  if (mg) return Number(mg[1]);
  return parseNumber(value);
}

function parseStabilityHours(value) {
  const text = String(value || "").replace(/\s+/g, "");
  if (!text) return 0;
  if (text.toLowerCase().includes("useimmediately") || text.includes("立即使用")) return 0.25;
  const dayMatches = [...text.matchAll(/(\d+(?:\.\d+)?)(?:天|日|d)/ig)].map(match => Number(match[1]) * 24);
  const hourMatches = [...text.matchAll(/(\d+(?:\.\d+)?)(?: h|h|hr|hrs)/ig)].map(match => Number(match[1]));
  const all = [...dayMatches, ...hourMatches].filter(value => Number.isFinite(value) && value > 0);
  if (all.length) return Math.min(...all);
  return 0;
}

function parseStrengthMg(row) {
  const text = [row.strengthMg, row.specText].filter(Boolean).join(" ");
  const ug = text.match(/(\d+(?:\.\d+)?)\s*(?:ug|μg|微克)/i);
  if (ug) return Number(ug[1]) / 1000;
  const mg = text.match(/(\d+(?:\.\d+)?)\s*mg/i);
  if (mg) return Number(mg[1]);
  const cnMg = text.match(/(\d+(?:\.\d+)?)\s*毫克/);
  if (cnMg) return Number(cnMg[1]);
  const g = text.match(/(\d+(?:\.\d+)?)\s*g/i);
  if (g) return Number(g[1]) * 1000;
  const cnG = text.match(/(\d+(?:\.\d+)?)\s*克/);
  if (cnG) return Number(cnG[1]) * 1000;
  const direct = parseNumber(row.strengthMg);
  if (direct > 0) return direct;
  return 0;
}

function makeDrugId(name, strength) {
  return `imp_${normalizeText(name).replace(/[^a-z0-9\u4e00-\u9fa5]/g, "").slice(0, 18)}_${strength}`;
}

function resetDynamicDrugs() {
  for (const id of importedDynamicDrugIds) {
    const index = drugs.findIndex(drug => drug.id === id);
    if (index >= 0) drugs.splice(index, 1);
  }
  importedDynamicDrugIds = [];
}

function drugForImportedRow(row) {
  const name = row.drugName || row.药品名称;
  const strength = parseStrengthMg(row);
  const existing = findDrugByNameAndStrength(name, strength);
  if (existing && (!strength || Math.abs(existing.vialStrengthMg - strength) < 0.0001)) {
    const importedPrice = parseNumber(row.price);
    if (importedPrice > 0) existing.pricePerVial = importedPrice;
    return existing;
  }

  if (!name || strength <= 0) return null;
  const id = makeDrugId(name, strength);
  let drug = byDrug(id);
  if (!drug) {
    drug = {
      id,
      name,
      vialStrengthMg: strength,
      pricePerVial: parseNumber(row.price) || 0,
      concentrationMgMl: parseConcentrationMgMl(row.concentration) || Math.max(1, strength / 10),
      reconstitutionSolvent: "Pending maintenance",
      reconstitutionVolumeMl: parseVolumeMl(row.reconstitutionVolumeText) || 0,
      solvent: "Diluent/volume pending maintenance",
      compatibleSolvents: ["Diluent/volume pending maintenance"],
      stabilityHours: 6,
      reconstitutedStabilityText: row.reconstitutedStabilityText || "",
      reconstitutedStabilityHours: parseNumber(row.reconstitutedStabilityHours) || parseStabilityHours(row.reconstitutedStabilityText) || 6,
      dilutedStabilityText: row.dilutedStabilityText || "",
      dilutedStabilityHours: parseNumber(row.dilutedStabilityHours) || parseStabilityHours(row.dilutedStabilityText) || 0,
      minWithdrawMl: 0.5,
      lightSensitive: false,
      refrigerated: false,
      shareable: true,
      riskLevel: "Pending",
      rules: ["Temporarily generated from imported order; complete drug database before production use"]
    };
    drugs.push(drug);
    importedDynamicDrugIds.push(id);
  }
  return drug;
}

function importedRowsToOrders(rows) {
  resetDynamicDrugs();
  const nextOrders = [];
  const rejected = [];

  rows.forEach((row, index) => {
    const drug = drugForImportedRow(row);
    const actualUsedVials = parseNumber(row.actualUsedVials);
    const doseMg = parseNumber(row.doseMg) || (drug ? actualUsedVials * drug.vialStrengthMg : 0);
    if (!drug || doseMg <= 0) {
      rejected.push({ row: index + 2, reason: "Missing drug name/strength, or missing order dose (mg)/actual used vials" });
      return;
    }
    const route = row.route || "IV infusion";
    const shareability = evaluateOrderShareability({ drugId: drug.id, route }, drug);

    nextOrders.push({
      id: `IMP-${String(index + 1).padStart(4, "0")}`,
      importIndex: index,
      patient: row.patientName || row.patient || row.patientId || `Patient ${index + 1}`,
      sex: "",
      age: "",
      bed: row.bed || "",
      ward: row.ward || "Ward not provided",
      drugId: drug.id,
      doseMg,
      dispensedVials: parseNumber(row.dispensedVials) || Math.ceil(doseMg / drug.vialStrengthMg),
      orderTime: "08:00",
      prepTime: row.prepTime || "09:00",
      infusionTime: row.infusionTime || row.prepTime || "10:00",
      status: "active",
      auditStatus: shareability.shareable ? "passed" : "blocked",
      batch: row.batch || batchFromTime(row.prepTime || "09:00"),
      route,
      protocol: "Imported prescription",
      cycle: "",
      allergy: "",
      labFlag: shareability.shareable ? "Imported successfully" : shareability.reason,
      nurseStation: row.ward || ""
    });
  });

  return { nextOrders, rejected };
}

function batchFromTime(time) {
  const value = minutes(time || "09:00");
  if (value < 600) return "Batch 1";
  if (value < 720) return "Batch 2";
  return "Batch 3";
}

function importOrderText(text) {
  const rows = parseDelimitedText(text);
  const { nextOrders, rejected } = importedRowsToOrders(rows);
  if (!nextOrders.length) {
    window.alert("No valid prescriptions to import. Provide at least Patient Name, Drug Name, Order Dose (mg), and Vial Strength (mg).");
    return;
  }
  orders = nextOrders;
  importRejected = rejected;
  document.body.dataset.confirmed = "false";
  document.querySelector("#confirmPlan").textContent = "Confirm Plan";
  auditTrail.unshift({ time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }), role: "System", action: `Imported ${nextOrders.length} daily prescriptions; ${rejected.length} rows excluded` });
  render();
}

function renderImportSummary(result) {
  const planByDrugId = new Map(result.plans.map(plan => [plan.drug.id, plan]));
  const ordersByDrugId = new Map();
  for (const order of result.activeOrders) {
    if (!ordersByDrugId.has(order.drugId)) ordersByDrugId.set(order.drugId, []);
    ordersByDrugId.get(order.drugId).push(order);
  }

  importSummary = [...ordersByDrugId.entries()].map(([drugId, drugOrders]) => {
    const drug = byDrug(drugId);
    const plan = planByDrugId.get(drugId);
    const before = drugOrders.reduce((sum, order) => sum + (Number.isFinite(order.dispensedVials) && order.dispensedVials > 0 ? order.dispensedVials : Math.ceil(order.doseMg / drug.vialStrengthMg)), 0);
    const after = plan ? plan.vials.length : before;
    const saved = Math.max(0, before - after);
    const shareableOrders = drugOrders.filter(order => evaluateOrderShareability(order, drug).shareable);
    const blockedOrders = drugOrders.length - shareableOrders.length;
    return {
      drugName: drug?.name || "Unmatched drug",
      patients: uniqueCount(drugOrders, order => order.patient),
      before,
      after,
      saved,
      status: blockedOrders && shareableOrders.length ? "Partially shareable" : (shareableOrders.length ? "Shareable" : "Not shareable")
    };
  }).sort((a, b) => b.saved - a.saved || b.patients - a.patients);

  const totals = importSummary.reduce((acc, item) => {
    acc.drugs += 1;
    acc.before += item.before;
    acc.after += item.after;
    acc.saved += item.saved;
    return acc;
  }, { drugs: 0, before: 0, after: 0, saved: 0 });
  const totalPatients = uniqueCount(result.activeOrders, order => order.patient);

  document.querySelector("#importMetrics").innerHTML = [
    ["Drugs", `${formatCount(totals.drugs)} drugs`],
    ["Patients", `${formatCount(totalPatients)} patients`],
    ["Baseline vials", `${round(totals.before)} vials`],
    ["Optimized vials", `${round(totals.after)} vials`],
    ["Saved vials", `${round(totals.saved)} vials`]
  ].map(([label, value]) => `
    <article class="real-world-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `).join("");

  document.querySelector("#importSummaryRows").innerHTML = importSummary.map(item => `
    <tr>
      <td>${item.drugName}</td>
      <td>${item.patients}</td>
      <td>${round(item.before)}</td>
      <td>${round(item.after)}</td>
      <td>${round(item.saved)}</td>
      <td><span class="${item.saved > 0 ? "ok" : "warning"}">${item.status}${item.saved > 0 ? " - sharing recommended" : " - limited benefit"}</span></td>
    </tr>
  `).join("") || `<tr><td colspan="6">No prescriptions imported.</td></tr>`;
}


function renderBatchTimeline(plans) {
  const vials = plans
    .flatMap(plan => plan.vials)
    .sort((a, b) => minutes(a.openTime) - minutes(b.openTime));

  if (!vials.length) {
    document.querySelector("#currentBatch").innerHTML = `<option value="all">All batches</option>`;
    document.querySelector("#batchTimeline").innerHTML = `<tr><td colspan="7">No drugs pending preparation.</td></tr>`;
    return;
  }

  const batches = [...new Set(vials.map(vial => vial.batch || "Unbatched"))].sort((a, b) => batchOrder(a) - batchOrder(b) || a.localeCompare(b, "en"));
  if (selectedBatchFilter !== "all" && !batches.includes(selectedBatchFilter)) selectedBatchFilter = "all";
  document.querySelector("#currentBatch").innerHTML = [
    `<option value="all">All batches</option>`,
    ...batches.map(batch => `<option value="${batch}">${batch}</option>`)
  ].join("");
  document.querySelector("#currentBatch").value = selectedBatchFilter;

  const grouped = new Map();
  for (const vial of vials) {
    const key = `${vial.batch}__${vial.drug.id}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        batch: vial.batch,
        drug: vial.drug,
        vialCount: 0,
        wasteMg: 0,
        patients: new Set(),
        orderIds: new Set(),
        beforeVials: 0,
        expireTimes: [],
      });
    }
    const item = grouped.get(key);
    item.vialCount += 1;
    item.wasteMg += vial.wasteMg;
    item.expireTimes.push(vial.expireTime);
    vial.orders.forEach(order => {
      item.patients.add(order.patient);
      if (!item.orderIds.has(order.id)) {
        item.orderIds.add(order.id);
        item.beforeVials += Number.isFinite(order.dispensedVials) && order.dispensedVials > 0 ? order.dispensedVials : Math.ceil((order.originalDoseMg || order.doseMg) / vial.drug.vialStrengthMg);
      }
    });
  }

  const rows = [...grouped.values()]
    .filter(item => selectedBatchFilter === "all" || item.batch === selectedBatchFilter)
    .map(item => ({ ...item, savedVials: Math.max(0, item.beforeVials - item.vialCount) }))
    .sort((a, b) => {
    const batchCompare = batchOrder(a.batch) - batchOrder(b.batch) || a.batch.localeCompare(b.batch, "en");
    if (batchCompare) return batchCompare;
    if (b.savedVials !== a.savedVials) return b.savedVials - a.savedVials;
    return a.drug.name.localeCompare(b.drug.name, "en");
  });

  if (!rows.length) {
    document.querySelector("#batchTimeline").innerHTML = `<tr><td colspan="7">No drugs pending preparation in this batch.</td></tr>`;
    return;
  }

  document.querySelector("#batchTimeline").innerHTML = rows.map(item => {
    const hasWaste = item.wasteMg > 0.0001;
    const wasteMl = item.drug.concentrationMgMl ? item.wasteMg / item.drug.concentrationMgMl : 0;
    const earliestExpire = item.expireTimes
      .filter(Boolean)
      .sort((a, b) => a.totalMinutes - b.totalMinutes)[0];
    return `
      <tr>
        <td>${item.batch}</td>
        <td>${item.drug.name}</td>
        <td>${item.patients.size} patients</td>
        <td>${item.vialCount} vials</td>
        <td><span class="${hasWaste ? "warning" : "ok"}">${hasWaste ? "Residual" : "No residual"}</span></td>
        <td>${hasWaste ? `${fmtDose(item.wasteMg)} / ${fmtMl(wasteMl)}` : "0 mg / 0 mL"}</td>
        <td>${earliestExpire?.label || "-"}</td>
      </tr>
    `;
  }).join("");
}

function renderTasks(plans) {
  if (!plans.length) {
    document.querySelector("#drugTasks").innerHTML = `<article class="task-card">No shareable drugs. Import daily prescriptions first.</article>`;
    return;
  }
  const html = plans.map(plan => {
      const totalDose = plan.orders.reduce((sum, order) => sum + order.doseMg, 0);
      const openedDose = plan.vials.length * plan.drug.vialStrengthMg;
      const shareScore = openedDose ? Math.max(0, 100 - (openedDose - totalDose) / openedDose * 100) : 0;
      const isSelected = plan.drug.id === selectedInstructionDrugId;
      return `
        <button class="task-card drug-task ${isSelected ? "selected" : ""}" type="button" data-drug-id="${plan.drug.id}" aria-pressed="${isSelected}">
          <header>
            <div>
              <h4>${plan.drug.name}</h4>
              <p class="eyebrow">${plan.orders.length} patients · ${plan.vials.length} vials · Reconstituted: ${stabilityLabel(plan.drug.reconstitutedStabilityText, getReconstitutedStabilityHours(plan.drug))} · Diluted: ${stabilityLabel(plan.drug.dilutedStabilityText, getDilutedStabilityHours(plan.drug))}</p>
            </div>
            <span class="risk-pill">${englishValue(plan.drug.riskLevel)} risk</span>
          </header>
          <div class="meta-row">
            <span>Strength ${fmtDose(plan.drug.vialStrengthMg)}/vial</span>
            <span>Reconstitution solvent ${englishValue(plan.drug.reconstitutionSolvent)}</span>
            <span>Reconstituted concentration ${plan.drug.concentrationMgMl} mg/mL</span>
            <span>Route ${[...new Set(plan.orders.map(order => routeText(order)))].join(" / ")}</span>
            <span>${englishValue(plan.drug.solvent)}</span>
          </div>
          <div class="progress" aria-label="Drug utilization"><span style="width:${shareScore}%"></span></div>
        </button>
      `;
    });

  document.querySelector("#drugTasks").innerHTML = html.join("");
}

function buildInstructionEntries(selectedPlan) {
  if (!selectedPlan) return [];
  const drug = selectedPlan.drug;
  const patientInstructions = new Map();

  selectedPlan.vials.forEach((vial, vialIndex) => {
    let remainingMg = drug.vialStrengthMg;
    const vialNo = vialIndex + 1;
    const vialEvents = vial.orders.map((order, orderIndex) => {
      const beforeMg = remainingMg;
      const usedMg = order.doseMg;
      const afterMg = Math.max(0, beforeMg - usedMg);
      remainingMg = afterMg;
      return { order, orderIndex, beforeMg, usedMg, afterMg };
    });

    vialEvents.forEach((event, index) => {
      const key = `${event.order.id}__${drug.id}`;
      const existing = patientInstructions.get(key) || {
        order: event.order,
        drug,
        doseMg: event.order.originalDoseMg || event.order.doseMg,
        wholeVialNos: [],
        sharedParts: [],
        vialNotes: [],
        warnings: new Set()
      };
      const usedMl = event.usedMg / drug.concentrationMgMl;
      const beforeMl = event.beforeMg / drug.concentrationMgMl;
      const afterMl = event.afterMg / drug.concentrationMgMl;
      const isWholeVial = event.beforeMg >= drug.vialStrengthMg - 0.0001 && event.usedMg >= drug.vialStrengthMg - 0.0001 && event.afterMg <= 0.0001 && vial.orders.length === 1;
      if (isWholeVial) {
        existing.wholeVialNos.push(vialNo);
      } else {
        const sourceText = index === 0
          ? `shared vial ${vialNo} withdraw ${fmtMl(usedMl)}`
          : `shared vial ${vialNo} residual reused ${fmtMl(usedMl)}`;
        const actionText = index === 0
          ? `shared vial ${vialNo} withdraw ${fmtMl(usedMl)}`
          : `Reuse shared vial ${vialNo} residual ${fmtMl(usedMl)}`;
        const remainingText = event.afterMg > 0.0001
          ? `remaining ${fmtMl(afterMl)}${index === vialEvents.length - 1 ? " discard or continue matching" : " for subsequent patients"}`
          : "no residual after withdrawal";
        existing.sharedParts.push(sourceText);
        existing.vialNotes.push(`${actionText}, ${remainingText}`);
      }
      stabilityWarnings(event.order, drug)
        .filter(warning => !warning.includes("stability pending maintenance"))
        .forEach(warning => existing.warnings.add(warning));
      patientInstructions.set(key, existing);
    });
  });

  return [...patientInstructions.values()]
    .sort((a, b) => compareOrdersByBatch(a.order, b.order))
    .map(({ order, drug, doseMg, wholeVialNos, sharedParts, vialNotes, warnings }) => {
    const wholeVialText = formatWholeVialRefs(wholeVialNos);
    const withdrawDisplay = [
      wholeVialText,
      ...sharedParts
    ].filter(Boolean).join(" + ") || "No withdrawal needed";
    const notes = [
      `${order.batch}, ${order.ward} ${order.bed}, ${routeText(order)}`,
      wholeVialText ? `Use ${wholeVialText}` : "",
      ...vialNotes,
      drug.lightSensitive ? "Protect from light" : "",
      order.auditStatus === "hold" ? "Order requires pharmacist review" : "",
      ...sharedParts.map(part => {
        const ml = parseNumber(part);
        return ml > 0 && ml < drug.minWithdrawMl ? "Below minimum accurate withdrawal volume; review required" : "";
      }),
      ...warnings
    ].filter(Boolean).join("; ");

    return {
      drugName: drug.name,
      patient: order.patient,
      dose: fmtDose(doseMg),
      withdraw: withdrawDisplay,
      solvent: englishValue(drug.solvent),
      notes
    };
  });
}

function renderInstructions(plans) {
  const selectedPlan = plans.find(plan => plan.drug.id === selectedInstructionDrugId);
  document.querySelector("#instructionTitle").textContent = selectedPlan
    ? `${selectedPlan.drug.name} (${fmtDose(selectedPlan.drug.vialStrengthMg)}/vial, reconstitution volume ${formatReconstitutionVolume(selectedPlan.drug)}, reconstituted concentration ${selectedPlan.drug.concentrationMgMl} mg/mL) · Post-sharing Preparation Volume Conversion`
    : "Post-sharing Preparation Volume Conversion";

  if (!selectedPlan) {
    document.querySelector("#instructionRows").innerHTML = `<tr><td colspan="5">Select a drug in Today's Sharing Tasks first.</td></tr>`;
    return;
  }

  const rows = buildInstructionEntries(selectedPlan).map(entry => `
      <tr>
        <td>${entry.patient}</td>
        <td>${entry.dose}</td>
        <td>${entry.withdraw}</td>
        <td>${entry.solvent}</td>
        <td class="instruction-note">${entry.notes}</td>
      </tr>
    `);

  document.querySelector("#instructionRows").innerHTML = rows.join("") || `<tr><td colspan="5">Select a drug in Today's Sharing Tasks first.</td></tr>`;
}

function renderDrugKnowledge() {
  const query = normalizeText(drugKnowledgeSearchTerm);
  const visibleDrugs = query
    ? drugs.filter(drug => {
      const haystack = normalizeText([
        drug.name,
        `${drug.vialStrengthMg}mg`,
        drug.solvent,
        drug.reconstitutionSolvent,
        drug.shareableText,
        drug.shareable ? "Shareable" : "Not shareable",
        ...(drug.rules || [])
      ].join(" "));
      return haystack.includes(query);
    })
    : [];
  document.querySelector("#drugKnowledgeCount").textContent = query ? `Total ${drugs.length} drugs; showing ${visibleDrugs.length} drugs` : `Total ${drugs.length} drugs`;
  document.querySelector("#drugKnowledgeSearchStatus").textContent = query ? `Showing ${visibleDrugs.length} matching records.` : "Enter a drug name to search.";
  if (!query) {
    document.querySelector("#drugKnowledgeRows").innerHTML = `<tr><td colspan="10">Enter a drug name to search.</td></tr>`;
    return;
  }
  document.querySelector("#drugKnowledgeRows").innerHTML = visibleDrugs.map(drug => {
    return `
      <tr data-drug-id="${drug.id}" class="${drug.id === selectedMaintenanceDrugId ? "selected-row" : ""}">
        <td>${drug.name}</td>
        <td>${fmtDose(drug.vialStrengthMg)}/vial</td>
        <td>${drug.concentrationMgMl} mg/mL</td>
        <td>${formatReconstitutionVolume(drug)}</td>
        <td>${englishValue(drug.solvent)}</td>
        <td>${stabilityLabel(drug.reconstitutedStabilityText, getReconstitutedStabilityHours(drug))}</td>
        <td>${stabilityLabel(drug.dilutedStabilityText, getDilutedStabilityHours(drug))}</td>
        <td><span class="${drug.shareable ? "ok" : "warning"}">${englishValue(drug.shareableText || (drug.shareable ? "Shareable" : "No sharing"))}</span></td>
        <td><span class="${confirmedDrugIds.has(drug.id) ? "ok" : "warning"}">${confirmedDrugIds.has(drug.id) ? "Confirmed" : "Pending"}</span></td>
        <td>${drug.rules.map(englishValue).join("; ")}</td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="10">No matching drugs found.</td></tr>`;
}

function getDrugKnowledgeTemplateText() {
  return [
    "Generic Name,Vial Strength,Drug Volume,Requires Reconstitution,Reconstituted Concentration,Reconstitution Solvent,Reconstitution Volume,Reconstituted Stability,Diluent and Volume,Diluted Stability,Sharing Status,Rule Notes",
    "Trastuzumab for Injection,150mg,,Yes,21 mg/ml,Sterile Water for Injection,7.2ml,,250 ml 0.9% Sodium Chloride Injection,Store at 2-8 C for 48 h,Shareable,Same drug and same diluent can be shared",
    "Idarubicin for Injection,10mg,,Yes,1 mg/ml,Water for Injection (USP),10ml,,None,15-30 C; protect from light,Not shareable; IV injection only,IV infusion prescriptions may enter sharing after pharmacist confirmation",
    "Leuprorelin Microspheres for Injection,11.25mg,,Yes,11.25 mg/ml,Dedicated injection solvent supplied with product,1ml,,None,Below 25 C; protect from light,Not shareable; subcutaneous injection and usually full-unit use,Non-subcutaneous prescriptions require pharmacist confirmation"
  ].join("\n");
}

function parseShareable(value) {
  const text = normalizeText(value);
  if (["否", "不共享", "不可共享", "禁止共享", "false", "no", "0", "notshareable", "nosharing"].includes(text)) return false;
  if (text.includes("不共享") || text.includes("不可共享") || text.includes("禁止共享") || text.includes("notshareable") || text.includes("nosharing")) return false;
  return true;
}

function buildMaintainedDrug(row, existing) {
  const sourceName = (row.drugName || "").trim();
  const name = englishDrugName(sourceName);
  const strength = parseStrengthMg(row);
  const drugVolumeMl = parseVolumeMl(row.drugVolumeText);
  const concentration = parseConcentrationMgMl(row.concentration) || (drugVolumeMl ? strength / drugVolumeMl : 0);
  const requiresReconstitution = !["否", "no", "false", "0"].includes(normalizeText(row.requiresReconstitution || ""));
  const reconstitutionVolumeMl = requiresReconstitution ? parseVolumeMl(row.reconstitutionVolumeText) || (concentration ? strength / concentration : 0) : 0;
  const reconstitutedText = (row.reconstitutedStabilityText || "").trim();
  const dilutedText = (row.dilutedStabilityText || "").trim();
  const legacyStability = parseNumber(row.stabilityHours);
  const reconstitutedHours = parseNumber(row.reconstitutedStabilityHours) || parseStabilityHours(reconstitutedText) || legacyStability || 0;
  const dilutedHours = parseNumber(row.dilutedStabilityHours) || parseStabilityHours(dilutedText) || 0;
  const solvent = (row.solvent || "").trim() || "Pending maintenance";
  const shareableText = (row.shareable || "").trim() || (existing?.shareableText || "");
  const rules = String(row.rules || "")
    .split(/[;；]/)
    .map(rule => rule.trim())
    .filter(Boolean);
  if (!name || strength <= 0 || concentration <= 0) return null;

  return {
    id: existing?.id || makeDrugId(name, strength),
    name,
    sourceName,
    aliases: [...new Set([sourceName, ...(DRUG_ALIAS_EN[name] || [])].filter(Boolean))],
    vialStrengthMg: strength,
    pricePerVial: parseNumber(row.price) || existing?.pricePerVial || 0,
    concentrationMgMl: concentration,
    reconstitutionSolvent: (row.reconstitutionSolvent || "").trim() || existing?.reconstitutionSolvent || "Pending maintenance",
    reconstitutionVolumeMl,
    drugVolumeMl,
    requiresReconstitution,
    solvent,
    compatibleSolvents: [solvent],
    stabilityHours: reconstitutedHours || dilutedHours || legacyStability || existing?.stabilityHours || 6,
    reconstitutedStabilityText: reconstitutedText,
    reconstitutedStabilityHours: reconstitutedHours,
    dilutedStabilityText: dilutedText,
    dilutedStabilityHours: dilutedHours,
    minWithdrawMl: parseNumber(row.minWithdrawMl) || existing?.minWithdrawMl || 0.5,
    lightSensitive: existing?.lightSensitive || /Protect from light/.test(`${reconstitutedText}${dilutedText}${row.rules || ""}`),
    refrigerated: existing?.refrigerated || /2-8|2℃|8℃|冷藏/.test(`${reconstitutedText}${dilutedText}`),
    shareable: parseShareable(shareableText),
    shareableText,
    riskLevel: englishValue((row.riskLevel || existing?.riskLevel || "Medium").trim()),
    rules: rules.length ? rules : [shareableText || "Generated after drug knowledge maintenance"].filter(Boolean)
  };
}

function importDrugKnowledgeText(text) {
  const rows = parseDelimitedText(text);
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const name = (row.drugName || "").trim();
    const strength = parseStrengthMg(row);
    if (!name || strength <= 0) {
      skipped += 1;
      continue;
    }

    const existing = findExactDrugByNameAndStrength(name, strength);
    const maintainedDrug = buildMaintainedDrug(row, existing);
    if (!maintainedDrug) {
      skipped += 1;
      continue;
    }

    if (existing) {
      Object.assign(existing, maintainedDrug);
      importedDynamicDrugIds = importedDynamicDrugIds.filter(dynamicId => dynamicId !== existing.id);
      updated += 1;
    } else {
      drugs.push(maintainedDrug);
      added += 1;
    }
  }

  document.querySelector("#drugKnowledgeUploadStatus").textContent = `Import complete: added ${added} drugs, updated ${updated} drugs, skipped ${skipped} rows.`;
  auditTrail.unshift({ time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }), role: "Drug maintenance", action: `Batch imported drug knowledge: added ${added} drugs, updated ${updated} drugs` });
  render();
}

function seedDrugKnowledgeRows() {
  const seedRows = window.DRUG_KNOWLEDGE_SEED || [];
  if (seedRows.length) {
    drugs.splice(0, drugs.length);
    importedDynamicDrugIds = [];
  }
  for (const row of seedRows) {
    const name = (row.drugName || "").trim();
    const strength = parseStrengthMg(row);
    if (!name || strength <= 0) continue;
    const existing = findDrugByNameAndStrength(name, strength);
    const exactExisting = existing && Math.abs(existing.vialStrengthMg - strength) < 0.0001 ? existing : null;
    const maintainedDrug = buildMaintainedDrug(row, exactExisting);
    if (!maintainedDrug) continue;
    if (exactExisting) {
      Object.assign(exactExisting, maintainedDrug);
    } else {
      drugs.push(maintainedDrug);
    }
  }
}

function resetDrugEditForm() {
  selectedMaintenanceDrugId = null;
  document.querySelector("#drugMaintenanceEditForm").reset();
  document.querySelector("#editShareable").value = "true";
  document.querySelector("#editRisk").value = "Medium";
  renderDrugKnowledge();
}

function fillDrugEditForm(drug) {
  selectedMaintenanceDrugId = drug.id;
  document.querySelector("#editDrugName").value = drug.name;
  document.querySelector("#editStrength").value = drug.vialStrengthMg;
  document.querySelector("#editPrice").value = drug.pricePerVial;
  document.querySelector("#editConcentration").value = drug.concentrationMgMl;
  document.querySelector("#editReconstitution").value = englishValue(drug.reconstitutionSolvent);
  document.querySelector("#editReconstitutionVolume").value = drug.reconstitutionVolumeMl || "";
  document.querySelector("#editSolvent").value = englishValue(drug.solvent);
  document.querySelector("#editReconstitutedStability").value = drug.reconstitutedStabilityText ? englishValue(drug.reconstitutedStabilityText) : (drug.reconstitutedStabilityHours ? `${round(drug.reconstitutedStabilityHours)} h` : "");
  document.querySelector("#editDilutedStability").value = drug.dilutedStabilityText ? englishValue(drug.dilutedStabilityText) : (drug.dilutedStabilityHours ? `${round(drug.dilutedStabilityHours)} h` : "");
  document.querySelector("#editMinWithdraw").value = drug.minWithdrawMl;
  document.querySelector("#editShareable").value = String(drug.shareable);
  document.querySelector("#editRisk").value = drug.riskLevel;
  document.querySelector("#editRules").value = drug.rules.map(englishValue).join("; ");
  renderDrugKnowledge();
}

function saveDrugEdit(event) {
  event.preventDefault();
  const name = document.querySelector("#editDrugName").value.trim();
  const strength = parseNumber(document.querySelector("#editStrength").value);
  const concentration = parseNumber(document.querySelector("#editConcentration").value);
  const solvent = document.querySelector("#editSolvent").value.trim();
  if (!name || strength <= 0 || concentration <= 0 || !solvent) return;

  const currentDrug = selectedMaintenanceDrugId ? byDrug(selectedMaintenanceDrugId) : null;
  const existing = currentDrug || drugs.find(drug => normalizeText(drug.name) === normalizeText(name) && Math.abs(drug.vialStrengthMg - strength) < 0.0001);
  const shareableText = document.querySelector("#editShareable").value === "true" ? "Shareable" : "Not shareable";
  const maintainedDrug = buildMaintainedDrug({
    drugName: name,
    strengthMg: strength,
    price: document.querySelector("#editPrice").value,
    concentration,
    reconstitutionSolvent: document.querySelector("#editReconstitution").value,
    reconstitutionVolumeText: document.querySelector("#editReconstitutionVolume").value,
    solvent,
    reconstitutedStabilityText: document.querySelector("#editReconstitutedStability").value,
    dilutedStabilityText: document.querySelector("#editDilutedStability").value,
    minWithdrawMl: document.querySelector("#editMinWithdraw").value,
    shareable: existing?.shareableText && existing.shareable === (document.querySelector("#editShareable").value === "true") ? existing.shareableText : shareableText,
    riskLevel: document.querySelector("#editRisk").value,
    rules: document.querySelector("#editRules").value
  }, existing);
  if (!maintainedDrug) return;

  if (existing) {
    Object.assign(existing, maintainedDrug);
  } else {
    drugs.push(maintainedDrug);
  }
  selectedMaintenanceDrugId = maintainedDrug.id;
  confirmedDrugIds.delete(maintainedDrug.id);
  auditTrail.unshift({ time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }), role: "Drug maintenance", action: `Saved drug maintenance info: ${name}` });
  render();
}

function confirmSelectedDrugKnowledge() {
  if (!selectedMaintenanceDrugId) return;
  const drug = byDrug(selectedMaintenanceDrugId);
  if (!drug) return;
  confirmedDrugIds.add(drug.id);
  document.querySelector("#drugKnowledgeUploadStatus").textContent = `Confirmed: ${drug.name} (${fmtDose(drug.vialStrengthMg)}/vial).`;
  auditTrail.unshift({ time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }), role: "Drug maintenance", action: `Confirmed drug knowledge info: ${drug.name}` });
  render();
}

function clearImportedOrders() {
  orders = [];
  importRejected = [];
  auditTrail = [];
  resetDynamicDrugs();
  document.querySelector("#orderPaste").value = "";
  document.querySelector("#orderFile").value = "";
  document.querySelector("#orderFileName").textContent = "No file selected";
  document.querySelector("#orderAnalysis").innerHTML = "";
  document.body.dataset.confirmed = "false";
  document.querySelector("#confirmPlan").textContent = "Confirm Plan";
  render();
}

function groupCount(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item) || "Not provided";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function renderOrderAnalysis() {
  const result = calculatePlan();
  if (!orders.length) {
    document.querySelector("#orderAnalysis").innerHTML = `<article class="analysis-card">No prescriptions imported; no data available for analysis.</article>`;
    return;
  }

  const allVials = result.plans.flatMap(plan => plan.vials);
  const baseline = baselineVialsForOrders(result.activeOrders);
  const after = allVials.length;
  const sharedVials = allVials.filter(vial => vial.shared).length;
  const tempDrugNames = drugs.filter(drug => importedDynamicDrugIds.includes(drug.id)).map(drug => drug.name);
  const byWard = groupCount(orders, order => order.ward).slice(0, 5);
  const byBatch = groupCount(orders, order => order.batch).slice(0, 5);
  const analyzedDrugs = importSummary;
  const uniquePatients = uniqueCount(result.activeOrders, order => order.patient);
  const avgPatientsPerDrug = result.plans.length ? uniquePatients / result.plans.length : 0;

  document.querySelector("#orderAnalysis").innerHTML = [
    `
      <article class="analysis-card">
        <h4>Sharing Benefit</h4>
        <span>Baseline ${round(baseline)} vials; optimized ${round(after)} vials</span>
        <strong>Saved ${round(Math.max(0, baseline - after))} vials</strong>
      </article>
    `,
    `
      <article class="analysis-card">
        <h4>Sharing Intensity</h4>
        <span>${result.plans.length} drugs, ${uniquePatients} patients</span>
        <strong>${sharedVials} shared vials</strong>
      </article>
    `,
    `
      <article class="analysis-card">
        <h4>Average Patient Density</h4>
        <span>Patients per shareable drug</span>
        <strong>${round(avgPatientsPerDrug)} patients/drug</strong>
      </article>
    `,
    `
      <article class="analysis-card">
        <h4>All Drug Sharing Results</h4>
        ${analyzedDrugs.map(item => `<p>${item.drugName}: ${item.patients} patients, baseline ${round(item.before)} vials, optimized ${round(item.after)} vials, saved ${round(item.saved)} vials</p>`).join("") || "<p>No shareable drugs.</p>"}
      </article>
    `,
    `
      <article class="analysis-card">
        <h4>Ward Distribution</h4>
        ${byWard.map(([ward, count]) => `<p>${ward}: ${count} prescriptions</p>`).join("")}
      </article>
    `,
    `
      <article class="analysis-card">
        <h4>Batch Distribution</h4>
        ${byBatch.map(([batch, count]) => `<p>${batch}: ${count} prescriptions</p>`).join("")}
      </article>
    `,
    `
      <article class="analysis-card">
        <h4>Drug Database Gaps</h4>
        ${tempDrugNames.length ? tempDrugNames.slice(0, 6).map(name => `<p>${name}: requires reconstitution solvent, stability, diluent/volume, and rules</p>`).join("") : "<p>All imported drugs matched the current rule base.</p>"}
      </article>
    `,
    `
      <article class="analysis-card">
        <h4>Excluded Records</h4>
        ${importRejected.length ? importRejected.slice(0, 8).map(item => `<p>Row ${item.row}: ${item.reason}</p>`).join("") : "<p>All imported rows were included in sharing calculation.</p>"}
      </article>
    `,
    `
      <article class="analysis-card">
        <h4>Execution Tips</h4>
        <p>Prioritize drugs with more saved vials, more shared vials, and concentrated same-batch patients; temporarily generated drug rules should be completed before production use.</p>
      </article>
    `
  ].join("");
}



function renderAnalytics(result, savedVials, savedAmount, wasteDose, openedDose) {
  const sharedVials = result.plans.flatMap(plan => plan.vials).filter(vial => vial.shared).length;
  const involvedDrugs = uniqueCount(result.activeOrders, order => order.drugId);
  const analytics = [
    ["Saved vials", `${savedVials} vials`],
    ["Savings Amount", fmtMoney(savedAmount)],
    ["Shared Vials", `${sharedVials} vials`],
    ["Drugs", `${involvedDrugs} drugs`],
    ["Discarded Residual Dose", fmtDose(wasteDose)],
    ["Total Opened Dose", fmtDose(openedDose)],
    ["Plan Adoption Rate", document.body.dataset.confirmed === "true" ? "100%" : "Pending"],
    ["Latest Audit Trail", auditTrail[0]?.action || "None"]
  ];

  document.querySelector("#analyticsCards").innerHTML = analytics.map(([label, value]) => `
    <div class="analytics-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");
}

function loadHistoryRecords() {
  try {
    historyRecords = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "[]");
  } catch {
    historyRecords = [];
  }
}

function saveHistoryRecords() {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyRecords));
}

function currentPlanSignature(result) {
  return JSON.stringify(result.activeOrders.map(order => ({
    id: order.id,
    patient: order.patient,
    drugId: order.drugId,
    doseMg: order.doseMg,
    batch: order.batch,
    prepTime: order.prepTime,
    infusionTime: order.infusionTime,
    route: order.route
  })));
}

function summarizePlans(result) {
  const allVials = result.plans.flatMap(plan => plan.vials);
  const baselineVials = baselineVialsForOrders(result.activeOrders);
  const optimizedVials = allVials.length;
  const savedVials = Math.max(0, baselineVials - optimizedVials);
  const openedDose = allVials.reduce((sum, vial) => sum + vial.drug.vialStrengthMg, 0);
  const wasteDose = allVials.reduce((sum, vial) => sum + vial.wasteMg, 0);
  const savedAmount = result.plans.reduce((sum, plan) => {
    const baseline = plan.orders.reduce((vials, order) => vials + (Number.isFinite(order.dispensedVials) && order.dispensedVials > 0 ? order.dispensedVials : Math.ceil(order.doseMg / plan.drug.vialStrengthMg)), 0);
    return sum + Math.max(0, baseline - plan.vials.length) * plan.drug.pricePerVial;
  }, 0);
  return { allVials, baselineVials, optimizedVials, savedVials, openedDose, wasteDose, savedAmount };
}

function buildDrugHistoryRows(result) {
  return result.plans.map(plan => {
    const before = plan.orders.reduce((vials, order) => vials + (Number.isFinite(order.dispensedVials) && order.dispensedVials > 0 ? order.dispensedVials : Math.ceil(order.doseMg / plan.drug.vialStrengthMg)), 0);
    const after = plan.vials.length;
    return {
      drug: plan.drug.name,
      patients: uniqueCount(plan.orders, order => order.patient),
      before,
      after,
      saved: Math.max(0, before - after),
      savings: Math.max(0, before - after) * plan.drug.pricePerVial
    };
  }).sort((a, b) => b.saved - a.saved || b.patients - a.patients);
}

function buildBatchHistoryRows(plans) {
  const grouped = new Map();
  for (const vial of plans.flatMap(plan => plan.vials)) {
    const key = `${vial.batch}__${vial.drug.id}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        batch: vial.batch,
        drug: vial.drug.name,
        vialCount: 0,
        wasteMg: 0,
        patients: new Set(),
        expireTimes: []
      });
    }
    const item = grouped.get(key);
    item.vialCount += 1;
    item.wasteMg += vial.wasteMg;
    item.expireTimes.push(vial.expireTime);
    vial.orders.forEach(order => item.patients.add(order.patient));
  }
  return [...grouped.values()].map(item => {
    const drug = plans.find(plan => plan.drug.name === item.drug)?.drug;
    const wasteMl = drug?.concentrationMgMl ? item.wasteMg / drug.concentrationMgMl : 0;
    const latest = item.expireTimes.filter(Boolean).sort((a, b) => a.totalMinutes - b.totalMinutes)[0];
    return {
      batch: item.batch,
      drug: item.drug,
      patients: item.patients.size,
      vialCount: item.vialCount,
      residual: item.wasteMg > 0.0001 ? "Residual" : "No residual",
      residualAmount: item.wasteMg > 0.0001 ? `${fmtDose(item.wasteMg)} / ${fmtMl(wasteMl)}` : "0 mg / 0 mL",
      latestUse: latest?.label || "-"
    };
  }).sort((a, b) => batchOrder(a.batch) - batchOrder(b.batch) || a.drug.localeCompare(b.drug, "en"));
}

function archiveCurrentPlan() {
  if (!orders.length) {
    window.alert("No prescriptions have been imported. Nothing can be archived.");
    return false;
  }
  const result = calculatePlan();
  if (!result.plans.length) {
    window.alert("No shareable plan is available for archiving.");
    return false;
  }
  const signature = currentPlanSignature(result);
  if (lastArchivedSignature === signature || historyRecords.some(record => record.signature === signature)) {
    window.alert("The current plan has already been archived.");
    return false;
  }
  const summary = summarizePlans(result);
  const record = {
    id: `HIS-${Date.now()}`,
    signature,
    confirmedAt: new Date().toLocaleString("en-US", { hour12: false }),
    drugs: uniqueCount(result.activeOrders, order => order.drugId),
    patients: uniqueCount(result.activeOrders, order => order.patient),
    baselineVials: summary.baselineVials,
    optimizedVials: summary.optimizedVials,
    savedVials: summary.savedVials,
    savedAmount: summary.savedAmount,
    wasteDose: fmtDose(summary.wasteDose),
    shareRate: summary.allVials.length ? `${round(summary.allVials.filter(vial => vial.shared).length / summary.allVials.length * 100)}%` : "0%",
    drugRows: buildDrugHistoryRows(result),
    batchRows: buildBatchHistoryRows(result.plans),
    instructionRows: result.plans.flatMap(plan => buildInstructionEntries(plan))
  };
  historyRecords.unshift(record);
  historyRecords = historyRecords.slice(0, 50);
  lastArchivedSignature = signature;
  expandedHistoryId = record.id;
  saveHistoryRecords();
  return true;
}

function renderHistoryRecords() {
  document.querySelector("#historyCount").textContent = `${historyRecords.length} records`;
  if (!historyRecords.length) {
    document.querySelector("#historyRows").innerHTML = `<tr><td colspan="8">No history records yet. A record is archived after Confirm Plan.</td></tr>`;
    document.querySelector("#historyDetail").innerHTML = "";
    return;
  }
  document.querySelector("#historyRows").innerHTML = historyRecords.map(record => `
    <tr>
      <td>${record.confirmedAt}</td>
      <td>${record.drugs} drugs</td>
      <td>${record.patients} patients</td>
      <td>${round(record.baselineVials)}</td>
      <td>${round(record.optimizedVials)}</td>
      <td>${round(record.savedVials)}</td>
      <td>${fmtMoney(record.savedAmount)}</td>
      <td>
        <div class="history-actions">
          <button class="table-action" type="button" data-history-view="${record.id}">${expandedHistoryId === record.id ? "Collapse" : "View Details"}</button>
          <button class="table-action" type="button" data-history-export="${record.id}">Export CSV</button>
          <button class="table-action danger" type="button" data-history-delete="${record.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");
  renderHistoryDetail();
}

function renderHistoryDetail() {
  const record = historyRecords.find(item => item.id === expandedHistoryId);
  if (!record) {
    document.querySelector("#historyDetail").innerHTML = "";
    return;
  }
  document.querySelector("#historyDetail").innerHTML = `
    <div class="history-section">
      <h4>Drug Summary</h4>
      <div class="table-wrap compact-table">
        <table>
          <thead><tr><th>Drug</th><th>Patients</th><th>Baseline Vials</th><th>Optimized Vials</th><th>Saved Vials</th><th>Savings</th></tr></thead>
          <tbody>${record.drugRows.map(row => `<tr><td>${row.drug}</td><td>${row.patients}</td><td>${round(row.before)}</td><td>${round(row.after)}</td><td>${round(row.saved)}</td><td>${fmtMoney(row.savings)}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    </div>
    <div class="history-section">
      <h4>Batch Vials and Residuals</h4>
      <div class="table-wrap compact-table">
        <table>
          <thead><tr><th>Batch</th><th>Drug</th><th>Patients</th><th>Opened Vials</th><th>Residual?</th><th>Residual Amount</th><th>Latest Use Time</th></tr></thead>
          <tbody>${record.batchRows.map(row => `<tr><td>${row.batch}</td><td>${row.drug}</td><td>${row.patients} patients</td><td>${row.vialCount} vials</td><td>${row.residual}</td><td>${row.residualAmount}</td><td>${row.latestUse}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    </div>
    <div class="history-section">
      <h4>PIVAS Preparation Instructions</h4>
      <div class="table-wrap compact-table">
        <table>
          <thead><tr><th>Drug</th><th>Patient</th><th>Order Dose</th><th>Withdrawal Volume</th><th>Diluent and Volume</th><th>Notes</th></tr></thead>
          <tbody>${record.instructionRows.map(row => `<tr><td>${row.drugName}</td><td>${row.patient}</td><td>${row.dose}</td><td>${row.withdraw}</td><td>${row.solvent}</td><td>${row.notes}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    </div>
  `;
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportHistoryRecord(record) {
  const headers = ["Drug", "Patient", "Order Dose", "Withdrawal Volume", "Diluent and Volume", "Notes"];
  const lines = [
    headers.map(csvEscape).join(","),
    ...record.instructionRows.map(row => [row.drugName, row.patient, row.dose, row.withdraw, row.solvent, row.notes].map(csvEscape).join(","))
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `prescription_allocation_history_${record.confirmedAt.replace(/[\\/:, ]/g, "-")}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

document.querySelector("#loadSampleOrders").addEventListener("click", () => {
  document.querySelector("#orderPaste").value = getImportSampleText();
});

document.querySelectorAll("[data-file-trigger]").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelector(`#${button.dataset.fileTrigger}`)?.click();
  });
});

document.querySelector("#orderFile").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  document.querySelector("#orderFileName").textContent = file?.name || "No file selected";
  if (!file) return;
  const importButton = document.querySelector("#importOrders");
  importButton.disabled = true;
  document.querySelector("#orderPaste").value = "";
  try {
    const text = await readTableFileAsText(file);
    if (!text) {
      event.target.value = "";
      document.querySelector("#orderFileName").textContent = "No file selected";
      return;
    }
    document.querySelector("#orderPaste").value = text;
    importOrderText(text);
  } catch (error) {
    console.error("Prescription import failed", error);
    window.alert("Prescription import or calculation failed. Check the file contents and try again.");
  } finally {
    importButton.disabled = false;
  }
});

document.querySelector("#importOrders").addEventListener("click", () => {
  importOrderText(document.querySelector("#orderPaste").value);
});

document.querySelector("#clearOrders").addEventListener("click", clearImportedOrders);

document.querySelector("#loadDrugKnowledgeTemplate").addEventListener("click", () => {
  document.querySelector("#drugKnowledgePaste").value = getDrugKnowledgeTemplateText();
});

document.querySelector("#drugKnowledgeFile").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  document.querySelector("#drugKnowledgeFileName").textContent = file?.name || "No file selected";
  if (!file) return;
  if (/\.xlsx?$/i.test(file.name)) {
    window.alert("This web prototype supports CSV/TSV/TXT import. Save Excel as CSV first, or paste table content into the text box.");
    event.target.value = "";
    document.querySelector("#drugKnowledgeFileName").textContent = "No file selected";
    return;
  }
  document.querySelector("#drugKnowledgePaste").value = await file.text();
});

document.querySelector("#importDrugKnowledge").addEventListener("click", () => {
  importDrugKnowledgeText(document.querySelector("#drugKnowledgePaste").value);
});

document.querySelector("#clearDrugKnowledgeInput").addEventListener("click", () => {
  document.querySelector("#drugKnowledgePaste").value = "";
  document.querySelector("#drugKnowledgeFile").value = "";
  document.querySelector("#drugKnowledgeFileName").textContent = "No file selected";
  document.querySelector("#drugKnowledgeUploadStatus").textContent = "Waiting for drug knowledge upload.";
});

document.querySelector("#drugKnowledgeSearch").addEventListener("input", event => {
  drugKnowledgeSearchTerm = event.target.value;
  renderDrugKnowledge();
});

document.querySelector("#drugKnowledgeRows").addEventListener("click", event => {
  const row = event.target.closest("[data-drug-id]");
  if (!row) return;
  const drug = byDrug(row.dataset.drugId);
  if (drug) fillDrugEditForm(drug);
});

document.querySelector("#drugMaintenanceEditForm").addEventListener("submit", saveDrugEdit);

document.querySelector("#confirmDrugKnowledge").addEventListener("click", confirmSelectedDrugKnowledge);

document.querySelector("#clearDrugEditForm").addEventListener("click", resetDrugEditForm);

document.querySelector("#drugTasks").addEventListener("click", event => {
  const task = event.target.closest("[data-drug-id]");
  if (!task) return;
  selectedInstructionDrugId = task.dataset.drugId;
  render();
  document.querySelector("#instructions").scrollIntoView({ behavior: "smooth", block: "start" });
});

document.querySelector("#currentBatch").addEventListener("change", event => {
  selectedBatchFilter = event.target.value;
  renderBatchTimeline(calculatePlan().plans);
});

document.querySelector("#confirmPlan").addEventListener("click", () => {
  const archived = archiveCurrentPlan();
  if (!archived) return;
  document.body.dataset.confirmed = "true";
  auditTrail.unshift({ time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }), role: "PIVAS pharmacist", action: "Confirmed current sharing plan and generated preparation check sheet" });
  document.querySelector("#confirmPlan").textContent = "Plan Confirmed";
  render();
});

document.querySelector("#historyRows").addEventListener("click", event => {
  const viewButton = event.target.closest("[data-history-view]");
  const exportButton = event.target.closest("[data-history-export]");
  const deleteButton = event.target.closest("[data-history-delete]");
  if (viewButton) {
    expandedHistoryId = expandedHistoryId === viewButton.dataset.historyView ? null : viewButton.dataset.historyView;
    renderHistoryRecords();
    return;
  }
  if (exportButton) {
    const record = historyRecords.find(item => item.id === exportButton.dataset.historyExport);
    if (record) exportHistoryRecord(record);
    return;
  }
  if (deleteButton) {
    historyRecords = historyRecords.filter(item => item.id !== deleteButton.dataset.historyDelete);
    if (expandedHistoryId === deleteButton.dataset.historyDelete) expandedHistoryId = null;
    saveHistoryRecords();
    renderHistoryRecords();
  }
});

document.querySelector("#printLabels").addEventListener("click", () => {
  document.body.classList.add("printing-instructions");
  window.print();
  window.setTimeout(() => document.body.classList.remove("printing-instructions"), 300);
});

loadHistoryRecords();
seedDrugKnowledgeRows();
render();
