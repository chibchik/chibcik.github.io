/**
 * SmartLocker — Автоматична камера схову
 * Лабораторна робота № 1 з дисципліни «Людино-машинна взаємодія» (ХНУРЕ)
 * Реалізація концептуальної моделі та моделі проектувальника
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
      category: 'park',
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
      category: 'mall',
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
      category: 'station',
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
      category: 'park',
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
    activeRental: null, // Loaded from localStorage or null
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
      // Mechanical "click-clack" frequency synthesis
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

      // Second bounce click
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
        // Initial sample history record for demonstration
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

  const tabButtons = document.querySelectorAll('.bottom-tab-bar .tab-item');
  const rentalActiveDot = document.getElementById('rentalActiveDot');

  function switchScreen(screenId) {
    Object.keys(screens).forEach(id => {
      if (screens[id]) {
        screens[id].classList.toggle('active', id === screenId);
      }
    });

    // Update active tab button
    tabButtons.forEach(btn => {
      const target = btn.getAttribute('data-target');
      btn.classList.toggle('active', target === screenId);
    });

    // Invalidate map size if switching to map
    if (screenId === 'screen-map' && state.map) {
      setTimeout(() => state.map.invalidateSize(), 200);
    }

    // Scroll container to top
    const activeView = screens[screenId];
    if (activeView) {
      const scrollable = activeView.querySelector('.scrollable-content');
      if (scrollable) scrollable.scrollTop = 0;
    }
  }

  // Tab buttons click
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      // If user clicks on 'screen-rental' but has no active rental
      if (target === 'screen-rental' && !state.activeRental) {
        showToast('У вас наразі немає активної оренди. Оберіть вільну комірку!', 'info');
        switchScreen('screen-booking');
        return;
      }
      switchScreen(target);
    });
  });

  // Back buttons
  document.querySelectorAll('.nav-back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-back-to') || 'screen-map';
      switchScreen(target);
    });
  });

  // Header View Mode Switcher
  const viewModeToggle = document.getElementById('viewModeToggle');
  viewModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('full-width-mode');
    const isFull = document.body.classList.contains('full-width-mode');
    viewModeToggle.querySelector('.btn-text').textContent = isFull ? 'Мобільний фрейм' : 'Режим смартфона';
    if (state.map) setTimeout(() => state.map.invalidateSize(), 300);
  });

  // Academic Docs Modals
  const reportDocsModal = document.getElementById('reportDocsModal');
  const openDocsBtn = document.getElementById('openDocsBtn');
  const openFullReportBtn = document.getElementById('openFullReportBtn');
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

  openDocsBtn.addEventListener('click', openDocs);
  openFullReportBtn.addEventListener('click', openDocs);
  closeReportDocsBtn.addEventListener('click', closeDocs);
  closeReportDocsBtnBottom.addEventListener('click', closeDocs);

  // Status Bar live clock
  function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const el = document.getElementById('statusBarTime');
    if (el) el.textContent = `${hours}:${minutes}`;
  }
  setInterval(updateClock, 1000);
  updateClock();

  // ==========================================
  // 4. MAP & LOCKER DISCOVERY (SCREEN 1)
  // ==========================================

  function initMap() {
    // Center on Kharkiv downtown (near Shevchenko Park)
    const initialCoords = [50.000, 36.230];
    
    state.map = L.map('lockersMap', {
      zoomControl: false,
      attributionControl: false
    }).setView(initialCoords, 14);

    // CartoDB Positron / OSM tiles for clean light aesthetic
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(state.map);

    // Add zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(state.map);

    renderMapMarkers(LOCKER_LOCATIONS);
  }

  function renderMapMarkers(locations) {
    // Clear old markers
    state.mapMarkers.forEach(m => state.map.removeLayer(m));
    state.mapMarkers = [];

    locations.forEach(loc => {
      // Custom HTML Marker matching high contrast requirements
      const markerHtml = `
        <div class="custom-map-pin ${loc.id === state.selectedLocker.id ? 'active' : ''}" style="
          background: #2563eb;
          color: #fff;
          padding: 6px 10px;
          border-radius: 20px;
          border: 2px solid #fff;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          font-weight: 800;
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
        className: 'locker-leaflet-marker',
        html: markerHtml,
        iconSize: [85, 30],
        iconAnchor: [42, 15]
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
    
    // Pan to marker
    if (state.map) {
      state.map.panTo([locker.lat, locker.lng], { animate: true });
    }

    // Highlight card in list
    document.querySelectorAll('.locker-card').forEach(card => {
      card.classList.toggle('highlighted', card.getAttribute('data-id') === locker.id);
    });

    // Update Screen 2 Booking summary
    updateBookingSummary();
  }

  function renderLockersList(locations) {
    const container = document.getElementById('lockersList');
    const badge = document.getElementById('lockersCountBadge');
    container.innerHTML = '';
    badge.textContent = `${locations.length} локації`;

    if (locations.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:20px; color:#64748b; font-size:0.85rem;">За вашим запитом камер схову не знайдено</div>`;
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

  // Search & Filtering
  const searchInput = document.getElementById('lockerSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const filterPills = document.querySelectorAll('.filter-pill');

  function filterLockers() {
    const query = searchInput.value.trim().toLowerCase();
    const activeFilterBtn = document.querySelector('.filter-pill.active');
    const category = activeFilterBtn ? activeFilterBtn.getAttribute('data-filter') : 'all';

    const filtered = LOCKER_LOCATIONS.filter(loc => {
      const matchesCategory = category === 'all' || loc.category === category;
      const matchesQuery = !query || 
        loc.name.toLowerCase().includes(query) || 
        loc.address.toLowerCase().includes(query) || 
        loc.hint.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
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

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      filterLockers();
    });
  });

  document.getElementById('refreshLocationsBtn').addEventListener('click', () => {
    showToast('Список камер схову оновлено', 'info');
    filterLockers();
  });

  document.getElementById('locateUserBtn').addEventListener('click', () => {
    if (state.map) {
      state.map.setView([50.0005, 36.2305], 16);
      showToast('Ваше поточне місцезнаходження визначено!', 'success');
    }
  });

  // ==========================================
  // 5. BOOKING SCREEN & COMPARTMENTS (SCREEN 2)
  // ==========================================

  function updateBookingSummary() {
    const loc = state.selectedLocker;
    document.getElementById('bookingLockerName').textContent = loc.name;
    document.getElementById('bookingLockerAddress').innerHTML = `<i class="fa-solid fa-location-dot"></i> ${loc.address}`;
    document.getElementById('bookingLockerDistance').textContent = `${loc.distance} від вас`;
    renderCompartmentsGrid();
    calculatePrice();
  }

  // Size Selector clicks
  const sizeCards = document.querySelectorAll('.size-card');
  sizeCards.forEach(card => {
    card.addEventListener('click', () => {
      sizeCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.selectedSize = card.getAttribute('data-size');
      renderCompartmentsGrid();
      calculatePrice();
    });
  });

  // Compartments Matrix Generation
  function renderCompartmentsGrid() {
    const grid = document.getElementById('compartmentsGrid');
    grid.innerHTML = '';

    // Generate 16 simulated compartments for current locker
    // We deterministically assign sizes and busy/free states
    const total = 16;
    for (let i = 1; i <= total; i++) {
      let cellSize = 'M';
      if (i <= 6) cellSize = 'S';
      else if (i > 12) cellSize = 'L';

      // Deterministic busy cells: cells 3, 7, 9, 11 are occupied
      const isBusy = [3, 7, 9, 11].includes(i);
      const isMatchingSize = (cellSize === state.selectedSize);

      const cellEl = document.createElement('div');
      cellEl.className = 'compartment-cell';

      if (isBusy) {
        cellEl.classList.add('busy');
        cellEl.title = `Комірка №${i} (${cellSize}) — Зайнята`;
      } else {
        cellEl.classList.add('free');
        if (i === state.selectedCellNum) {
          cellEl.classList.add('chosen');
        }
        cellEl.title = `Комірка №${i} (${cellSize}) — Вільна для оренди`;
      }

      cellEl.innerHTML = `
        <span class="cell-led"></span>
        <span class="cell-num">${i}</span>
        <span class="cell-size-tag">${cellSize}</span>
      `;

      if (!isBusy) {
        cellEl.addEventListener('click', () => {
          // If user clicked cell with different size, update size selector automatically
          if (cellSize !== state.selectedSize) {
            state.selectedSize = cellSize;
            sizeCards.forEach(c => c.classList.toggle('selected', c.getAttribute('data-size') === cellSize));
          }
          state.selectedCellNum = i;
          renderCompartmentsGrid();
          calculatePrice();
        });
      }

      grid.appendChild(cellEl);
    }

    // Sync button text
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

    document.getElementById('calcSizeName').textContent = sizeInfo.name;
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
    // Populate Modal details
    const sizeInfo = SIZE_PRICING[state.selectedSize];
    const total = state.estimatedHours * sizeInfo.rate;

    document.getElementById('modalLockerName').textContent = state.selectedLocker.name;
    document.getElementById('modalCellDetails').textContent = `№ ${state.selectedCellNum} (${sizeInfo.name})`;
    document.getElementById('modalTimeEstimate').textContent = `${state.estimatedHours} год (${sizeInfo.rate} грн/год)`;
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

  // Method cards radio styling
  document.querySelectorAll('.payment-method-card input').forEach(input => {
    input.addEventListener('change', () => {
      document.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('selected'));
      input.closest('.payment-method-card').classList.add('selected');
    });
  });

  // Successful payment & rental activation
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
      pin: formattedPin,
      status: 'active'
    };

    saveActiveRental();
    updateRentalScreen();
    showToast(`Комірку №${state.activeRental.cellNum} заброньовано! Речі готові до зберігання.`, 'success');

    // Switch to Screen 3 "Моя оренда"
    switchScreen('screen-rental');

    // Automatically trigger door modal for placing luggage
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
      rentalActiveDot.style.display = 'none';
      if (rentalTimerInterval) clearInterval(rentalTimerInterval);
      return;
    }

    rentalActiveDot.style.display = 'block';

    document.getElementById('rentalLockerTitle').textContent = rent.lockerName;
    document.getElementById('rentalLockerAddr').textContent = rent.lockerAddress;
    document.getElementById('activeCellNum').textContent = `№ ${rent.cellNum}`;
    
    const sizeInfo = SIZE_PRICING[rent.size];
    document.getElementById('activeCellSize').textContent = `${rent.size} (${sizeInfo.specs})`;
    document.getElementById('rentalStartTime').textContent = rent.startTimeFormatted;
    document.getElementById('rentalPinCode').textContent = rent.pin;
    document.getElementById('qrModalPin').textContent = rent.pin;

    // Generate mock QR Code SVG
    generateQrSvg(rent.id + '-' + rent.pin);

    // Start timer counter
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

    // Calculate real-time accumulated cost
    // First hour is charged fully, subsequent hours prorated by fraction of hour
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

    // Play lock sound synthesis
    playLockSound();

    // Visual button state
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
    
    // Update graphic on screen
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

    // Reset visual door status back to locked
    const doorVisual = document.getElementById('doorVisual');
    const lockIcon = document.getElementById('doorLockIcon');
    const statusText = document.getElementById('doorStatusText');

    if (doorVisual) {
      doorVisual.className = 'door-visual-box closed';
      lockIcon.className = 'fa-solid fa-lock';
      statusText.textContent = 'Дверцята зачинені та заблоковані';
    }

    showToast('Дверцята надійно зачинено', 'info');
  });

  // Finish Rental
  const finishRentalBtn = document.getElementById('finishRentalBtn');
  finishRentalBtn.addEventListener('click', () => {
    if (!state.activeRental) return;

    const confirmFinish = confirm('Ви дійсно забрали всі свої речі та бажаєте завершити оренду комірки?');
    if (!confirmFinish) return;

    // Play sound
    playLockSound();

    const rent = state.activeRental;
    const elapsedMs = Date.now() - rent.startTimestamp;
    const totalMinutes = Math.max(1, Math.round(elapsedMs / 60000));
    const billedHours = Math.max(1, Math.ceil(totalMinutes / 60));
    const finalPrice = (billedHours * rent.rate).toFixed(2);

    // Push to history
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

    // Clear active rental
    state.activeRental = null;
    saveActiveRental();
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
    // Elegant SVG QR Mockup with recognizable finder patterns
    const svgCode = `
      <svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="#ffffff" />
        <!-- Top-left finder -->
        <rect x="8" y="8" width="28" height="28" fill="#0f172a" rx="4"/>
        <rect x="14" y="14" width="16" height="16" fill="#ffffff" rx="2"/>
        <rect x="18" y="18" width="8" height="8" fill="#0f172a" rx="1"/>
        <!-- Top-right finder -->
        <rect x="64" y="8" width="28" height="28" fill="#0f172a" rx="4"/>
        <rect x="70" y="14" width="16" height="16" fill="#ffffff" rx="2"/>
        <rect x="74" y="18" width="8" height="8" fill="#0f172a" rx="1"/>
        <!-- Bottom-left finder -->
        <rect x="8" y="64" width="28" height="28" fill="#0f172a" rx="4"/>
        <rect x="14" y="70" width="16" height="16" fill="#ffffff" rx="2"/>
        <rect x="18" y="74" width="8" height="8" fill="#0f172a" rx="1"/>
        <!-- Data points mock -->
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
      large.innerHTML = `<div style="width:200px; height:200px; margin:0 auto;">${svgCode}</div>`;
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

  // Copy PIN
  document.getElementById('copyPinBtn').addEventListener('click', () => {
    if (state.activeRental && navigator.clipboard) {
      navigator.clipboard.writeText(state.activeRental.pin);
      showToast('PIN-код скопійовано в буфер обміну', 'info');
    }
  });

  // Share rental
  document.getElementById('shareRentalBtn').addEventListener('click', () => {
    if (!state.activeRental) return;
    const shareText = `Моя оренда камери схову SmartLocker: ${state.activeRental.lockerName}, комірка №${state.activeRental.cellNum}. Резервний PIN: ${state.activeRental.pin}`;
    if (navigator.share) {
      navigator.share({ title: 'SmartLocker', text: shareText }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
      showToast('Дані оренди скопійовано для відправки!', 'info');
    }
  });

  // Open Route
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

    // Calculate stats
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
        <div style="text-align:center; padding:32px 16px; color:#64748b;">
          <i class="fa-solid fa-receipt" style="font-size:2rem; margin-bottom:8px; opacity:0.5;"></i>
          <p>У вас поки немає завершених оренд</p>
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
          <span>Комірка <strong>№ ${item.cellNum}</strong> (${item.size})</span>
          <span>Час: <strong>${item.duration}</strong></span>
          <strong style="color:var(--primary);">${item.totalPaid}</strong>
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

  if (state.activeRental) {
    updateRentalScreen();
  }
});
