// Ashro Living - Resident Portal Controller

let currentResident = null;
let residentState = {
    invoices: [],
    tickets: [],
    meals: [],
    notices: [],
    kyc: null,
    pendingDocs: {
        id_front: null,
        id_back: null,
        work_id: null
    }
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
        const [invoices, tickets, meals, notices, kycRes] = await Promise.all([
            AshroAPI.get('/resident/invoices', { user_id: currentResident.id }),
            AshroAPI.get('/resident/tickets', { user_id: currentResident.id }),
            AshroAPI.get('/resident/meals'),
            AshroAPI.get('/notices'),
            AshroAPI.get('/resident/kyc', { user_id: currentResident.id }).catch(() => null)
        ]);

        residentState.invoices = invoices;
        residentState.tickets = tickets;
        residentState.meals = meals;
        residentState.notices = notices;
        residentState.kyc = kycRes ? (kycRes.data || kycRes) : null;

        renderInvoices();
        renderTickets();
        renderMeals();
        renderNotices();
        renderKyc();
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

// ================= Tenant Digital KYC =================
function renderKyc() {
    const kyc = residentState.kyc;
    if (!kyc) return;

    // 1. Update Profile Pill
    const pill = document.getElementById('resKycPill');
    if (pill) {
        if (kyc.status === 'Verified') {
            pill.textContent = '✓ ID Verified';
            pill.style.background = 'rgba(46, 125, 50, 0.2)';
            pill.style.color = '#81c784';
        } else if (kyc.status === 'Under Review') {
            pill.textContent = '⏳ KYC Under Review';
            pill.style.background = 'rgba(255, 152, 0, 0.2)';
            pill.style.color = '#ffb74d';
        } else if (kyc.status === 'Rejected') {
            pill.textContent = '✕ KYC Needs Re-upload';
            pill.style.background = 'rgba(244, 67, 54, 0.2)';
            pill.style.color = '#e57373';
        } else {
            pill.textContent = '⚠️ KYC Pending';
            pill.style.background = 'rgba(158, 158, 158, 0.2)';
            pill.style.color = '#e0e0e0';
        }
    }

    // 2. Update Status Banner
    const banner = document.getElementById('kycStatusBanner');
    const titleEl = document.getElementById('kycStatusTitle');
    const descEl = document.getElementById('kycStatusDesc');
    const badgeEl = document.getElementById('kycStatusBadge');

    if (banner && titleEl && descEl && badgeEl) {
        banner.className = 'kyc-status-banner';
        if (kyc.status === 'Verified') {
            banner.classList.add('verified');
            titleEl.textContent = '✅ Verified Resident Identity';
            descEl.textContent = `Approved by Property Manager on ${kyc.verified_at ? kyc.verified_at.split(' ')[0] : 'recent date'}. Your official PG stay is active.`;
            badgeEl.className = 'doc-badge-status verified';
            badgeEl.textContent = 'Verified';
        } else if (kyc.status === 'Under Review') {
            banner.classList.add('under-review');
            titleEl.textContent = '⏳ Documents Submitted — Under Manager Review';
            descEl.textContent = 'Your documents have been submitted and are awaiting approval by Manager Piyush. You will receive an alert once verified.';
            badgeEl.className = 'doc-badge-status review';
            badgeEl.textContent = 'Under Review';
        } else if (kyc.status === 'Rejected') {
            banner.classList.add('rejected');
            titleEl.textContent = '⚠️ Document Verification Action Required';
            descEl.textContent = `Reason: "${kyc.rejection_reason || 'Please upload clear photos'}". Please correct and re-submit below.`;
            badgeEl.className = 'doc-badge-status rejected';
            badgeEl.textContent = 'Needs Re-Upload';
        } else {
            banner.classList.add('pending');
            titleEl.textContent = '📄 Government ID & Occupation Verification Required';
            descEl.textContent = 'Please complete your digital KYC submission below for official check-in and room key allocation.';
            badgeEl.className = 'doc-badge-status pending';
            badgeEl.textContent = 'Pending';
        }
    }

    // 3. Populate existing document thumbnails if available
    const currDocs = document.getElementById('kycCurrentDocsSection');
    const thumbFront = document.getElementById('viewThumbFront');
    const thumbBack = document.getElementById('viewThumbBack');
    const thumbWork = document.getElementById('viewThumbWork');

    if (kyc.id_front_image && currDocs && thumbFront && thumbBack && thumbWork) {
        currDocs.style.display = 'block';
        thumbFront.src = kyc.id_front_image;
        thumbBack.src = kyc.id_back_image || kyc.id_front_image;
        thumbWork.src = kyc.work_id_image || kyc.id_front_image;
    } else if (currDocs) {
        currDocs.style.display = 'none';
    }

    // 4. Pre-fill form inputs
    const elIdType = document.getElementById('kycIdType');
    if (elIdType && kyc.id_type) elIdType.value = kyc.id_type;

    const elIdNum = document.getElementById('kycIdNumber');
    if (elIdNum && kyc.id_number) elIdNum.value = kyc.id_number;

    const elOcc = document.getElementById('kycOccupationType');
    if (elOcc && kyc.occupation_type) elOcc.value = kyc.occupation_type;

    const elInst = document.getElementById('kycInstitutionName');
    if (elInst && kyc.institution_name) elInst.value = kyc.institution_name;

    const elAddr = document.getElementById('kycAddress');
    if (elAddr && kyc.permanent_address) elAddr.value = kyc.permanent_address;

    const elCity = document.getElementById('kycCity');
    if (elCity && kyc.city) elCity.value = kyc.city;

    const elState = document.getElementById('kycState');
    if (elState && kyc.state) elState.value = kyc.state;

    const elPin = document.getElementById('kycPincode');
    if (elPin && kyc.pincode) elPin.value = kyc.pincode;

    const elEmgName = document.getElementById('kycEmergencyName');
    if (elEmgName && kyc.emergency_name) elEmgName.value = kyc.emergency_name;

    const elEmgPhone = document.getElementById('kycEmergencyPhone');
    if (elEmgPhone && kyc.emergency_phone) elEmgPhone.value = kyc.emergency_phone;

    const elEmgRel = document.getElementById('kycEmergencyRelation');
    if (elEmgRel && kyc.emergency_relation) elEmgRel.value = kyc.emergency_relation;

    // Submit button label
    const btnSubmit = document.getElementById('btnSubmitKyc');
    if (btnSubmit) {
        if (kyc.status === 'Verified') {
            btnSubmit.textContent = 'Update Verified Documents \u2192';
        } else if (kyc.status === 'Under Review') {
            btnSubmit.textContent = 'Re-Submit Documents \u2192';
        } else {
            btnSubmit.textContent = 'Submit Documents for Verification \u2192';
        }
    }
}

function handleDocFileChange(e, docKey) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        const dataUrl = evt.target.result;
        residentState.pendingDocs[docKey] = dataUrl;

        let previewId = '';
        let promptId = '';
        if (docKey === 'id_front') {
            previewId = 'previewFront'; promptId = 'dropPromptFront';
        } else if (docKey === 'id_back') {
            previewId = 'previewBack'; promptId = 'dropPromptBack';
        } else if (docKey === 'work_id') {
            previewId = 'previewWork'; promptId = 'dropPromptWork';
        }

        const prevEl = document.getElementById(previewId);
        const prmpEl = document.getElementById(promptId);
        if (prevEl) {
            prevEl.src = dataUrl;
            prevEl.style.display = 'block';
        }
        if (prmpEl) {
            prmpEl.style.display = 'none';
        }

        showToast(`${file.name} loaded successfully`, 'success');
    };
    reader.readAsDataURL(file);
}

function viewDocImage(docKey) {
    const kyc = residentState.kyc;
    if (!kyc) return;

    let src = '';
    let title = '';

    if (docKey === 'id_front') {
        src = residentState.pendingDocs.id_front || kyc.id_front_image;
        title = `${kyc.id_type || 'ID Card'} (Front)`;
    } else if (docKey === 'id_back') {
        src = residentState.pendingDocs.id_back || kyc.id_back_image;
        title = `${kyc.id_type || 'ID Card'} (Back / Address)`;
    } else if (docKey === 'work_id') {
        src = residentState.pendingDocs.work_id || kyc.work_id_image;
        title = 'Work / Student Proof Document';
    }

    if (!src) {
        showToast('No document uploaded yet', 'error');
        return;
    }

    const modalTitle = document.getElementById('docViewerTitle');
    const modalImg = document.getElementById('docViewerImg');
    if (modalTitle) modalTitle.textContent = title;
    if (modalImg) modalImg.src = src;

    document.getElementById('docViewerModal').classList.add('active');
}

async function handleKycFormSubmit(e) {
    e.preventDefault();
    if (!currentResident) return;

    const existingKyc = residentState.kyc || {};
    const frontImg = residentState.pendingDocs.id_front || existingKyc.id_front_image;
    const backImg = residentState.pendingDocs.id_back || existingKyc.id_back_image;
    const workImg = residentState.pendingDocs.work_id || existingKyc.work_id_image;

    if (!frontImg) {
        showToast('Please upload front photo of your government ID', 'error');
        return;
    }

    const payload = {
        user_id: currentResident.id,
        id_type: document.getElementById('kycIdType').value,
        id_number: document.getElementById('kycIdNumber').value,
        id_front_image: frontImg,
        id_back_image: backImg || frontImg,
        occupation_type: document.getElementById('kycOccupationType').value,
        institution_name: document.getElementById('kycInstitutionName').value,
        work_id_image: workImg,
        permanent_address: document.getElementById('kycAddress').value,
        city: document.getElementById('kycCity').value,
        state: document.getElementById('kycState').value,
        pincode: document.getElementById('kycPincode').value,
        emergency_name: document.getElementById('kycEmergencyName').value,
        emergency_phone: document.getElementById('kycEmergencyPhone').value,
        emergency_relation: document.getElementById('kycEmergencyRelation').value
    };

    try {
        const btn = document.getElementById('btnSubmitKyc');
        if (btn) btn.disabled = true;

        const res = await AshroAPI.post('/resident/kyc', payload);
        residentState.kyc = res.data || res;
        renderKyc();
        showToast('KYC documents submitted! Manager Piyush notified for review.', 'success');

        if (btn) btn.disabled = false;
    } catch (err) {
        showToast(err.message || 'Failed to submit KYC documents', 'error');
        const btn = document.getElementById('btnSubmitKyc');
        if (btn) btn.disabled = false;
    }
}

function loadSampleKycDocs() {
    const sampleFront = (
        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250">'
        + '<rect width="400" height="250" fill="%23FFFFFF" rx="8" stroke="%23DED5C9" stroke-width="2"/>'
        + '<rect width="400" height="35" fill="%23302720"/>'
        + '<text x="20" y="23" fill="%23FFFFFF" font-family="sans-serif" font-size="12" font-weight="bold">GOVERNMENT OF INDIA • AADHAAR CARD</text>'
        + '<rect x="25" y="55" width="80" height="100" fill="%23E8DED1" rx="4"/>'
        + '<circle cx="65" cy="90" r="25" fill="%23B69B83"/>'
        + '<path d="M40 140 C40 115 90 115 90 140 Z" fill="%23B69B83"/>'
        + '<text x="125" y="75" font-family="sans-serif" font-size="13" font-weight="bold" fill="%23302720">NAME: AARAV SHARMA</text>'
        + '<text x="125" y="98" font-family="sans-serif" font-size="11" fill="%23756D65">DOB: 14/08/1998 • Gender: Male</text>'
        + '<text x="125" y="125" font-family="sans-serif" font-size="14" font-weight="bold" fill="%23765B49">5421 8901 8241</text>'
        + '<rect x="0" y="220" width="400" height="30" fill="%23F7F3ED"/>'
        + '<text x="20" y="238" font-family="sans-serif" font-size="10" fill="%23756D65">Mera Aadhaar, Meri Pehchaan • Sample ID</text></svg>'
    );

    const sampleBack = (
        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250">'
        + '<rect width="400" height="250" fill="%23FFFFFF" rx="8" stroke="%23DED5C9" stroke-width="2"/>'
        + '<rect width="400" height="35" fill="%23302720"/>'
        + '<text x="20" y="23" fill="%23FFFFFF" font-family="sans-serif" font-size="12" font-weight="bold">UNIQUE IDENTIFICATION AUTHORITY OF INDIA</text>'
        + '<text x="25" y="70" font-family="sans-serif" font-size="11" font-weight="bold" fill="%23302720">Permanent Address:</text>'
        + '<text x="25" y="92" font-family="sans-serif" font-size="11" fill="%23756D65">B-402, Shivalik Residency, 150 Feet Ring Road</text>'
        + '<text x="25" y="112" font-family="sans-serif" font-size="11" fill="%23756D65">Rajkot, Gujarat - 360005</text>'
        + '<rect x="25" y="145" width="350" height="40" fill="%23E8DED1" rx="4"/>'
        + '<text x="40" y="170" font-family="monospace" font-size="11" fill="%23302720">||| | ||||| || |||||| | |||| ||| ||||</text>'
        + '<rect x="0" y="220" width="400" height="30" fill="%23F7F3ED"/>'
        + '<text x="20" y="238" font-family="sans-serif" font-size="10" fill="%23756D65">Official Address Proof • Sample Back</text></svg>'
    );

    const sampleWork = (
        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250">'
        + '<rect width="400" height="250" fill="%23FFFFFF" rx="8" stroke="%23DED5C9" stroke-width="2"/>'
        + '<rect width="400" height="35" fill="%23765B49"/>'
        + '<text x="20" y="23" fill="%23FFFFFF" font-family="sans-serif" font-size="12" font-weight="bold">EMPLOYEE ID • TATA CONSULTANCY SERVICES</text>'
        + '<rect x="25" y="55" width="80" height="100" fill="%23E8DED1" rx="4"/>'
        + '<circle cx="65" cy="90" r="25" fill="%23B69B83"/>'
        + '<path d="M40 140 C40 115 90 115 90 140 Z" fill="%23B69B83"/>'
        + '<text x="125" y="75" font-family="sans-serif" font-size="13" font-weight="bold" fill="%23302720">AARAV SHARMA</text>'
        + '<text x="125" y="95" font-family="sans-serif" font-size="11" fill="%23756D65">Designation: Systems Engineer</text>'
        + '<text x="125" y="115" font-family="sans-serif" font-size="11" fill="%23756D65">Emp ID: TCS-748921</text>'
        + '<text x="125" y="135" font-family="sans-serif" font-size="11" fill="%23756D65">Campus: Infocity, Gandhinagar</text>'
        + '<rect x="0" y="220" width="400" height="30" fill="%23F7F3ED"/>'
        + '<text x="20" y="238" font-family="sans-serif" font-size="10" fill="%23756D65">Corporate Employment Verification Card</text></svg>'
    );

    residentState.pendingDocs.id_front = sampleFront;
    residentState.pendingDocs.id_back = sampleBack;
    residentState.pendingDocs.work_id = sampleWork;

    const pF = document.getElementById('previewFront');
    const pB = document.getElementById('previewBack');
    const pW = document.getElementById('previewWork');
    if (pF) { pF.src = sampleFront; pF.style.display = 'block'; }
    if (pB) { pB.src = sampleBack; pB.style.display = 'block'; }
    if (pW) { pW.src = sampleWork; pW.style.display = 'block'; }

    const dF = document.getElementById('dropPromptFront');
    const dB = document.getElementById('dropPromptBack');
    const dW = document.getElementById('dropPromptWork');
    if (dF) dF.style.display = 'none';
    if (dB) dB.style.display = 'none';
    if (dW) dW.style.display = 'none';

    document.getElementById('kycIdType').value = 'Aadhaar Card';
    document.getElementById('kycIdNumber').value = '5421 8901 8241';
    document.getElementById('kycOccupationType').value = 'Working Professional';
    document.getElementById('kycInstitutionName').value = 'Tata Consultancy Services (TCS), Gandhinagar';
    document.getElementById('kycAddress').value = 'B-402, Shivalik Residency, 150 Feet Ring Road';
    document.getElementById('kycCity').value = 'Rajkot';
    document.getElementById('kycState').value = 'Gujarat';
    document.getElementById('kycPincode').value = '360005';
    document.getElementById('kycEmergencyName').value = 'Rajesh Sharma';
    document.getElementById('kycEmergencyPhone').value = '9876543210';
    document.getElementById('kycEmergencyRelation').value = 'Father';

    showToast('Demo Aadhaar and Work ID documents loaded!', 'success');
}
