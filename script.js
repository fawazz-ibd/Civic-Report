const SUPABASE_URL = "https://wacxrbdxwoaucufdzmks.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_wNCSj9O0AlSTgVeOmzg_bw_n-39DK9T";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let activeCategory = "";

// Konfigurasi Password Admin
const ADMIN_PASSWORD = "FawazNoyaRayhan61418"; 

function isAdminLoggedIn() {
    return localStorage.getItem('isAdminAuth') === 'true';
}

function isUserLoggedIn() {
    return localStorage.getItem('isUserAuth') === 'true';
}

function getCurrentUser() {
    return JSON.parse(localStorage.getItem('userData')) || null;
}

function escapeHTML(text) {
    return String(text || "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
}

// ==========================================
// 1. OPERASI DATABASE & RENDER LAPORAN
// ==========================================
async function renderReports() {
    const list = document.getElementById("reportList");
    if (!list) return;

    list.innerHTML = '<div class="empty">🔄 Memuat laporan...</div>';

    const queryText = document.getElementById("search")?.value.toLowerCase().trim() || "";

    let query = supabaseClient.from('reports').select('*').order('created_at', { ascending: false });

    if (activeCategory) {
        query = query.eq('category', activeCategory);
    }

    const { data: reports, error } = await query;

    if (error) {
        console.error("Gagal mengambil data:", error);
        list.innerHTML = '<div class="empty">❌ Gagal memuat data dari database.</div>';
        return;
    }

    const filtered = reports.filter(r => 
        (r.title + " " + r.location + " " + r.description).toLowerCase().includes(queryText)
    );

    if (filtered.length === 0) {
        list.innerHTML = '<div class="empty">Laporan tidak ditemukan.</div>';
    } else {
        list.innerHTML = filtered.map(r => {
            const isDone = r.status === "Selesai";
            
            let deleteButtonHTML = "";
            if (isAdminLoggedIn()) {
                deleteButtonHTML = `
                    <button type="button" onclick="hapusLaporan(${r.id})" style="cursor: pointer; background: #ffebee; border: 1px solid #f44336; color: #c62828; border-radius: 4px; padding: 4px 10px; font-size: 12px; font-weight: bold;">
                        🗑️ Hapus Laporan
                    </button>
                `;
            }

            return `
            <article class="report" style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                <h3>${escapeHTML(r.title)}</h3>
                <small>📍 ${escapeHTML(r.location)}</small><br>
                <small>📅 ${escapeHTML(r.date)} · ${escapeHTML(r.category)}</small>
                <p style="margin-top: 8px;">${escapeHTML(r.description)}</p>

                <div style="margin-top: 10px; display: flex; gap: 8px; align-items: center; justify-content: space-between; flex-wrap: wrap;">
                    <span class="status ${isDone ? "selesai" : ""}">${escapeHTML(r.status)}</span>
                    <select onchange="gantiStatusLaporan(${r.id}, this.value)" style="font-size: 12px; padding: 2px 5px;">
                        <option value="" disabled selected>⚙️ Ubah Status</option>
                        <option value="Menunggu">Menunggu</option>
                        <option value="Dalam Proses">Dalam Proses</option>
                        <option value="Selesai">Selesai</option>
                    </select>
                </div>

                <hr style="margin: 12px 0; border: none; border-top: 1px solid #eee;">

                <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap; margin-bottom: 10px;">
                    <button type="button" onclick="dukungLaporan(${r.id}, ${r.upvotes || 0})" style="cursor: pointer; background: #e3f2fd; border: 1px solid #2196f3; color: #1976d2; border-radius: 4px; padding: 4px 10px; font-size: 12px;">
                        👍 Dukung Laporan (${r.upvotes || 0})
                    </button>
                    ${deleteButtonHTML}
                </div>

                ${isDone ? `
                    <div style="background: #fff8e1; padding: 8px; border-radius: 6px; font-size: 13px;">
                        <strong>⭐ Rating Pengerjaan:</strong> 
                        ${r.rating ? `<b>${r.rating}/5 Bintang</b>` : `
                            <select onchange="beriRating(${r.id}, this.value)" style="font-size: 12px; margin-left: 5px;">
                                <option value="" disabled selected>Beri Rating</option>
                                <option value="5">⭐⭐⭐⭐⭐ (Sangat Puas)</option>
                                <option value="4">⭐⭐⭐⭐ (Puas)</option>
                                <option value="3">⭐⭐⭐ (Cukup)</option>
                                <option value="2">⭐⭐ (Kurang)</option>
                                <option value="1">⭐ (Buruk)</option>
                            </select>
                        `}
                    </div>
                ` : ""}
            </article>
        `;
        }).join("");
    }

    updateStats(reports);
}

function updateStats(reports) {
    document.getElementById("total").textContent = reports.length;
    document.getElementById("process").textContent = reports.filter(r => r.status === "Dalam Proses").length;
    document.getElementById("done").textContent = reports.filter(r => r.status === "Selesai").length;
}

// ==========================================
// 2. TAMBAH LAPORAN BARU (SENSOR KATA KASAR)
// ==========================================
const badWords = ['anjing', 'babi', 'bangsat', 'kontol', 'memek', 'tai', 'asu', 'kampret', 'goblok', 'tolol', 'bego', 'pantek', 'peler', 'pepek', 'bajingan'];

const submitBtnEl = document.getElementById("submitBtn");
if (submitBtnEl) {
    submitBtnEl.onclick = async function(e) {
        e.preventDefault();

        const title = document.getElementById("title").value.trim();
        const desc = document.getElementById("description").value.trim();
        const loc = document.getElementById("location").value.trim();
        const cat = document.getElementById("category").value;

        if (!title || !loc || !desc || !cat) {
            alert("Harap isi semua kolom dengan lengkap!");
            return;
        }

        const textAwal = submitBtnEl.textContent;
        submitBtnEl.textContent = "⏳ Memverifikasi laporan...";
        submitBtnEl.disabled = true;

        setTimeout(async () => {
            const gabunganTeks = (title + " " + desc + " " + loc).toLowerCase();
            const kenaSensor = badWords.some(kata => gabunganTeks.includes(kata));

            if (kenaSensor) {
                alert("⚠️ LAPORAN DITOLAK!\n\nLaporan Anda mengandung kata-kata yang tidak sopan.");
                submitBtnEl.textContent = textAwal;
                submitBtnEl.disabled = false;
                return;
            }

            const { error } = await supabaseClient.from('reports').insert([
                {
                    title: title,
                    category: cat,
                    location: loc,
                    description: desc,
                    status: "Menunggu",
                    date: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
                    upvotes: 0,
                    rating: 0
                }
            ]);

            submitBtnEl.textContent = textAwal;
            submitBtnEl.disabled = false;

            if (error) {
                alert("Gagal menyimpan laporan: " + error.message);
            } else {
                document.getElementById("title").value = "";
                document.getElementById("description").value = "";
                document.getElementById("location").value = "";
                document.getElementById("category").value = "";
                modal.classList.remove("show");

                alert("Laporan berhasil ditambahkan!");
                renderReports();
            }
        }, 1200);
    };
}

// ==========================================
// 3. FITUR INTERAKSI
// ==========================================
async function dukungLaporan(id, currentUpvotes) {
    const { error } = await supabaseClient
        .from('reports')
        .update({ upvotes: currentUpvotes + 1 })
        .eq('id', id);

    if (!error) renderReports();
}

async function gantiStatusLaporan(id, statusBaru) {
    const { error } = await supabaseClient
        .from('reports')
        .update({ status: statusBaru })
        .eq('id', id);

    if (!error) renderReports();
}

async function beriRating(id, nilai) {
    const { error } = await supabaseClient
        .from('reports')
        .update({ rating: parseInt(nilai) })
        .eq('id', id);

    if (!error) renderReports();
}

async function hapusLaporan(id) {
    if (!isAdminLoggedIn()) {
        alert("Akses ditolak! Anda harus login sebagai admin.");
        return;
    }

    if (confirm("Apakah Anda yakin ingin menghapus laporan ini?")) {
        const { error } = await supabaseClient
            .from('reports')
            .delete()
            .eq('id', id);

        if (error) {
            alert("Gagal menghapus laporan: " + error.message);
        } else {
            alert("Laporan berhasil dihapus!");
            renderReports();
        }
    }
}

// Kategori Filter
document.querySelectorAll('.category').forEach(btn => {
    btn.onclick = () => {
        const cat = btn.getAttribute('data-category');
        if (activeCategory === cat) {
            activeCategory = "";
            btn.style.opacity = "1";
        } else {
            activeCategory = cat;
            document.querySelectorAll('.category').forEach(b => b.style.opacity = "0.6");
            btn.style.opacity = "1";
        }
        renderReports();
    };
});

// Kontrol Modal Form Laporan
const modal = document.getElementById("reportModal");
if (document.getElementById("openForm")) document.getElementById("openForm").onclick = () => modal.classList.add("show");
if (document.getElementById("heroButton")) document.getElementById("heroButton").onclick = () => modal.classList.add("show");
if (document.getElementById("closeForm")) document.getElementById("closeForm").onclick = () => modal.classList.remove("show");
if (document.getElementById("search")) document.getElementById("search").oninput = renderReports;

// ==========================================
// 4. KONTROL NAVBAR AUTH (ADMIN & USER)
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    const navContainer = document.getElementById("navAuthContainer");
    if (navContainer) {
        navContainer.innerHTML = "";

        // Tombol Login/Logout Admin
        let btnAdmin = document.createElement("button");
        btnAdmin.type = "button";
        btnAdmin.style.cssText = "border: none; padding: 7px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12px;";
        if (isAdminLoggedIn()) {
            btnAdmin.textContent = "🔓 Logout Admin";
            btnAdmin.style.background = "#dc2626";
            btnAdmin.style.color = "white";
            btnAdmin.onclick = () => {
                if (confirm("Keluar dari Admin?")) {
                    localStorage.removeItem("isAdminAuth");
                    location.reload();
                }
            };
        } else {
            btnAdmin.textContent = "🔐 Login Admin";
            btnAdmin.style.background = "#1e3a8a";
            btnAdmin.style.color = "white";
            btnAdmin.onclick = () => {
                let pass = prompt("Masukkan Password Admin:");
                if (pass === ADMIN_PASSWORD) {
                    localStorage.setItem("isAdminAuth", "true");
                    alert("Login Admin Berhasil!");
                    location.reload();
                } else if (pass !== null) {
                    alert("Password salah!");
                }
            };
        }
        navContainer.appendChild(btnAdmin);

        // Tombol User Warga
        let btnUser = document.createElement("button");
        btnUser.type = "button";
        btnUser.style.cssText = "border: none; padding: 7px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12px;";
        
        let currentUser = getCurrentUser();
        if (isUserLoggedIn() && currentUser) {
            btnUser.textContent = `👤 ${currentUser.nama}`;
            btnUser.style.background = "#059669";
            btnUser.style.color = "white";
            btnUser.onclick = () => {
                if (confirm(`Halo ${currentUser.nama}, ingin Logout dari akun warga?`)) {
                    localStorage.removeItem("isUserAuth");
                    localStorage.removeItem("userData");
                    location.reload();
                }
            };
        } else {
            btnUser.textContent = "👤 Login / Daftar Warga";
            btnUser.style.background = "#2563eb";
            btnUser.style.color = "white";
            btnUser.onclick = () => {
                let userModal = document.getElementById("userModal");
                if (userModal) userModal.style.display = "flex";
            };
        }
        navContainer.appendChild(btnUser);
    }

    // Modal Pendaftaran User Warga
    let userModal = document.getElementById("userModal");
    if (!userModal) {
        userModal = document.createElement("div");
        userModal.id = "userModal";
        userModal.style.cssText = "display: none; position: fixed; z-index: 10000; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center;";
        userModal.innerHTML = `
            <div style="background: white; padding: 25px; border-radius: 8px; width: 340px; position: relative; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                <span id="closeUserModal" style="position: absolute; right: 15px; top: 10px; font-size: 22px; cursor: pointer; font-weight: bold;">&times;</span>
                <h3 style="margin-bottom: 15px; color: #2563eb;">Akun Warga LaporKota</h3>
                <form id="userForm">
                    <div style="margin-bottom: 10px;">
                        <label style="display: block; margin-bottom: 3px; font-size: 12px; font-weight: bold;">Nama Lengkap:</label>
                        <input type="text" id="regNama" required placeholder="Nama anda..." style="width: 100%; padding: 7px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                    </div>
                    <div style="margin-bottom: 10px;">
                        <label style="display: block; margin-bottom: 3px; font-size: 12px; font-weight: bold;">Email:</label>
                        <input type="email" id="regEmail" required placeholder="email@domain.com..." style="width: 100%; padding: 7px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                    </div>
                    <div style="margin-bottom: 10px;">
                        <label style="display: block; margin-bottom: 3px; font-size: 12px; font-weight: bold;">No. Telepon / WhatsApp:</label>
                        <input type="tel" id="regPhone" required placeholder="08123456789..." style="width: 100%; padding: 7px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 3px; font-size: 12px; font-weight: bold;">Password:</label>
                        <input type="password" id="regPass" required placeholder="Buat password..." style="width: 100%; padding: 7px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                    </div>
                    <button type="submit" style="width: 100%; background: #2563eb; color: white; border: none; padding: 9px; border-radius: 4px; font-weight: bold; cursor: pointer;">Daftar & Masuk</button>
                </form>
            </div>
        `;
        document.body.appendChild(userModal);

        document.getElementById("closeUserModal").onclick = () => {
            userModal.style.display = "none";
        };

        document.getElementById("userForm").onsubmit = (e) => {
            e.preventDefault();
            const nama = document.getElementById("regNama").value.trim();
            const email = document.getElementById("regEmail").value.trim();
            const phone = document.getElementById("regPhone").value.trim();
            const pass = document.getElementById("regPass").value.trim();

            const userData = { nama, email, phone, pass };
            localStorage.setItem("userData", JSON.stringify(userData));
            localStorage.setItem("isUserAuth", "true");

            alert(`Selamat datang, ${nama}! Akun warga berhasil dibuat.`);
            userModal.style.display = "none";
            location.reload();
        };
    }
});

// Inisialisasi awal
renderReports();