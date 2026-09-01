/**
 * Offline-First Auto-Sync
 * - LocalStorage = sumber kebenaran di perangkat
 * - isDirty true = ada perubahan belum di cloud → PUSH saat online
 * - isDirty false = boleh PULL dari cloud
 */
const firebaseConfig = {
  apiKey: "AIzaSyCXB4Y7kmmqV--iKbyKLJoFY7r6HgmX3VA",
  authDomain: "garasi-keuangan.firebaseapp.com",
  projectId: "garasi-keuangan",
  storageBucket: "garasi-keuangan.firebasestorage.app",
  messagingSenderId: "845558051998",
  appId: "1:845558051998:web:06bc6a582cda6b720d378f",
  measurementId: "G-JCGG630229",
  databaseURL: "https://garasi-keuangan-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const STORAGE_KEY = "GARASI_FOTOCOPY_OFFLINE_V1";
let db = null, dbRef = null, isConnectedToCloud = false, chartInstance = null, applyingRemote = false;

let state = {
  saldoTunai: 0, saldoBank: 0, kasLaciAwal: 0, bersihHariIni: 0, qrisHariIni: 0, transferHariIni: 0,
  kategoriPengeluaran: ["Paket COD","Paket TF","Belanja Felik","Belanja Yuni","Belanja Gibran","Belanja Toko","Operasional","Lain-lain"],
  riwayat: []
};

let meta = { nextId: 1, isDirty: false, lastUpdated: 0 };

// ===== LOCAL =====
function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (p.state) state = Object.assign(state, p.state);
    if (p.meta) meta = Object.assign(meta, p.meta);
    if (!Array.isArray(state.riwayat)) state.riwayat = [];
  } catch (e) {}
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: state, meta: meta }));
}

/** Setiap aksi user: simpan lokal dulu, tandai dirty, sync jika online */
function commitLocalChange() {
  meta.isDirty = true;
  meta.lastUpdated = Date.now();
  saveLocal();
  renderSemua();
  if (isConnectedToCloud) pushToCloud();
  else updateStatus("offline");
}

function pushToCloud() {
  if (!dbRef || !isConnectedToCloud) return;
  updateStatus("saving");
  const payload = {
    state: state,
    nextId: meta.nextId,
    lastUpdated: meta.lastUpdated
  };
  dbRef.set(payload)
    .then(function () {
      meta.isDirty = false;
      saveLocal();
      updateStatus("cloud");
    })
    .catch(function () {
      // tetap dirty, coba lagi saat online
      updateStatus("offline");
    });
}

function applyRemoteIfSafe(data) {
  if (!data || !data.state) return;
  // Jangan timpa data offline yang belum terupload
  if (meta.isDirty) return;
  const remoteTs = data.lastUpdated || 0;
  // Jika lokal lebih baru (tanpa dirty jarang terjadi), jaga lokal
  if (meta.lastUpdated > remoteTs) return;
  applyingRemote = true;
  state = Object.assign(state, data.state);
  if (!Array.isArray(state.riwayat)) state.riwayat = [];
  meta.nextId = data.nextId || meta.nextId;
  meta.lastUpdated = remoteTs || meta.lastUpdated;
  meta.isDirty = false;
  saveLocal();
  renderSemua();
  applyingRemote = false;
}

// ===== FIREBASE =====
loadLocal();
renderSemua();
updateStatus(navigator.onLine ? "saving" : "offline");

try {
  if (typeof firebase !== "undefined") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    dbRef = db.ref("keuangan_garasi_fotocopy");

    db.ref(".info/connected").on("value", function (snap) {
      if (snap.val() === true) {
        isConnectedToCloud = true;
        if (meta.isDirty) pushToCloud();
        else updateStatus("cloud");
      } else {
        isConnectedToCloud = false;
        updateStatus("offline");
      }
    });

    dbRef.on("value", function (snapshot) {
      if (applyingRemote) return;
      applyRemoteIfSafe(snapshot.val());
    });
  } else {
    updateStatus("offline");
  }
} catch (e) {
  updateStatus("offline");
}

window.addEventListener("online", function () {
  // Firebase .info/connected akan memicu push; fallback:
  setTimeout(function () {
    if (meta.isDirty && isConnectedToCloud) pushToCloud();
  }, 500);
});
window.addEventListener("offline", function () {
  isConnectedToCloud = false;
  updateStatus("offline");
});

function updateStatus(tipe) {
  var el = document.getElementById("syncStatus");
  if (!el) return;
  if (tipe === "cloud") {
    el.innerHTML = '<i class="fa-solid fa-circle text-[7px] animate-pulse"></i> Online';
    el.className = "text-[9px] px-2 py-0.5 rounded-full bg-emerald-500 text-white flex items-center gap-1 font-semibold";
  } else if (tipe === "saving") {
    el.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> Menyinkronkan...';
    el.className = "text-[9px] px-2 py-0.5 rounded-full bg-amber-500 text-white flex items-center gap-1 font-semibold";
  } else {
    el.innerHTML = '<i class="fa-solid fa-circle text-[7px]"></i> Offline';
    el.className = "text-[9px] px-2 py-0.5 rounded-full bg-slate-500 text-white flex items-center gap-1 font-semibold";
  }
}

function formatRp(n) {
  n = Number(n) || 0;
  var s = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(Math.abs(n));
  return n < 0 ? "-" + s : s;
}
function getWaktu() {
  var now = new Date();
  return { jam: now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }), timestamp: now.getTime() };
}
function setT(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }

function renderSemua() {
  var u = (state.saldoTunai||0)+(state.saldoBank||0)+(state.kasLaciAwal||0)+(state.bersihHariIni||0)+(state.qrisHariIni||0)+(state.transferHariIni||0);
  setT("valSaldoUtama", formatRp(u));
  setT("valSaldoTunai", formatRp(state.saldoTunai));
  setT("valSaldoBank", formatRp(state.saldoBank));
  setT("valKasLaciAwal", formatRp(state.kasLaciAwal));
  setT("valBersihHariIni", formatRp(state.bersihHariIni));
  setT("valQrisHariIni", formatRp(state.qrisHariIni));
  setT("valTransferHariIni", formatRp(state.transferHariIni));
  var st = (state.kasLaciAwal||0)+(state.bersihHariIni||0);
  var sb = (state.qrisHariIni||0)+(state.transferHariIni||0);
  setT("setorKasLaci", formatRp(state.kasLaciAwal));
  setT("setorBersih", formatRp(state.bersihHariIni));
  setT("setorTunaiTotal", formatRp(st));
  setT("setorQris", formatRp(state.qrisHariIni));
  setT("setorTransfer", formatRp(state.transferHariIni));
  setT("setorBankTotal", formatRp(sb));
  setT("setorTotal", formatRp(st+sb));
  setT("totalTransaksi", (state.riwayat ? state.riwayat.length : 0) + " transaksi");
  renderRiwayat();
  renderKategoriDropdown();
}

function renderKategoriDropdown() {
  var sel = document.getElementById("inputKategoriTunai");
  if (!sel) return;
  sel.innerHTML = "";
  (state.kategoriPengeluaran||[]).forEach(function (k) {
    var o = document.createElement("option"); o.value = k; o.textContent = k; sel.appendChild(o);
  });
}

function renderRiwayat() {
  var tb = document.getElementById("tbodyRiwayat");
  if (!tb) return;
  tb.innerHTML = "";
  if (!state.riwayat || !state.riwayat.length) {
    tb.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-slate-400">Belum ada transaksi</td></tr>';
    return;
  }
  state.riwayat.slice().reverse().forEach(function (item) {
    var tr = document.createElement("tr");
    tr.className = "hover:bg-blue-50 border-b";
    var badge = item.tipe === "MASUK"
      ? '<span class="text-emerald-600 font-bold">+' + formatRp(item.nominal) + "</span>"
      : item.tipe === "KELUAR"
      ? '<span class="text-rose-600 font-bold">-' + formatRp(item.nominal) + "</span>"
      : '<span class="font-bold">' + formatRp(item.nominal) + "</span>";
    tr.innerHTML = '<td class="py-3 px-4 font-mono text-[11px] text-slate-500">' + item.waktu + '</td>' +
      '<td class="py-3 px-4"><span class="px-2 py-0.5 rounded-full text-[10px] bg-slate-200 border">' + item.kategori + "</span></td>" +
      '<td class="py-3 px-4 font-medium">' + (item.ket || "") + "</td>" +
      '<td class="py-3 px-4 text-right">' + badge + "</td>" +
      '<td class="py-3 px-4 text-center"><button onclick="bukaEditRiwayat(' + item.id + ')" class="text-blue-600 w-7 h-7"><i class="fa-solid fa-pen text-xs"></i></button> ' +
      '<button onclick="hapusRiwayat(' + item.id + ')" class="text-rose-600 w-7 h-7"><i class="fa-solid fa-trash text-xs"></i></button></td>';
    tb.appendChild(tr);
  });
}

function bukaModal(id) {
  var m = document.getElementById(id);
  if (!m) return;
  m.classList.remove("hidden"); m.classList.add("flex");
  if (id === "modalTransaksiTunai") toggleKategoriTunai();
}
function tutupModal(id) {
  var m = document.getElementById(id);
  if (!m) return;
  m.classList.add("hidden"); m.classList.remove("flex");
}

function handleKasLaciAwal(e) {
  e.preventDefault();
  var n = parseInt(document.getElementById("inputKasLaci").value, 10);
  if (n > state.saldoTunai) { alert("Saldo Tunai tidak cukup!"); return; }
  state.saldoTunai -= n; state.kasLaciAwal += n;
  var w = getWaktu();
  state.riwayat.push({ id: meta.nextId++, waktu: w.jam, timestamp: w.timestamp, kategori: "Kas Laci", ket: "Ambil Kas Laci Awal", tipe: "KELUAR", nominal: n, sumber: "KAS_LACI" });
  document.getElementById("inputKasLaci").value = "";
  commitLocalChange(); tutupModal("modalKasLaci");
}

function handleTransaksiTunai(e) {
  e.preventDefault();
  var jenis = document.getElementById("inputJenisTunai").value;
  var ket = document.getElementById("inputKetTunai").value.trim();
  var n = parseInt(document.getElementById("inputNominalTunai").value, 10);
  var kategori = "Toko", sumber = "";
  if (jenis === "MASUK") {
    if (!ket) ket = "Penjualan Toko";
    state.bersihHariIni += n; sumber = "TUNAI_MASUK";
  } else {
    kategori = document.getElementById("inputKategoriTunai").value || "Lain-lain";
    if (!ket) ket = kategori;
    var sd = document.getElementById("inputSumberDanaTunai").value;
    if (sd === "TUNAI") {
      if (n > state.saldoTunai) { alert("Saldo Tunai tidak cukup!"); return; }
      state.saldoTunai -= n; sumber = "PENGELUARAN_TUNAI"; ket += " (Potong Tunai)";
    } else {
      if (n > state.saldoBank) { alert("Saldo Bank tidak cukup!"); return; }
      state.saldoBank -= n; sumber = "PENGELUARAN_BANK"; ket += " (Potong Rekening)";
    }
  }
  var w = getWaktu();
  state.riwayat.push({ id: meta.nextId++, waktu: w.jam, timestamp: w.timestamp, kategori: kategori, ket: ket, tipe: jenis, nominal: n, sumber: sumber });
  document.getElementById("inputKetTunai").value = "";
  document.getElementById("inputNominalTunai").value = "";
  commitLocalChange(); tutupModal("modalTransaksiTunai");
}

function handleTransaksiDigital(e) {
  e.preventDefault();
  var metode = document.getElementById("inputMetodeDigital").value;
  var ket = document.getElementById("inputKetDigital").value.trim() || "Penjualan Toko";
  var n = parseInt(document.getElementById("inputNominalDigital").value, 10);
  if (metode === "QRIS") state.qrisHariIni += n; else state.transferHariIni += n;
  var w = getWaktu();
  state.riwayat.push({ id: meta.nextId++, waktu: w.jam, timestamp: w.timestamp, kategori: "Toko", ket: ket + " (" + metode + ")", tipe: "MASUK", nominal: n, sumber: metode });
  document.getElementById("inputKetDigital").value = "";
  document.getElementById("inputNominalDigital").value = "";
  commitLocalChange(); tutupModal("modalTransaksiDigital");
}

function handleSaldoManual(e) {
  e.preventDefault();
  var akun = document.getElementById("inputAkunManual").value;
  var aksi = document.getElementById("inputAksiManual").value;
  var ket = document.getElementById("inputKetManual").value.trim() || "Setoran Modal";
  var n = parseInt(document.getElementById("inputNominalManual").value, 10);
  if (akun === "TUNAI") {
    if (aksi === "KURANG" && n > state.saldoTunai) { alert("Saldo Tunai tidak cukup!"); return; }
    state.saldoTunai += aksi === "TAMBAH" ? n : -n;
  } else {
    if (aksi === "KURANG" && n > state.saldoBank) { alert("Saldo Bank tidak cukup!"); return; }
    state.saldoBank += aksi === "TAMBAH" ? n : -n;
  }
  var w = getWaktu();
  state.riwayat.push({ id: meta.nextId++, waktu: w.jam, timestamp: w.timestamp, kategori: "Manual", ket: "[" + (akun === "TUNAI" ? "Tunai" : "Bank") + "] " + ket, tipe: aksi === "TAMBAH" ? "MASUK" : "KELUAR", nominal: n, sumber: "MANUAL_" + akun });
  document.getElementById("inputKetManual").value = "";
  document.getElementById("inputNominalManual").value = "";
  commitLocalChange(); tutupModal("modalSaldoManual");
}

function eksekusiSetorkan() {
  var tt = (state.kasLaciAwal||0)+(state.bersihHariIni||0);
  var tb = (state.qrisHariIni||0)+(state.transferHariIni||0);
  state.saldoTunai += tt; state.saldoBank += tb;
  var w = getWaktu();
  state.riwayat.push({ id: meta.nextId++, waktu: w.jam, timestamp: w.timestamp, kategori: "Setoran", ket: "Tutup Kasir Tunai " + formatRp(tt) + " & Bank " + formatRp(tb), tipe: "TRANSFER", nominal: tt+tb, nominalTunai: tt, nominalBank: tb, sumber: "SETOR" });
  state.kasLaciAwal = 0; state.bersihHariIni = 0; state.qrisHariIni = 0; state.transferHariIni = 0;
  commitLocalChange(); tutupModal("modalSetorkan");
  alert("Penutupan kasir berhasil!");
}

function bukaEditRiwayat(id) {
  var item = state.riwayat.find(function (r) { return r.id === id; });
  if (!item) return;
  document.getElementById("editId").value = id;
  document.getElementById("editKet").value = item.ket;
  document.getElementById("editNominal").value = item.nominal;
  bukaModal("modalEdit");
}

function handleEditRiwayat(e) {
  e.preventDefault();
  var id = parseInt(document.getElementById("editId").value, 10);
  var item = state.riwayat.find(function (r) { return r.id === id; });
  if (!item) return;
  var nn = parseInt(document.getElementById("editNominal").value, 10);
  var nk = document.getElementById("editKet").value;
  terapkanEfek(item, -item.nominal);
  item.nominal = nn; item.ket = nk;
  terapkanEfek(item, item.nominal);
  commitLocalChange(); tutupModal("modalEdit");
}

function hapusRiwayat(id) {
  if (!confirm("Hapus transaksi ini?")) return;
  var idx = state.riwayat.findIndex(function (r) { return r.id === id; });
  if (idx < 0) return;
  terapkanEfek(state.riwayat[idx], -state.riwayat[idx].nominal);
  state.riwayat.splice(idx, 1);
  commitLocalChange();
}

function terapkanEfek(item, nominal) {
  switch (item.sumber) {
    case "KAS_LACI": state.saldoTunai -= nominal; state.kasLaciAwal += nominal; break;
    case "TUNAI_MASUK": state.bersihHariIni += nominal; break;
    case "PENGELUARAN_TUNAI": state.saldoTunai -= nominal; break;
    case "PENGELUARAN_BANK": state.saldoBank -= nominal; break;
    case "QRIS": state.qrisHariIni += nominal; break;
    case "TRANSFER": state.transferHariIni += nominal; break;
    case "MANUAL_TUNAI": state.saldoTunai += item.tipe === "MASUK" ? nominal : -nominal; break;
    case "MANUAL_BANK": state.saldoBank += item.tipe === "MASUK" ? nominal : -nominal; break;
    case "SETOR":
      if (item.nominalTunai != null && item.nominalBank != null && item.nominal) {
        var r = nominal / item.nominal;
        state.saldoTunai += item.nominalTunai * r;
        state.saldoBank += item.nominalBank * r;
      } else state.saldoTunai += nominal;
      break;
  }
}

function renderRekap(periode) {
  document.querySelectorAll(".tab-rekap").forEach(function (b) { b.classList.remove("active","bg-white","shadow","text-blue-700"); b.classList.add("text-slate-500"); });
  var bid = periode === "hari" ? "btnRekapHari" : periode === "minggu" ? "btnRekapMinggu" : "btnRekapBulan";
  var btn = document.getElementById(bid);
  if (btn) { btn.classList.add("active","bg-white","shadow","text-blue-700"); btn.classList.remove("text-slate-500"); }
  var now = new Date(), mulai;
  if (periode === "hari") mulai = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  else if (periode === "minggu") mulai = new Date(now.getTime() - 7*864e5);
  else mulai = new Date(now.getFullYear(), now.getMonth(), 1);
  var f = (state.riwayat||[]).filter(function (r) { return r.timestamp >= mulai.getTime() && r.sumber !== "SETOR" && r.sumber !== "KAS_LACI"; });
  var masuk = f.filter(function (r) { return r.tipe === "MASUK"; }).reduce(function (s,r) { return s+r.nominal; }, 0);
  var keluar = f.filter(function (r) { return r.tipe === "KELUAR"; }).reduce(function (s,r) { return s+r.nominal; }, 0);
  setT("rekapMasuk", formatRp(masuk)); setT("rekapKeluar", formatRp(keluar)); setT("rekapSisa", formatRp(masuk-keluar));
  if (chartInstance) chartInstance.destroy();
  var ctx = document.getElementById("chartRekap");
  if (!ctx || typeof Chart === "undefined") return;
  chartInstance = new Chart(ctx.getContext("2d"), {
    type: "doughnut",
    data: { labels: ["Pemasukan","Pengeluaran"], datasets: [{ data: [masuk||0.001, keluar||0.001], backgroundColor: ["#2563eb","#dc2626"], borderWidth: 3, borderColor: "#fff" }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }
  });
}

function tambahKategoriBaru() {
  var nama = prompt("Nama kategori baru:");
  if (nama && nama.trim()) {
    state.kategoriPengeluaran.push(nama.trim());
    commitLocalChange();
    document.getElementById("inputKategoriTunai").value = nama.trim();
  }
}
function toggleKategoriTunai() {
  document.getElementById("containerKategoriTunai").classList.toggle("hidden", document.getElementById("inputJenisTunai").value !== "KELUAR");
}
function backupData() {
  var blob = new Blob([JSON.stringify({ state: state, meta: meta }, null, 2)], { type: "application/json" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "backup-garasi-" + new Date().toISOString().slice(0,10) + ".json";
  a.click();
}
function restoreData(ev) {
  var f = ev.target.files && ev.target.files[0]; if (!f) return;
  if (!confirm("Ganti data dengan file ini?")) return;
  var r = new FileReader();
  r.onload = function (e) {
    try {
      var p = JSON.parse(e.target.result);
      if (p.state) state = Object.assign(state, p.state);
      if (p.meta) meta = Object.assign(meta, p.meta);
      meta.isDirty = true;
      commitLocalChange();
      tutupModal("modalSetelan");
      alert("Restore berhasil!");
    } catch (err) { alert("File tidak valid"); }
  };
  r.readAsText(f);
}
function resetAplikasi() {
  if (!confirm("Hapus SEMUA data lokal & cloud?")) return;
  if (!confirm("Yakin sekali lagi?")) return;
  state = { saldoTunai:0,saldoBank:0,kasLaciAwal:0,bersihHariIni:0,qrisHariIni:0,transferHariIni:0,
    kategoriPengeluaran:["Paket COD","Paket TF","Belanja Felik","Belanja Yuni","Belanja Gibran","Belanja Toko","Operasional","Lain-lain"], riwayat:[] };
  meta = { nextId: 1, isDirty: true, lastUpdated: Date.now() };
  commitLocalChange();
  location.reload();
}

document.getElementById("currentDateDisplay").textContent = new Date().toLocaleDateString("id-ID", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () { navigator.serviceWorker.register("./sw.js").catch(function(){}); });
}
