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

const STORAGE_KEY = 'GARASI_FOTOCOPY_DATA_V400';
let db = null, dbRef = null, isConnectedToCloud = false, chartInstance = null;

let state = {
    saldoTunai: 0, saldoBank: 0, kasLaciAwal: 0, bersihHariIni: 0, qrisHariIni: 0, transferHariIni: 0,
    kategoriPengeluaran: ['Paket COD', 'Paket TF', 'Belanja Felik', 'Belanja Yuni', 'Belanja Gibran', 'Belanja Toko', 'Operasional', 'Lain-lain'],
    riwayat: [],
    targets: [] // Array untuk Target Impian Baru
};

let meta = { nextId: 1, isDirty: false, lastUpdated: Date.now() };

// MUAT DATA LOKAL DULU
muatLokal();

function muatLokal() {
    const localData = localStorage.getItem(STORAGE_KEY);
    if (localData) {
        try {
            const parsed = JSON.parse(localData);
            if (parsed.state) state = Object.assign(state, parsed.state);
            if (parsed.meta) meta = Object.assign(meta, parsed.meta);
            if (!Array.isArray(state.riwayat)) state.riwayat = [];
            if (!Array.isArray(state.targets)) state.targets = []; // Handle old data without targets array
        } catch(err) {}
    }
}

function simpanLokal() { localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, meta })); }

function commitLocalChange() {
    meta.isDirty = true;
    meta.lastUpdated = Date.now();
    simpanLokal();
    renderSemua();
    
    if (isConnectedToCloud) syncUpData();
    else updateStatus('offline');
}

function syncUpData() {
    if (!dbRef || !isConnectedToCloud) return;
    updateStatus('saving');
    
    dbRef.set({ state: state, nextId: meta.nextId, lastUpdated: meta.lastUpdated }).then(() => {
        meta.isDirty = false; simpanLokal(); updateStatus('cloud');
    }).catch(() => { updateStatus('offline'); });
}

try {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        dbRef = db.ref('keuangan_garasi_fotocopy');
        
        db.ref(".info/connected").on("value", (snap) => {
            if (snap.val() === true) {
                isConnectedToCloud = true;
                if (meta.isDirty) syncUpData(); else updateStatus('cloud');
            } else {
                isConnectedToCloud = false; updateStatus('offline');
            }
        });

        dbRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data && data.state) {
                if (!meta.isDirty) {
                    state = Object.assign(state, data.state);
                    if (!Array.isArray(state.riwayat)) state.riwayat = [];
                    if (!Array.isArray(state.targets)) state.targets = [];
                    meta.nextId = data.nextId || meta.nextId;
                    meta.lastUpdated = data.lastUpdated || Date.now();
                    simpanLokal(); renderSemua();
                    // Jika modal target sedang buka, rerender
                    if(!document.getElementById('modalTargetLuar').classList.contains('hidden')) renderDaftarTarget();
                }
            }
        });
    } else { updateStatus('offline'); }
} catch (e) { updateStatus('offline'); }

window.addEventListener('online', () => { if (meta.isDirty && isConnectedToCloud) syncUpData(); });
window.addEventListener('offline', () => { isConnectedToCloud = false; updateStatus('offline'); });

function updateStatus(tipe) {
    const statusEl = document.getElementById('syncStatus');
    if (!statusEl) return;
    if (tipe === 'cloud') {
        statusEl.innerHTML = '<i class="fa-solid fa-circle text-[7px] animate-pulse"></i> Online';
        statusEl.className = 'text-[9px] px-2 py-0.5 rounded-full bg-emerald-500 text-white flex items-center gap-1 shadow-sm font-semibold';
    } else if (tipe === 'saving') {
        statusEl.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> Menyinkronkan...';
        statusEl.className = 'text-[9px] px-2 py-0.5 rounded-full bg-amber-500 text-white flex items-center gap-1 shadow-sm font-semibold';
    } else {
        statusEl.innerHTML = '<i class="fa-solid fa-circle text-[7px]"></i> Offline';
        statusEl.className = 'text-[9px] px-2 py-0.5 rounded-full bg-slate-500 text-white flex items-center gap-1 shadow-sm font-semibold';
    }
}

function formatRp(angka) {
    const n = Number(angka) || 0;
    const formatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Math.abs(n));
    return n < 0 ? `-${formatted}` : formatted;
}

function getWaktuLengkap() {
    const now = new Date();
    return { jam: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), timestamp: now.getTime() };
}

function updateTanggal() {
    const el = document.getElementById('currentDateDisplay');
    if (el) el.textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function renderSemua() {
    const saldoUtama = (state.saldoTunai || 0) + (state.saldoBank || 0) + (state.kasLaciAwal || 0) + (state.bersihHariIni || 0) + (state.qrisHariIni || 0) + (state.transferHariIni || 0);
    setElText('valSaldoUtama', formatRp(saldoUtama));
    setElText('valSaldoTunai', formatRp(state.saldoTunai));
    setElText('valSaldoBank', formatRp(state.saldoBank));
    setElText('valKasLaciAwal', formatRp(state.kasLaciAwal));
    setElText('valBersihHariIni', formatRp(state.bersihHariIni));
    setElText('valQrisHariIni', formatRp(state.qrisHariIni));
    setElText('valTransferHariIni', formatRp(state.transferHariIni));

    const subtotalTunai = (state.kasLaciAwal || 0) + (state.bersihHariIni || 0);
    const subtotalBank = (state.qrisHariIni || 0) + (state.transferHariIni || 0);
    setElText('setorKasLaci', formatRp(state.kasLaciAwal));
    setElText('setorBersih', formatRp(state.bersihHariIni));
    setElText('setorTunaiTotal', formatRp(subtotalTunai));
    setElText('setorQris', formatRp(state.qrisHariIni));
    setElText('setorTransfer', formatRp(state.transferHariIni));
    setElText('setorBankTotal', formatRp(subtotalBank));
    setElText('setorTotal', formatRp(subtotalTunai + subtotalBank));
    setElText('totalTransaksi', `${state.riwayat ? state.riwayat.length : 0} transaksi`);
    
    renderRiwayat();
    renderKategoriDropdown();
}

function setElText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

function renderKategoriDropdown() {
    const sel = document.getElementById('inputKategoriTunai'); if (!sel) return; sel.innerHTML = '';
    (state.kategoriPengeluaran || []).forEach(k => { const opt = document.createElement('option'); opt.value = k; opt.textContent = k; sel.appendChild(opt); });
}

function renderRiwayat() {
    const tbody = document.getElementById('tbodyRiwayat'); if (!tbody) return; tbody.innerHTML = '';
    if (!state.riwayat || state.riwayat.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-slate-400 font-medium">Belum ada transaksi</td></tr>'; return; }
    state.riwayat.slice().reverse().forEach(item => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-blue-50 transition border-b border-slate-50 last:border-0";
        let badge = item.tipe === 'MASUK' ? `<span class="text-emerald-600 font-bold">+${formatRp(item.nominal)}</span>` : 
                    item.tipe === 'KELUAR' ? `<span class="text-rose-600 font-bold">-${formatRp(item.nominal)}</span>` : 
                    `<span class="text-slate-700 font-bold">${formatRp(item.nominal)}</span>`;
        
        tr.innerHTML = `<td class="py-3 px-4 font-mono text-slate-500 text-[11px]">${item.waktu}</td>
                        <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-700 border border-slate-300">${item.kategori}</span></td>
                        <td class="py-3 px-4 font-medium text-slate-800">${item.ket || ''}</td>
                        <td class="py-3 px-4 text-right">${badge}</td>
                        <td class="py-3 px-4 text-center whitespace-nowrap">
                            <button type="button" onclick="bukaEditRiwayat(${item.id})" class="text-blue-600 hover:bg-blue-100 w-7 h-7 rounded"><i class="fa-solid fa-pen text-xs"></i></button>
                            <button type="button" onclick="hapusRiwayat(${item.id})" class="text-rose-600 hover:bg-rose-100 w-7 h-7 rounded"><i class="fa-solid fa-trash text-xs"></i></button>
                        </td>`;
        tbody.appendChild(tr);
    });
}

function bukaModal(id) {
    const m = document.getElementById(id); if (!m) return; m.classList.remove('hidden'); m.classList.add('flex');
    if (id === 'modalTransaksiTunai') toggleKategoriTunai();
}
function tutupModal(id) {
    const m = document.getElementById(id); if (!m) return; m.classList.add('hidden'); m.classList.remove('flex');
}

// ---------------- TRANSAKSI HANDLERS ---------------- //
window.handleKasLaciAwal = function(e) {
    e.preventDefault(); const nominal = parseInt(document.getElementById('inputKasLaci').value, 10);
    if (nominal > state.saldoTunai) { alert('Saldo Tunai tidak cukup!'); return false; }
    state.saldoTunai -= nominal; state.kasLaciAwal += nominal; const w = getWaktuLengkap();
    if (!state.riwayat) state.riwayat = [];
    state.riwayat.push({ id: meta.nextId++, waktu: w.jam, timestamp: w.timestamp, kategori: 'Kas Laci', ket: 'Ambil Kas Laci Awal', tipe: 'KELUAR', nominal, sumber: 'KAS_LACI' });
    document.getElementById('inputKasLaci').value = ''; commitLocalChange(); tutupModal('modalKasLaci'); return false;
};

window.handleTransaksiTunai = function(e) {
    e.preventDefault();
    const jenis = document.getElementById('inputJenisTunai').value; let ket = document.getElementById('inputKetTunai').value.trim();
    const nominal = parseInt(document.getElementById('inputNominalTunai').value, 10);
    let kategori = 'Toko', idSumber = '';

    if (jenis === 'MASUK') {
        if (!ket) ket = 'Penjualan Toko'; state.bersihHariIni += nominal; idSumber = 'TUNAI_MASUK';
    } else {
        kategori = document.getElementById('inputKategoriTunai').value || 'Lain-lain'; const sumberDana = document.getElementById('inputSumberDanaTunai').value;
        if (!ket) ket = kategori;
        if (sumberDana === 'TUNAI') {
            if (nominal > state.saldoTunai) { alert('Saldo Tunai tidak cukup!'); return false; }
            state.saldoTunai -= nominal; idSumber = 'PENGELUARAN_TUNAI'; ket = `${ket} (Potong Tunai)`;
        } else {
            if (nominal > state.saldoBank) { alert('Saldo Bank tidak cukup!'); return false; }
            state.saldoBank -= nominal; idSumber = 'PENGELUARAN_BANK'; ket = `${ket} (Potong Rekening)`;
        }
    }
    const w = getWaktuLengkap(); if (!state.riwayat) state.riwayat = [];
    state.riwayat.push({ id: meta.nextId++, waktu: w.jam, timestamp: w.timestamp, kategori, ket, tipe: jenis, nominal, sumber: idSumber });
    document.getElementById('inputKetTunai').value = ''; document.getElementById('inputNominalTunai').value = ''; commitLocalChange(); tutupModal('modalTransaksiTunai'); return false;
};

window.handleTransaksiDigital = function(e) {
    e.preventDefault(); const metode = document.getElementById('inputMetodeDigital').value; let ket = document.getElementById('inputKetDigital').value.trim(); const nominal = parseInt(document.getElementById('inputNominalDigital').value, 10);
    if (!ket) ket = 'Penjualan Toko';
    if (metode === 'QRIS') state.qrisHariIni += nominal; else state.transferHariIni += nominal;
    const w = getWaktuLengkap(); if (!state.riwayat) state.riwayat = [];
    state.riwayat.push({ id: meta.nextId++, waktu: w.jam, timestamp: w.timestamp, kategori: 'Toko', ket: `${ket} (${metode})`, tipe: 'MASUK', nominal, sumber: metode });
    document.getElementById('inputKetDigital').value = ''; document.getElementById('inputNominalDigital').value = ''; commitLocalChange(); tutupModal('modalTransaksiDigital'); return false;
};

window.handleSaldoManual = function(e) {
    e.preventDefault(); const akun = document.getElementById('inputAkunManual').value; const aksi = document.getElementById('inputAksiManual').value; let ket = document.getElementById('inputKetManual').value.trim(); const nominal = parseInt(document.getElementById('inputNominalManual').value, 10);
    if (!ket) ket = 'Setoran Modal';
    if (akun === 'TUNAI') {
        if (aksi === 'KURANG' && nominal > state.saldoTunai) { alert('Saldo Tunai tidak cukup!'); return false; } state.saldoTunai += (aksi === 'TAMBAH' ? nominal : -nominal);
    } else {
        if (aksi === 'KURANG' && nominal > state.saldoBank) { alert('Saldo Bank tidak cukup!'); return false; } state.saldoBank += (aksi === 'TAMBAH' ? nominal : -nominal);
    }
    const w = getWaktuLengkap(); if (!state.riwayat) state.riwayat = [];
    state.riwayat.push({ id: meta.nextId++, waktu: w.jam, timestamp: w.timestamp, kategori: 'Manual', ket: `[${akun === 'TUNAI' ? 'Tunai' : 'Bank'}] ${ket}`, tipe: aksi === 'TAMBAH' ? 'MASUK' : 'KELUAR', nominal, sumber: 'MANUAL_' + akun });
    document.getElementById('inputKetManual').value = ''; document.getElementById('inputNominalManual').value = ''; commitLocalChange(); tutupModal('modalSaldoManual'); return false;
};

window.eksekusiSetorkan = function() {
    const totalTunaiSetor = (state.kasLaciAwal || 0) + (state.bersihHariIni || 0); const totalBankSetor = (state.qrisHariIni || 0) + (state.transferHariIni || 0);
    state.saldoTunai += totalTunaiSetor; state.saldoBank += totalBankSetor;
    const totalSetoran = totalTunaiSetor + totalBankSetor; const w = getWaktuLengkap();
    if (!state.riwayat) state.riwayat = [];
    state.riwayat.push({ id: meta.nextId++, waktu: w.jam, timestamp: w.timestamp, kategori: 'Setoran', ket: `Tutup Kasir: Setor Tunai (${formatRp(totalTunaiSetor)}) & Bank (${formatRp(totalBankSetor)})`, tipe: 'TRANSFER', nominal: totalSetoran, nominalTunai: totalTunaiSetor, nominalBank: totalBankSetor, sumber: 'SETOR' });
    state.kasLaciAwal = 0; state.bersihHariIni = 0; state.qrisHariIni = 0; state.transferHariIni = 0;
    commitLocalChange(); tutupModal('modalSetorkan'); alert('✅ Penutupan kasir berhasil!');
};

// ---------------- EDIT & HAPUS ---------------- //
window.bukaEditRiwayat = function(id) {
    const item = state.riwayat.find(r => r.id === id); if (!item) return;
    document.getElementById('editId').value = id; document.getElementById('editKet').value = item.ket; document.getElementById('editNominal').value = item.nominal; bukaModal('modalEdit');
};
window.handleEditRiwayat = function(e) {
    e.preventDefault(); const id = parseInt(document.getElementById('editId').value, 10); const newKet = document.getElementById('editKet').value; const newNominal = parseInt(document.getElementById('editNominal').value, 10);
    const item = state.riwayat.find(r => r.id === id); if (!item) return false;
    terapkanEfekSaldo(item, -item.nominal); item.nominal = newNominal; item.ket = newKet; terapkanEfekSaldo(item, item.nominal);
    commitLocalChange(); tutupModal('modalEdit'); return false;
};
window.hapusRiwayat = function(id) {
    if (!confirm('Hapus transaksi ini? Saldo terkait akan menyesuaikan.')) return;
    const idx = state.riwayat.findIndex(r => r.id === id); if (idx === -1) return;
    terapkanEfekSaldo(state.riwayat[idx], -state.riwayat[idx].nominal); state.riwayat.splice(idx, 1); commitLocalChange();
};
function terapkanEfekSaldo(item, nominal) {
    switch(item.sumber) {
        case 'KAS_LACI': state.saldoTunai -= nominal; state.kasLaciAwal += nominal; break;
        case 'TUNAI_MASUK': state.bersihHariIni += nominal; break;
        case 'PENGELUARAN_TUNAI': state.saldoTunai -= nominal; break;
        case 'PENGELUARAN_BANK': state.saldoBank -= nominal; break;
        case 'QRIS': state.qrisHariIni += nominal; break;
        case 'TRANSFER': state.transferHariIni += nominal; break;
        case 'MANUAL_TUNAI': state.saldoTunai += (item.tipe === 'MASUK' ? nominal : -nominal); break;
        case 'MANUAL_BANK': state.saldoBank += (item.tipe === 'MASUK' ? nominal : -nominal); break;
        case 'TARGET_TUNAI': state.saldoTunai -= nominal; break; // Refund jika dihapus
        case 'TARGET_BANK': state.saldoBank -= nominal; break;
        case 'SETOR':
            if (item.nominalTunai !== undefined && item.nominalBank !== undefined) { const ratio = item.nominal > 0 ? (nominal / item.nominal) : 1; state.saldoTunai += item.nominalTunai * ratio; state.saldoBank += item.nominalBank * ratio; } 
            else { state.saldoTunai += nominal; }
            break;
    }
}

// ---------------- TARGET IMPIAN (BARU) ---------------- //
window.renderDaftarTarget = function() {
    const container = document.getElementById('listTargetContainer');
    if (!state.targets || state.targets.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-slate-400 text-sm"><i class="fa-solid fa-bullseye text-4xl mb-3 text-slate-300"></i><p>Belum ada target dibuat.</p></div>';
        return;
    }
    let html = '';
    const now = new Date();
    
    state.targets.forEach(t => {
        // Hitung deadline & sisa waktu
        const created = new Date(t.tanggalDibuat);
        let deadline = new Date(created);
        if(t.durasiSatuan === 'HARI') deadline.setDate(deadline.getDate() + t.durasiAngka);
        else deadline.setMonth(deadline.getMonth() + t.durasiAngka);

        const diffTime = Math.max(0, deadline - now);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        let strWaktu = diffDays > 0 ? `${diffDays} Hari` : 'Jatuh Tempo/Selesai';
        
        // Hitung persentase & saran sisihkan harian
        let percent = Math.min(100, (t.terkumpul / t.targetNominal) * 100);
        let sisaNominal = Math.max(0, t.targetNominal - t.terkumpul);
        let saranSisih = diffDays > 0 ? (sisaNominal / diffDays) : sisaNominal;

        html += `
        <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-3 relative overflow-hidden">
            ${percent === 100 ? '<div class="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-bold px-3 py-1 rounded-bl-lg">TERCAPAI</div>' : ''}
            <div class="flex justify-between items-start mb-2">
                <div class="pr-6">
                    <span class="text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase font-bold">${t.jenis}</span>
                    <h4 class="font-bold text-sm mt-1.5 text-slate-800 leading-tight">${t.nama}</h4>
                </div>
                <button onclick="hapusTarget(${t.id})" class="text-rose-500 text-xs hover:bg-rose-50 p-1.5 rounded transition"><i class="fa-solid fa-trash"></i></button>
            </div>
            
            <div class="text-[11px] mb-2 font-medium">
                <span class="text-slate-500">Terkumpul: </span>
                <strong class="text-emerald-600 text-sm">${formatRp(t.terkumpul)}</strong>
                <span class="text-slate-400"> dari ${formatRp(t.targetNominal)}</span>
            </div>
            
            <div class="w-full bg-slate-100 rounded-full h-2 mb-3 border border-slate-200">
                <div class="bg-gradient-to-r from-emerald-400 to-emerald-500 h-2 rounded-full" style="width: ${percent}%"></div>
            </div>
            
            <div class="grid grid-cols-2 gap-2 text-[10px] bg-slate-50 p-2.5 rounded-lg border border-slate-100 mb-3">
                <div><span class="text-slate-400 block mb-0.5">Sisa Waktu:</span><strong class="text-slate-700">${strWaktu}</strong></div>
                <div><span class="text-slate-400 block mb-0.5">Sisihkan:</span><strong class="text-amber-600">${formatRp(saranSisih)} /hari</strong></div>
            </div>
            
            ${percent < 100 ? `<button onclick="bukaModalIsiTarget(${t.id}, '${t.nama}')" class="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition"><i class="fa-solid fa-coins mr-1"></i> Isi Saldo Target</button>` : `<button disabled class="w-full py-2 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold"><i class="fa-solid fa-check-circle mr-1"></i> Target Selesai!</button>`}
        </div>`;
    });
    container.innerHTML = html;
};

window.handleTambahTarget = function(e) {
    e.preventDefault();
    const nama = document.getElementById('tTargetNama').value.trim();
    const jenis = document.getElementById('tTargetJenis').value.trim();
    const nominal = parseInt(document.getElementById('tTargetNominal').value, 10);
    const durasiAngka = parseInt(document.getElementById('tTargetDurasiAngka').value, 10);
    const durasiSatuan = document.getElementById('tTargetDurasiSatuan').value;
    
    if(!state.targets) state.targets = [];
    state.targets.push({
        id: meta.nextId++,
        nama: nama,
        jenis: jenis,
        targetNominal: nominal,
        terkumpul: 0,
        durasiAngka: durasiAngka,
        durasiSatuan: durasiSatuan,
        tanggalDibuat: Date.now()
    });
    
    document.getElementById('tTargetNama').value = '';
    document.getElementById('tTargetJenis').value = '';
    document.getElementById('tTargetNominal').value = '';
    document.getElementById('tTargetDurasiAngka').value = '';
    
    commitLocalChange();
    tutupModal('modalTambahTarget');
    renderDaftarTarget();
};

window.bukaModalIsiTarget = function(id, nama) {
    document.getElementById('iTargetId').value = id;
    document.getElementById('infoIsiTargetNama').innerText = "Target: " + nama;
    bukaModal('modalIsiTarget');
};

window.handleIsiTarget = function(e) {
    e.preventDefault();
    const id = parseInt(document.getElementById('iTargetId').value, 10);
    const sumber = document.getElementById('iTargetSumber').value;
    const nominal = parseInt(document.getElementById('iTargetNominal').value, 10);
    
    const targetIdx = state.targets.findIndex(t => t.id === id);
    if(targetIdx === -1) return false;
    
    // Validasi Saldo
    if(sumber === 'TUNAI' && nominal > state.saldoTunai) { alert('Saldo Tunai Tidak Cukup!'); return false; }
    if(sumber === 'BANK' && nominal > state.saldoBank) { alert('Saldo Bank Tidak Cukup!'); return false; }
    
    // Potong Saldo
    if(sumber === 'TUNAI') state.saldoTunai -= nominal;
    else state.saldoBank -= nominal;
    
    // Tambah Terkumpul
    state.targets[targetIdx].terkumpul += nominal;
    
    // Catat Riwayat
    const w = getWaktuLengkap();
    state.riwayat.push({ 
        id: meta.nextId++, waktu: w.jam, timestamp: w.timestamp, 
        kategori: 'Setor Target', ket: `Isi Saldo Target: ${state.targets[targetIdx].nama}`, 
        tipe: 'KELUAR', nominal, sumber: `TARGET_${sumber}` 
    });
    
    document.getElementById('iTargetNominal').value = '';
    commitLocalChange();
    tutupModal('modalIsiTarget');
    renderDaftarTarget();
    return false;
};

window.hapusTarget = function(id) {
    if(!confirm("Yakin ingin menghapus target ini? (Uang yang terkumpul akan dikembalikan ke Saldo Tunai agar tidak hilang).")) return;
    
    const idx = state.targets.findIndex(t => t.id === id);
    if(idx === -1) return;
    
    const target = state.targets[idx];
    if(target.terkumpul > 0) {
        // Kembalikan dana ke tunai
        state.saldoTunai += target.terkumpul;
        const w = getWaktuLengkap();
        state.riwayat.push({ 
            id: meta.nextId++, waktu: w.jam, timestamp: w.timestamp, 
            kategori: 'Refund Target', ket: `Pembatalan/Hapus Target: ${target.nama}`, 
            tipe: 'MASUK', nominal: target.terkumpul, sumber: 'REFUND_TARGET' 
        });
    }
    
    state.targets.splice(idx, 1);
    commitLocalChange();
    renderDaftarTarget();
};

// ---------------- REKAP & LAINNYA ---------------- //
window.renderRekap = function(periode) {
    document.querySelectorAll('.tab-rekap').forEach(b => { b.classList.remove('active', 'bg-white', 'shadow', 'text-blue-700'); b.classList.add('text-slate-500'); });
    const btn = document.getElementById('btnRekap' + (periode === 'hari' ? 'Hari' : periode === 'minggu' ? 'Minggu' : 'Bulan'));
    if (btn) { btn.classList.add('active', 'bg-white', 'shadow', 'text-blue-700'); btn.classList.remove('text-slate-500'); }
    
    const now = new Date(); let mulai;
    if (periode === 'hari') mulai = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    else if (periode === 'minggu') mulai = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else mulai = new Date(now.getFullYear(), now.getMonth(), 1);

    const filtered = (state.riwayat || []).filter(r => r.timestamp >= mulai.getTime() && r.sumber !== 'SETOR' && r.sumber !== 'KAS_LACI' && r.sumber !== 'REFUND_TARGET');
    const totalMasuk = filtered.filter(r => r.tipe === 'MASUK').reduce((s, r) => s + r.nominal, 0);
    const totalKeluar = filtered.filter(r => r.tipe === 'KELUAR').reduce((s, r) => s + r.nominal, 0);

    setElText('rekapMasuk', formatRp(totalMasuk));
    setElText('rekapKeluar', formatRp(totalKeluar));
    setElText('rekapSisa', formatRp(totalMasuk - totalKeluar));

    if (chartInstance) chartInstance.destroy();
    const ctx = document.getElementById('chartRekap').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['Pemasukan', 'Pengeluaran'], datasets: [{ data: [totalMasuk || 0.001, totalKeluar || 0.001], backgroundColor: ['#2563eb', '#dc2626'], borderWidth: 3, borderColor: '#fff' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
};

window.tambahKategoriBaru = function(target) {
    const nama = prompt('Masukkan nama kategori pengeluaran baru:');
    if (nama && nama.trim()) { state.kategoriPengeluaran.push(nama.trim()); commitLocalChange(); renderKategoriDropdown(); document.getElementById('inputKategoriTunai').value = nama.trim(); }
};
window.toggleKategoriTunai = function() {
    const isKeluar = document.getElementById('inputJenisTunai').value === 'KELUAR'; document.getElementById('containerKategoriTunai').classList.toggle('hidden', !isKeluar);
};
window.backupData = function() {
    const dataStr = JSON.stringify({ state, meta }, null, 2); const blob = new Blob([dataStr], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `backup-garasi-fotocopy-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href); alert('✅ Backup berhasil diunduh!');
};
window.restoreData = function(event) {
    const file = event.target.files[0]; if (!file) return;
    if (!confirm('Data saat ini akan diganti dengan data dari file. Lanjutkan?')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = JSON.parse(e.target.result);
            if (parsed.state) state = Object.assign(state, parsed.state);
            if (parsed.meta) meta = Object.assign(meta, parsed.meta);
            commitLocalChange(); tutupModal('modalSetelan'); alert('✅ Data berhasil dipulihkan!');
        } catch (err) { alert('❌ File tidak valid!'); }
    }; reader.readAsText(file);
};
window.resetAplikasi = function() {
    if (!confirm('⚠️ SEMUA data di HP ini dan Cloud Firebase akan dihapus. Yakin?')) return;
    if (!confirm('Konfirmasi sekali lagi: HAPUS SEMUA DATA?')) return;
    localStorage.removeItem(STORAGE_KEY);
    state = { saldoTunai: 0, saldoBank: 0, kasLaciAwal: 0, bersihHariIni: 0, qrisHariIni: 0, transferHariIni: 0, kategoriPengeluaran: ['Paket COD', 'Paket TF', 'Belanja Felik', 'Belanja Yuni', 'Belanja Gibran', 'Belanja Toko', 'Operasional', 'Lain-lain'], riwayat: [], targets: [] };
    meta = { nextId: 1, isDirty: true, lastUpdated: Date.now() }; commitLocalChange(); location.reload();
};

window.onload = function() {
    updateTanggal(); renderSemua();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
};