const drugs = [
  {
    id: "bev",
    name: "贝伐珠单抗",
    vialStrengthMg: 100,
    pricePerVial: 1180,
    concentrationMgMl: 10,
    reconstitutionSolvent: "注射用水",
    solvent: "0.9% NaCl 100 mL",
    compatibleSolvents: ["0.9% NaCl 100 mL", "0.9% NaCl 250 mL"],
    stabilityHours: 8,
    minWithdrawMl: 0.5,
    lightSensitive: false,
    refrigerated: false,
    shareable: true,
    riskLevel: "中",
    rules: ["开瓶后8小时内使用", "同药同溶媒可共享", "允许跨病区共享"]
  },
  {
    id: "pem",
    name: "培美曲塞",
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
    riskLevel: "中",
    rules: ["复溶后6小时内使用", "按配置批次共享", "需核对肾功能相关医嘱"]
  },
  {
    id: "oxa",
    name: "奥沙利铂",
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
    riskLevel: "高",
    rules: ["禁用含氯溶媒", "避光配置", "复溶后6小时内使用"]
  },
  {
    id: "trial",
    name: "临床试验盲法药",
    vialStrengthMg: 80,
    pricePerVial: 0,
    concentrationMgMl: 8,
    reconstitutionSolvent: "专用溶媒",
    solvent: "专用溶媒 50 mL",
    compatibleSolvents: ["专用溶媒 50 mL"],
    stabilityHours: 2,
    minWithdrawMl: 0.5,
    lightSensitive: true,
    refrigerated: true,
    shareable: false,
    riskLevel: "高",
    rules: ["盲法管理", "禁止共享", "需独立配置"]
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
const HISTORY_STORAGE_KEY = "dosepilot_history_zh";

const fmtMoney = value => `¥${Math.round(value).toLocaleString("zh-CN")}`;
const fmtDose = value => `${round(value)} mg`;
const fmtMl = value => `${round(value)} mL`;
const round = value => Number.parseFloat(value.toFixed(2)).toString();

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
  if (day === 1) return `次日 ${hour}:${minute}`;
  return `${day}天后 ${hour}:${minute}`;
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
  return ranges.join("、");
}

function formatWholeVialRefs(vialNos) {
  const ranges = formatNumberRanges(vialNos);
  return ranges ? `整瓶${ranges}` : "";
}

function batchOrder(batch) {
  const known = ["第一批", "第二批", "第三批", "第四批"];
  const index = known.indexOf(batch);
  return index >= 0 ? index : known.length;
}

function compareOrdersByBatch(a, b) {
  const batchCompare = batchOrder(a.batch) - batchOrder(b.batch) || String(a.batch || "").localeCompare(String(b.batch || ""), "zh-CN");
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
  return drugs.find(drug => normalized.includes(normalizeText(drug.name)) || normalizeText(drug.name).includes(normalized));
}

function findDrugByNameAndStrength(name, strength) {
  const normalized = normalizeText(name);
  const candidates = drugs.filter(drug => normalized.includes(normalizeText(drug.name)) || normalizeText(drug.name).includes(normalized));
  if (!strength) return candidates[0];
  return candidates.find(drug => Math.abs(drug.vialStrengthMg - strength) < 0.0001) || candidates[0];
}

function normalizeText(value) {
  return String(value || "").replace(/[（(].*?[）)]/g, "").replace(/\s+/g, "").toLowerCase();
}

function routeText(order) {
  return String(order?.route || "静脉滴注").trim() || "静脉滴注";
}

function isIvInjection(route) {
  const text = normalizeText(route);
  return text.includes("静脉注射") || text.includes("ivpush") || text.includes("ivbolus");
}

function isIvInfusion(route) {
  const text = normalizeText(route);
  return text.includes("静脉滴注") || text.includes("静脉输注") || text.includes("输注") || text.includes("滴注");
}

function shareRuleText(drug) {
  return [drug?.shareableText, drug?.shareableStatus, ...(drug?.rules || [])].filter(Boolean).join("；");
}

function hasRouteConditionalNoShare(drug) {
  const text = shareRuleText(drug);
  return text.includes("不共享") && (text.includes("静脉注射") || text.includes("皮下注射"));
}

function hasHardNoShare(drug) {
  const text = shareRuleText(drug);
  if (drug?.shareable === true) return false;
  if (hasRouteConditionalNoShare(drug)) return false;
  return !drug?.shareable || ["盲法", "特殊管理", "独立配置", "不可共享", "禁止共享", "现配现用", "极不稳定"].some(keyword => text.includes(keyword));
}

function evaluateOrderShareability(order, drug = byDrug(order?.drugId)) {
  const route = routeText(order);
  if (!drug) return { shareable: false, reason: "药品字典缺失" };
  if (isIvInjection(route)) return { shareable: false, reason: "静脉注射医嘱，按整支/独立配置处理" };
  if (hasHardNoShare(drug)) return { shareable: false, reason: "院内规则禁止共享" };
  if (hasRouteConditionalNoShare(drug) && !isIvInfusion(route)) return { shareable: false, reason: "当前给药途径不适合共享" };
  return { shareable: true, reason: hasRouteConditionalNoShare(drug) ? "静脉滴注医嘱，可进入共享计算" : "规则允许共享" };
}

function stabilityLabel(text, hours) {
  if (text) return text;
  if (Number.isFinite(hours) && hours > 0) return `${round(hours)} 小时`;
  return "待药师确认";
}

function formatReconstitutionVolume(drug) {
  if (drug?.requiresReconstitution === false) return "0 mL（无需复溶）";
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
    warnings.push(`稀释液稳定性超出${round(dilutedHours)}小时，需复核`);
  }
  if (!getReconstitutedStabilityHours(drug) && !drug.reconstitutedStabilityText) warnings.push("复溶液稳定性待维护");
  if (!getDilutedStabilityHours(drug) && !drug.dilutedStabilityText) warnings.push("稀释液稳定性待维护");
  return warnings;
}

function getOrderIssues(order) {
  const drug = byDrug(order.drugId);
  const issues = [];
  const shareability = evaluateOrderShareability(order, drug);
  if (!drug) issues.push("药品字典缺失");
  if (drug && !shareability.shareable) issues.push(shareability.reason);
  if (order.auditStatus === "hold") issues.push(order.labFlag);
  if (order.auditStatus === "blocked") issues.push(order.labFlag || "需人工处理");
  if (drug && !drug.compatibleSolvents.includes(drug.solvent)) issues.push("溶媒规格不在规则库");
  if (drug && order.doseMg / drug.concentrationMgMl < drug.minWithdrawMl) issues.push("抽取体积低于最小准确量");
  if (drug) issues.push(...stabilityWarnings(order, drug));
  if (order.status !== "active") issues.push("非有效医嘱");
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
  document.querySelector("#runStatus").textContent = "待导入";
  document.querySelector("#importMetrics").innerHTML = "";
  document.querySelector("#importSummaryRows").innerHTML = `<tr><td colspan="6">尚未导入当日医嘱。</td></tr>`;
  document.querySelector("#currentBatch").innerHTML = `<option value="all">全部批次</option>`;
  document.querySelector("#batchTimeline").innerHTML = `<tr><td colspan="7">尚未导入当日医嘱。</td></tr>`;
  document.querySelector("#drugTasks").innerHTML = `<article class="task-card">尚未导入当日医嘱。</article>`;
  document.querySelector("#instructionTitle").textContent = "共享后药品调配量自动换算";
  document.querySelector("#instructionRows").innerHTML = `<tr><td colspan="5">尚未导入当日医嘱。</td></tr>`;
  document.querySelector("#analyticsCards").innerHTML = "";
  document.querySelector("#aiAnswer").textContent = "尚未导入当日医嘱，暂无可解释方案。";
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
  document.querySelector("#runStatus").textContent = `已计算 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
  renderImportSummary(result);
  renderBatchTimeline(result.plans);
  renderTasks(result.plans);
  renderInstructions(result.plans);
  renderDrugKnowledge();
  renderAnalytics(result, savedVials, savedAmount, wasteDose, openedDose);
  renderHistoryRecords();
  renderAiAnswer();
}

function formatLargeMoney(value) {
  const number = Number(value) || 0;
  if (number >= 10000) return `¥${round(number / 10000)}万`;
  return fmtMoney(number);
}

function formatCount(value) {
  return Math.round(Number(value) || 0).toLocaleString("zh-CN");
}


function getImportSampleText() {
  return [
    "患者,药品名称,医嘱剂量mg,药品规格mg,药品单价,复溶后浓度mg/mL,给药途径,配置时间,输注时间,病区,床号,批次,实际分配瓶数",
    "A患者,贝伐珠单抗,60,100,1180,10,静脉滴注,09:00,10:00,肿瘤一病区,12床,第一批,1",
    "B患者,贝伐珠单抗,35,100,1180,10,静脉滴注,09:10,10:20,肿瘤三病区,21床,第一批,1",
    "C患者,贝伐珠单抗,102,100,1180,10,静脉滴注,09:30,11:00,日间化疗,日间07,第二批,2",
    "D患者,贝伐珠单抗,98,100,1180,10,静脉滴注,09:45,11:20,肿瘤二病区,18床,第二批,1",
    "E患者,培美曲塞,720,500,1460,25,静脉滴注,08:50,10:10,肿瘤二病区,09床,第一批,2",
    "F患者,培美曲塞,260,500,1460,25,静脉滴注,09:05,10:40,日间化疗,日间12,第一批,1",
    "G患者,奥沙利铂,85,100,720,5,静脉滴注,09:20,10:30,肿瘤一病区,06床,第一批,1",
    "H患者,奥沙利铂,110,100,720,5,静脉滴注,09:40,11:10,肿瘤二病区,22床,第二批,2"
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
      window.alert("Excel解析库尚未加载完成，请稍后重试；也可以先将Excel另存为CSV后导入。");
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
    ["患者", "patientName"], ["患者姓名", "patientName"], ["姓名", "patientName"], ["病人姓名", "patientName"], ["模拟患者", "patientName"],
    ["患者编号", "patientId"], ["患者卡号", "patientId"], ["病历号", "patientId"],
    ["药品名称", "drugName"], ["药品通用名", "drugName"], ["药品", "drugName"], ["通用名", "drugName"],
    ["医嘱剂量mg", "doseMg"], ["剂量mg", "doseMg"], ["剂量", "doseMg"], ["医嘱剂量", "doseMg"],
    ["用量mg", "doseMg"],
    ["实际使用量", "actualUsedVials"], ["实际使用瓶", "actualUsedVials"], ["实际使用瓶支", "actualUsedVials"],
    ["实际使用量瓶支", "actualUsedVials"], ["实际用量瓶支", "actualUsedVials"],
    ["药品规格mg", "strengthMg"], ["规格mg", "strengthMg"], ["规格数值", "strengthMg"],
    ["药品规格", "specText"], ["规格", "specText"],
    ["药品单价", "price"], ["单价", "price"], ["单价元瓶", "price"],
    ["复溶后浓度mg/ml", "concentration"], ["复溶后浓度mgml", "concentration"], ["浓度mg/ml", "concentration"], ["浓度mgml", "concentration"], ["复溶浓度", "concentration"],
    ["复溶溶媒", "reconstitutionSolvent"], ["溶解溶媒", "reconstitutionSolvent"],
    ["复溶溶媒量", "reconstitutionVolumeText"], ["复溶加入溶媒量ml", "reconstitutionVolumeText"], ["复溶加入量", "reconstitutionVolumeText"],
    ["溶媒类型及规格", "solvent"], ["溶媒规格", "solvent"], ["溶媒", "solvent"], ["稀释液及规格", "solvent"],
    ["开瓶后稳定性小时", "stabilityHours"], ["稳定性小时", "stabilityHours"], ["稳定性", "stabilityHours"],
    ["复溶液稳定性", "reconstitutedStabilityText"], ["复溶液稳定性小时", "reconstitutedStabilityHours"],
    ["稀释液药品稳定性", "dilutedStabilityText"], ["稀释液稳定性", "dilutedStabilityText"], ["稀释液稳定性小时", "dilutedStabilityHours"],
    ["最小准确抽取ml", "minWithdrawMl"], ["最小抽取体积ml", "minWithdrawMl"], ["最小抽取ml", "minWithdrawMl"],
    ["是否共享", "shareable"], ["共享状态", "shareable"], ["允许共享", "shareable"],
    ["是否需要复溶", "requiresReconstitution"], ["药品体积", "drugVolumeText"],
    ["风险等级", "riskLevel"], ["风险", "riskLevel"],
    ["共享规则", "rules"], ["规则备注", "rules"], ["sop备注", "rules"], ["SOP备注", "rules"],
    ["配置时间", "prepTime"], ["配液时间", "prepTime"],
    ["输注时间", "infusionTime"], ["给药时间", "infusionTime"],
    ["给药途径", "route"], ["用法", "route"], ["给药方式", "route"], ["途径", "route"],
    ["病区", "ward"], ["科室", "ward"],
    ["床号", "bed"],
    ["批次", "batch"],
    ["实际分配瓶数", "dispensedVials"], ["发药瓶数", "dispensedVials"], ["发药数量", "dispensedVials"],
    ["发药数量取整", "dispensedVials"], ["发药数量瓶支", "dispensedVials"]
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
  if (text.includes("立即使用")) return 0.25;
  const dayMatches = [...text.matchAll(/(\d+(?:\.\d+)?)(?:天|日|d)/ig)].map(match => Number(match[1]) * 24);
  const hourMatches = [...text.matchAll(/(\d+(?:\.\d+)?)(?:小时|h|hr|hrs)/ig)].map(match => Number(match[1]));
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
      reconstitutionSolvent: "待维护",
      reconstitutionVolumeMl: parseVolumeMl(row.reconstitutionVolumeText) || 0,
      solvent: "待维护溶媒规格",
      compatibleSolvents: ["待维护溶媒规格"],
      stabilityHours: 6,
      reconstitutedStabilityText: row.reconstitutedStabilityText || "",
      reconstitutedStabilityHours: parseNumber(row.reconstitutedStabilityHours) || parseStabilityHours(row.reconstitutedStabilityText) || 6,
      dilutedStabilityText: row.dilutedStabilityText || "",
      dilutedStabilityHours: parseNumber(row.dilutedStabilityHours) || parseStabilityHours(row.dilutedStabilityText) || 0,
      minWithdrawMl: 0.5,
      lightSensitive: false,
      refrigerated: false,
      shareable: true,
      riskLevel: "待维护",
      rules: ["由导入医嘱临时生成，需补充药品数据库后用于生产"]
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
      rejected.push({ row: index + 2, reason: "缺少药品名称/规格，或缺少医嘱剂量mg/实际使用量" });
      return;
    }
    const route = row.route || "静脉滴注";
    const shareability = evaluateOrderShareability({ drugId: drug.id, route }, drug);

    nextOrders.push({
      id: `IMP-${String(index + 1).padStart(4, "0")}`,
      importIndex: index,
      patient: row.patientName || row.patient || row.patientId || `患者${index + 1}`,
      sex: "",
      age: "",
      bed: row.bed || "",
      ward: row.ward || "未填写病区",
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
      protocol: "导入医嘱",
      cycle: "",
      allergy: "",
      labFlag: shareability.shareable ? "导入成功" : shareability.reason,
      nurseStation: row.ward || ""
    });
  });

  return { nextOrders, rejected };
}

function batchFromTime(time) {
  const value = minutes(time || "09:00");
  if (value < 600) return "第一批";
  if (value < 720) return "第二批";
  return "第三批";
}

function importOrderText(text) {
  const rows = parseDelimitedText(text);
  const { nextOrders, rejected } = importedRowsToOrders(rows);
  if (!nextOrders.length) {
    window.alert("没有可导入的有效医嘱。请至少提供：患者、药品名称、医嘱剂量mg、药品规格mg。");
    return;
  }
  orders = nextOrders;
  importRejected = rejected;
  document.body.dataset.confirmed = "false";
  document.querySelector("#confirmPlan").textContent = "一键确认方案";
  auditTrail.unshift({ time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }), role: "系统", action: `导入${nextOrders.length}条当日医嘱，${rejected.length}条未纳入` });
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
      drugName: drug?.name || "未匹配药品",
      patients: uniqueCount(drugOrders, order => order.patient),
      before,
      after,
      saved,
      status: blockedOrders && shareableOrders.length ? "部分可共享" : (shareableOrders.length ? "可共享" : "不可共享")
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
    ["涉及药品", `${formatCount(totals.drugs)} 种`],
    ["涉及患者", `${formatCount(totalPatients)} 人`],
    ["共享前瓶数", `${round(totals.before)} 瓶`],
    ["共享后瓶数", `${round(totals.after)} 瓶`],
    ["节约瓶数", `${round(totals.saved)} 瓶`]
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
      <td><span class="${item.saved > 0 ? "ok" : "warning"}">${item.status}${item.saved > 0 ? "，建议共享" : "，收益有限"}</span></td>
    </tr>
  `).join("") || `<tr><td colspan="6">尚未导入医嘱。</td></tr>`;
}


function renderBatchTimeline(plans) {
  const vials = plans
    .flatMap(plan => plan.vials)
    .sort((a, b) => minutes(a.openTime) - minutes(b.openTime));

  if (!vials.length) {
    document.querySelector("#currentBatch").innerHTML = `<option value="all">全部批次</option>`;
    document.querySelector("#batchTimeline").innerHTML = `<tr><td colspan="7">暂无待调配药品。</td></tr>`;
    return;
  }

  const batchOrder = batch => {
    const known = ["第一批", "第二批", "第三批", "第四批"];
    const index = known.indexOf(batch);
    return index >= 0 ? index : known.length;
  };
  const batches = [...new Set(vials.map(vial => vial.batch || "未分批"))].sort((a, b) => batchOrder(a) - batchOrder(b) || a.localeCompare(b, "zh-CN"));
  if (selectedBatchFilter !== "all" && !batches.includes(selectedBatchFilter)) selectedBatchFilter = "all";
  document.querySelector("#currentBatch").innerHTML = [
    `<option value="all">全部批次</option>`,
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
    const batchCompare = batchOrder(a.batch) - batchOrder(b.batch) || a.batch.localeCompare(b.batch, "zh-CN");
    if (batchCompare) return batchCompare;
    if (b.savedVials !== a.savedVials) return b.savedVials - a.savedVials;
    return a.drug.name.localeCompare(b.drug.name, "zh-CN");
  });

  if (!rows.length) {
    document.querySelector("#batchTimeline").innerHTML = `<tr><td colspan="7">该批次暂无待调配药品。</td></tr>`;
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
        <td>${item.patients.size} 人</td>
        <td>${item.vialCount} 瓶</td>
        <td><span class="${hasWaste ? "warning" : "ok"}">${hasWaste ? "有余液" : "无余液"}</span></td>
        <td>${hasWaste ? `${fmtDose(item.wasteMg)} / ${fmtMl(wasteMl)}` : "0 mg / 0 mL"}</td>
        <td>${earliestExpire?.label || "-"}</td>
      </tr>
    `;
  }).join("");
}

function renderTasks(plans) {
  if (!plans.length) {
    document.querySelector("#drugTasks").innerHTML = `<article class="task-card">暂无可共享药品，请先导入当日医嘱。</article>`;
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
              <p class="eyebrow">${plan.orders.length} 名患者 · ${plan.vials.length} 瓶 · 复溶液：${stabilityLabel(plan.drug.reconstitutedStabilityText, getReconstitutedStabilityHours(plan.drug))} · 稀释液：${stabilityLabel(plan.drug.dilutedStabilityText, getDilutedStabilityHours(plan.drug))}</p>
            </div>
            <span class="risk-pill">${plan.drug.riskLevel}风险</span>
          </header>
          <div class="meta-row">
            <span>规格 ${fmtDose(plan.drug.vialStrengthMg)}/瓶</span>
            <span>复溶溶媒 ${plan.drug.reconstitutionSolvent}</span>
            <span>复溶浓度 ${plan.drug.concentrationMgMl} mg/mL</span>
            <span>给药途径 ${[...new Set(plan.orders.map(order => routeText(order)))].join(" / ")}</span>
            <span>${plan.drug.solvent}</span>
          </div>
          <div class="progress" aria-label="药品利用率"><span style="width:${shareScore}%"></span></div>
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
          ? `共享瓶${vialNo}抽取${fmtMl(usedMl)}`
          : `共享瓶${vialNo}续用余液抽取${fmtMl(usedMl)}`;
        const actionText = index === 0
          ? `共享瓶${vialNo}抽取${fmtMl(usedMl)}`
          : `续用共享瓶${vialNo}余液${fmtMl(usedMl)}`;
        const remainingText = event.afterMg > 0.0001
          ? `余${fmtMl(afterMl)}${index === vialEvents.length - 1 ? "废弃或继续匹配" : "供后续患者使用"}`
          : "抽取后无余液";
        existing.sharedParts.push(sourceText);
        existing.vialNotes.push(`${actionText}，${remainingText}`);
      }
      stabilityWarnings(event.order, drug)
        .filter(warning => !warning.includes("稳定性待维护"))
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
    ].filter(Boolean).join(" + ") || "无需抽取";
    const notes = [
      `${order.batch}，${order.ward}${order.bed}，${routeText(order)}`,
      wholeVialText ? `使用${wholeVialText}` : "",
      ...vialNotes,
      drug.lightSensitive ? "避光" : "",
      order.auditStatus === "hold" ? "医嘱待药师复核" : "",
      ...sharedParts.map(part => {
        const ml = parseNumber(part);
        return ml > 0 && ml < drug.minWithdrawMl ? "低于最小准确抽取体积，需复核" : "";
      }),
      ...warnings
    ].filter(Boolean).join("；");

    return {
      drugName: drug.name,
      patient: order.patient,
      dose: fmtDose(doseMg),
      withdraw: withdrawDisplay,
      solvent: drug.solvent,
      notes
    };
  });
}

function renderInstructions(plans) {
  const selectedPlan = plans.find(plan => plan.drug.id === selectedInstructionDrugId);
  document.querySelector("#instructionTitle").textContent = selectedPlan
    ? `${selectedPlan.drug.name}（${fmtDose(selectedPlan.drug.vialStrengthMg)}/瓶，复溶加入${formatReconstitutionVolume(selectedPlan.drug)}，复溶后浓度${selectedPlan.drug.concentrationMgMl} mg/mL） · 共享后药品调配量自动换算`
    : "共享后药品调配量自动换算";

  if (!selectedPlan) {
    document.querySelector("#instructionRows").innerHTML = `<tr><td colspan="5">请先在“今日共享任务”中选择药品。</td></tr>`;
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

  document.querySelector("#instructionRows").innerHTML = rows.join("") || `<tr><td colspan="5">请先在“今日共享任务”中选择药品。</td></tr>`;
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
        drug.shareable ? "可共享" : "不共享",
        ...(drug.rules || [])
      ].join(" "));
      return haystack.includes(query);
    })
    : [];
  document.querySelector("#drugKnowledgeCount").textContent = query ? `共 ${drugs.length} 种，当前显示 ${visibleDrugs.length} 种` : `共 ${drugs.length} 种药品`;
  document.querySelector("#drugKnowledgeSearchStatus").textContent = query ? `当前显示 ${visibleDrugs.length} 条匹配记录。` : "请输入药品名称进行查询。";
  if (!query) {
    document.querySelector("#drugKnowledgeRows").innerHTML = `<tr><td colspan="10">请输入药品名称进行查询。</td></tr>`;
    return;
  }
  document.querySelector("#drugKnowledgeRows").innerHTML = visibleDrugs.map(drug => {
    return `
      <tr data-drug-id="${drug.id}" class="${drug.id === selectedMaintenanceDrugId ? "selected-row" : ""}">
        <td>${drug.name}</td>
        <td>${fmtDose(drug.vialStrengthMg)}/瓶</td>
        <td>${drug.concentrationMgMl} mg/mL</td>
        <td>${formatReconstitutionVolume(drug)}</td>
        <td>${drug.solvent}</td>
        <td>${stabilityLabel(drug.reconstitutedStabilityText, getReconstitutedStabilityHours(drug))}</td>
        <td>${stabilityLabel(drug.dilutedStabilityText, getDilutedStabilityHours(drug))}</td>
        <td><span class="${drug.shareable ? "ok" : "warning"}">${drug.shareableText || (drug.shareable ? "允许共享" : "禁止共享")}</span></td>
        <td><span class="${confirmedDrugIds.has(drug.id) ? "ok" : "warning"}">${confirmedDrugIds.has(drug.id) ? "已确认" : "待确认"}</span></td>
        <td>${drug.rules.join("；")}</td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="10">未找到匹配药品。</td></tr>`;
}

function getDrugKnowledgeTemplateText() {
  return [
    "药品通用名,药品规格,药品体积,是否需要复溶,复溶浓度,复溶溶媒,复溶溶媒量,复溶液稳定性,稀释液及规格,稀释液药品稳定性,共享状态,规则备注",
    "注射用曲妥珠单抗,150mg,,是,21 mg/ml,无菌注射用水,7.2ml,,250 ml 0.9% 氯化钠注射液,2-8 ℃ 保存 48 小时,可共享,同药同溶媒可共享",
    "注射用伊达比星,10mg,,是,1 mg/ml,注射用水（USP）,10ml,,无,15-30℃避光,不共享，仅用于静脉注射,静脉滴注医嘱需药师确认后可进入共享",
    "注射用亮丙瑞林微球,11.25mg,,是,11.25 mg/ml,随药附带专用注射用溶剂,1ml,,无,低于25℃避光,不共享，皮下注射，一般整支使用,非皮下注射医嘱需药师确认"
  ].join("\n");
}

function parseShareable(value) {
  const text = normalizeText(value);
  if (["否", "不共享", "不可共享", "禁止共享", "false", "no", "0"].includes(text)) return false;
  if (text.includes("不共享") || text.includes("不可共享") || text.includes("禁止共享")) return false;
  return true;
}

function buildMaintainedDrug(row, existing) {
  const name = (row.drugName || "").trim();
  const strength = parseStrengthMg(row);
  const drugVolumeMl = parseVolumeMl(row.drugVolumeText);
  const concentration = parseConcentrationMgMl(row.concentration) || (drugVolumeMl ? strength / drugVolumeMl : 0);
  const requiresReconstitution = normalizeText(row.requiresReconstitution || "") !== "否";
  const reconstitutionVolumeMl = requiresReconstitution ? parseVolumeMl(row.reconstitutionVolumeText) || (concentration ? strength / concentration : 0) : 0;
  const reconstitutedText = (row.reconstitutedStabilityText || "").trim();
  const dilutedText = (row.dilutedStabilityText || "").trim();
  const legacyStability = parseNumber(row.stabilityHours);
  const reconstitutedHours = parseNumber(row.reconstitutedStabilityHours) || parseStabilityHours(reconstitutedText) || legacyStability || 0;
  const dilutedHours = parseNumber(row.dilutedStabilityHours) || parseStabilityHours(dilutedText) || 0;
  const solvent = (row.solvent || "").trim() || "待维护";
  const shareableText = (row.shareable || "").trim() || (existing?.shareableText || "");
  const rules = String(row.rules || "")
    .split(/[;；]/)
    .map(rule => rule.trim())
    .filter(Boolean);
  if (!name || strength <= 0 || concentration <= 0) return null;

  return {
    id: existing?.id || makeDrugId(name, strength),
    name,
    vialStrengthMg: strength,
    pricePerVial: parseNumber(row.price) || existing?.pricePerVial || 0,
    concentrationMgMl: concentration,
    reconstitutionSolvent: (row.reconstitutionSolvent || "").trim() || existing?.reconstitutionSolvent || "待维护",
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
    lightSensitive: existing?.lightSensitive || /避光/.test(`${reconstitutedText}${dilutedText}${row.rules || ""}`),
    refrigerated: existing?.refrigerated || /2-8|2℃|8℃|冷藏/.test(`${reconstitutedText}${dilutedText}`),
    shareable: parseShareable(shareableText),
    shareableText,
    riskLevel: (row.riskLevel || existing?.riskLevel || "中").trim(),
    rules: rules.length ? rules : [shareableText || "药品知识库维护后生成"].filter(Boolean)
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

    const existing = drugs.find(drug => normalizeText(drug.name) === normalizeText(name) && Math.abs(drug.vialStrengthMg - strength) < 0.0001);
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

  document.querySelector("#drugKnowledgeUploadStatus").textContent = `导入完成：新增 ${added} 种，更新 ${updated} 种，跳过 ${skipped} 行。`;
  auditTrail.unshift({ time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }), role: "药品维护", action: `批量导入药品知识库：新增${added}种，更新${updated}种` });
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
  document.querySelector("#editRisk").value = "中";
  renderDrugKnowledge();
}

function fillDrugEditForm(drug) {
  selectedMaintenanceDrugId = drug.id;
  document.querySelector("#editDrugName").value = drug.name;
  document.querySelector("#editStrength").value = drug.vialStrengthMg;
  document.querySelector("#editPrice").value = drug.pricePerVial;
  document.querySelector("#editConcentration").value = drug.concentrationMgMl;
  document.querySelector("#editReconstitution").value = drug.reconstitutionSolvent;
  document.querySelector("#editReconstitutionVolume").value = drug.reconstitutionVolumeMl || "";
  document.querySelector("#editSolvent").value = drug.solvent;
  document.querySelector("#editReconstitutedStability").value = drug.reconstitutedStabilityText || (drug.reconstitutedStabilityHours ? `${round(drug.reconstitutedStabilityHours)}小时` : "");
  document.querySelector("#editDilutedStability").value = drug.dilutedStabilityText || (drug.dilutedStabilityHours ? `${round(drug.dilutedStabilityHours)}小时` : "");
  document.querySelector("#editMinWithdraw").value = drug.minWithdrawMl;
  document.querySelector("#editShareable").value = String(drug.shareable);
  document.querySelector("#editRisk").value = drug.riskLevel;
  document.querySelector("#editRules").value = drug.rules.join("；");
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
  const shareableText = document.querySelector("#editShareable").value === "true" ? "可共享" : "不共享";
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
  auditTrail.unshift({ time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }), role: "药品维护", action: `保存药品维护信息：${name}` });
  render();
}

function confirmSelectedDrugKnowledge() {
  if (!selectedMaintenanceDrugId) return;
  const drug = byDrug(selectedMaintenanceDrugId);
  if (!drug) return;
  confirmedDrugIds.add(drug.id);
  document.querySelector("#drugKnowledgeUploadStatus").textContent = `已确认：${drug.name}（${fmtDose(drug.vialStrengthMg)}/瓶）。`;
  auditTrail.unshift({ time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }), role: "药品维护", action: `确认药品知识库信息：${drug.name}` });
  render();
}

function clearImportedOrders() {
  orders = [];
  importRejected = [];
  auditTrail = [];
  resetDynamicDrugs();
  document.querySelector("#orderPaste").value = "";
  document.querySelector("#orderFile").value = "";
  document.querySelector("#orderAnalysis").innerHTML = "";
  document.body.dataset.confirmed = "false";
  document.querySelector("#confirmPlan").textContent = "一键确认方案";
  render();
}

function groupCount(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item) || "未填写";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function renderOrderAnalysis() {
  const result = calculatePlan();
  if (!orders.length) {
    document.querySelector("#orderAnalysis").innerHTML = `<article class="analysis-card">尚未导入医嘱，暂无可分析数据。</article>`;
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
        <h4>共享收益</h4>
        <span>共享前 ${round(baseline)} 瓶，推荐后 ${round(after)} 瓶</span>
        <strong>节约 ${round(Math.max(0, baseline - after))} 瓶</strong>
      </article>
    `,
    `
      <article class="analysis-card">
        <h4>共享强度</h4>
        <span>${result.plans.length} 种药品，${uniquePatients} 名患者</span>
        <strong>${sharedVials} 个共享瓶</strong>
      </article>
    `,
    `
      <article class="analysis-card">
        <h4>平均患者密度</h4>
        <span>每种可共享药品涉及患者数</span>
        <strong>${round(avgPatientsPerDrug)} 人/药</strong>
      </article>
    `,
    `
      <article class="analysis-card">
        <h4>全部药品共享结果</h4>
        ${analyzedDrugs.map(item => `<p>${item.drugName}：${item.patients}人，共享前${round(item.before)}瓶，推荐后${round(item.after)}瓶，节约${round(item.saved)}瓶</p>`).join("") || "<p>暂无可共享药品。</p>"}
      </article>
    `,
    `
      <article class="analysis-card">
        <h4>病区分布</h4>
        ${byWard.map(([ward, count]) => `<p>${ward}：${count}条医嘱</p>`).join("")}
      </article>
    `,
    `
      <article class="analysis-card">
        <h4>批次分布</h4>
        ${byBatch.map(([batch, count]) => `<p>${batch}：${count}条医嘱</p>`).join("")}
      </article>
    `,
    `
      <article class="analysis-card">
        <h4>药品数据库缺口</h4>
        ${tempDrugNames.length ? tempDrugNames.slice(0, 6).map(name => `<p>${name}：需补充复溶溶媒、稳定性、溶媒规格等规则</p>`).join("") : "<p>导入药品均已匹配当前规则库。</p>"}
      </article>
    `,
    `
      <article class="analysis-card">
        <h4>未纳入记录</h4>
        ${importRejected.length ? importRejected.slice(0, 8).map(item => `<p>第${item.row}行：${item.reason}</p>`).join("") : "<p>所有导入行均已纳入共享计算。</p>"}
      </article>
    `,
    `
      <article class="analysis-card">
        <h4>执行提示</h4>
        <p>优先处理节约瓶数高、共享瓶数多、同批次患者集中的药品；临时生成药品规则的项目需先补全药品数据库后再用于生产。</p>
      </article>
    `
  ].join("");
}



function renderAnalytics(result, savedVials, savedAmount, wasteDose, openedDose) {
  const sharedVials = result.plans.flatMap(plan => plan.vials).filter(vial => vial.shared).length;
  const involvedDrugs = uniqueCount(result.activeOrders, order => order.drugId);
  const analytics = [
    ["节约瓶数", `${savedVials} 瓶`],
    ["节约金额", fmtMoney(savedAmount)],
    ["共享瓶数", `${sharedVials} 瓶`],
    ["涉及药品", `${involvedDrugs} 种`],
    ["剩余废弃剂量", fmtDose(wasteDose)],
    ["开启总剂量", fmtDose(openedDose)],
    ["推荐采纳率", document.body.dataset.confirmed === "true" ? "100%" : "待确认"],
    ["最新留痕", auditTrail[0]?.action || "暂无"]
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
      residual: item.wasteMg > 0.0001 ? "有余液" : "无余液",
      residualAmount: item.wasteMg > 0.0001 ? `${fmtDose(item.wasteMg)} / ${fmtMl(wasteMl)}` : "0 mg / 0 mL",
      latestUse: latest?.label || "-"
    };
  }).sort((a, b) => batchOrder(a.batch) - batchOrder(b.batch) || a.drug.localeCompare(b.drug, "zh-CN"));
}

function archiveCurrentPlan() {
  if (!orders.length) {
    window.alert("当前未导入医嘱，无法归档。");
    return false;
  }
  const result = calculatePlan();
  if (!result.plans.length) {
    window.alert("当前没有可归档的共享方案。");
    return false;
  }
  const signature = currentPlanSignature(result);
  if (lastArchivedSignature === signature || historyRecords.some(record => record.signature === signature)) {
    window.alert("当前方案已归档，无需重复保存。");
    return false;
  }
  const summary = summarizePlans(result);
  const record = {
    id: `HIS-${Date.now()}`,
    signature,
    confirmedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
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
  document.querySelector("#historyCount").textContent = `${historyRecords.length} 条记录`;
  if (!historyRecords.length) {
    document.querySelector("#historyRows").innerHTML = `<tr><td colspan="8">暂无历史分配记录。点击“一键确认方案”后自动归档。</td></tr>`;
    document.querySelector("#historyDetail").innerHTML = "";
    return;
  }
  document.querySelector("#historyRows").innerHTML = historyRecords.map(record => `
    <tr>
      <td>${record.confirmedAt}</td>
      <td>${record.drugs} 种</td>
      <td>${record.patients} 人</td>
      <td>${round(record.baselineVials)}</td>
      <td>${round(record.optimizedVials)}</td>
      <td>${round(record.savedVials)}</td>
      <td>${fmtMoney(record.savedAmount)}</td>
      <td>
        <div class="history-actions">
          <button class="table-action" type="button" data-history-view="${record.id}">${expandedHistoryId === record.id ? "收起" : "查看详情"}</button>
          <button class="table-action" type="button" data-history-export="${record.id}">导出CSV</button>
          <button class="table-action danger" type="button" data-history-delete="${record.id}">删除</button>
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
      <h4>药品汇总</h4>
      <div class="table-wrap compact-table">
        <table>
          <thead><tr><th>药品</th><th>患者数</th><th>共享前瓶数</th><th>共享后瓶数</th><th>节约瓶数</th><th>节约金额</th></tr></thead>
          <tbody>${record.drugRows.map(row => `<tr><td>${row.drug}</td><td>${row.patients}</td><td>${round(row.before)}</td><td>${round(row.after)}</td><td>${round(row.saved)}</td><td>${fmtMoney(row.savings)}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    </div>
    <div class="history-section">
      <h4>批次用瓶与余液</h4>
      <div class="table-wrap compact-table">
        <table>
          <thead><tr><th>批次</th><th>药品</th><th>涉及患者</th><th>开启瓶数</th><th>是否有余液</th><th>余液量</th><th>最晚使用时间</th></tr></thead>
          <tbody>${record.batchRows.map(row => `<tr><td>${row.batch}</td><td>${row.drug}</td><td>${row.patients} 人</td><td>${row.vialCount} 瓶</td><td>${row.residual}</td><td>${row.residualAmount}</td><td>${row.latestUse}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    </div>
    <div class="history-section">
      <h4>PIVAS调配指令</h4>
      <div class="table-wrap compact-table">
        <table>
          <thead><tr><th>药品</th><th>患者</th><th>医嘱剂量</th><th>应抽取药液体积</th><th>溶媒类型及规格</th><th>备注</th></tr></thead>
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
  const headers = ["药品", "患者", "医嘱剂量", "应抽取药液体积", "溶媒类型及规格", "备注"];
  const lines = [
    headers.map(csvEscape).join(","),
    ...record.instructionRows.map(row => [row.drugName, row.patient, row.dose, row.withdraw, row.solvent, row.notes].map(csvEscape).join(","))
  ];
  const blob = new Blob([`\ufeff${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `药品处方分配记录_${record.confirmedAt.replace(/[\\/: ]/g, "-")}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function renderAiAnswer(question) {
  const result = calculatePlan();
  const topPlan = result.plans[0];
  if (!topPlan) {
    document.querySelector("#aiAnswer").textContent = "当前没有可解释的共享方案。";
    return;
  }

  const sharedVials = topPlan.vials.filter(vial => vial.shared).length;
  const wasteMg = topPlan.vials.reduce((sum, vial) => sum + vial.wasteMg, 0);
  const baseline = topPlan.orders.reduce((sum, order) => sum + (Number.isFinite(order.dispensedVials) && order.dispensedVials > 0 ? order.dispensedVials : Math.ceil(order.doseMg / topPlan.drug.vialStrengthMg)), 0);
  const saved = Math.max(0, baseline - topPlan.vials.length) * topPlan.drug.pricePerVial;
  const holdCount = topPlan.orders.filter(order => order.auditStatus === "hold").length;

  const prefix = question ? `问题：${question}\n\n` : "";
  document.querySelector("#aiAnswer").innerHTML = `
    ${prefix.replace(/\n/g, "<br>")}
    推荐优先处理 <strong>${topPlan.drug.name}</strong>，因为它有 ${topPlan.orders.length} 名患者处于相容溶媒和稳定性窗口内，
    可形成 ${sharedVials} 个共享瓶，预计节约 ${fmtMoney(saved)}。系统同时保留了 ${holdCount} 条需人工复核医嘱，
    这些方案不会直接进入配置完成状态。
    <br><br>
    审核依据：${topPlan.drug.rules.join("；")}。药师重点核对复溶加入溶媒量 ${formatReconstitutionVolume(topPlan.drug)}、
    复溶后浓度 ${topPlan.drug.concentrationMgMl} mg/mL、复溶液稳定性 ${stabilityLabel(topPlan.drug.reconstitutedStabilityText, getReconstitutedStabilityHours(topPlan.drug))}、
    稀释液稳定性 ${stabilityLabel(topPlan.drug.dilutedStabilityText, getDilutedStabilityHours(topPlan.drug))}、每名患者抽取体积、批次配送节点，以及剩余 ${fmtDose(wasteMg)} 的处理路径。
  `;
}



document.querySelector("#loadSampleOrders").addEventListener("click", () => {
  document.querySelector("#orderPaste").value = getImportSampleText();
});

document.querySelector("#orderFile").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  const importButton = document.querySelector("#importOrders");
  importButton.disabled = true;
  document.querySelector("#orderPaste").value = "";
  try {
    const text = await readTableFileAsText(file);
    if (!text) {
      event.target.value = "";
      return;
    }
    document.querySelector("#orderPaste").value = text;
    importOrderText(text);
  } catch (error) {
    console.error("Prescription import failed", error);
    window.alert("医嘱导入或计算失败，请检查文件内容后重试。");
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
  if (!file) return;
  if (/\.xlsx?$/i.test(file.name)) {
    window.alert("当前网页原型支持CSV/TSV/TXT导入。请先将Excel另存为CSV，或直接复制表格内容粘贴到文本框。");
    event.target.value = "";
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
  document.querySelector("#drugKnowledgeUploadStatus").textContent = "等待上传药品知识库。";
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
  auditTrail.unshift({ time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }), role: "PIVAS药师", action: "确认当前共享方案并生成调配核对单" });
  document.querySelector("#confirmPlan").textContent = "方案已确认";
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

document.querySelector("#askAi").addEventListener("click", () => {
  renderAiAnswer(document.querySelector("#aiQuestion").value.trim());
});



loadHistoryRecords();
seedDrugKnowledgeRows();
render();
