/**
 * SmartLocker — Автоматична камера схову
 * Лабораторна робота № 1 з дисципліни «Людино-машинна взаємодія» (ХНУРЕ)
 * Десктопна та мобільна реалізація інтерфейсу
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. DATA AND STATE
  // ==========================================

  const LOCKER_LOCATIONS = [
    {
      id: 'loc-1',
      name: 'Сад Шевченка (Центральний фонтан)',
      address: 'вул. Сумська, 35, Харків',
      lat: 50.0005,
      lng: 36.2305,
      distance: '120 м',
      operatingHours: 'Цілодобово 24/7',
      totalCells: 16,
      freeCells: 7,
      hint: 'Поруч із центральним фонтаном та алеєю'
    },
    {
      id: 'loc-2',
      name: 'ТРЦ «Нікольський»',
      address: 'вул. Григорія Сковороди, 2А, Харків',
      lat: 49.9912,
      lng: 36.2342,
      distance: '350 м',
      operatingHours: '10:00 – 22:00',
      totalCells: 24,
      freeCells: 11,
      hint: 'Вхід з вул. Короленка, рівень -1 біля паркінгу'
    },
    {
      id: 'loc-3',
      name: 'Харків-Пасажирський (Південний вокзал)',
      address: 'Привокзальний майдан, 1, Харків',
      lat: 49.9882,
      lng: 36.2045,
      distance: '850 м',
      operatingHours: 'Цілодобово 24/7',
      totalCells: 32,
      freeCells: 5,
      hint: 'Центральний касовий зал, біля ескалаторів'
    },
    {
      id: 'loc-4',
      name: 'Саржин Яр (Джерело & Парк)',
      address: 'вул. Отакара Яроша / Саржинська, Харків',
      lat: 50.0210,
      lng: 36.2312,
      distance: '1.4 км',
      operatingHours: '06:00 – 23:00',
      totalCells: 12,
      freeCells: 8,
      hint: 'Поруч зі спортивним майданчиком та бюветом'
    }
  ];

  const SIZE_PRICING = {
    'S': { name: 'Розмір S (Мала)', rate: 25, specs: '30×40×50 см', capacity: 'до 15 кг' },
    'M': { name: 'Розмір M (Середня)', rate: 45, specs: '45×60×60 см', capacity: 'до 25 кг' },
    'L': { name: 'Розмір L (Велика)', rate: 70, specs: '60×80×80 см', capacity: 'до 40 кг' }
  };

  // State
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

  // Audio Context for mechanical lock sound synthesis
  let audioCtx = null;

  function initAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
  }

  function playLockSound() {
    try {
      initAudioContext();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      
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
      console.warn('Audio synthesis not supported or blocked:', e);
    }
  }

  // ==========================================
  // 2. PERSISTENCE (localStorage)
  // ==========================================

  function loadSavedData() {
    try {
      const savedRental = localStorage.getItem('smartlocker_active_rental');
      if (savedRental) {
        state.activeRental = JSON.parse(savedRental);
      }

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
            duration: '1 год 45 хв',
            totalPaid: '45.00 грн'
          }
        ];
        saveHistory();
      }
    } catch (e) {
      console.error('Error loading saved state:', e);
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
      console.error('Error saving rental state:', e);
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem('smartlocker_history', JSON.stringify(state.history));
    } catch (e) {
      console.error('Error saving history:', e);
    }
  }

  // ==========================================
  // 3. NAVIGATION & SCREEN SWITCHING
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

  function switchScreen(screenId) {
    Object.keys(screens).forEach(id => {
      if (screens[id]) {
        screens[id].classList.toggle('active', id === screenId);
      }
    });

    // Update desktop nav
    desktopNavLinks.forEach(link => {
      const target = link.getAttribute('data-target');
      link.classList.toggle('active', target === screenId);
    });

    // Update mobile tab buttons
    mobileTabButtons.forEach(btn => {
      const target = btn.getAttribute('data-target');
      btn.classList.toggle('active', target === screenId);
    });

    // Invalidate map size
    if (screenId === 'screen-map' && state.map) {
      setTimeout(() => state.map.invalidateSize(), 200);
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const activeView = screens[screenId];
    if (activeView) {
      const scrollable = activeView.querySelector('.scrollable-content');
      if (scrollable) scrollable.scrollTop = 0;
    }
  }

  // Navigation handlers
  function handleNavClick(target) {
    if (target === 'screen-rental' && !state.activeRental) {
      showToast('У вас наразі немає активної оренди. Оберіть вільну комірку!', 'info');
      switchScreen('screen-booking');
      return;
    }
    switchScreen(target);
  }

  desktopNavLinks.forEach(link => {
    link.addEventListener('click', () => {
      handleNavClick(link.getAttribute('data-target'));
    });
  });

  mobileTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      handleNavClick(btn.getAttribute('data-target'));
    });
  });

  // Brand logo click goes to map
  const brandLogoBtn = document.getElementById('brandLogoBtn');
  if (brandLogoBtn) {
    brandLogoBtn.addEventListener('click', () => switchScreen('screen-map'));
  }

  // Back buttons
  document.querySelectorAll('.nav-back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-back-to') || 'screen-map';
      switchScreen(target);
    });
  });

  // Academic Docs Modals
  const reportDocsModal = document.getElementById('reportDocsModal');
  const openDocsBtn = document.getElementById('openDocsBtn');
  const closeReportDocsBtn = document.getElementById('closeReportDocsBtn');
  const closeReportDocsBtnBottom = document.getElementById('closeReportDocsBtnBottom');

  function openDocs() {
    if (reportDocsModal.showModal) reportDocsModal.showModal();
    else reportDocsModal.setAttribute('open', 'true');
  }

  function closeDocs() {
    if (reportDocsModal.close) reportDocsModal.close();
    else reportDocsModal.removeAttribute('open');
  }

  if (openDocsBtn) openDocsBtn.addEventListener('click', openDocs);
  if (closeReportDocsBtn) closeReportDocsBtn.addEventListener('click', closeDocs);
  if (closeReportDocsBtnBottom) closeReportDocsBtnBottom.addEventListener('click', closeDocs);

  // ==========================================
  // 4. MAP & LOCKER DISCOVERY (SCREEN 1)
  // ==========================================

  function initMap() {
    const initialCoords = [50.000, 36.230];
    
    state.map = L.map('lockersMap', {
      zoomControl: false,
      attributionControl: false
    }).setView(initialCoords, 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(state.map);

    L.control.zoom({ position: 'bottomright' }).addTo(state.map);

    renderMapMarkers(LOCKER_LOCATIONS);
  }

  function renderMapMarkers(locations) {
    state.mapMarkers.forEach(m => state.map.removeLayer(m));
    state.mapMarkers = [];

    locations.forEach(loc => {
      const markerHtml = `
        <div class="custom-map-pin ${loc.id === state.selectedLocker.id ? 'active' : ''}" style="
          background: #2563eb;
          color: #fff;
          padding: 6px 12px;
          border-radius: 20px;
          border: 2px solid #fff;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          font-weight: 800;
          font-size: 11px;
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          cursor: pointer;
        ">
          <i class="fa-solid fa-box-archive"></i>
          <span>${loc.freeCells} вільних</span>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'locker-leaflet-marker',
        html: markerHtml,
        iconSize: [95, 32],
        iconAnchor: [47, 16]
      });

      const marker = L.marker([loc.lat, loc.lng], { icon: customIcon }).addTo(state.map);
      
      marker.on('click', () => {
        selectLocker(loc);
      });

      state.mapMarkers.push(marker);
    });
  }

  function selectLocker(locker) {
    state.selectedLocker = locker;
    
    if (state.map) {
      state.map.panTo([locker.lat, locker.lng], { animate: true });
    }

    document.querySelectorAll('.locker-card').forEach(card => {
      card.classList.toggle('highlighted', card.getAttribute('data-id') === locker.id);
    });

    updateBookingSummary();
  }

  function renderLockersList(locations) {
    const container = document.getElementById('lockersList');
    const badge = document.getElementById('lockersCountBadge');
    container.innerHTML = '';
    badge.textContent = `${locations.length} локації`;

    if (locations.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:30px; color:#64748b; font-size:0.9rem;">За вашим запитом камер схову не знайдено</div>`;
      return;
    }

    locations.forEach(loc => {
      const card = document.createElement('div');
      card.className = `locker-card ${loc.id === state.selectedLocker.id ? 'highlighted' : ''}`;
      card.setAttribute('data-id', loc.id);

      card.innerHTML = `
        <div class="card-top">
          <div>
            <div class="locker-title">${loc.name}</div>
            <div class="locker-address"><i class="fa-solid fa-location-dot"></i> ${loc.address}</div>
          </div>
          <span class="locker-dist">${loc.distance}</span>
        </div>
        <div class="card-footer">
          <span class="free-cells-count"><i class="fa-solid fa-circle-check"></i> ${loc.freeCells} вільних комірок</span>
          <button class="btn-select-locker">
            Обрати локер <i class="fa-solid fa-chevron-right"></i>
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

  // Search without category pills
  const searchInput = document.getElementById('lockerSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  function filterLockers() {
    const query = searchInput.value.trim().toLowerCase();

    const filtered = LOCKER_LOCATIONS.filter(loc => {
      return !query || 
        loc.name.toLowerCase().includes(query) || 
        loc.address.toLowerCase().includes(query) || 
        loc.hint.toLowerCase().includes(query);
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

  document.getElementById('refreshLocationsBtn').addEventListener('click', () => {
    showToast('Список камер схову оновлено', 'info');
    filterLockers();
  });

  document.getElementById('locateUserBtn').addEventListener('click', () => {
    if (state.map) {
      state.map.setView([50.0005, 36.2305], 16);
      showToast('Ваше місцезнаходження визначено!', 'success');
    }
  });

  // ==========================================
  // 5. BOOKING SCREEN & COMPARTMENTS WITH PRICES (SCREEN 2)
  // ==========================================

  function updateBookingSummary() {
    const loc = state.selectedLocker;
    document.getElementById('bookingLockerName').textContent = loc.name;
    document.getElementById('bookingLockerAddress').innerHTML = `<i class="fa-solid fa-location-dot"></i> ${loc.address}`;
    document.getElementById('bookingLockerDistance').textContent = `${loc.distance} від вас`;
    renderCompartmentsGrid();
    calculatePrice();
  }

  // Compartments Matrix Generation (Prices and size on each cell)
  function renderCompartmentsGrid() {
    const grid = document.getElementById('compartmentsGrid');
    grid.innerHTML = '';

    const total = 16;
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
        cellEl.title = `Комірка №${i} (${sizeInfo.name}) — Зайнята`;
      } else {
        cellEl.classList.add('free');
        if (i === state.selectedCellNum) {
          cellEl.classList.add('chosen');
        }
        cellEl.title = `Комірка №${i} (${sizeInfo.name}) — Вільна для оренди (${sizeInfo.rate} грн/год)`;
      }

      cellEl.innerHTML = `
        <div class="cell-top-bar">
          <span class="cell-num">№ ${i}</span>
          <span class="cell-led"></span>
        </div>
        <div class="cell-size-badge">${cellSize} • ${sizeInfo.capacity}</div>
        <div class="cell-price-tag">${sizeInfo.rate} грн/год</div>
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

  // Duration Slider & Price Calculator
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

    const calcBadge = document.getElementById('calcCellBadge');
    if (calcBadge) {
      calcBadge.textContent = `Комірка № ${state.selectedCellNum} (${sizeInfo.name})`;
    }

    document.getElementById('calcBaseRate').textContent = `${rate} грн / год`;
    document.getElementById('calcHours').textContent = `${hours} год`;
    document.getElementById('calcTotalSum').textContent = `${total.toFixed(2)} грн`;
    document.getElementById('btnPricePreview').textContent = `${total.toFixed(0)} грн`;
    document.getElementById('btnCellNumber').textContent = state.selectedCellNum;
  }

  // ==========================================
  // 6. PAYMENT MODAL & CONFIRMATION
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
    document.getElementById('modalCellDetails').textContent = `№ ${state.selectedCellNum} (${sizeInfo.name}, ${sizeInfo.rate} грн/год)`;
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
      hint: state.selectedLocker.hint,
      cellNum: state.selectedCellNum,
      size: state.selectedSize,
      rate: SIZE_PRICING[state.selectedSize].rate,
      startTimestamp: Date.now(),
      startTimeFormatted: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,
      pin: formattedPin,
      status: 'active'
    };

    saveActiveRental();
    updateNavigationDots();
    updateRentalScreen();
    showToast(`Комірку №${state.activeRental.cellNum} заброньовано! Речі готові до зберігання.`, 'success');

    switchScreen('screen-rental');

    setTimeout(() => {
      openDoorModal(state.activeRental.cellNum);
    }, 600);
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
    document.getElementById('rentalLockerHint').textContent = rent.hint || 'Локер розташований біля центрального входу';
    document.getElementById('activeCellNum').textContent = `№ ${rent.cellNum}`;
    
    const sizeInfo = SIZE_PRICING[rent.size];
    document.getElementById('activeCellSize').textContent = `${rent.size} (${sizeInfo.rate} грн/год, ${sizeInfo.specs})`;
    document.getElementById('rentalStartTime').textContent = rent.startTimeFormatted;
    document.getElementById('rentalPinCode').textContent = rent.pin;
    document.getElementById('qrModalPin').textContent = rent.pin;

    generateQrSvg(rent.id + '-' + rent.pin);

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
  // 8. UNLOCKING COMPARTMENT (METAPHOR OF KEY)
  // ==========================================

  const unlockCellBtn = document.getElementById('unlockCellBtn');
  const doorOpenedModal = document.getElementById('doorOpenedModal');
  const closeDoorModalBtn = document.getElementById('closeDoorModalBtn');

  unlockCellBtn.addEventListener('click', () => {
    if (!state.activeRental) return;

    playLockSound();

    unlockCellBtn.style.transform = 'scale(0.97)';
    const textSpan = unlockCellBtn.querySelector('.unlock-main-text');
    const oldText = textSpan.textContent;
    textSpan.textContent = 'РОЗБЛОКУВАННЯ...';

    setTimeout(() => {
      unlockCellBtn.style.transform = '';
      textSpan.textContent = oldText;
      openDoorModal(state.activeRental.cellNum);
    }, 450);
  });

  function openDoorModal(cellNum) {
    document.getElementById('openedCellNum').textContent = cellNum;
    
    const doorVisual = document.getElementById('doorVisual');
    const lockIcon = document.getElementById('doorLockIcon');
    const statusText = document.getElementById('doorStatusText');

    if (doorVisual) {
      doorVisual.className = 'door-visual-box opened';
      lockIcon.className = 'fa-solid fa-lock-open';
      statusText.textContent = `Комірка №${cellNum} ВІДЧИНЕНА`;
    }

    if (doorOpenedModal.showModal) doorOpenedModal.showModal();
    else doorOpenedModal.setAttribute('open', 'true');
  }

  closeDoorModalBtn.addEventListener('click', () => {
    if (doorOpenedModal.close) doorOpenedModal.close();
    else doorOpenedModal.removeAttribute('open');

    const doorVisual = document.getElementById('doorVisual');
    const lockIcon = document.getElementById('doorLockIcon');
    const statusText = document.getElementById('doorStatusText');

    if (doorVisual) {
      doorVisual.className = 'door-visual-box closed';
      lockIcon.className = 'fa-solid fa-lock';
      statusText.textContent = 'Дверцята зачинені та заблоковані';
    }

    showToast('Дверцята заблоковано', 'info');
  });

  // Finish Rental
  const finishRentalBtn = document.getElementById('finishRentalBtn');
  finishRentalBtn.addEventListener('click', () => {
    if (!state.activeRental) return;

    const confirmFinish = confirm('Ви дійсно забрали всі свої речі та бажаєте завершити оренду комірки?');
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
      duration: `${totalMinutes} хв (${billedHours} год)`,
      totalPaid: `${finalPrice} грн`
    });

    saveHistory();

    state.activeRental = null;
    saveActiveRental();
    updateNavigationDots();
    updateRentalScreen();
    renderHistory();

    showToast(`Оренду комірки №${rent.cellNum} успішно завершено! Дякуємо!`, 'success');
    switchScreen('screen-map');
  });

  // ==========================================
  // 9. QR CODE & BACKUP PIN
  // ==========================================

  const qrModal = document.getElementById('qrModal');
  const showQrModalBtn = document.getElementById('showQrModalBtn');
  const closeQrModalBtn = document.getElementById('closeQrModalBtn');
  const dismissQrBtn = document.getElementById('dismissQrBtn');

  function generateQrSvg(text) {
    const svgCode = `
      <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
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
        <rect x="52" y="28" width="6" height="6" fill="#0f172a"/>
        <rect x="10" y="44" width="6" height="6" fill="#0f172a"/>
        <rect x="22" y="48" width="6" height="6" fill="#0f172a"/>
        <rect x="34" y="42" width="6" height="6" fill="#0f172a"/>
        <rect x="46" y="46" width="6" height="6" fill="#0f172a"/>
        <rect x="60" y="42" width="6" height="6" fill="#0f172a"/>
        <rect x="72" y="48" width="6" height="6" fill="#0f172a"/>
        <rect x="84" y="44" width="6" height="6" fill="#0f172a"/>
        <rect x="44" y="62" width="6" height="6" fill="#0f172a"/>
        <rect x="56" y="66" width="6" height="6" fill="#0f172a"/>
        <rect x="44" y="76" width="6" height="6" fill="#0f172a"/>
        <rect x="68" y="72" width="6" height="6" fill="#0f172a"/>
        <rect x="80" y="80" width="6" height="6" fill="#0f172a"/>
      </svg>
    `;

    const thumb = document.getElementById('qrMockContainer');
    if (thumb) thumb.innerHTML = svgCode;

    const large = document.getElementById('largeQrContainer');
    if (large) {
      large.innerHTML = `<div style="width:220px; height:220px; margin:0 auto;">${svgCode}</div>`;
    }
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
      showToast('PIN-код скопійовано', 'info');
    }
  });

  document.getElementById('shareRentalBtn').addEventListener('click', () => {
    if (!state.activeRental) return;
    const shareText = `Моя оренда SmartLocker: ${state.activeRental.lockerName}, комірка №${state.activeRental.cellNum}. Резервний PIN: ${state.activeRental.pin}`;
    if (navigator.share) {
      navigator.share({ title: 'SmartLocker', text: shareText }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
      showToast('Дані оренди скопійовано для відправки!', 'info');
    }
  });

  document.getElementById('openRouteBtn').addEventListener('click', () => {
    if (state.activeRental) {
      showToast(`Прокладаємо пішохідний маршрут до: ${state.activeRental.lockerName}`, 'info');
    }
  });

  // ==========================================
  // 10. HISTORY SCREEN (SCREEN 4)
  // ==========================================

  function renderHistory() {
    const container = document.getElementById('historyListContainer');
    container.innerHTML = '';

    const totalCount = state.history.length;
    let totalSpent = 0;

    state.history.forEach(item => {
      const match = item.totalPaid.match(/[\d.]+/);
      if (match) totalSpent += parseFloat(match[0]);
    });

    document.getElementById('totalRentalsCount').textContent = totalCount;
    document.getElementById('totalSpentCount').textContent = `${totalSpent.toFixed(0)} грн`;

    if (state.history.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:48px 16px; color:#64748b; background:#fff; border-radius:14px; border:1px solid #e2e8f0;">
          <i class="fa-solid fa-receipt" style="font-size:2.5rem; margin-bottom:12px; opacity:0.4;"></i>
          <p style="font-size:1rem; font-weight:600;">У вас поки немає завершених оренд</p>
        </div>
      `;
      return;
    }

    state.history.forEach(item => {
      const card = document.createElement('div');
      card.className = 'history-card';
      card.innerHTML = `
        <div class="history-card-header">
          <div>
            <div class="history-loc-name">${item.lockerName}</div>
            <div class="history-date">${item.date}</div>
          </div>
          <span class="history-status-tag">Завершено</span>
        </div>
        <div class="history-card-body">
          <span>Комірка <strong>№ ${item.cellNum}</strong> (Розмір ${item.size})</span>
          <span>Тривалість: <strong>${item.duration}</strong></span>
          <strong style="color:var(--primary); font-size:1.05rem;">${item.totalPaid}</strong>
        </div>
      `;
      container.appendChild(card);
    });
  }

  document.getElementById('clearHistoryBtn').addEventListener('click', () => {
    if (state.history.length === 0) return;
    if (confirm('Очистити історію оренд?')) {
      state.history = [];
      saveHistory();
      renderHistory();
      showToast('Історію очищено', 'info');
    }
  });

  // ==========================================
  // 11. TOAST NOTIFICATIONS
  // ==========================================

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = '<i class="fa-solid fa-circle-info"></i>';
    if (type === 'success') icon = '<i class="fa-solid fa-circle-check"></i>';

    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
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
