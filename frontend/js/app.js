// Ashro Living - Client Application Controller

let state = {
    properties: [],
    rooms: [],
    activeFilter: 'all',
    selectedLocation: '',
    currentRoom: null
};

document.addEventListener('DOMContentLoaded', async () => {
    // Default dates
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const dateStr = nextMonth.toISOString().split('T')[0];

    const searchDateInput = document.getElementById('searchMoveInDate');
    if (searchDateInput) searchDateInput.value = dateStr;

    const reserveDateInput = document.getElementById('reserveMoveInDate');
    if (reserveDateInput) reserveDateInput.value = dateStr;

    const visitDateInput = document.getElementById('visitDate');
    if (visitDateInput) {
        const nextWeek = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        visitDateInput.value = nextWeek.toISOString().split('T')[0];
    }

    updateNavbarAuthState();
    await loadInitialData();

    // Trigger search on Enter key in search inputs
    ['searchLocation', 'searchRoomType', 'searchMoveInDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    applySearchFilters();
                }
            });
        }
    });
});

function updateNavbarAuthState() {
    const user = AuthService.getCurrentUser();
    const label = document.getElementById('navAuthLabel');
    if (!label) return;

    if (user) {
        if (user.role === 'admin') {
            label.textContent = `Manager: ${user.name.split(' ')[0]}`;
        } else {
            label.textContent = `Resident: ${user.name.split(' ')[0]}`;
        }
    } else {
        label.textContent = 'Sign In';
    }
}

async function loadInitialData() {
    try {
        const [props, rooms] = await Promise.all([
            AshroAPI.get('/properties'),
            AshroAPI.get('/rooms')
        ]);
        state.properties = props;
        state.rooms = rooms;

        populateLocationDropdowns();
        renderRooms(state.rooms);
    } catch (err) {
        console.error('Failed to load initial data:', err);
        showToast('Error connecting to Ashro Living service', 'error');
    }
}

function populateLocationDropdowns() {
    const searchLocation = document.getElementById('searchLocation');
    const visitPropertySelect = document.getElementById('visitPropertySelect');

    const activeProps = state.properties.filter(p => p.status === 'Active');

    if (searchLocation) {
        searchLocation.innerHTML = '<option value="">All Operating Campuses (Vastral, Naroda, Rabari Colony)</option>';
        activeProps.forEach(p => {
            searchLocation.innerHTML += `<option value="${p.id}">${p.name} — ${p.area}</option>`;
        });
    }

    if (visitPropertySelect) {
        visitPropertySelect.innerHTML = '';
        activeProps.forEach(p => {
            visitPropertySelect.innerHTML += `<option value="${p.id}">${p.name} — ${p.area}</option>`;
        });
        updateVisitRoomsDropdown();
    }
}

function updateVisitRoomsDropdown() {
    const visitPropertySelect = document.getElementById('visitPropertySelect');
    const visitRoomSelect = document.getElementById('visitRoomSelect');
    if (!visitPropertySelect || !visitRoomSelect) return;

    const selectedPropId = visitPropertySelect.value;
    const matchingRooms = state.rooms.filter(r => !selectedPropId || r.property_id == selectedPropId);

    const prevVal = visitRoomSelect.value;
    visitRoomSelect.innerHTML = '<option value="">Any Available Suite</option>';
    matchingRooms.forEach(r => {
        visitRoomSelect.innerHTML += `<option value="${r.id}">${r.name} (${r.room_type} — ${formatINR(r.price_monthly)}/mo)</option>`;
    });

    if (prevVal && matchingRooms.some(r => r.id == prevVal)) {
        visitRoomSelect.value = prevVal;
    } else {
        visitRoomSelect.value = "";
    }
}

function renderRooms(rooms) {
    const container = document.getElementById('roomsContainer');
    const counterText = document.getElementById('residenceCounterText');
    if (!container) return;

    if (counterText) {
        counterText.textContent = `Displaying ${rooms.length} curated residence${rooms.length === 1 ? '' : 's'} in Amdavad`;
    }

    if (!rooms || rooms.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: #FFFFFF; border-radius: 12px; border: 1px solid var(--border-light);">
                <h3 style="font-size: 24px; color: var(--text-heading); margin-bottom: 8px;">No matching residences found</h3>
                <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 24px;">Please adjust your filter parameters or location selection.</p>
                <button class="btn-secondary" onclick="resetFilters()">View All Residences</button>
            </div>
        `;
        return;
    }

    container.innerHTML = rooms.map(room => {
        const features = room.features || [];
        const bedsLabel = room.available_beds > 0 ? `${room.available_beds} suites available` : 'Waitlist Only';

        return `
            <div class="residence-card" data-id="${room.id}">
                <div class="residence-img-box">
                    <img src="${room.cover_image}" alt="${room.name}" class="residence-img" loading="lazy">
                    <span class="residence-tag-top">${room.property_area}, Amdavad</span>
                    <span class="residence-beds-left">${bedsLabel}</span>
                </div>
                <div class="residence-content">
                    <span class="residence-category">${room.tag || room.room_type}</span>
                    <h3>${room.name}</h3>
                    <p class="residence-desc">${room.description}</p>
                    <div class="residence-specs-line">
                        <span class="spec-badge">${room.size_sqft} sq.ft</span>
                        <span class="spec-badge">${room.washroom_type}</span>
                        ${features.slice(0, 2).map(f => `<span class="spec-badge">${f}</span>`).join('')}
                    </div>
                    <div class="residence-price-row">
                        <div class="price-display">
                            ${formatINR(room.price_monthly)}<span> / month</span>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn-secondary" style="padding: 8px 14px; font-size: 11px;" onclick="openRoomDetails(${room.id})">
                                Details
                            </button>
                            <button class="btn-primary" style="padding: 8px 16px; font-size: 11px;" onclick="openReserveModal(${room.id})">
                                Reserve &rarr;
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Filter Actions
function setRoomTypeFilter(type, buttonEl) {
    state.activeFilter = type;
    document.querySelectorAll('.category-pill').forEach(btn => btn.classList.remove('active'));
    if (buttonEl) buttonEl.classList.add('active');
    applyCombinedFilters();
}

function applySearchFilters() {
    const locSelect = document.getElementById('searchLocation');
    const typeSelect = document.getElementById('searchRoomType');

    state.selectedLocation = locSelect ? locSelect.value : '';
    const roomType = typeSelect ? typeSelect.value : 'all';

    const pills = document.querySelectorAll('.category-pill');
    pills.forEach(pill => {
        if (pill.textContent.includes(roomType) || (roomType === 'all' && pill.textContent.includes('All'))) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });

    state.activeFilter = roomType;
    applyCombinedFilters();

    const targetSection = document.getElementById('rooms') || document.getElementById('roomsContainer');
    if (targetSection) {
        const headerOffset = 80;
        const elementPosition = targetSection.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }
}

function applyCombinedFilters() {
    let filtered = [...state.rooms];

    if (state.selectedLocation) {
        filtered = filtered.filter(r => r.property_id == state.selectedLocation);
    }

    if (state.activeFilter && state.activeFilter !== 'all') {
        filtered = filtered.filter(r => r.room_type.toLowerCase() === state.activeFilter.toLowerCase());
    }

    renderRooms(filtered);
}

function resetFilters() {
    state.activeFilter = 'all';
    state.selectedLocation = '';
    const locSelect = document.getElementById('searchLocation');
    if (locSelect) locSelect.value = '';
    const typeSelect = document.getElementById('searchRoomType');
    if (typeSelect) typeSelect.value = 'all';

    document.querySelectorAll('.category-pill').forEach((pill, idx) => {
        if (idx === 0) pill.classList.add('active');
        else pill.classList.remove('active');
    });

    renderRooms(state.rooms);
}

// Room Details Modal
async function openRoomDetails(roomId) {
    try {
        const room = await AshroAPI.get(`/rooms/${roomId}`);
        state.currentRoom = room;

        const content = document.getElementById('roomDetailsContent');
        if (!content) return;

        const gallery = room.gallery && room.gallery.length ? room.gallery : [room.cover_image];
        const features = room.features || [];

        content.innerHTML = `
            <div style="margin-bottom: 20px;">
                <span class="location-status-tag active" style="margin-bottom: 8px;">${room.tag || room.room_type}</span>
                <h2 style="font-size: 30px; margin-bottom: 4px;">${room.name}</h2>
                <p style="color: var(--text-muted); font-size: 13px;">Ashro Living &bull; ${room.property_name} (${room.property_area}, Amdavad)</p>
            </div>

            <div style="position: relative; margin-bottom: 24px;">
                <img id="modalMainImg" src="${gallery[0]}" alt="${room.name}" style="width: 100%; height: 320px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border-light);">
                <div style="display: flex; gap: 10px; margin-top: 10px; overflow-x: auto;">
                    ${gallery.map((img, idx) => `
                        <img src="${img}" style="width: 80px; height: 60px; object-fit: cover; border-radius: 4px; cursor: pointer; border: 2px solid ${idx === 0 ? 'var(--text-heading)' : 'transparent'};"
                             onclick="changeModalGalleryImg('${img}', this)">
                    `).join('')}
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; text-align: center;">
                <div style="background: var(--bg-primary); padding: 12px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                    <strong style="font-size: 14px; display: block; color: var(--text-heading);">${room.size_sqft} sq.ft</strong>
                    <span style="font-size: 11px; color: var(--text-muted);">Floor Area</span>
                </div>
                <div style="background: var(--bg-primary); padding: 12px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                    <strong style="font-size: 14px; display: block; color: var(--text-heading);">${room.washroom_type}</strong>
                    <span style="font-size: 11px; color: var(--text-muted);">Sanitary</span>
                </div>
                <div style="background: var(--bg-primary); padding: 12px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                    <strong style="font-size: 14px; display: block; color: var(--text-heading);">${room.air_conditioned ? 'Climate Control' : 'Standard'}</strong>
                    <span style="font-size: 11px; color: var(--text-muted);">AC Spec</span>
                </div>
                <div style="background: var(--bg-primary); padding: 12px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                    <strong style="font-size: 14px; display: block; color: var(--text-heading);">${room.balcony ? 'Private Balcony' : 'Large Window'}</strong>
                    <span style="font-size: 11px; color: var(--text-muted);">Aspect</span>
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <h4 style="font-size: 18px; margin-bottom: 8px;">Architecture & Comfort Overview</h4>
                <p style="font-size: 14px; color: var(--text-muted); line-height: 1.7;">${room.description}</p>
            </div>

            <div style="margin-bottom: 24px;">
                <h4 style="font-size: 18px; margin-bottom: 10px;">Included Hospitality Appointments</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${features.map(f => `<span class="spec-badge">${f}</span>`).join('')}
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-light); padding-top: 20px; flex-wrap: wrap; gap: 16px;">
                <div>
                    <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">All-Inclusive Monthly Tariff</span>
                    <div style="font-family: var(--font-serif); font-size: 28px; font-weight: 600; color: var(--text-heading);">
                        ${formatINR(room.price_monthly)}<span style="font-family: var(--font-sans); font-size: 13px; color: var(--text-muted);"> / month</span>
                    </div>
                    <span style="font-size: 11px; color: var(--accent-cocoa);">Includes 3 Wholesome Meals, Fiber Internet & Daily Housekeeping</span>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-secondary" onclick="closeModal('roomDetailsModal'); openVisitModal(${room.property_id}, ${room.id})">Schedule Tour</button>
                    <button class="btn-primary" onclick="closeModal('roomDetailsModal'); openReserveModal(${room.id})">Reserve Suite &rarr;</button>
                </div>
            </div>
        `;

        document.getElementById('roomDetailsModal').classList.add('active');
    } catch (err) {
        showToast('Unable to load residence details', 'error');
    }
}

function changeModalGalleryImg(src, thumbEl) {
    const mainImg = document.getElementById('modalMainImg');
    if (mainImg) mainImg.src = src;

    if (thumbEl && thumbEl.parentElement) {
        Array.from(thumbEl.parentElement.children).forEach(el => el.style.borderColor = 'transparent');
        thumbEl.style.borderColor = 'var(--text-heading)';
    }
}

// Authentication Modal Logic
function openAuthModal() {
    const user = AuthService.getCurrentUser();
    if (user) {
        // Already logged in, route to their respective portal
        if (user.role === 'admin') {
            window.location.href = '/admin';
        } else {
            window.location.href = '/resident';
        }
        return;
    }

    toggleAuthMode('signin');
    document.getElementById('authModal').classList.add('active');
}

function toggleAuthMode(targetMode) {
    const modeInput = document.getElementById('authMode');
    const currentMode = modeInput ? modeInput.value : 'signin';
    const nextMode = targetMode || (currentMode === 'signin' ? 'signup' : 'signin');

    if (modeInput) modeInput.value = nextMode;

    const nameGroup = document.getElementById('authNameGroup');
    const phoneGroup = document.getElementById('authPhoneGroup');
    const titleEl = document.getElementById('authModalTitle');
    const subtitleEl = document.getElementById('authModalSubtitle');
    const submitBtn = document.getElementById('authSubmitBtn');
    const switchPrompt = document.getElementById('authSwitchPrompt');
    const switchBtn = document.getElementById('authSwitchBtn');
    const errBox = document.getElementById('authErrorMessage');
    if (errBox) errBox.style.display = 'none';

    const nameInput = document.getElementById('authName');
    const phoneInput = document.getElementById('authPhone');

    if (nextMode === 'signup') {
        if (nameGroup) nameGroup.style.display = 'flex';
        if (phoneGroup) phoneGroup.style.display = 'flex';
        if (nameInput) nameInput.required = true;
        if (phoneInput) phoneInput.required = true;
        if (titleEl) titleEl.textContent = 'Create an Account';
        if (subtitleEl) subtitleEl.textContent = 'Register as a new resident to view rooms and bookings.';
        if (submitBtn) submitBtn.innerHTML = 'Create Account &rarr;';
        if (switchPrompt) switchPrompt.textContent = 'Already have an account?';
        if (switchBtn) switchBtn.innerHTML = 'Sign In &rarr;';
    } else {
        if (nameGroup) nameGroup.style.display = 'none';
        if (phoneGroup) phoneGroup.style.display = 'none';
        if (nameInput) {
            nameInput.required = false;
            nameInput.value = '';
        }
        if (phoneInput) {
            phoneInput.required = false;
            phoneInput.value = '';
        }
        if (titleEl) titleEl.textContent = 'Sign In';
        if (subtitleEl) subtitleEl.textContent = 'Enter your email & password to access your dashboard.';
        if (submitBtn) submitBtn.innerHTML = 'Sign In &rarr;';
        if (switchPrompt) switchPrompt.textContent = "Don't have an account yet?";
        if (switchBtn) switchBtn.innerHTML = 'Sign Up &rarr;';
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const mode = (document.getElementById('authMode') || {}).value || 'signin';
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const errBox = document.getElementById('authErrorMessage');

    try {
        if (errBox) errBox.style.display = 'none';

        let user;
        if (mode === 'signup') {
            const name = document.getElementById('authName').value.trim();
            const phone = document.getElementById('authPhone').value.trim();
            user = await AuthService.signup(name, email, password, phone);
            closeModal('authModal');
            showToast(`Account created! Welcome, ${user.name}`, 'success');
            window.location.href = '/resident';
        } else {
            user = await AuthService.login(email, password);
            closeModal('authModal');
            showToast(`Welcome back, ${user.name}`, 'success');

            if (user.role === 'admin') {
                window.location.href = '/admin';
            } else {
                window.location.href = '/resident';
            }
        }
    } catch (err) {
        if (errBox) {
            errBox.textContent = err.message || 'Operation failed. Please verify your details.';
            errBox.style.display = 'block';
        } else {
            showToast(err.message || 'Error occurred', 'error');
        }
    }
}

// Visit Booking Modal
function openVisitModal(propertyIdOrIdentifier = null, roomId = null) {
    const modal = document.getElementById('visitModal');
    if (!modal) return;

    let targetPropId = null;

    if (propertyIdOrIdentifier !== null && propertyIdOrIdentifier !== undefined) {
        // If directly a property ID
        const byId = state.properties.find(p => p.id == propertyIdOrIdentifier);
        if (byId) {
            targetPropId = byId.id;
        } else if (typeof propertyIdOrIdentifier === 'string') {
            const lower = propertyIdOrIdentifier.toLowerCase();
            const bySlugOrName = state.properties.find(p =>
                (p.slug && p.slug.toLowerCase().includes(lower)) ||
                (p.name && p.name.toLowerCase().includes(lower)) ||
                (p.area && p.area.toLowerCase().includes(lower))
            );
            if (bySlugOrName) {
                targetPropId = bySlugOrName.id;
            }
        }
    }

    if (roomId) {
        const room = state.rooms.find(r => r.id == roomId);
        if (room) {
            targetPropId = room.property_id;
        }
    }

    const propSelect = document.getElementById('visitPropertySelect');
    if (propSelect) {
        if (targetPropId) {
            propSelect.value = targetPropId;
        } else if (!propSelect.value && state.properties.length > 0) {
            propSelect.value = state.properties[0].id;
        }
        updateVisitRoomsDropdown();
    }

    const roomSelect = document.getElementById('visitRoomSelect');
    if (roomSelect) {
        if (roomId) {
            roomSelect.value = roomId;
        } else {
            // Default room sharing preference to Any Available Suite
            roomSelect.value = "";
        }
    }

    // Default visit date to tomorrow if blank
    const dateInput = document.getElementById('visitDate');
    if (dateInput && !dateInput.value) {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        dateInput.value = d.toISOString().split('T')[0];
    }

    modal.classList.add('active');
}

async function handleVisitSubmit(e) {
    e.preventDefault();
    const tourTypeEl = document.querySelector('input[name="tourType"]:checked');
    const propSelect = document.getElementById('visitPropertySelect');
    const payload = {
        name: document.getElementById('visitName').value,
        email: document.getElementById('visitEmail').value,
        phone: document.getElementById('visitPhone').value,
        property_id: propSelect ? propSelect.value : null,
        room_id: document.getElementById('visitRoomSelect').value || null,
        visit_date: document.getElementById('visitDate').value,
        visit_time: document.getElementById('visitTime').value,
        tour_type: tourTypeEl ? tourTypeEl.value : 'In-Person',
        notes: document.getElementById('visitNotes').value
    };

    try {
        await AshroAPI.post('/visits', payload);
        closeModal('visitModal');
        showToast('Visit confirmed! Manager Piyush has been notified via Email & SMS.', 'success');
        e.target.reset();
    } catch (err) {
        showToast(err.message || 'Failed to submit tour request', 'error');
    }
}

// Instant Reserve Modal
function openReserveModal(roomId) {
    const room = state.rooms.find(r => r.id == roomId);
    if (!room) return;
    state.currentRoom = room;

    const modal = document.getElementById('reserveModal');
    document.getElementById('reserveRoomId').value = room.id;

    const summaryCard = document.getElementById('reserveSummaryCard');
    if (summaryCard) {
        summaryCard.innerHTML = `
            <div style="display: flex; gap: 14px; align-items: center;">
                <img src="${room.cover_image}" alt="${room.name}" style="width: 70px; height: 70px; object-fit: cover; border-radius: 6px;">
                <div>
                    <h4 style="font-size: 18px; margin-bottom: 2px;">${room.name}</h4>
                    <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 2px;">Ashro Living &bull; ${room.property_name} (${room.property_area})</p>
                    <span style="font-size: 11px; font-weight: 700; color: var(--accent-cocoa); text-transform: uppercase;">${room.room_type}</span>
                </div>
            </div>
        `;
    }

    updateReservePricing();
    modal.classList.add('active');
}

function updateReservePricing() {
    const room = state.currentRoom;
    if (!room) return;

    const tenureSelect = document.getElementById('reserveTenure');
    const tenure = tenureSelect ? parseInt(tenureSelect.value) : 6;

    let monthlyRent = room.price_monthly;
    let discount = 0;

    if (tenure >= 6) {
        discount = 1000;
        monthlyRent = monthlyRent - discount;
    } else if (tenure >= 3) {
        discount = 500;
        monthlyRent = monthlyRent - discount;
    }

    const tokenFee = 2000;
    const deposit = monthlyRent;

    const breakdown = document.getElementById('reservePriceBreakdown');
    if (breakdown) {
        breakdown.innerHTML = `
            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
                <span>Monthly Tariff (All-inclusive Meals & Fiber):</span>
                <strong>${formatINR(monthlyRent)}/mo ${discount > 0 ? `<s style="color: #999; font-weight: 400; font-size: 11px;">${formatINR(room.price_monthly)}</s>` : ''}</strong>
            </div>
            ${discount > 0 ? `
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--accent-cocoa); margin-bottom: 6px;">
                    <span>Privilege Long-Stay Rebate:</span>
                    <span>- ${formatINR(discount)}/mo</span>
                </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
                <span>Refundable Escrow Security Deposit:</span>
                <strong>${formatINR(deposit)}</strong>
            </div>
            <div style="border-top: 1px solid var(--border-light); margin: 8px 0; padding-top: 8px; display: flex; justify-content: space-between; font-size: 14px;">
                <span style="font-weight: 700; color: var(--text-heading);">Immediate Token Deposit to Secure Suite:</span>
                <strong style="color: var(--text-heading); font-size: 16px;">${formatINR(tokenFee)}</strong>
            </div>
        `;
    }
}

async function handleReserveSubmit(e) {
    e.preventDefault();
    const tenureSelect = document.getElementById('reserveTenure');
    const tenure = tenureSelect ? parseInt(tenureSelect.value) : 6;
    const room = state.currentRoom;

    let monthlyRent = room.price_monthly;
    let discount = 0;
    if (tenure >= 6) {
        discount = 1000;
        monthlyRent -= discount;
    } else if (tenure >= 3) {
        discount = 500;
        monthlyRent -= discount;
    }

    const payload = {
        room_id: parseInt(document.getElementById('reserveRoomId').value),
        guest_name: document.getElementById('reserveGuestName').value,
        guest_email: document.getElementById('reserveGuestEmail').value,
        guest_phone: document.getElementById('reserveGuestPhone').value,
        move_in_date: document.getElementById('reserveMoveInDate').value,
        tenure_months: tenure,
        monthly_rent: monthlyRent,
        security_deposit: monthlyRent,
        discount_applied: discount,
        token_amount_paid: 2000.0,
        meal_plan_included: true
    };

    try {
        const res = await AshroAPI.post('/bookings', payload);
        closeModal('reserveModal');
        showToast(`Reservation Confirmed. Reference: ${res.data.booking_reference}`, 'success');
        e.target.reset();

        const updatedRooms = await AshroAPI.get('/rooms');
        state.rooms = updatedRooms;
        applyCombinedFilters();
    } catch (err) {
        showToast(err.message || 'Error completing reservation', 'error');
    }
}

// Priority Waitlist Modal / Trigger
function openWaitlistModal(campusName) {
    const campusSelect = document.getElementById('inqCampus');
    if (campusSelect) {
        for (let i = 0; i < campusSelect.options.length; i++) {
            if (campusSelect.options[i].text.includes(campusName)) {
                campusSelect.selectedIndex = i;
                break;
            }
        }
    }
    const msg = document.getElementById('inqMessage');
    if (msg) msg.value = `I am interested in joining the priority pre-booking waitlist for ${campusName}.`;

    const contactSection = document.getElementById('contact');
    if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// Inquiry Form Submission
async function handleInquirySubmit(e) {
    e.preventDefault();
    const payload = {
        name: document.getElementById('inqName').value,
        email: document.getElementById('inqEmail').value,
        phone: document.getElementById('inqPhone').value,
        subject: document.getElementById('inqCampus').value,
        message: document.getElementById('inqMessage').value
    };

    try {
        await AshroAPI.post('/inquiries', payload);
        showToast('Your inquiry has been received. Our concierge will be in touch shortly.', 'success');
        e.target.reset();
    } catch (err) {
        showToast(err.message || 'Failed to submit inquiry', 'error');
    }
}

// FAQ Toggle
function toggleFaq(btnEl) {
    const box = btnEl.closest('.faq-box');
    box.classList.toggle('open');
}

function closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.remove('active');
}

// Interactive Google Map Explorer for Bhagwati PG Group 01, 02, 03
const mapBranchData = {
    group01: {
        title: "Bhagwati PG Group 01 — Rabari Colony Metro",
        address: "Opposite Metro Pillar 118, Rabari Colony Metro Station, Amraiwadi, Khokhra (380026)",
        embedUrl: "https://maps.google.com/maps?q=Rabari+Colony+Metro+Station+Ahmedabad&t=&z=15&ie=UTF8&iwloc=&output=embed",
        mapLink: "https://www.google.com/maps/search/?api=1&query=Bhagwati+PG+Group+01+Rabari+Colony+Ahmedabad"
    },
    group02: {
        title: "Bhagwati PG Group 02 — Vastral Branch",
        address: "Near Nirant Cross Road & Rajendra Park Road, SP Ring Road, Vastral (382418)",
        embedUrl: "https://maps.google.com/maps?q=Nirant+Cross+Road+Vastral+Ahmedabad&t=&z=15&ie=UTF8&iwloc=&output=embed",
        mapLink: "https://www.google.com/maps/search/?api=1&query=Bhagwati+PG+Group+02+Vastral+Ahmedabad"
    },
    group03: {
        title: "Bhagwati PG Group 03 — Naroda Branch",
        address: "Near Galaxy Cinema & Naroda Gam BRTS, Naroda-Dehgam Road, Kathwada, Naroda (382330)",
        embedUrl: "https://maps.google.com/maps?q=Galaxy+Cinema+Naroda+Ahmedabad&t=&z=15&ie=UTF8&iwloc=&output=embed",
        mapLink: "https://www.google.com/maps/search/?api=1&query=Bhagwati+PG+Group+03+Naroda+Ahmedabad"
    }
};

function openExploreMapModal(defaultGroup = 'group01') {
    switchMapBranch(defaultGroup);
    const modal = document.getElementById('exploreMapModal');
    if (modal) modal.classList.add('active');
}

function switchMapBranch(groupKey) {
    const data = mapBranchData[groupKey] || mapBranchData.group01;
    
    // Update active tab button
    ['group01', 'group02', 'group03'].forEach(k => {
        const tabId = k === 'group01' ? 'mapTab01' : (k === 'group02' ? 'mapTab02' : 'mapTab03');
        const tab = document.getElementById(tabId);
        if (tab) {
            if (k === groupKey) tab.classList.add('active');
            else tab.classList.remove('active');
        }
    });

    const iframe = document.getElementById('exploreMapIframe');
    const titleEl = document.getElementById('exploreBranchTitle');
    const addrEl = document.getElementById('exploreBranchAddress');
    const linkEl = document.getElementById('exploreBranchMapLink');

    if (iframe) iframe.src = data.embedUrl;
    if (titleEl) titleEl.textContent = data.title;
    if (addrEl) addrEl.textContent = data.address;
    if (linkEl) linkEl.href = data.mapLink;
}
