// Ashro Living - Resident Portal Controller

let currentResident = null;
let residentState = {
    invoices: [],
    tickets: [],
    meals: [],
    notices: []
};

document.addEventListener('DOMContentLoaded', async () => {
    checkResidentAuth();

    // Check initial URL hash for deep linking
    const initialHash = window.location.hash.replace('#', '');
    if (initialHash && document.getElementById(`tab-${initialHash}`)) {
        switchTab(initialHash);
    }
});

window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(`tab-${hash}`)) {
        switchTab(hash);
    }
});

function checkResidentAuth() {
    const user = AuthService.getCurrentUser();
    const barrier = document.getElementById('residentAuthBarrier');
    const content = document.getElementById('residentMainContent');

    if (!user || user.role !== 'resident') {
        if (barrier) barrier.style.display = 'block';
        if (content) content.style.display = 'none';
        return;
    }

    if (barrier) barrier.style.display = 'none';
    if (content) content.style.display = 'block';

    currentResident = user;
    const nameEl = document.getElementById('resProfileName');
    if (nameEl) nameEl.textContent = user.name;

    loadResidentData();
}

function switchTab(tabName, clickedEl) {
    if (!tabName) return;

    // Remove active state from all tabs and panes
    document.querySelectorAll('#residentMainContent .tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.resident-tab').forEach(t => t.classList.remove('active'));

    // Activate the targeted pane
    const targetPane = document.getElementById(`tab-${tabName}`);
    if (targetPane) {
        targetPane.classList.add('active');
    }

    // Highlight the matching tab item
    const tabItem = clickedEl || document.querySelector(`.resident-tab[data-tab="${tabName}"]`);
    if (tabItem) {
        tabItem.classList.add('active');
    }

    // Update URL hash cleanly without page jump
    try {
        history.replaceState(null, '', '#' + tabName);
    } catch (e) {}
}

async function loadResidentData() {
    if (!currentResident) return;
    try {
        const [invoices, tickets, meals, notices] = await Promise.all([
            AshroAPI.get('/resident/invoices', { user_id: currentResident.id }),
            AshroAPI.get('/resident/tickets', { user_id: currentResident.id }),
            AshroAPI.get('/resident/meals'),
            AshroAPI.get('/notices')
        ]);

        residentState.invoices = invoices;
        residentState.tickets = tickets;
        residentState.meals = meals;
        residentState.notices = notices;

        renderInvoices();
        renderTickets();
        renderMeals();
        renderNotices();
    } catch (err) {
        console.error('Error loading resident portal data:', err);
        showToast('Unable to load resident data', 'error');
    }
}

// Invoices
function renderInvoices() {
    const tbody = document.getElementById('invoicesTableBody');
    if (!tbody) return;

    if (!residentState.invoices.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">No billing records found.</td></tr>';
        return;
    }

    tbody.innerHTML = residentState.invoices.map(inv => {
        const isPaid = inv.status === 'Paid';
        return `
            <tr>
                <td><strong>${inv.invoice_number}</strong></td>
                <td>${inv.title}</td>
                <td>${inv.due_date}</td>
                <td><strong>${formatINR(inv.amount)}</strong></td>
                <td>${inv.payment_method || 'Direct Bank'}</td>
                <td>
                    <span class="status-badge ${isPaid ? 'paid' : 'pending'}">
                        ${inv.status}
                    </span>
                </td>
                <td>
                    ${isPaid ? `
                        <button class="btn-secondary" style="padding: 5px 12px; font-size: 11px;" onclick="downloadReceipt('${inv.invoice_number}')">
                            Receipt
                        </button>
                    ` : `
                        <button class="btn-primary" style="padding: 5px 14px; font-size: 11px;" onclick="openPayModal(${inv.id})">
                            Pay Now &rarr;
                        </button>
                    `}
                </td>
            </tr>
        `;
    }).join('');
}

function downloadReceipt(num) {
    showToast(`Receipt voucher for ${num} generated.`, 'success');
}

function openPayModal(invId) {
    const inv = residentState.invoices.find(i => i.id === invId);
    if (!inv) return;

    document.getElementById('payInvoiceId').value = inv.id;
    const summary = document.getElementById('payInvoiceSummary');
    if (summary) {
        summary.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
                <span style="color: var(--text-muted);">Invoice:</span>
                <strong>${inv.invoice_number}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
                <span style="color: var(--text-muted);">Charge:</span>
                <span>${inv.title}</span>
            </div>
            <div style="border-top: 1px solid var(--border-light); padding-top: 8px; margin-top: 8px; display: flex; justify-content: space-between; font-size: 15px;">
                <span style="font-weight: 700; color: var(--text-heading);">Total Due:</span>
                <strong style="color: var(--text-heading); font-size: 18px;">${formatINR(inv.amount)}</strong>
            </div>
        `;
    }
    document.getElementById('payRentModal').classList.add('active');
}

async function handlePaySubmit(e) {
    e.preventDefault();
    const invId = document.getElementById('payInvoiceId').value;
    const method = document.getElementById('payMethodSelect').value;

    try {
        await AshroAPI.post(`/resident/invoices/${invId}/pay`, { payment_method: method });
        closeModal('payRentModal');
        showToast('Payment successful. Receipt logged.', 'success');

        const updated = await AshroAPI.get('/resident/invoices', { user_id: currentResident.id });
        residentState.invoices = updated;
        renderInvoices();
    } catch (err) {
        showToast(err.message || 'Payment processing failed', 'error');
    }
}

// Tickets
function renderTickets() {
    const container = document.getElementById('ticketsListContainer');
    if (!container) return;

    if (!residentState.tickets.length) {
        container.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--text-muted);">No open service requests. All living systems operational.</div>';
        return;
    }

    container.innerHTML = residentState.tickets.map(t => {
        const isResolved = t.status === 'Resolved';
        return `
            <div style="background: var(--bg-primary); border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 18px 20px; margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <strong style="color: var(--text-heading);">${t.ticket_number}</strong>
                        <span style="font-size: 11px; font-weight: 700; color: var(--accent-cocoa); text-transform: uppercase;">${t.category}</span>
                        <span style="font-size: 10px; background: var(--bg-surface); padding: 2px 6px; border: 1px solid var(--border-light); border-radius: 4px;">Priority: ${t.priority}</span>
                    </div>
                    <span class="status-badge ${isResolved ? 'resolved' : 'in-progress'}">${t.status}</span>
                </div>
                <h4 style="font-size: 16px; margin-bottom: 6px;">${t.title}</h4>
                <p style="font-size: 13px; color: var(--text-muted); line-height: 1.6; margin-bottom: 10px;">${t.description}</p>
                ${t.assigned_to ? `
                    <div style="font-size: 12px; background: var(--bg-surface); padding: 8px 12px; border-radius: 4px; border: 1px solid var(--border-subtle);">
                        <span>Assigned Staff: <strong>${t.assigned_to}</strong></span>
                        ${t.resolution_notes ? `<span> &bull; Update: <em>"${t.resolution_notes}"</em></span>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function openRaiseTicketModal() {
    document.getElementById('raiseTicketModal').classList.add('active');
}

async function handleRaiseTicketSubmit(e) {
    e.preventDefault();
    const payload = {
        user_id: currentResident.id,
        room_id: 1,
        category: document.getElementById('ticketCategory').value,
        priority: document.getElementById('ticketPriority').value,
        title: document.getElementById('ticketTitle').value,
        description: document.getElementById('ticketDescription').value
    };

    try {
        await AshroAPI.post('/resident/tickets', payload);
        closeModal('raiseTicketModal');
        showToast('Service request submitted to concierge desk', 'success');
        e.target.reset();

        const updated = await AshroAPI.get('/resident/tickets', { user_id: currentResident.id });
        residentState.tickets = updated;
        renderTickets();
    } catch (err) {
        showToast(err.message || 'Error submitting ticket', 'error');
    }
}

// Meals
function renderMeals() {
    const container = document.getElementById('mealsGridContainer');
    if (!container) return;

    const daysOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const grouped = {};
    daysOrder.forEach(d => grouped[d] = []);

    residentState.meals.forEach(m => {
        if (!grouped[m.day_of_week]) grouped[m.day_of_week] = [];
        grouped[m.day_of_week].push(m);
    });

    const currentDayName = daysOrder[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

    container.innerHTML = daysOrder.map(day => {
        const mealsForDay = grouped[day] || [];
        const isToday = day === currentDayName;

        return `
            <div class="meal-day-tile ${isToday ? 'today' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <strong style="font-size: 16px; font-family: var(--font-serif);">${day}</strong>
                    ${isToday ? '<span class="status-badge paid">Today\'s Menu</span>' : ''}
                </div>

                ${mealsForDay.map(slot => `
                    <div class="meal-slot-item">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
                            <strong style="color: var(--accent-cocoa); text-transform: uppercase;">${slot.meal_type}</strong>
                            <span style="color: var(--text-muted);">${slot.calories} kcal</span>
                        </div>
                        <p style="font-size: 12px; color: var(--text-heading); margin-bottom: 4px; line-height: 1.4;">${slot.menu_items}</p>
                        <div style="font-size: 10px; color: var(--text-muted);">${slot.dietary_tags}</div>
                    </div>
                `).join('')}

                ${isToday ? `
                    <div style="margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--border-light); display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 11px; color: var(--text-muted);">Dinner Status:</span>
                        <button class="btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="toggleDinnerStatus(this)">
                            Opted-In
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

async function toggleDinnerStatus(btn) {
    const todayStr = new Date().toISOString().split('T')[0];
    const isOptedIn = btn.textContent.includes('Opted-In');
    const newStatus = isOptedIn ? 'Opted-Out' : 'Opted-In';

    try {
        await AshroAPI.post('/resident/meals/preferences', {
            user_id: currentResident.id,
            date: todayStr,
            meal_type: 'Dinner',
            status: newStatus
        });
        btn.textContent = newStatus === 'Opted-In' ? 'Opted-In' : 'Opted-Out';
        showToast(`Dinner attendance preference: ${newStatus}`, 'success');
    } catch (err) {
        showToast('Unable to update meal preference', 'error');
    }
}

// Notices
function renderNotices() {
    const container = document.getElementById('noticesContainer');
    if (!container) return;

    if (!residentState.notices.length) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">No active bulletins.</div>';
        return;
    }

    container.innerHTML = residentState.notices.map(n => `
        <div style="background: var(--bg-primary); border-left: 3px solid var(--accent-mocha); padding: 18px 20px; border-radius: var(--radius-xs); margin-bottom: 14px; border: 1px solid var(--border-light); border-left-width: 3px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px;">
                <span style="font-weight: 700; color: var(--accent-cocoa); text-transform: uppercase;">${n.category}</span>
                <span style="color: var(--text-muted);">${n.created_at.split(' ')[0]}</span>
            </div>
            <h4 style="font-size: 18px; margin-bottom: 6px;">${n.title}</h4>
            <p style="font-size: 13px; color: var(--text-muted); line-height: 1.6; margin: 0;">${n.content}</p>
        </div>
    `).join('');
}

function openAuthModal() {
    document.getElementById('authModal').classList.add('active');
}

async function handleResidentPageLogin(e) {
    e.preventDefault();
    const email = document.getElementById('resEmailInput').value;
    const pass = document.getElementById('resPasswordInput').value;
    try {
        await AuthService.login(email, pass);
        closeModal('authModal');
        checkResidentAuth();
    } catch (err) {
        showToast(err.message || 'Authentication failed', 'error');
    }
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
}
