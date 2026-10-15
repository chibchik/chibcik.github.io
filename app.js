/**
 * SmartLocker — Автоматична камера схову
 * Спрощений, чистий та адаптивний інтерфейс
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. DATA AND STATE
  // ==========================================

  const LOCKER_LOCATIONS = [
    {
      id: 'loc-1',
      name: 'Сад Шевченка (Біля фонтану)',
      address: 'вул. Сумська, 35',
      lat: 50.0005,
      lng: 36.2305,
      distance: '120 м',
      freeCells: 8
    },
    {
      id: 'loc-2',
      name: 'ТРЦ «Нікольський»',
      address: 'вул. Григорія Сковороди, 2А',
      lat: 49.9912,
      lng: 36.2342,
      distance: '350 м',
      freeCells: 8
    },
    {
      id: 'loc-3',
      name: 'Південний вокзал (Харків-Пас.)',
      address: 'Привокзальний майдан, 1',
      lat: 49.9882,
      lng: 36.2045,
      distance: '850 м',
      freeCells: 8
    },
    {
      id: 'loc-4',
      name: 'Саржин Яр',
      address: 'вул. Отакара Яроша',
      lat: 50.0210,
      lng: 36.2312,
      distance: '1.4 км',
      freeCells: 8
    }
  ];

  const SIZE_PRICING = {
    'S': { name: 'Розмір S', rate: 25 },
    'M': { name: 'Розмір M', rate: 45 },
    'L': { name: 'Розмір L', rate: 70 }
  };

  let state = {
    selectedLocker: LOCKER_LOCATIONS[0],
    selectedSize: 'M',
    selectedCellNum: 14,
    estimatedHours: 2,
    activeRental: null,
    history: [],
    map: null,
    mapMarkers: []
  };

  // Audio Context for mechanical lock sound
  let audioCtx = null;

  function playLockSound() {
    try {
      if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
      }
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);

      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.12);

      setTimeout(() => {
        if (!audioCtx) return;
        const now2 = audioCtx.currentTime;
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(520, now2);
        osc2.frequency.exponentialRampToValueAtTime(80, now2 + 0.08);

        gain2.gain.setValueAtTime(0.4, now2);
        gain2.gain.exponentialRampToValueAtTime(0.01, now2 + 0.08);

        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start(now2);
        osc2.stop(now2 + 0.08);
      }, 70);
    } catch (e) {
      console.warn('Audio blocked or not supported');
    }
  }

  // ==========================================
  // 2. PERSISTENCE
  // ==========================================

  function loadSavedData() {
    try {
      const savedRental = localStorage.getItem('smartlocker_active_rental');
      if (savedRental) state.activeRental = JSON.parse(savedRental);

      const savedHistory = localStorage.getItem('smartlocker_history');
      if (savedHistory) {
        state.history = JSON.parse(savedHistory);
      } else {
        state.history = [
          {
            id: 'hist-1',
            lockerName: 'ТРЦ «Нікольський»',
            cellNum: 8,
            size: 'S',
            date: 'Вчора, 18:20',
            duration: '2 год',
            totalPaid: '50.00 грн'
          }
        ];
        saveHistory();
      }
    } catch (e) {
      console.error(e);
    }
  }

  function saveActiveRental() {
    try {
      if (state.activeRental) {
        localStorage.setItem('smartlocker_active_rental', JSON.stringify(state.activeRental));
      } else {
        localStorage.removeItem('smartlocker_active_rental');
      }
    } catch (e) {
      console.error(e);
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem('smartlocker_history', JSON.stringify(state.history));
    } catch (e) {
      console.error(e);
    }
  }

  // ==========================================
  // 3. NAVIGATION
  // ==========================================

  const screens = {
    'screen-map': document.getElementById('screen-map'),
    'screen-booking': document.getElementById('screen-booking'),
    'screen-rental': document.getElementById('screen-rental'),
    'screen-history': document.getElementById('screen-history')
  };

  const desktopNavLinks = document.querySelectorAll('.desktop-nav-menu .nav-link');
  const mobileTabButtons = document.querySelectorAll('.bottom-tab-bar .tab-item');
  const rentalActiveDot = document.getElementById('rentalActiveDot');
  const desktopRentalDot = document.getElementById('desktopRentalDot');

  function updateNavigationDots() {
    const isRenting = Boolean(state.activeRental);
    if (rentalActiveDot) rentalActiveDot.style.display = isRenting ? 'inline-block' : 'none';
    if (desktopRentalDot) desktopRentalDot.style.display = isRenting ? 'inline-block' : 'none';
  }

  function invalidateMap() {
    if (state.map) {
      setTimeout(() => {
        state.map.invalidateSize();
      }, 50);
      setTimeout(() => {
        state.map.invalidateSize();
      }, 300);
    }
  }

  function switchScreen(screenId) {
    Object.keys(screens).forEach(id => {
      if (screens[id]) screens[id].classList.toggle('active', id === screenId);
    });

    desktopNavLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('data-target') === screenId);
    });

    mobileTabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-target') === screenId);
    });

    if (screenId === 'screen-map') {
      invalidateMap();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleNav(target) {
    if (target === 'screen-rental' && !state.activeRental) {
      showToast('Немає активної оренди. Оберіть комірку!', 'info');
      switchScreen('screen-booking');
      return;
    }
    switchScreen(target);
  }

  desktopNavLinks.forEach(link => {
    link.addEventListener('click', () => handleNav(link.getAttribute('data-target')));
  });

  mobileTabButtons.forEach(btn => {
    btn.addEventListener('click', () => handleNav(btn.getAttribute('data-target')));
  });

  const brandLogoBtn = document.getElementById('brandLogoBtn');
  if (brandLogoBtn) {
    brandLogoBtn.addEventListener('click', () => switchScreen('screen-map'));
  }

  document.querySelectorAll('.nav-back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchScreen(btn.getAttribute('data-back-to') || 'screen-map');
    });
  });

  // Handle window resizing to keep map responsive
  window.addEventListener('resize', invalidateMap);

  // ==========================================
  // 4. MAP & LOCKERS LIST (SCREEN 1)
  // ==========================================

  function initMap() {
    const coords = [50.000, 36.230];
    
    state.map = L.map('lockersMap', {
      zoomControl: true
    }).setView(coords, 14);

    L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_4lca_1_771f025d3820d6c782919594', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(state.map);

    renderMapMarkers(LOCKER_LOCATIONS);
    invalidateMap();
  }

  function renderMapMarkers(locations) {
    state.mapMarkers.forEach(m => state.map.removeLayer(m));
    state.mapMarkers = [];

    locations.forEach(loc => {
      const isSelected = loc.id === state.selectedLocker.id;
      const markerHtml = `
        <div style="
          background: ${isSelected ? '#1d4ed8' : '#2563eb'};
          color: #fff;
          padding: 5px 10px;
          border-radius: 14px;
          border: 2px solid #fff;
          box-shadow: 0 3px 8px rgba(0,0,0,0.25);
          font-weight: 700;
          font-size: 11px;
          display: flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
          cursor: pointer;
        ">
          <i class="fa-solid fa-box-archive"></i>
          <span>${loc.freeCells} вільних</span>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-locker-marker',
        html: markerHtml,
        iconSize: [85, 28],
        iconAnchor: [42, 14]
      });

      const marker = L.marker([loc.lat, loc.lng], { icon: customIcon }).addTo(state.map);
      marker.on('click', () => selectLocker(loc));
      state.mapMarkers.push(marker);
    });
  }

  function selectLocker(locker) {
    state.selectedLocker = locker;
    if (state.map) state.map.panTo([locker.lat, locker.lng], { animate: true });

    document.querySelectorAll('.locker-card').forEach(card => {
      card.classList.toggle('highlighted', card.getAttribute('data-id') === locker.id);
    });

    updateBookingSummary();
  }

  function renderLockersList(locations) {
    const container = document.getElementById('lockersList');
    container.innerHTML = '';

    if (locations.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:24px; color:#94a3b8; font-size:0.85rem;">Нічого не знайдено</div>`;
      return;
    }

    locations.forEach(loc => {
      const card = document.createElement('div');
      card.className = `locker-card ${loc.id === state.selectedLocker.id ? 'highlighted' : ''}`;
      card.setAttribute('data-id', loc.id);

      card.innerHTML = `
        <div class="card-top">
          <span class="locker-title">${loc.name}</span>
          <span class="locker-dist">${loc.distance}</span>
        </div>
        <div class="locker-address">${loc.address}</div>
        <div class="card-footer">
          <span class="free-cells-count">${loc.freeCells} вільних комірок</span>
          <button class="btn-select-locker">
            Обрати <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      `;

      card.addEventListener('click', () => {
        selectLocker(loc);
        switchScreen('screen-booking');
      });

      container.appendChild(card);
    });
  }

  const searchInput = document.getElementById('lockerSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  function filterLockers() {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = LOCKER_LOCATIONS.filter(loc => {
      return !query || loc.name.toLowerCase().includes(query) || loc.address.toLowerCase().includes(query);
    });

    renderLockersList(filtered);
    renderMapMarkers(filtered);
  }

  searchInput.addEventListener('input', () => {
    clearSearchBtn.style.display = searchInput.value ? 'block' : 'none';
    filterLockers();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    filterLockers();
  });

  document.getElementById('locateUserBtn').addEventListener('click', () => {
    if (state.map) {
      state.map.setView([50.0005, 36.2305], 16);
      showToast('Ваше місцезнаходження визначено', 'success');
    }
  });

  // ==========================================
  // 5. BOOKING SCREEN (SCREEN 2)
  // ==========================================

  function updateBookingSummary() {
    const loc = state.selectedLocker;
    const nameEl = document.getElementById('bookingLockerName');
    if (nameEl) nameEl.textContent = loc.name;

    renderCompartmentsGrid();
    calculatePrice();
  }

  function renderCompartmentsGrid() {
    const grid = document.getElementById('compartmentsGrid');
    grid.innerHTML = '';

    const total = 12;
    for (let i = 1; i <= total; i++) {
      let cellSize = 'M';
      if (i <= 6) cellSize = 'S';
      else if (i > 12) cellSize = 'L';

      const sizeInfo = SIZE_PRICING[cellSize];
      const isBusy = [3, 7, 9, 11].includes(i);

      const cellEl = document.createElement('div');
      cellEl.className = 'compartment-cell';

      if (isBusy) {
        cellEl.classList.add('busy');
        cellEl.title = `Комірка №${i} — Зайнята`;
      } else {
        cellEl.classList.add('free');
        if (i === state.selectedCellNum) cellEl.classList.add('chosen');
        cellEl.title = `Комірка №${i} (${sizeInfo.rate} грн/год)`;
      }

      cellEl.innerHTML = `
        <div class="cell-top-bar">
          <span class="cell-num">${i}</span>
          <span class="cell-led"></span>
        </div>
        <div class="cell-info-row">
          <span class="cell-size-badge">${cellSize}</span>
          <span class="cell-price-tag">${sizeInfo.rate} грн/год</span>
        </div>
      `;

      if (!isBusy) {
        cellEl.addEventListener('click', () => {
          state.selectedCellNum = i;
          state.selectedSize = cellSize;
          renderCompartmentsGrid();
          calculatePrice();
        });
      }

      grid.appendChild(cellEl);
    }

    document.getElementById('btnCellNumber').textContent = state.selectedCellNum;
  }

  const durationSlider = document.getElementById('durationSlider');
  const durationLabel = document.getElementById('durationLabel');

  durationSlider.addEventListener('input', () => {
    state.estimatedHours = parseInt(durationSlider.value, 10);
    const h = state.estimatedHours;
    durationLabel.textContent = `${h} ${h === 1 ? 'година' : (h < 5 ? 'години' : 'годин')}`;
    calculatePrice();
  });

  function calculatePrice() {
    const sizeInfo = SIZE_PRICING[state.selectedSize];
    const hours = state.estimatedHours;
    const rate = sizeInfo.rate;
    const total = hours * rate;

    const badge = document.getElementById('calcCellBadge');
    if (badge) badge.textContent = `Комірка № ${state.selectedCellNum} (${sizeInfo.name})`;

    document.getElementById('calcBaseRate').textContent = `${rate} грн / год`;
    document.getElementById('calcTotalSum').textContent = `${total.toFixed(2)} грн`;
    document.getElementById('btnPricePreview').textContent = `${total.toFixed(0)} грн`;
    document.getElementById('btnCellNumber').textContent = state.selectedCellNum;
  }

  // ==========================================
  // 6. PAYMENT MODAL
  // ==========================================

  const paymentModal = document.getElementById('paymentModal');
  const proceedToPaymentBtn = document.getElementById('proceedToPaymentBtn');
  const closePaymentModalBtn = document.getElementById('closePaymentModalBtn');
  const cancelBookingBtn = document.getElementById('cancelBookingBtn');
  const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');

  proceedToPaymentBtn.addEventListener('click', () => {
    const sizeInfo = SIZE_PRICING[state.selectedSize];
    const total = state.estimatedHours * sizeInfo.rate;

    document.getElementById('modalLockerName').textContent = state.selectedLocker.name;
    document.getElementById('modalCellDetails').textContent = `№ ${state.selectedCellNum} (${sizeInfo.name})`;
    document.getElementById('modalTimeEstimate').textContent = `${state.estimatedHours} год`;
    document.getElementById('modalTotalPrice').textContent = `${total.toFixed(2)} грн`;

    if (paymentModal.showModal) paymentModal.showModal();
    else paymentModal.setAttribute('open', 'true');
  });

  function closePayment() {
    if (paymentModal.close) paymentModal.close();
    else paymentModal.removeAttribute('open');
  }

  closePaymentModalBtn.addEventListener('click', closePayment);
  cancelBookingBtn.addEventListener('click', closePayment);

  document.querySelectorAll('.payment-method-card input').forEach(input => {
    input.addEventListener('change', () => {
      document.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('selected'));
      input.closest('.payment-method-card').classList.add('selected');
    });
  });

  confirmPaymentBtn.addEventListener('click', () => {
    closePayment();

    const now = new Date();
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const formattedPin = `${pin.substring(0, 3)}-${pin.substring(3)}`;

    state.activeRental = {
      id: 'rent-' + Date.now(),
      lockerId: state.selectedLocker.id,
      lockerName: state.selectedLocker.name,
      lockerAddress: state.selectedLocker.address,
      cellNum: state.selectedCellNum,
      size: state.selectedSize,
      rate: SIZE_PRICING[state.selectedSize].rate,
      startTimestamp: Date.now(),
      startTimeFormatted: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,
      pin: formattedPin
    };

    saveActiveRental();
    updateNavigationDots();
    updateRentalScreen();
    showToast(`Комірку №${state.activeRental.cellNum} заброньовано!`, 'success');

    switchScreen('screen-rental');

    setTimeout(() => {
      openDoorModal(state.activeRental.cellNum);
    }, 400);
  });

  // ==========================================
  // 7. ACTIVE RENTAL SCREEN (SCREEN 3)
  // ==========================================

  let rentalTimerInterval = null;

  function updateRentalScreen() {
    const rent = state.activeRental;
    if (!rent) {
      updateNavigationDots();
      if (rentalTimerInterval) clearInterval(rentalTimerInterval);
      return;
    }

    updateNavigationDots();

    document.getElementById('rentalLockerTitle').textContent = rent.lockerName;
    document.getElementById('rentalLockerAddr').textContent = rent.lockerAddress;
    document.getElementById('activeCellNum').textContent = `№ ${rent.cellNum}`;
    
    const sizeInfo = SIZE_PRICING[rent.size];
    document.getElementById('activeCellSize').textContent = `${rent.size} · ${sizeInfo.rate} грн/год`;
    document.getElementById('rentalPinCode').textContent = rent.pin;
    document.getElementById('qrModalPin').textContent = rent.pin;

    generateQrSvg();

    if (rentalTimerInterval) clearInterval(rentalTimerInterval);
    rentalTimerInterval = setInterval(updateLiveTimer, 1000);
    updateLiveTimer();
  }

  function updateLiveTimer() {
    if (!state.activeRental) return;

    const elapsedMs = Date.now() - state.activeRental.startTimestamp;
    const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const formattedTime = `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
    const timerDisplay = document.getElementById('liveTimerDisplay');
    if (timerDisplay) timerDisplay.textContent = formattedTime;

    const rate = state.activeRental.rate;
    const billedHours = Math.max(1, Math.ceil(totalSeconds / 3600));
    const currentCost = (billedHours * rate).toFixed(2);

    const costEl = document.getElementById('rentalCurrentCost');
    if (costEl) costEl.textContent = `${currentCost} грн`;
  }

  // ==========================================
  // 8. UNLOCKING & COMPLETION
  // ==========================================

  const unlockCellBtn = document.getElementById('unlockCellBtn');
  const doorOpenedModal = document.getElementById('doorOpenedModal');
  const closeDoorModalBtn = document.getElementById('closeDoorModalBtn');

  unlockCellBtn.addEventListener('click', () => {
    if (!state.activeRental) return;
    playLockSound();

    const textSpan = unlockCellBtn.querySelector('.unlock-main-text');
    textSpan.textContent = 'ВІДЧИНЯЄТЬСЯ...';

    setTimeout(() => {
      textSpan.textContent = 'ВІДКРИТИ КОМІРКУ';
      openDoorModal(state.activeRental.cellNum);
    }, 400);
  });

  function openDoorModal(cellNum) {
    document.getElementById('openedCellNum').textContent = cellNum;
    if (doorOpenedModal.showModal) doorOpenedModal.showModal();
    else doorOpenedModal.setAttribute('open', 'true');
  }

  closeDoorModalBtn.addEventListener('click', () => {
    if (doorOpenedModal.close) doorOpenedModal.close();
    else doorOpenedModal.removeAttribute('open');
    showToast('Дверцята заблоковано', 'info');
  });

  const finishRentalBtn = document.getElementById('finishRentalBtn');
  finishRentalBtn.addEventListener('click', () => {
    if (!state.activeRental) return;

    const confirmFinish = confirm('Завершити оренду комірки?');
    if (!confirmFinish) return;

    playLockSound();

    const rent = state.activeRental;
    const elapsedMs = Date.now() - rent.startTimestamp;
    const totalMinutes = Math.max(1, Math.round(elapsedMs / 60000));
    const billedHours = Math.max(1, Math.ceil(totalMinutes / 60));
    const finalPrice = (billedHours * rent.rate).toFixed(2);

    state.history.unshift({
      id: 'hist-' + Date.now(),
      lockerName: rent.lockerName,
      cellNum: rent.cellNum,
      size: rent.size,
      date: 'Сьогодні, ' + rent.startTimeFormatted,
      duration: `${billedHours} год`,
      totalPaid: `${finalPrice} грн`
    });

    saveHistory();

    state.activeRental = null;
    saveActiveRental();
    updateNavigationDots();
    updateRentalScreen();
    renderHistory();

    showToast(`Оренду комірки №${rent.cellNum} завершено!`, 'success');
    switchScreen('screen-map');
  });

  // ==========================================
  // 9. QR CODE & PIN
  // ==========================================

  const qrModal = document.getElementById('qrModal');
  const showQrModalBtn = document.getElementById('showQrModalBtn');
  const closeQrModalBtn = document.getElementById('closeQrModalBtn');
  const dismissQrBtn = document.getElementById('dismissQrBtn');

  function generateQrSvg() {
    const svgCode = `
      <svg viewBox="0 0 100 100" width="180" height="180" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="#ffffff" />
        <rect x="8" y="8" width="28" height="28" fill="#0f172a" rx="4"/>
        <rect x="14" y="14" width="16" height="16" fill="#ffffff" rx="2"/>
        <rect x="18" y="18" width="8" height="8" fill="#0f172a" rx="1"/>
        <rect x="64" y="8" width="28" height="28" fill="#0f172a" rx="4"/>
        <rect x="70" y="14" width="16" height="16" fill="#ffffff" rx="2"/>
        <rect x="74" y="18" width="8" height="8" fill="#0f172a" rx="1"/>
        <rect x="8" y="64" width="28" height="28" fill="#0f172a" rx="4"/>
        <rect x="14" y="70" width="16" height="16" fill="#ffffff" rx="2"/>
        <rect x="18" y="74" width="8" height="8" fill="#0f172a" rx="1"/>
        <rect x="42" y="10" width="6" height="6" fill="#0f172a"/>
        <rect x="52" y="14" width="6" height="6" fill="#0f172a"/>
        <rect x="42" y="24" width="6" height="6" fill="#0f172a"/>
        <rect x="10" y="44" width="6" height="6" fill="#0f172a"/>
        <rect x="34" y="42" width="6" height="6" fill="#0f172a"/>
        <rect x="60" y="42" width="6" height="6" fill="#0f172a"/>
        <rect x="72" y="48" width="6" height="6" fill="#0f172a"/>
        <rect x="44" y="62" width="6" height="6" fill="#0f172a"/>
        <rect x="56" y="66" width="6" height="6" fill="#0f172a"/>
        <rect x="80" y="80" width="6" height="6" fill="#0f172a"/>
      </svg>
    `;
    const container = document.getElementById('largeQrContainer');
    if (container) container.innerHTML = svgCode;
  }

  showQrModalBtn.addEventListener('click', () => {
    if (qrModal.showModal) qrModal.showModal();
    else qrModal.setAttribute('open', 'true');
  });

  function closeQr() {
    if (qrModal.close) qrModal.close();
    else qrModal.removeAttribute('open');
  }

  closeQrModalBtn.addEventListener('click', closeQr);
  dismissQrBtn.addEventListener('click', closeQr);

  document.getElementById('copyPinBtn').addEventListener('click', () => {
    if (state.activeRental && navigator.clipboard) {
      navigator.clipboard.writeText(state.activeRental.pin);
      showToast('PIN скопійовано', 'info');
    }
  });

  // ==========================================
  // 10. HISTORY (SCREEN 4)
  // ==========================================

  function renderHistory() {
    const container = document.getElementById('historyListContainer');
    container.innerHTML = '';

    if (state.history.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:36px; color:#94a3b8; background:#fff; border-radius:12px; border:1px solid #e2e8f0;">
          <p style="font-size:0.95rem; font-weight:600;">У вас поки немає завершених оренд</p>
        </div>
      `;
      return;
    }

    state.history.forEach(item => {
      const card = document.createElement('div');
      card.className = 'history-card';
      card.innerHTML = `
        <div class="history-info-col">
          <h4>${item.lockerName} • Комірка №${item.cellNum}</h4>
          <p>${item.date} · ${item.duration}</p>
        </div>
        <div class="history-amount">${item.totalPaid}</div>
      `;
      container.appendChild(card);
    });
  }

  document.getElementById('clearHistoryBtn').addEventListener('click', () => {
    if (state.history.length === 0) return;
    if (confirm('Очистити історію?')) {
      state.history = [];
      saveHistory();
      renderHistory();
      showToast('Історію очищено', 'info');
    }
  });

  // ==========================================
  // 11. TOAST
  // ==========================================

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================

  loadSavedData();
  initMap();
  renderLockersList(LOCKER_LOCATIONS);
  updateBookingSummary();
  renderHistory();
  updateNavigationDots();

  if (state.activeRental) {
    updateRentalScreen();
  }
});
