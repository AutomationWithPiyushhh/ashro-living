// Ashro Living - Property Manager & Admin Controller

let adminState = {
    stats: {},
    properties: [],
    rooms: [],
    visits: [],
    tickets: [],
    bookings: [],
    kyc: [],
    activeKycFilter: 'all',
    currentReviewKycId: null
};

document.addEventListener('DOMContentLoaded', async () => {
    checkAdminAuth();

    // Check initial URL hash for deep linking
    const initialHash = window.location.hash.replace('#', '');
    if (initialHash && document.getElementById(`admin-tab-${initialHash}`)) {
        switchAdminTab(initialHash);
    }
});

window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(`admin-tab-${hash}`)) {
        switchAdminTab(hash);
    }
});

function checkAdminAuth() {
    const user = AuthService.getCurrentUser();
    const barrier = document.getElementById('adminAuthBarrier');
    const content = document.getElementById('adminMainContent');

    if (!user || user.role !== 'admin') {
        if (barrier) barrier.style.display = 'block';
        if (content) content.style.display = 'none';
        return;
    }

    if (barrier) barrier.style.display = 'none';
    if (content) content.style.display = 'block';

    const bar = document.getElementById('adminProfileBar');
    if (bar) bar.innerHTML = `Manager &bull; <strong>${user.name}</strong> (${user.email})`;

    loadAdminData();
}

function switchAdminTab(tabName, clickedEl) {
    if (!tabName) return;

    // Remove active state from all tabs and panes
    document.querySelectorAll('#adminMainContent .tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.admin-tab-item').forEach(t => t.classList.remove('active'));

    // Activate the targeted pane
    const targetPane = document.getElementById(`admin-tab-${tabName}`);
    if (targetPane) {
        targetPane.classList.add('active');
    }

    // Highlight the matching tab item
    const tabItem = clickedEl || document.querySelector(`.admin-tab-item[data-tab="${tabName}"]`);
    if (tabItem) {
        tabItem.classList.add('active');
    }

    // Update URL hash cleanly without page jump
    try {
        history.replaceState(null, '', '#' + tabName);
    } catch (e) {}
}

async function loadAdminData() {
    try {
        const [stats, props, rooms, visits, tickets, bookings, kyc] = await Promise.all([
            AshroAPI.get('/admin/stats'),
            AshroAPI.get('/properties'),
            AshroAPI.get('/rooms'),
            AshroAPI.get('/admin/visits'),
            AshroAPI.get('/admin/tickets'),
            AshroAPI.get('/admin/bookings'),
            AshroAPI.get('/admin/kyc').catch(() => [])
        ]);

        adminState.stats = stats;
        adminState.properties = props;
        adminState.rooms = rooms;
        adminState.visits = visits;
        adminState.tickets = tickets;
        adminState.bookings = bookings;
        adminState.kyc = kyc || [];

        renderStats();
        renderRoomsTable();
        renderVisitsTable();
        renderTicketsTable();
        renderBookingsTable();
        renderKycTable();
        populateNewRoomProps();
    } catch (err) {
        console.error('Failed to load manager hub data:', err);
        showToast('Error loading property manager data', 'error');
    }
}

function renderStats() {
    const s = adminState.stats;
    if (!s) return;

    const occEl = document.getElementById('kpiOccupancy');
    const bedsSub = document.getElementById('kpiBedsSub');
    if (occEl) occEl.textContent = `${s.occupancy_rate}%`;
    if (bedsSub) bedsSub.textContent = `${s.occupied_beds} occupied / ${s.total_beds} total suites`;

    const revEl = document.getElementById('kpiRevenue');
    if (revEl) revEl.textContent = formatINR(s.revenue_collected);

    const pendEl = document.getElementById('kpiPending');
    if (pendEl) pendEl.textContent = formatINR(s.pending_rent);

    const tickEl = document.getElementById('kpiTickets');
    if (tickEl) tickEl.textContent = s.open_tickets;

    const badgeVisits = document.getElementById('badgeVisits');
    if (badgeVisits) badgeVisits.textContent = adminState.visits.filter(v => v.status === 'Scheduled').length;

    const badgeTickets = document.getElementById('badgeTickets');
    if (badgeTickets) badgeTickets.textContent = s.open_tickets;

    const badgeKyc = document.getElementById('badgeKyc');
    const pendingKycCount = adminState.kyc.filter(k => k.status === 'Under Review').length;
    if (badgeKyc) badgeKyc.textContent = pendingKycCount;

    const kpiKyc = document.getElementById('kpiKyc');
    if (kpiKyc) kpiKyc.textContent = pendingKycCount;

    const recTbody = document.getElementById('overviewBookingsTable');
    if (recTbody) {
        if (!adminState.bookings.length) {
            recTbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-muted);">No reservations found.</td></tr>';
        } else {
            recTbody.innerHTML = adminState.bookings.slice(0, 5).map(b => `
                <tr>
                    <td><strong>${b.booking_reference}</strong></td>
                    <td>${b.guest_name}</td>
                    <td>${b.guest_phone}</td>
                    <td>${b.move_in_date}</td>
                    <td><strong>${formatINR(b.monthly_rent)}</strong></td>
                    <td style="color: var(--accent-cocoa);">Remitted ${formatINR(b.token_amount_paid)}</td>
                    <td><span class="status-badge paid">${b.status}</span></td>
                </tr>
            `).join('');
        }
    }
}

// Rooms Table
function renderRoomsTable() {
    const tbody = document.getElementById('adminRoomsTableBody');
    if (!tbody) return;

    if (!adminState.rooms.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px; color: var(--text-muted);">No residences in catalog.</td></tr>';
        return;
    }

    tbody.innerHTML = adminState.rooms.map(r => `
        <tr>
            <td>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="${r.cover_image}" alt="${r.name}" style="width: 48px; height: 36px; object-fit: cover; border-radius: 4px;">
                    <div>
                        <strong>${r.name}</strong>
                        <div style="font-size: 11px; color: var(--text-muted);">${r.size_sqft} sq.ft &bull; ${r.washroom_type}</div>
                    </div>
                </div>
            </td>
            <td>${r.property_area} (${r.property_city})</td>
            <td><span style="font-size: 11px; font-weight: 700; color: var(--accent-cocoa); text-transform: uppercase;">${r.room_type}</span></td>
            <td><strong>${formatINR(r.price_monthly)}</strong></td>
            <td>${formatINR(r.security_deposit)}</td>
            <td>${r.total_beds} beds</td>
            <td><strong>${r.available_beds}</strong></td>
            <td>
                <span class="status-badge ${r.status === 'Available' ? 'paid' : 'pending'}">
                    ${r.status}
                </span>
            </td>
            <td>
                <select style="font-size: 12px; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-light);"
                        onchange="toggleRoomStatus(${r.id}, this.value)">
                    <option value="Available" ${r.status === 'Available' ? 'selected' : ''}>Available</option>
                    <option value="Full" ${r.status === 'Full' ? 'selected' : ''}>Fully Occupied</option>
                    <option value="Maintenance" ${r.status === 'Maintenance' ? 'selected' : ''}>Maintenance</option>
                </select>
            </td>
        </tr>
    `).join('');
}

async function toggleRoomStatus(roomId, newStatus) {
    try {
        await AshroAPI.put(`/admin/rooms/${roomId}`, { status: newStatus });
        showToast('Residence status updated', 'success');
        const updated = await AshroAPI.get('/rooms');
        adminState.rooms = updated;
        renderRoomsTable();
    } catch (err) {
        showToast('Failed to update status', 'error');
    }
}

// Visits Table
function renderVisitsTable() {
    const tbody = document.getElementById('adminVisitsTableBody');
    if (!tbody) return;

    if (!adminState.visits.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px; color: var(--text-muted);">No scheduled tour requests.</td></tr>';
        return;
    }

    tbody.innerHTML = adminState.visits.map(v => {
        const isScheduled = v.status === 'Scheduled';
        return `
            <tr>
                <td><strong>${v.name}</strong></td>
                <td>
                    <div>${v.phone}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${v.email}</div>
                </td>
                <td>${v.property_name || 'All Amdavad Campuses'}</td>
                <td>${v.room_name || 'General Tour'}</td>
                <td><strong>${v.visit_date}</strong> at ${v.visit_time}</td>
                <td>
                    <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--accent-cocoa);">
                        ${v.tour_type}
                    </span>
                </td>
                <td style="max-width: 200px; font-size: 12px; color: var(--text-muted);">${v.notes || '—'}</td>
                <td>
                    <span class="status-badge ${isScheduled ? 'pending' : 'paid'}">
                        ${v.status}
                    </span>
                </td>
                <td>
                    ${isScheduled ? `
                        <button class="btn-primary" style="padding: 4px 10px; font-size: 11px;" onclick="updateVisitStatus(${v.id}, 'Completed')">
                            Mark Completed
                        </button>
                    ` : `
                        <span style="color: var(--text-muted); font-size: 11px;">Archived</span>
                    `}
                </td>
            </tr>
        `;
    }).join('');
}

async function updateVisitStatus(visitId, status) {
    try {
        await AshroAPI.put(`/admin/visits/${visitId}`, { status: status });
        showToast(`Tour status updated to ${status}`, 'success');
        const updated = await AshroAPI.get('/admin/visits');
        adminState.visits = updated;
        renderVisitsTable();
        renderStats();
    } catch (err) {
        showToast('Failed to update tour status', 'error');
    }
}

// Tickets Table
function renderTicketsTable() {
    const tbody = document.getElementById('adminTicketsTableBody');
    if (!tbody) return;

    if (!adminState.tickets.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: var(--text-muted);">No active tickets.</td></tr>';
        return;
    }

    tbody.innerHTML = adminState.tickets.map(t => {
        const isResolved = t.status === 'Resolved';
        return `
            <tr>
                <td><strong>${t.ticket_number}</strong></td>
                <td>
                    <strong>${t.user_name}</strong>
                    <div style="font-size: 11px; color: var(--text-muted);">${t.room_name} &bull; ${t.user_phone}</div>
                </td>
                <td><span style="font-weight: 600; color: var(--accent-cocoa); font-size: 12px;">${t.category}</span></td>
                <td>
                    <strong>${t.title}</strong>
                    <div style="font-size: 12px; color: var(--text-muted); max-width: 280px;">${t.description}</div>
                </td>
                <td>
                    <span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 700; background: var(--sand-glow); color: var(--accent-cocoa);">
                        ${t.priority}
                    </span>
                </td>
                <td>${t.assigned_to || 'Concierge Desk'}</td>
                <td>
                    <span class="status-badge ${isResolved ? 'resolved' : 'in-progress'}">
                        ${t.status}
                    </span>
                </td>
                <td>
                    <button class="btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="openTriageModal(${t.id})">
                        Triage &rarr;
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function openTriageModal(ticketId) {
    const ticket = adminState.tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    document.getElementById('triageTicketId').value = ticket.id;
    document.getElementById('triageTicketSubtitle').textContent = `Ticket ${ticket.ticket_number} &bull; ${ticket.title}`;
    document.getElementById('triageStatus').value = ticket.status;
    if (ticket.assigned_to) {
        document.getElementById('triageAssignedTo').value = ticket.assigned_to;
    }
    document.getElementById('triageResolutionNotes').value = ticket.resolution_notes || '';

    document.getElementById('triageTicketModal').classList.add('active');
}

async function handleTriageTicketSubmit(e) {
    e.preventDefault();
    const tId = document.getElementById('triageTicketId').value;
    const payload = {
        status: document.getElementById('triageStatus').value,
        assigned_to: document.getElementById('triageAssignedTo').value,
        resolution_notes: document.getElementById('triageResolutionNotes').value
    };

    try {
        await AshroAPI.put(`/admin/tickets/${tId}`, payload);
        closeModal('triageTicketModal');
        showToast('Service ticket update saved', 'success');

        const [tickets, stats] = await Promise.all([
            AshroAPI.get('/admin/tickets'),
            AshroAPI.get('/admin/stats')
        ]);
        adminState.tickets = tickets;
        adminState.stats = stats;
        renderTicketsTable();
        renderStats();
    } catch (err) {
        showToast('Failed to update ticket', 'error');
    }
}

// Master Ledger
function renderBookingsTable() {
    const tbody = document.getElementById('adminBookingsTableBody');
    if (!tbody) return;

    if (!adminState.bookings.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px; color: var(--text-muted);">No bookings recorded.</td></tr>';
        return;
    }

    tbody.innerHTML = adminState.bookings.map(b => {
        const kycRecord = (adminState.kyc || []).find(k => k.user_id === b.user_id || k.user_email === b.guest_email);
        const kycStatus = kycRecord ? kycRecord.status : 'Pending';
        let kycBadge = '<span class="doc-badge-status pending" style="cursor: pointer;" onclick="switchAdminTab(\'kyc\')">KYC: Pending</span>';
        if (kycStatus === 'Verified') {
            kycBadge = '<span class="doc-badge-status verified" style="cursor: pointer;" onclick="switchAdminTab(\'kyc\')">✓ KYC Verified</span>';
        } else if (kycStatus === 'Under Review') {
            kycBadge = '<span class="doc-badge-status review" style="cursor: pointer;" onclick="switchAdminTab(\'kyc\')">⏳ KYC Review</span>';
        } else if (kycStatus === 'Rejected') {
            kycBadge = '<span class="doc-badge-status rejected" style="cursor: pointer;" onclick="switchAdminTab(\'kyc\')">✕ KYC Re-upload</span>';
        }

        return `
        <tr>
            <td><strong>${b.booking_reference}</strong></td>
            <td>
                <strong>${b.guest_name}</strong>
                <div style="margin-top: 4px;">${kycBadge}</div>
            </td>
            <td>
                <div>${b.guest_phone}</div>
                <div style="font-size: 11px; color: var(--text-muted);">${b.guest_email}</div>
            </td>
            <td>
                <strong>${b.room_name}</strong>
                <div style="font-size: 11px; color: var(--text-muted);">${b.property_name}</div>
            </td>
            <td>${b.move_in_date}</td>
            <td>${b.tenure_months} Months</td>
            <td><strong>${formatINR(b.monthly_rent)}</strong></td>
            <td>${formatINR(b.security_deposit)}</td>
            <td><span class="status-badge paid">${b.status}</span></td>
        </tr>
    `;
    }).join('');
}

function populateNewRoomProps() {
    const select = document.getElementById('newRoomPropertyId');
    if (!select) return;
    select.innerHTML = adminState.properties.map(p => `
        <option value="${p.id}">${p.name} (${p.area}, ${p.city})</option>
    `).join('');
}

function openAddRoomModal() {
    document.getElementById('addRoomModal').classList.add('active');
}

async function handleAddRoomSubmit(e) {
    e.preventDefault();
    const featuresRaw = document.getElementById('newRoomFeatures').value;
    const featuresList = featuresRaw.split(',').map(s => s.trim()).filter(Boolean);

    const payload = {
        property_id: parseInt(document.getElementById('newRoomPropertyId').value),
        name: document.getElementById('newRoomName').value,
        room_type: document.getElementById('newRoomType').value,
        price_monthly: parseFloat(document.getElementById('newRoomPrice').value),
        security_deposit: parseFloat(document.getElementById('newRoomDeposit').value || document.getElementById('newRoomPrice').value),
        size_sqft: parseInt(document.getElementById('newRoomSqft').value || 210),
        cover_image: document.getElementById('newRoomCoverImage').value,
        features: featuresList,
        description: document.getElementById('newRoomDescription').value,
        available_beds: 1,
        total_beds: 1,
        status: 'Available'
    };

    try {
        await AshroAPI.post('/admin/rooms', payload);
        closeModal('addRoomModal');
        showToast('Residence suite published to catalog', 'success');
        e.target.reset();

        const [rooms, stats] = await Promise.all([
            AshroAPI.get('/rooms'),
            AshroAPI.get('/admin/stats')
        ]);
        adminState.rooms = rooms;
        adminState.stats = stats;
        renderRoomsTable();
        renderStats();
    } catch (err) {
        showToast(err.message || 'Error publishing residence', 'error');
    }
}

function openAdminLoginModal() {
    document.getElementById('adminAuthModal').classList.add('active');
}

async function handleAdminPageLogin(e) {
    e.preventDefault();
    const email = document.getElementById('admEmailInput').value;
    const pass = document.getElementById('admPasswordInput').value;

    try {
        const user = await AuthService.login(email, pass);
        if (user.role !== 'admin') {
            AuthService.logout();
            showToast('Account is not authorized as Manager/Owner.', 'error');
            return;
        }
        closeModal('adminAuthModal');
        checkAdminAuth();
        showToast(`Welcome, ${user.name}`, 'success');
    } catch (err) {
        showToast(err.message || 'Invalid management credentials', 'error');
    }
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
}

// ================= Tenant Digital KYC Controller =================
function renderKycTable() {
    const tbody = document.getElementById('adminKycTableBody');
    if (!tbody) return;

    let records = adminState.kyc || [];
    if (adminState.activeKycFilter !== 'all') {
        records = records.filter(k => k.status === adminState.activeKycFilter);
    }

    if (!records.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 24px; color: var(--text-muted);">No tenant KYC records found matching filter.</td></tr>`;
        return;
    }

    tbody.innerHTML = records.map(k => {
        let statusBadge = '<span class="doc-badge-status review">Under Review</span>';
        if (k.status === 'Verified') {
            statusBadge = '<span class="doc-badge-status verified">✓ Verified</span>';
        } else if (k.status === 'Rejected') {
            statusBadge = '<span class="doc-badge-status rejected">✕ Needs Re-upload</span>';
        } else if (k.status === 'Pending Submission') {
            statusBadge = '<span class="doc-badge-status pending">Pending</span>';
        }

        const cleanPhone = (k.user_phone || '').replace(/[^0-9]/g, '');

        return `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${k.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}" alt="${k.user_name}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;">
                        <div>
                            <strong>${k.user_name}</strong>
                            <div style="font-size: 11px; color: var(--text-muted);">UID: #${k.user_id}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div><a href="tel:${k.user_phone}" style="color: var(--text-heading); font-weight: 600; text-decoration: none;">${k.user_phone}</a></div>
                    <div style="font-size: 11px; color: var(--text-muted);">${k.user_email}</div>
                    ${cleanPhone ? `<div style="margin-top: 2px;"><a href="https://wa.me/91${cleanPhone}" target="_blank" style="color: #25D366; font-size: 11px; text-decoration: none; font-weight: bold;">WhatsApp &rarr;</a></div>` : ''}
                </td>
                <td>
                    <strong>${k.room_name || 'Allocated Room'}</strong>
                    <div style="font-size: 11px; color: var(--accent-cocoa);">${k.property_name || 'Amdavad PG'}</div>
                </td>
                <td>
                    <strong>${k.id_type || 'Aadhaar Card'}</strong>
                    <div style="font-size: 11px; font-family: monospace; color: var(--text-muted);">${k.id_number || 'Not Provided'}</div>
                </td>
                <td>
                    <div style="font-weight: 600;">${k.occupation_type || 'Professional'}</div>
                    <div style="font-size: 11px; color: var(--text-muted); max-width: 180px;">${k.institution_name || 'General Resident'}</div>
                </td>
                <td>
                    <div class="kyc-thumb-strip">
                        ${k.id_front_image ? `<img src="${k.id_front_image}" alt="Front" class="kyc-thumb-mini" title="Govt ID Front" onclick="openAdminDocPreview('${k.id_front_image.replace(/'/g, "\\'")}', '${k.user_name} - ID Front')">` : '<span style="font-size: 10px; color: var(--text-muted);">No Front</span>'}
                        ${k.id_back_image ? `<img src="${k.id_back_image}" alt="Back" class="kyc-thumb-mini" title="Address Back" onclick="openAdminDocPreview('${k.id_back_image.replace(/'/g, "\\'")}', '${k.user_name} - Address Back')">` : ''}
                        ${k.work_id_image ? `<img src="${k.work_id_image}" alt="Work ID" class="kyc-thumb-mini" title="Work / Student Proof" onclick="openAdminDocPreview('${k.work_id_image.replace(/'/g, "\\'")}', '${k.user_name} - Work/Student ID')">` : ''}
                    </div>
                </td>
                <td>
                    <span style="font-size: 11px; color: var(--text-muted);">${k.updated_at ? k.updated_at.split(' ')[0] : (k.submitted_at ? k.submitted_at.split(' ')[0] : 'Recent')}</span>
                </td>
                <td>
                    ${statusBadge}
                </td>
                <td>
                    <button class="btn-primary" style="padding: 5px 12px; font-size: 11px;" onclick="openKycReviewModal(${k.id})">
                        Review &amp; Verify &rarr;
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterKycTable(status, btnEl) {
    adminState.activeKycFilter = status;
    document.querySelectorAll('#admin-tab-kyc .btn-secondary').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    renderKycTable();
}

function openKycReviewModal(kycId) {
    const kyc = adminState.kyc.find(k => k.id === kycId);
    if (!kyc) return;

    adminState.currentReviewKycId = kycId;

    // Status Badge
    const badgeEl = document.getElementById('modalKycStatusBadge');
    if (badgeEl) {
        badgeEl.className = 'doc-badge-status';
        if (kyc.status === 'Verified') {
            badgeEl.classList.add('verified'); badgeEl.textContent = 'Verified Resident';
        } else if (kyc.status === 'Rejected') {
            badgeEl.classList.add('rejected'); badgeEl.textContent = 'Rejected';
        } else {
            badgeEl.classList.add('review'); badgeEl.textContent = 'Under Review';
        }
    }

    // Resident Summary
    const summaryBox = document.getElementById('modalKycResidentSummary');
    if (summaryBox) {
        summaryBox.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 14px;">
                <div style="display: flex; gap: 12px; align-items: center;">
                    <img src="${kyc.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;">
                    <div>
                        <h4 style="font-size: 18px; margin: 0 0 2px 0;">${kyc.user_name}</h4>
                        <div style="font-size: 12px; color: var(--text-muted);">${kyc.user_email} &bull; ${kyc.user_phone}</div>
                        <div style="font-size: 12px; color: var(--accent-cocoa); font-weight: 600; margin-top: 2px;">
                            ${kyc.property_name || 'Ashro Living'} &bull; ${kyc.room_name || 'Allocated Suite'}
                        </div>
                    </div>
                </div>
                <div style="font-size: 12px; line-height: 1.6; max-width: 300px;">
                    <div><strong>Govt ID:</strong> ${kyc.id_type} (${kyc.id_number || 'N/A'})</div>
                    <div><strong>Occupation:</strong> ${kyc.occupation_type} at ${kyc.institution_name || 'N/A'}</div>
                    <div><strong>Permanent City:</strong> ${kyc.city || ''}, ${kyc.state || 'Gujarat'} (${kyc.pincode || ''})</div>
                    <div><strong>Emergency Guardian:</strong> ${kyc.emergency_name || 'N/A'} (${kyc.emergency_relation || 'Parent'}) &bull; ${kyc.emergency_phone || 'N/A'}</div>
                </div>
            </div>
            ${kyc.rejection_reason ? `<div style="margin-top: 10px; padding: 8px 12px; background: #FDEDEC; border-radius: 4px; font-size: 12px; color: #78281F;"><strong>Previous Rejection Reason:</strong> ${kyc.rejection_reason}</div>` : ''}
        `;
    }

    // Documents Grid
    const docsGrid = document.getElementById('modalKycDocsGrid');
    if (docsGrid) {
        docsGrid.innerHTML = `
            <div class="kyc-doc-card-modal">
                <strong style="display: block; font-size: 12px; margin-bottom: 6px;">1. ${kyc.id_type} (Front Side)</strong>
                ${kyc.id_front_image ? `<img src="${kyc.id_front_image}" alt="ID Front" onclick="openAdminDocPreview('${kyc.id_front_image.replace(/'/g, "\\'")}', '${kyc.user_name} - ${kyc.id_type} Front')">` : '<div style="padding: 40px; color: var(--text-muted);">No image uploaded</div>'}
                <div style="font-size: 11px; color: var(--text-muted);">Click to zoom full size</div>
            </div>

            <div class="kyc-doc-card-modal">
                <strong style="display: block; font-size: 12px; margin-bottom: 6px;">2. Permanent Address (Back Side)</strong>
                ${kyc.id_back_image ? `<img src="${kyc.id_back_image}" alt="ID Back" onclick="openAdminDocPreview('${kyc.id_back_image.replace(/'/g, "\\'")}', '${kyc.user_name} - Address Back')">` : '<div style="padding: 40px; color: var(--text-muted);">No back image</div>'}
                <div style="font-size: 11px; color: var(--text-muted);">Click to zoom full size</div>
            </div>

            <div class="kyc-doc-card-modal">
                <strong style="display: block; font-size: 12px; margin-bottom: 6px;">3. Work / College ID Proof</strong>
                ${kyc.work_id_image ? `<img src="${kyc.work_id_image}" alt="Work ID" onclick="openAdminDocPreview('${kyc.work_id_image.replace(/'/g, "\\'")}', '${kyc.user_name} - Work / College ID')">` : '<div style="padding: 40px; color: var(--text-muted);">No work ID provided</div>'}
                <div style="font-size: 11px; color: var(--text-muted);">Click to zoom full size</div>
            </div>
        `;
    }

    document.getElementById('kycReviewModal').classList.add('active');
}

async function confirmKycApproval() {
    if (!adminState.currentReviewKycId) return;
    try {
        await AshroAPI.put(`/admin/kyc/${adminState.currentReviewKycId}`, { status: 'Verified' });
        showToast('Tenant KYC verified and approved successfully!', 'success');
        closeModal('kycReviewModal');

        const [kyc, stats] = await Promise.all([
            AshroAPI.get('/admin/kyc'),
            AshroAPI.get('/admin/stats')
        ]);
        adminState.kyc = kyc;
        adminState.stats = stats;
        renderKycTable();
        renderStats();
    } catch (err) {
        showToast(err.message || 'Failed to approve KYC', 'error');
    }
}

async function promptKycRejection() {
    if (!adminState.currentReviewKycId) return;
    const reason = prompt('Please specify why this document needs re-upload:', 'Aadhaar image is blurry or address proof incomplete.');
    if (!reason) return;

    try {
        await AshroAPI.put(`/admin/kyc/${adminState.currentReviewKycId}`, {
            status: 'Rejected',
            rejection_reason: reason
        });
        showToast('Re-upload request sent to resident', 'success');
        closeModal('kycReviewModal');

        const [kyc, stats] = await Promise.all([
            AshroAPI.get('/admin/kyc'),
            AshroAPI.get('/admin/stats')
        ]);
        adminState.kyc = kyc;
        adminState.stats = stats;
        renderKycTable();
        renderStats();
    } catch (err) {
        showToast(err.message || 'Failed to update KYC status', 'error');
    }
}

function openAdminDocPreview(imgSrc, title) {
    const modalImg = document.getElementById('adminDocViewerImg');
    const modalTitle = document.getElementById('adminDocViewerTitle');
    if (modalImg) modalImg.src = imgSrc;
    if (modalTitle) modalTitle.textContent = title || 'Document Inspection';

    document.getElementById('adminDocViewerModal').classList.add('active');
}
