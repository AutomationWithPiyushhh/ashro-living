// Ashro Living - Property Manager & Admin Controller

let adminState = {
    stats: {},
    properties: [],
    rooms: [],
    visits: [],
    tickets: [],
    bookings: []
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
        const [stats, props, rooms, visits, tickets, bookings] = await Promise.all([
            AshroAPI.get('/admin/stats'),
            AshroAPI.get('/properties'),
            AshroAPI.get('/rooms'),
            AshroAPI.get('/admin/visits'),
            AshroAPI.get('/admin/tickets'),
            AshroAPI.get('/admin/bookings')
        ]);

        adminState.stats = stats;
        adminState.properties = props;
        adminState.rooms = rooms;
        adminState.visits = visits;
        adminState.tickets = tickets;
        adminState.bookings = bookings;

        renderStats();
        renderRoomsTable();
        renderVisitsTable();
        renderTicketsTable();
        renderBookingsTable();
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

    tbody.innerHTML = adminState.bookings.map(b => `
        <tr>
            <td><strong>${b.booking_reference}</strong></td>
            <td><strong>${b.guest_name}</strong></td>
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
    `).join('');
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
