import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, collection, addDoc, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, 
  serverTimestamp, query, where, orderBy, onSnapshot, writeBatch 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
  GoogleAuthProvider, OAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { locationService } from "./location/index.js";
import { BRIDAL_CATEGORIES, ETHNIC_CATEGORIES, KIDS_CATEGORIES, WESTERN_CATEGORIES, WOMEN_CATEGORIES } from "./catalogData.js";
import { evaluateRuleChatbot, resetConversationState } from "./ruleChatbot.js";

const firebaseConfig = {
  apiKey: "AIzaSyClbTtfoGIsidVBpXmnnoga7i8ITSAGJ9I",
  authDomain: "jayashree-fashion-106ad.firebaseapp.com",
  projectId: "jayashree-fashion-106ad",
  storageBucket: "jayashree-fashion-106ad.firebasestorage.app",
  messagingSenderId: "354729251033",
  appId: "1:354729251033:web:4493a8d0dd1cec1e28eec8",
  measurementId: "G-GKX9H6HZ25"
};

let app = null;
try {
  app = initializeApp(firebaseConfig);
  window.fbDb = getFirestore(app);
  window.fbAuth = getAuth(app);
} catch (err) {
  console.warn("Firebase initialization skipped for local preview:", err);
  window.fbDb = null;
  window.fbAuth = null;
}
window.fbFns = {
  collection, addDoc, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  serverTimestamp, query, where, orderBy, onSnapshot, writeBatch,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
  GoogleAuthProvider, OAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult
};
window.fbFnsLoaded = true;

// ==========================================
// MAIN APPLICATION LOGIC
// ==========================================

if ('scrollRestoration' in history) { history.scrollRestoration = 'manual'; }

const DEFAULT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const KIDS_SIZES = [
  "1-2 Years", "2-3 Years", "3-4 Years", "4-5 Years",
  "5-6 Years", "6-7 Years", "7-8 Years", "8-9 Years",
  "9-10 Years", "10-11 Years", "11-12 Years", "12-13 Years", "13-14 Years"
];

const CATALOGUE_DATA = {
  women: {
    defaultCat: Object.keys(WOMEN_CATEGORIES)[0], // 'co-ords' (Co-Ord Sets)
    catLabel: 'Women',
    categories: WOMEN_CATEGORIES
  },
  kids: {
    defaultCat: Object.keys(KIDS_CATEGORIES)[0], // 'kids-casual' (Casual Wear)
    catLabel: 'Kids',
    categories: KIDS_CATEGORIES
  },
  bridal: {
    defaultCat: Object.keys(BRIDAL_CATEGORIES)[0], // 'accessories' (Bridal Accessories)
    catLabel: 'Bridal',
    categories: BRIDAL_CATEGORIES
  },
  ethnic: {
    defaultCat: Object.keys(ETHNIC_CATEGORIES)[0], // 'anarkalis' (Anarkalis)
    catLabel: 'Ethnic',
    categories: ETHNIC_CATEGORIES
  },
  western: {
    defaultCat: Object.keys(WESTERN_CATEGORIES)[0], // 'bodycon' (Bodycon Dresses)
    catLabel: 'Western',
    categories: WESTERN_CATEGORIES
  }
};

/* =========================================================
   3D FLIP STATE MANAGEMENT
   ========================================================= */
const cardStates = {};
let activeFlipCardId = null;

function resetCardState(container, cardId) {
  if (cardStates[cardId]) {
    cardStates[cardId].size = null;
    cardStates[cardId].isOpen = false;
  }
  container.querySelectorAll('.size-chip').forEach(btn => btn.classList.remove('active'));
  const card = container.closest('.design-card') || container;
  const buyNowBtn = card.querySelector('.buy-now-btn');
  if (buyNowBtn) {
    buyNowBtn.classList.remove('btn-card-secondary');
    buyNowBtn.classList.add('btn-card-primary');
  }
  const msgEl = document.getElementById(`msg-${cardId}`);
  if (msgEl) {
    msgEl.style.display = 'none';
    msgEl.textContent = '';
  }
}

function toggleFlip(cardId) {
  const container = document.querySelector(`[data-card-id="${cardId}"]`);
  if (!container) return;

  if (activeFlipCardId === cardId) {
    container.classList.remove('is-flipped');
    activeFlipCardId = null;
    resetCardState(container, cardId);
    return;
  }

  if (activeFlipCardId) {
    const prevContainer = document.querySelector(`[data-card-id="${activeFlipCardId}"]`);
    if (prevContainer) {
      prevContainer.classList.remove('is-flipped');
      resetCardState(prevContainer, activeFlipCardId);
    }
  }

  container.classList.add('is-flipped');
  activeFlipCardId = cardId;
  if (!cardStates[cardId]) {
    cardStates[cardId] = { isOpen: true, size: null };
  } else {
    cardStates[cardId].isOpen = true;
  }
}

function selectSize(cardId, size) {
  if (!cardStates[cardId]) cardStates[cardId] = { isOpen: true, size: null };
  cardStates[cardId].size = size;

  const container = document.querySelector(`[data-card-id="${cardId}"]`);
  if (!container) return;

  container.querySelectorAll('.size-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.size === size);
  });

  const card = container.closest('.design-card') || container;
  const buyNowBtn = card.querySelector('.buy-now-btn');
  if (buyNowBtn) {
    buyNowBtn.classList.remove('btn-card-secondary');
    buyNowBtn.classList.add('btn-card-primary');
  }
  const msgEl = document.getElementById(`msg-${cardId}`);
  if (msgEl) {
    msgEl.style.display = 'none';
    msgEl.textContent = '';
  }

  updateCustomisationLinks(cardId);
}

function updateCustomisationLinks(cardId) {
  const container = document.querySelector(`[data-card-id="${cardId}"]`);
  if (!container) return;

  const state = cardStates[cardId] || { size: null };
  const cat = container.dataset.category;
  const design = container.dataset.design;

  let url = `#/customisation?category=${encodeURIComponent(cat)}&design=${encodeURIComponent(design)}`;
  if (state.size) url += `&size=${encodeURIComponent(state.size)}`;

  const card = container.closest('.design-card') || container;
  card.querySelectorAll('.customisation-link').forEach(a => {
    a.href = url;
  });
}

let pendingPurchase = null;

/* =========================================================
   DELIVERY DETAILS & ORDER CHECKOUT FLOW
   ========================================================= */

const ESTIMATED_DELIVERY_TIMELINE = "7–17 days";
let currentCheckoutPurchase = null;
let pendingOrderCheckout = null;

/**
 * UI requests State data dynamically from the dedicated location structure
 */
function ensureStateOptions() {
  const stateSelect = document.getElementById('deliveryState');
  if (!stateSelect) return;
  const states = locationService.getStates();
  if (stateSelect.options.length <= 1) {
    stateSelect.innerHTML = '<option value="">Select your state</option>' +
      states.map(st => `<option value="${st.name}">${st.name}</option>`).join('');
  }
}

/**
 * Handles State change to request Districts from the location structure
 */
function handleStateSelectionChange(selectedState) {
  const districtSelect = document.getElementById('deliveryDistrict');
  if (!districtSelect) return;

  if (!selectedState) {
    districtSelect.innerHTML = '<option value="">Select your district</option>';
    districtSelect.value = '';
    districtSelect.disabled = true;
    updateLogisticsDisplay(null, '');
    return;
  }

  const districts = locationService.getDistricts(selectedState);
  if (districts && districts.length > 0) {
    districtSelect.innerHTML = '<option value="">Select your district</option>' +
      districts.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
    districtSelect.disabled = false;
  } else {
    districtSelect.innerHTML = '<option value="">Select your district</option>';
    districtSelect.disabled = true;
  }
  districtSelect.value = '';

  updateLogisticsDisplay(null, selectedState);
}

/**
 * Handles District change to update logistics from location structure
 */
function handleDistrictSelectionChange(selectedDistrict, selectedState) {
  const pinVal = document.getElementById('deliveryPin')?.value || '';
  updateLogisticsDisplay(pinVal, selectedState);
}

function parseRangeDays(rangeStr) {
  if (!rangeStr) return { min: 2, max: 4 };
  const match = String(rangeStr).match(/(\d+)\s*[-–—]\s*(\d+)/);
  if (match) {
    return { min: parseInt(match[1], 10), max: parseInt(match[2], 10) };
  }
  const single = String(rangeStr).match(/(\d+)/);
  if (single) {
    const n = parseInt(single[1], 10);
    return { min: n, max: n + 2 };
  }
  return { min: 2, max: 4 };
}

function formatDynamicDeliveryDateRange(pinCode, stateName, orderDate = new Date()) {
  const info = locationService.getDeliveryInfo(pinCode, { stateName });
  const basePrepDays = 7; // standard designer tailoring window

  let minDays = 2;
  let maxDays = 4;

  if (info && info.recommendedDeliveryRange) {
    const parsed = parseRangeDays(info.recommendedDeliveryRange);
    minDays = parsed.min;
    maxDays = parsed.max;
  }

  const startDate = new Date(orderDate);
  startDate.setDate(startDate.getDate() + basePrepDays + minDays);

  const endDate = new Date(orderDate);
  endDate.setDate(endDate.getDate() + basePrepDays + maxDays);

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const startDay = startDate.getDate();
  const endDay = endDate.getDate();
  const startMonth = MONTHS[startDate.getMonth()];
  const endMonth = MONTHS[endDate.getMonth()];
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  if (startYear === endYear) {
    if (startMonth === endMonth) {
      return `${startDay}–${endDay} ${startMonth} ${startYear}`;
    }
    return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${startYear}`;
  }
  return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
}

/**
 * Updates logistics card to display only the dynamic estimated delivery date
 */
function updateLogisticsDisplay(pinCode, stateName) {
  const logisticsCard = document.getElementById('checkoutLogisticsCard');
  const logisticsDate = document.getElementById('logisticsDeliveryDate');

  if (!logisticsCard) return;

  const info = locationService.getDeliveryInfo(pinCode, { stateName });
  if (info && (pinCode || stateName)) {
    const formattedDateRange = formatDynamicDeliveryDateRange(pinCode, stateName);
    if (logisticsDate) logisticsDate.textContent = formattedDateRange;
    logisticsCard.style.display = 'flex';
  } else {
    logisticsCard.style.display = 'none';
  }
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Ensures currency symbol ₹ appears exactly once in the final rendered price.
 * Handles single amounts (e.g. "₹999", "999") and ranges (e.g. "₹9999–₹69999").
 */
function formatPrice(price) {
  if (!price) return '₹0';
  let str = String(price).trim();
  while (str.startsWith('₹₹')) {
    str = str.substring(1);
  }
  if (str.startsWith('₹')) return str;
  return `₹${str}`;
}

/**
 * Returns dynamically calculated estimated delivery date range based on location.
 */
function getEstimatedDelivery(pinCode, state, orderDate = new Date()) {
  return formatDynamicDeliveryDateRange(pinCode, state, orderDate);
}

/**
 * Checks whether all 7 required customer fields have valid values.
 */
function areAllRequiredFieldsValid() {
  const stateVal = document.getElementById('deliveryState')?.value.trim() || '';
  const distVal = document.getElementById('deliveryDistrict')?.value.trim() || '';
  const cityVal = document.getElementById('deliveryCity')?.value.trim() || '';
  const areaVal = document.getElementById('deliveryArea')?.value.trim() || '';
  const pinVal = document.getElementById('deliveryPin')?.value.trim() || '';
  const addrVal = document.getElementById('deliveryAddress')?.value.trim() || '';
  const emailVal = document.getElementById('deliveryEmail')?.value.trim() || '';

  const isStateValid = stateVal.length > 0;
  const isDistValid = distVal.length > 0;
  const isCityValid = cityVal.length > 0;
  const isAreaValid = areaVal.length > 0;
  const isPinValid = /^[1-9][0-9]{5}$/.test(pinVal);
  const isAddrValid = addrVal.length > 0;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal);

  return isStateValid && isDistValid && isCityValid && isAreaValid && isPinValid && isAddrValid && isEmailValid;
}

function isAnyModalOpen() {
  const authOverlay = document.getElementById('authModalOverlay');
  const checkoutOverlay = document.getElementById('checkoutModalOverlay');
  const catOverlay = document.getElementById('categoryPopupOverlay');
  const adminOverlay = document.getElementById('adminModalOverlay');
  const adminReplyOverlay = document.getElementById('adminReplyModalOverlay');
  const confirmOverlay = document.getElementById('confirmOverlay');

  const authOpen = Boolean(authOverlay && authOverlay.classList.contains('open'));
  const checkoutOpen = Boolean(checkoutOverlay && checkoutOverlay.classList.contains('open'));
  const catOpen = Boolean(catOverlay && catOverlay.classList.contains('open'));
  const adminOpen = Boolean(adminOverlay && (adminOverlay.style.display === 'flex' || adminOverlay.classList.contains('open')));
  const adminReplyOpen = Boolean(adminReplyOverlay && (adminReplyOverlay.style.display === 'flex' || adminReplyOverlay.classList.contains('open')));
  const confirmOpen = Boolean(confirmOverlay && confirmOverlay.classList.contains('open'));

  return authOpen || checkoutOpen || catOpen || adminOpen || adminReplyOpen || confirmOpen;
}

function updateModalLockState() {
  const isOpen = isAnyModalOpen();
  if (isOpen) {
    const sw = window.innerWidth - document.documentElement.clientWidth;
    if (sw > 0 && !document.body.style.paddingRight) {
      document.body.style.paddingRight = sw + 'px';
    }
    document.documentElement.classList.add('modal-locked', 'popup-open');
    document.body.classList.add('modal-locked', 'popup-open');
  } else {
    document.documentElement.classList.remove('modal-locked', 'popup-open');
    document.body.classList.remove('modal-locked', 'popup-open');
    document.body.style.paddingRight = '';
  }
}

// Background interaction & scroll protection when any modal is open
window.addEventListener('wheel', (e) => {
  if (!isAnyModalOpen()) return;
  const inModal = e.target && e.target.closest && e.target.closest(
    '.auth-modal, .checkout-modal, .category-popup, .admin-modal-card, .confirm-modal'
  );
  if (!inModal) {
    e.preventDefault();
  }
}, { passive: false });

window.addEventListener('touchmove', (e) => {
  if (!isAnyModalOpen()) return;
  const inModal = e.target && e.target.closest && e.target.closest(
    '.auth-modal, .checkout-modal, .category-popup, .admin-modal-card, .confirm-modal'
  );
  if (!inModal) {
    e.preventDefault();
  }
}, { passive: false });

// Automatic MutationObserver to keep background lock in sync with any modal state change
if (typeof MutationObserver !== 'undefined') {
  const modalObserver = new MutationObserver(() => {
    updateModalLockState();
  });
  window.addEventListener('DOMContentLoaded', () => {
    ['authModalOverlay', 'checkoutModalOverlay', 'categoryPopupOverlay', 'adminModalOverlay', 'adminReplyModalOverlay', 'confirmOverlay'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        modalObserver.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
      }
    });
  });
}

function openCheckoutModal(purchase) {
  if (!purchase) return;
  currentCheckoutPurchase = purchase;

  const overlay = document.getElementById('checkoutModalOverlay');
  const deliveryView = document.getElementById('checkoutDeliveryView');
  const successView = document.getElementById('checkoutSuccessView');
  const form = document.getElementById('checkoutDeliveryForm');
  const sumCard = document.getElementById('checkoutSummaryCard');

  if (!overlay) return;

  // Reset form inputs for fresh entry
  if (form) form.reset();

  // Ensure all Indian States and Union Territories options are loaded
  ensureStateOptions();
  handleStateSelectionChange('');

  // Reset views
  if (deliveryView) deliveryView.style.display = 'block';
  if (successView) successView.style.display = 'none';

  // Ensure Order Summary is hidden initially until user enters data
  if (sumCard) sumCard.style.display = 'none';

  // Set product badge details with formatPrice (never duplicate ₹)
  const badgeName = document.getElementById('badgeProductName');
  const badgeSize = document.getElementById('badgeProductSize');
  const badgePrice = document.getElementById('badgeProductPrice');
  if (badgeName) badgeName.textContent = purchase.design || 'Designer Outfit';
  if (badgeSize) badgeSize.textContent = purchase.size || 'Standard';
  if (badgePrice) badgePrice.textContent = formatPrice(purchase.price);

  // Set order summary details with formatPrice (never duplicate ₹)
  const sumName = document.getElementById('summaryProductName');
  const sumSize = document.getElementById('summarySize');
  const sumPrice = document.getElementById('summaryPrice');
  const sumEst = document.getElementById('summaryEstimate');
  const sumAddr = document.getElementById('summaryAddress');
  const sumEmail = document.getElementById('summaryEmail');

  if (sumName) sumName.textContent = purchase.design || 'Designer Outfit';
  if (sumSize) sumSize.textContent = purchase.size || 'Standard';
  if (sumPrice) sumPrice.textContent = formatPrice(purchase.price);
  if (sumEst) sumEst.textContent = getEstimatedDelivery();
  if (sumAddr) sumAddr.textContent = '—';
  if (sumEmail) sumEmail.textContent = '—';

  // Clear errors
  document.querySelectorAll('.checkout-field').forEach(field => {
    field.classList.remove('has-error');
  });

  // Pre-fill email if logged-in customer session exists
  const emailInput = document.getElementById('deliveryEmail');
  if (emailInput) {
    const session = typeof getCustomerSession === 'function' ? getCustomerSession() : null;
    if (session && session.email && session.provider !== 'guest') {
      emailInput.value = session.email;
    }
  }

  // Update live summary visibility based on filled fields
  updateCheckoutSummaryFields();

  // Reset button state and payment selection to Cash on Delivery
  const codRadio = document.getElementById('paymentMethodCod');
  if (codRadio) codRadio.checked = true;
  updatePaymentMethodUI('cod');

  overlay.classList.add('open');
  updateModalLockState();
}

function closeCheckoutModal() {
  const overlay = document.getElementById('checkoutModalOverlay');
  if (overlay) overlay.classList.remove('open');
  updateModalLockState();
  currentCheckoutPurchase = null;
  pendingOrderCheckout = null;
  try {
    sessionStorage.removeItem('pendingOrderCheckout');
  } catch (e) {}
}

function updateCheckoutSummaryFields() {
  const stateInput = document.getElementById('deliveryState');
  const distInput = document.getElementById('deliveryDistrict');
  const cityInput = document.getElementById('deliveryCity');
  const areaInput = document.getElementById('deliveryArea');
  const pinInput = document.getElementById('deliveryPin');
  const addrInput = document.getElementById('deliveryAddress');
  const emailInput = document.getElementById('deliveryEmail');

  const sumCard = document.getElementById('checkoutSummaryCard');
  const sumAddr = document.getElementById('summaryAddress');
  const sumEmail = document.getElementById('summaryEmail');
  const sumPrice = document.getElementById('summaryPrice');
  const sumName = document.getElementById('summaryProductName');
  const sumSize = document.getElementById('summarySize');
  const sumEst = document.getElementById('summaryEstimate');

  const allValid = areAllRequiredFieldsValid();

  // Order Summary appears ONLY when all required fields contain valid values
  if (sumCard) {
    sumCard.style.display = allValid ? 'flex' : 'none';
  }

  if (allValid) {
    const stateVal = stateInput ? stateInput.value.trim() : '';
    const pinVal = pinInput ? pinInput.value.trim() : '';

    if (currentCheckoutPurchase) {
      if (sumName) sumName.textContent = currentCheckoutPurchase.design || 'Designer Outfit';
      if (sumSize) sumSize.textContent = currentCheckoutPurchase.size || 'Standard';
      if (sumPrice) sumPrice.textContent = formatPrice(currentCheckoutPurchase.price);
    }
    if (sumEst) sumEst.textContent = getEstimatedDelivery(pinVal, stateVal);

    if (sumAddr) {
      const parts = [];
      const addrVal = addrInput ? addrInput.value.trim() : '';
      const areaVal = areaInput ? areaInput.value.trim() : '';
      const cityVal = cityInput ? cityInput.value.trim() : '';
      const distVal = distInput ? distInput.value.trim() : '';

      if (addrVal) parts.push(addrVal);
      if (areaVal) parts.push(areaVal);
      if (cityVal) parts.push(cityVal);
      if (distVal && distVal.toLowerCase() !== cityVal.toLowerCase()) parts.push(distVal);
      if (stateVal) parts.push(stateVal);

      let formatted = parts.join(', ');
      if (pinVal) formatted += (formatted ? ` - ${pinVal}` : pinVal);
      sumAddr.textContent = formatted;
    }

    if (sumEmail) {
      sumEmail.textContent = emailInput ? emailInput.value.trim() : '';
    }
  }
}

function updatePaymentMethodUI(method) {
  const codCard = document.getElementById('labelPaymentCod');
  const onlineCard = document.getElementById('labelPaymentOnline');
  const submitBtn = document.getElementById('checkoutSubmitBtn');

  if (method === 'online') {
    if (codCard) codCard.classList.remove('active');
    if (onlineCard) onlineCard.classList.add('active');
    if (submitBtn) submitBtn.innerHTML = '<span>Continue to Payment</span>';
  } else {
    if (codCard) codCard.classList.add('active');
    if (onlineCard) onlineCard.classList.remove('active');
    if (submitBtn) submitBtn.innerHTML = '<span>Place Order</span>';
  }
}

function formatPaymentMethodDisplay(method) {
  if (!method || typeof method !== 'string' || !method.trim()) {
    return '<span class="admin-payment-not-recorded">Not recorded</span>';
  }
  const clean = method.trim();
  const lower = clean.toLowerCase();
  if (lower === 'cash on delivery' || lower === 'cod') {
    return 'Cash on Delivery';
  }
  if (lower === 'online payment' || lower.includes('online') || lower.includes('prepaid') || lower.includes('card') || lower.includes('upi') || lower.includes('net banking')) {
    return 'Online Payment';
  }
  return escapeHtml(clean);
}

function formatPaymentMethodText(method) {
  if (!method || typeof method !== 'string' || !method.trim()) {
    return 'Not recorded';
  }
  const clean = method.trim();
  const lower = clean.toLowerCase();
  if (lower === 'cash on delivery' || lower === 'cod') {
    return 'Cash on Delivery';
  }
  if (lower === 'online payment' || lower.includes('online') || lower.includes('prepaid') || lower.includes('card') || lower.includes('upi') || lower.includes('net banking')) {
    return 'Online Payment';
  }
  return clean;
}

function formatPaymentStatusBadge(status) {
  if (!status || typeof status !== 'string' || !status.trim()) {
    return '<span class="payment-badge payment-badge-not-recorded">Not recorded</span>';
  }
  const clean = status.trim();
  const lower = clean.toLowerCase();
  if (lower === 'paid') {
    return '<span class="payment-badge payment-badge-paid">Paid</span>';
  }
  if (lower === 'pending' || lower === 'unpaid') {
    return '<span class="payment-badge payment-badge-pending">Pending</span>';
  }
  if (lower === 'failed') {
    return '<span class="payment-badge payment-badge-failed">Failed</span>';
  }
  return `<span class="payment-badge payment-badge-not-recorded">${escapeHtml(clean)}</span>`;
}

/**
 * Validates delivery form fields with inline error display
 */
function validateCheckoutForm() {
  let isValid = true;
  const fields = [
    { id: 'deliveryState', wrap: 'wrap-deliveryState', errId: 'err-deliveryState', validator: v => !!v.trim(), msg: 'State is required.' },
    { id: 'deliveryDistrict', wrap: 'wrap-deliveryDistrict', errId: 'err-deliveryDistrict', validator: v => !!v.trim(), msg: 'District is required.' },
    { id: 'deliveryCity', wrap: 'wrap-deliveryCity', errId: 'err-deliveryCity', validator: v => !!v.trim(), msg: 'City / Town / Location is required.' },
    { id: 'deliveryArea', wrap: 'wrap-deliveryArea', errId: 'err-deliveryArea', validator: v => !!v.trim(), msg: 'Area is required.' },
    {
      id: 'deliveryPin',
      wrap: 'wrap-deliveryPin',
      errId: 'err-deliveryPin',
      validator: v => /^[1-9][0-9]{5}$/.test(v.trim()),
      msg: 'Enter a valid 6-digit PIN code.'
    },
    { id: 'deliveryAddress', wrap: 'wrap-deliveryAddress', errId: 'err-deliveryAddress', validator: v => !!v.trim(), msg: 'Full address is required.' },
    {
      id: 'deliveryEmail',
      wrap: 'wrap-deliveryEmail',
      errId: 'err-deliveryEmail',
      validator: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
      msg: 'Enter a valid email address.'
    }
  ];

  fields.forEach(field => {
    const input = document.getElementById(field.id);
    const wrap = document.getElementById(field.wrap);
    const errMsg = document.getElementById(field.errId);
    const val = input ? input.value : '';

    if (!input || !field.validator(val)) {
      isValid = false;
      if (wrap) wrap.classList.add('has-error');
      if (errMsg) errMsg.textContent = field.msg;
    } else {
      if (wrap) wrap.classList.remove('has-error');
    }
  });

  return isValid;
}


function getSavedPendingPurchase() {
  try {
    const raw = sessionStorage.getItem('pendingPurchase');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function getSavedPendingOrder() {
  try {
    const raw = sessionStorage.getItem('pendingOrderCheckout');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function restorePendingOrderDetails(order, authEmail) {
  if (!order) return;
  if (order.purchase) {
    currentCheckoutPurchase = order.purchase;
    const badgeName = document.getElementById('badgeProductName');
    const badgeSize = document.getElementById('badgeProductSize');
    const badgePrice = document.getElementById('badgeProductPrice');
    if (badgeName) badgeName.textContent = order.purchase.design || 'Designer Outfit';
    if (badgeSize) badgeSize.textContent = order.purchase.size || 'Standard';
    if (badgePrice) badgePrice.textContent = formatPrice(order.purchase.price);
  }

  const stateSelect = document.getElementById('deliveryState');
  const distSelect = document.getElementById('deliveryDistrict');
  const cityInput = document.getElementById('deliveryCity');
  const areaInput = document.getElementById('deliveryArea');
  const pinInput = document.getElementById('deliveryPin');
  const addrInput = document.getElementById('deliveryAddress');
  const emailInput = document.getElementById('deliveryEmail');

  if (stateSelect && order.state) {
    stateSelect.value = order.state;
    handleStateSelectionChange(order.state);
  }
  if (distSelect && order.district) {
    distSelect.value = order.district;
    distSelect.disabled = false;
  }
  if (cityInput && order.city) cityInput.value = order.city;
  if (areaInput && order.area) areaInput.value = order.area;
  if (pinInput && order.pinCode) {
    pinInput.value = order.pinCode;
    const stateVal = order.state || '';
    updateLogisticsDisplay(order.pinCode, stateVal);
  }
  if (addrInput && order.fullAddress) addrInput.value = order.fullAddress;

  const effectiveEmail = authEmail || order.email || '';
  if (emailInput && effectiveEmail) emailInput.value = effectiveEmail;
  if (order && effectiveEmail) order.email = effectiveEmail;

  if (order.paymentMethodType) {
    const radio = document.querySelector(`input[name="checkoutPaymentMethod"][value="${order.paymentMethodType}"]`);
    if (radio) {
      radio.checked = true;
      updatePaymentMethodUI(order.paymentMethodType);
    }
  }

  updateCheckoutSummaryFields();
}

/**
 * Resolves Razorpay payment method names and variations to official refund timeframes
 * 
 * Supported categories:
 * - UPI: 2 to 7 days ("UPI: Refunds typically take 2 to 7 days.")
 * - Credit / Debit Cards: 5 to 10 days ("Credit / Debit Cards: Refunds typically take 5 to 10 days.")
 * - Net Banking: 2 to 10 days ("Net Banking: Refunds typically take 2 to 10 days.")
 * - Wallets: 0 to 3 days ("Wallets: Refunds typically take 0 to 3 days.")
 * - Unidentified: Neutral support message
 */
function resolveRazorpayPaymentMethod(input) {
  if (!input) {
    return {
      category: 'unknown',
      label: 'Online Payment',
      timeline: null,
      refundMessage: 'Refunds: Please contact support for refund timeframe assistance.',
      isIdentified: false
    };
  }

  let methodStr = '';
  if (typeof input === 'string') {
    methodStr = input.trim().toLowerCase();
  } else if (typeof input === 'object') {
    const rzpMethod = (input.method || input.paymentMethod || input.payment_method || '').toLowerCase();
    const cardType = (input.card?.type || input.card_type || '').toLowerCase();
    const walletName = (input.wallet || '').toLowerCase();
    const bankName = (input.bank || '').toLowerCase();
    methodStr = `${rzpMethod} ${cardType} ${walletName} ${bankName}`.trim().toLowerCase();
  }

  // 1. Wallets: 0 to 3 days
  if (
    methodStr.includes('wallet') ||
    methodStr.includes('paytm') ||
    methodStr.includes('mobikwik') ||
    methodStr.includes('freecharge') ||
    methodStr.includes('olamoney') ||
    methodStr.includes('amazonpay') ||
    methodStr.includes('amazon pay') ||
    methodStr.includes('phonepe wallet')
  ) {
    return {
      category: 'wallet',
      label: 'Wallets',
      timeline: '0 to 3 days',
      refundMessage: 'Wallets: Refunds typically take 0 to 3 days.',
      isIdentified: true
    };
  }

  // 2. UPI: 2 to 7 days
  if (
    methodStr.includes('upi') ||
    methodStr.includes('gpay') ||
    methodStr.includes('google pay') ||
    methodStr.includes('phonepe') ||
    methodStr.includes('bhim') ||
    methodStr.includes('@')
  ) {
    return {
      category: 'upi',
      label: 'UPI',
      timeline: '2 to 7 days',
      refundMessage: 'UPI: Refunds typically take 2 to 7 days.',
      isIdentified: true
    };
  }

  // 3. Net Banking: 2 to 10 days
  if (
    methodStr.includes('netbanking') ||
    methodStr.includes('net banking') ||
    methodStr.includes('net_banking') ||
    methodStr.includes('net-banking') ||
    methodStr === 'nb'
  ) {
    return {
      category: 'netbanking',
      label: 'Net Banking',
      timeline: '2 to 10 days',
      refundMessage: 'Net Banking: Refunds typically take 2 to 10 days.',
      isIdentified: true
    };
  }

  // 4. Credit / Debit Cards: 5 to 10 days
  if (
    methodStr.includes('card') ||
    methodStr.includes('credit') ||
    methodStr.includes('debit') ||
    methodStr.includes('visa') ||
    methodStr.includes('mastercard') ||
    methodStr.includes('rupay') ||
    methodStr.includes('amex') ||
    methodStr.includes('diners')
  ) {
    return {
      category: 'card',
      label: 'Credit / Debit Cards',
      timeline: '5 to 10 days',
      refundMessage: 'Credit / Debit Cards: Refunds typically take 5 to 10 days.',
      isIdentified: true
    };
  }

  // 5. Cash on Delivery
  if (
    methodStr === 'cod' ||
    methodStr === 'cash on delivery' ||
    methodStr.includes('cash on delivery') ||
    methodStr.includes('pay on delivery')
  ) {
    return {
      category: 'cod',
      label: 'Cash on Delivery',
      timeline: null,
      refundMessage: null,
      isIdentified: true
    };
  }

  // 6. Unknown / Unidentified method
  return {
    category: 'unknown',
    label: 'Online Payment',
    timeline: null,
    refundMessage: 'Refunds: Please contact support for refund timeframe assistance.',
    isIdentified: false
  };
}
window.resolveRazorpayPaymentMethod = resolveRazorpayPaymentMethod;

async function finalizeAndSaveOrder({ orderPayload, paymentMethod, paymentStatus, razorpayData, refundTimeframe, refundMessage, isIdentified }) {
  const deliveryView = document.getElementById('checkoutDeliveryView');
  const successView = document.getElementById('checkoutSuccessView');

  // Show Payment Success View
  if (deliveryView) deliveryView.style.display = 'none';
  if (successView) successView.style.display = 'block';

  // Stable order reference (reuse intent if retry, or new unique ID)
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const orderId = orderPayload.orderId || `JF-${randomSuffix}`;
  const fourDigitOrderNumber = orderPayload.orderNumber || String(Math.floor(1000 + Math.random() * 9000));
  orderPayload.orderId = orderId;
  orderPayload.orderNumber = fourDigitOrderNumber;

  const orderIdEl = document.getElementById('confirmOrderId');
  const productEl = document.getElementById('confirmProduct');
  const sizeEl = document.getElementById('confirmSize');
  const amountEl = document.getElementById('confirmAmount');
  const addrEl = document.getElementById('confirmAddress');
  const emailEl = document.getElementById('confirmEmailDisplay');
  const payMethodEl = document.getElementById('confirmPaymentMethod');
  const payStatusEl = document.getElementById('confirmPaymentStatus');
  const confirmSuccessSub = document.getElementById('confirmSuccessSub');
  const refundBoxEl = document.getElementById('confirmRefundTimeframeBox');
  const refundTextEl = document.getElementById('confirmRefundTimeframeText');

  const customer = typeof getCustomerSession === 'function' ? getCustomerSession() : null;
  const currentUser = window.fbAuth?.currentUser;
  const finalEmail = currentUser?.email || customer?.email || orderPayload.email || '';
  const finalUid = currentUser?.uid || customer?.uid || 'guest';
  const formattedPrice = formatPrice(orderPayload.purchase?.price);

  // Resolve verified payment method and refund timeframe
  const isCod = paymentMethod === 'Cash on Delivery';
  const methodInput = razorpayData?.method || razorpayData?.paymentMethod || (isCod ? 'cod' : paymentMethod);
  const resolvedPayment = resolveRazorpayPaymentMethod(methodInput);

  const displayPaymentMethod = isCod
    ? 'Cash on Delivery'
    : (resolvedPayment.isIdentified ? resolvedPayment.label : (paymentMethod || 'Online Payment'));

  const finalRefundTimeframe = refundTimeframe || razorpayData?.refundTimeframe || resolvedPayment.timeline || null;
  const finalRefundMessage = refundMessage || razorpayData?.refundMessage || resolvedPayment.refundMessage || null;
  const methodIdentified = typeof isIdentified === 'boolean' ? isIdentified : resolvedPayment.isIdentified;

  if (orderIdEl) orderIdEl.textContent = `#${fourDigitOrderNumber}`;
  if (productEl) productEl.textContent = orderPayload.purchase?.design || 'Designer Outfit';
  if (sizeEl) sizeEl.textContent = orderPayload.purchase?.size || 'Standard';
  if (amountEl) amountEl.textContent = formattedPrice;
  if (addrEl) addrEl.textContent = orderPayload.formattedAddress;
  if (emailEl) emailEl.textContent = finalEmail;
  if (payMethodEl) payMethodEl.textContent = displayPaymentMethod;
  if (payStatusEl) {
    payStatusEl.textContent = isCod ? 'Pending (Pay on delivery)' : 'Paid';
  }
  if (confirmSuccessSub) {
    confirmSuccessSub.textContent = isCod
      ? 'Your order has been placed successfully. Payment is due upon delivery.'
      : 'Your payment was successful.';
  }

  // Display only the matching refund timeframe for verified online payments
  if (isCod) {
    if (refundBoxEl) refundBoxEl.style.display = 'none';
  } else {
    if (refundBoxEl && refundTextEl) {
      if (finalRefundMessage) {
        refundTextEl.textContent = finalRefundMessage;
        if (!methodIdentified) {
          refundTextEl.classList.add('is-neutral');
        } else {
          refundTextEl.classList.remove('is-neutral');
        }
        refundBoxEl.style.display = 'block';
      } else {
        refundBoxEl.style.display = 'none';
      }
    }
  }

  const confirmEstimateEl = document.getElementById('confirmEstimate');
  if (confirmEstimateEl && orderPayload.estimatedDelivery) {
    confirmEstimateEl.textContent = orderPayload.estimatedDelivery;
  }

  const firestoreOrder = {
    orderId: orderId,
    orderNumber: fourDigitOrderNumber,
    userId: finalUid,
    customerEmail: finalEmail,
    customerName: customer?.name || (finalEmail ? finalEmail.split('@')[0] : 'Customer'),
    customerPhone: orderPayload.phone || '—',
    productId: String(orderPayload.purchase?.num || orderPayload.purchase?.cardId || ''),
    productName: orderPayload.purchase?.design || 'Designer Outfit',
    product: orderPayload.purchase?.design || 'Designer Outfit',
    category: orderPayload.purchase?.category || '',
    subcategory: orderPayload.purchase?.subcategory || '',
    size: orderPayload.purchase?.size || 'Standard',
    price: formattedPrice,
    amount: formattedPrice,
    quantity: 1,
    state: orderPayload.state || '',
    district: orderPayload.district || '',
    city: orderPayload.city || '',
    pinCode: orderPayload.pinCode || '',
    area: orderPayload.area || '',
    fullAddress: orderPayload.fullAddress || '',
    address: orderPayload.formattedAddress || '',
    estimatedDelivery: orderPayload.estimatedDelivery || '',
    paymentMethod: displayPaymentMethod, // e.g. 'UPI', 'Credit / Debit Cards', 'Net Banking', 'Wallets', 'Cash on Delivery'
    paymentStatus: paymentStatus, // 'Pending' or 'Paid'
    orderStatus: 'Processing',
    status: 'Processing',
    customMessage: '',
    razorpayOrderId: razorpayData?.orderId || '',
    razorpayPaymentId: razorpayData?.paymentId || '',
    razorpayMethod: razorpayData?.method || (resolvedPayment.isIdentified ? resolvedPayment.category : ''),
    refundTimeframe: finalRefundTimeframe || '',
    refundMessage: finalRefundMessage || '',
    date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    createdAt: window.fbFns?.serverTimestamp ? window.fbFns.serverTimestamp() : new Date().toISOString(),
    updatedAt: window.fbFns?.serverTimestamp ? window.fbFns.serverTimestamp() : new Date().toISOString()
  };

  if (window.fbDb && window.fbFns) {
    let orderSavedToFirestore = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await window.fbFns.setDoc(window.fbFns.doc(window.fbDb, 'orders', orderId), firestoreOrder);
        orderSavedToFirestore = true;
        break;
      } catch (err) {
        console.warn(`Firestore setDoc order attempt ${attempt + 1} failed:`, err);
        if (attempt === 0) await new Promise(r => setTimeout(r, 600));
      }
    }
    if (!orderSavedToFirestore) {
      console.error('Failed to sync order to cloud Firestore after retries. Local backup preserved.');
    }

    try {
      await window.fbFns.setDoc(window.fbFns.doc(window.fbDb, 'deliveryData', orderId), {
        orderId: orderId,
        userId: finalUid,
        customerName: firestoreOrder.customerName,
        customerEmail: finalEmail,
        customerPhone: firestoreOrder.customerPhone,
        state: orderPayload.state || '',
        district: orderPayload.district || '',
        city: orderPayload.city || '',
        pinCode: orderPayload.pinCode || '',
        area: orderPayload.area || '',
        fullAddress: orderPayload.fullAddress || '',
        address: orderPayload.formattedAddress || '',
        estimatedDelivery: orderPayload.estimatedDelivery || '',
        createdAt: window.fbFns?.serverTimestamp ? window.fbFns.serverTimestamp() : new Date().toISOString()
      });
    } catch (dErr) {
      console.warn('Firestore deliveryData setDoc error:', dErr);
    }

    if (finalUid && finalUid !== 'guest' && finalEmail) {
      try {
        await window.fbFns.setDoc(window.fbFns.doc(window.fbDb, 'users', finalUid), {
          uid: finalUid,
          email: finalEmail,
          resendEmail: finalEmail,
          lastOrderEmail: finalEmail,
          lastOrderId: orderId,
          lastOrderAmount: formattedPrice,
          updatedAt: window.fbFns.serverTimestamp()
        }, { merge: true });
      } catch (uErr) {
        console.warn('Firestore user doc update for Resend order email error:', uErr);
      }
    }
  }

  // Update local Admin Orders store
  try {
    const currentAdminOrders = getAdminOrders();
    const existingIndex = currentAdminOrders.findIndex(o =>
      o.id === orderId ||
      o.orderId === orderId ||
      (orderPayload.clientOrderId && o.clientOrderId === orderPayload.clientOrderId)
    );
    const adminRecord = {
      id: orderId,
      orderId: orderId,
      clientOrderId: orderPayload.clientOrderId || '',
      orderNumber: fourDigitOrderNumber,
      userId: finalUid,
      date: firestoreOrder.date,
      createdAt: new Date().toISOString(),
      customerName: firestoreOrder.customerName,
      customerEmail: finalEmail,
      customerPhone: '—',
      product: firestoreOrder.productName,
      size: firestoreOrder.size,
      quantity: 1,
      amount: formattedPrice,
      price: formattedPrice,
      status: 'Processing',
      orderStatus: 'Processing',
      customMessage: '',
      paymentMethod: paymentMethod,
      paymentStatus: paymentStatus,
      address: orderPayload.formattedAddress,
      estimatedDelivery: orderPayload.estimatedDelivery || '',
      state: orderPayload.state || '',
      pinCode: orderPayload.pinCode || '',
      cancelledBy: '',
      cancelledAt: null
    };

    if (existingIndex >= 0) {
      currentAdminOrders[existingIndex] = adminRecord;
    } else {
      currentAdminOrders.unshift(adminRecord);
    }
    saveAdminOrders(currentAdminOrders);

    // Sync to currentCustomerOrders if matching customer
    try {
      const customerRecord = {
        ...adminRecord,
        docId: orderId,
        productName: firestoreOrder.productName
      };
      const cIndex = currentCustomerOrders.findIndex(o => (o.id || o.orderId) === orderId);
      if (cIndex >= 0) {
        currentCustomerOrders[cIndex] = customerRecord;
      } else {
        currentCustomerOrders.unshift(customerRecord);
      }
      renderCustomerOrdersList(currentCustomerOrders);
    } catch (cSyncErr) {
      console.warn('Customer orders sync error:', cSyncErr);
    }
  } catch (e) {
    console.warn('Local admin orders save error:', e);
  }

  // Dispatch customer order confirmation email via Gmail REST API upon Razorpay payment
  if (finalEmail && finalEmail.includes('@') && (paymentStatus === 'Paid' || razorpayData)) {
    try {
      fetch('/api/orders/confirmation-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          orderNumber: fourDigitOrderNumber,
          customerEmail: finalEmail,
          customerName: firestoreOrder.customerName,
          product: firestoreOrder.productName,
          size: firestoreOrder.size,
          amount: formattedPrice,
          paymentMethod: displayPaymentMethod,
          deliveryAddress: orderPayload.formattedAddress,
          estimatedDelivery: orderPayload.estimatedDelivery || '',
          razorpayPaymentId: razorpayData?.paymentId || ''
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.emailSent) {
          console.log(`✓ Order confirmation email successfully sent to ${finalEmail} for order #${fourDigitOrderNumber}`);
        } else {
          console.warn('Order confirmation email response:', data.error || data.message);
        }
      })
      .catch(emailErr => {
        console.warn('Order confirmation email network dispatch error:', emailErr);
      });
    } catch (dispErr) {
      console.warn('Could not dispatch order confirmation email:', dispErr);
    }
  }

  try {
    sessionStorage.removeItem('pendingOrderCheckout');
  } catch (e) {}
}

async function executeOrderPayment(orderPayload) {
  if (!orderPayload) return;

  const overlay = document.getElementById('checkoutModalOverlay');
  const deliveryView = document.getElementById('checkoutDeliveryView');
  const successView = document.getElementById('checkoutSuccessView');

  if (overlay && !overlay.classList.contains('open')) {
    overlay.classList.add('open');
    document.body.classList.add('popup-open');
  }
  if (deliveryView) deliveryView.style.display = 'block';
  if (successView) successView.style.display = 'none';

  const submitBtn = document.getElementById('checkoutSubmitBtn');
  const paymentMethodType = orderPayload.paymentMethodType || 'cod';

  // Branch 1: Cash on Delivery (COD)
  if (paymentMethodType === 'cod') {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Placing order...</span>';
    }

    try {
      await finalizeAndSaveOrder({
        orderPayload,
        paymentMethod: 'Cash on Delivery',
        paymentStatus: 'Pending',
        razorpayData: null
      });
    } catch (err) {
      console.error('Error placing COD order:', err);
      alert('Unable to place Cash on Delivery order. Please try again.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Place Order</span>';
      }
    }
    return;
  }

  // Branch 2: Pay Online (Razorpay)
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Initiating payment...</span>';
  }

  try {
    const rawPrice = orderPayload.purchase?.price || '0';
    const numericAmount = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;

    // Stable intent key per checkout attempt to prevent duplicate orders
    if (!orderPayload.clientOrderId) {
      orderPayload.clientOrderId = 'intent_' + Date.now() + '_' + Math.floor(1000 + Math.random() * 9000);
    }

    const orderRes = await fetch('/api/payment/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: numericAmount,
        receipt: orderPayload.clientOrderId
      })
    });

    const orderData = await orderRes.json();

    if (!orderRes.ok || !orderData.success) {
      const errMsg = orderData.error || 'Online payment is currently unavailable. Please choose Cash on Delivery.';
      alert(errMsg);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Continue to Payment</span>';
      }
      return;
    }

    const rzpOrder = orderData.order;
    const keyId = orderData.keyId;

    if (!window.Razorpay) {
      alert('Payment service could not be loaded. Please check your connection or choose Cash on Delivery.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Continue to Payment</span>';
      }
      return;
    }

    const customer = typeof getCustomerSession === 'function' ? getCustomerSession() : null;
    const currentUser = window.fbAuth?.currentUser;
    const userEmail = currentUser?.email || customer?.email || orderPayload.email || '';
    const userPhone = orderPayload.phone || customer?.phone || '';

    const rzpOptions = {
      key: keyId,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency || 'INR',
      name: 'Jayashree',
      description: orderPayload.purchase?.design || 'Designer Outfit',
      order_id: rzpOrder.id,
      prefill: {
        email: userEmail,
        contact: userPhone
      },
      theme: {
        color: '#2F2924'
      },
      handler: async function (response) {
        if (submitBtn) {
          submitBtn.innerHTML = '<span>Verifying payment...</span>';
        }

        try {
          const verifyRes = await fetch('/api/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            })
          });

          const verifyData = await verifyRes.json();

          if (verifyRes.ok && verifyData.success && verifyData.verified) {
            await finalizeAndSaveOrder({
              orderPayload,
              paymentMethod: verifyData.paymentMethod || 'Online Payment',
              paymentStatus: 'Paid',
              refundTimeframe: verifyData.refundTimeframe,
              refundMessage: verifyData.refundMessage,
              isIdentified: verifyData.isIdentified,
              razorpayData: {
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                method: verifyData.rawMethod || verifyData.methodCategory,
                paymentMethod: verifyData.paymentMethod,
                refundTimeframe: verifyData.refundTimeframe,
                refundMessage: verifyData.refundMessage,
                isIdentified: verifyData.isIdentified
              }
            });
          } else {
            alert('Payment verification failed on the server. Your order was not confirmed.');
          }
        } catch (vErr) {
          console.error('Payment verification error:', vErr);
          alert('Network error verifying payment. Please contact support.');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Continue to Payment</span>';
          }
        }
      },
      modal: {
        ondismiss: function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Continue to Payment</span>';
          }
        }
      }
    };

    const rzpInstance = new window.Razorpay(rzpOptions);
    rzpInstance.on('payment.failed', function (failResp) {
      console.warn('Payment failed:', failResp);
      alert('Payment failed: ' + (failResp.error?.description || 'Transaction declined'));
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Continue to Payment</span>';
      }
    });

    rzpInstance.open();

  } catch (err) {
    console.error('Online payment error:', err);
    alert('Unable to initiate online payment: ' + (err.message || 'Server error. Please use Cash on Delivery.'));
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Continue to Payment</span>';
    }
  }
}

function handleCheckoutSubmit(e) {
  if (e) e.preventDefault();
  if (!validateCheckoutForm()) return;

  const stateVal = document.getElementById('deliveryState')?.value.trim() || '';
  const distVal = document.getElementById('deliveryDistrict')?.value.trim() || '';
  const cityVal = document.getElementById('deliveryCity')?.value.trim() || '';
  const areaVal = document.getElementById('deliveryArea')?.value.trim() || '';
  const pinVal = document.getElementById('deliveryPin')?.value.trim() || '';
  const addrVal = document.getElementById('deliveryAddress')?.value.trim() || '';
  const emailVal = document.getElementById('deliveryEmail')?.value.trim() || '';
  const paymentMethodType = document.querySelector('input[name="checkoutPaymentMethod"]:checked')?.value || 'cod';

  const parts = [];
  if (addrVal) parts.push(addrVal);
  if (areaVal) parts.push(areaVal);
  if (cityVal) parts.push(cityVal);
  if (distVal && distVal.toLowerCase() !== cityVal.toLowerCase()) parts.push(distVal);
  if (stateVal) parts.push(stateVal);
  let formattedAddress = parts.join(', ');
  if (pinVal) formattedAddress += (formattedAddress ? ` - ${pinVal}` : pinVal);

  const orderPayload = {
    purchase: currentCheckoutPurchase,
    state: stateVal,
    district: distVal,
    city: cityVal,
    area: areaVal,
    pinCode: pinVal,
    fullAddress: addrVal,
    formattedAddress,
    email: emailVal,
    paymentMethodType,
    price: formatPrice(currentCheckoutPurchase?.price),
    estimatedDelivery: getEstimatedDelivery(pinVal, stateVal)
  };

  // Requirement: Before completing a purchase, the customer must be logged in.
  // Flow: View & Buy -> Select Size -> Delivery Details -> Buy Now -> Login/Sign Up -> Payment.
  // If already logged in, continue directly to payment.
  if (!isCustomerLoggedIn()) {
    pendingOrderCheckout = orderPayload;
    try {
      sessionStorage.setItem('pendingOrderCheckout', JSON.stringify(orderPayload));
    } catch (err) {}

    // Open login/sign-up screen while preserving all entered delivery details
    openAuthModal('login', true);
    if (authEmailInput && emailVal) {
      authEmailInput.value = emailVal;
    }
    return;
  }

  // Already logged in: continue directly to payment
  executeOrderPayment(orderPayload);
}

function executeCheckout(purchase) {
  if (!purchase) return;
  openCheckoutModal(purchase);
}

function handleBuyNow(cardId) {
  const state = cardStates[cardId] || {};
  const msgEl = document.getElementById(`msg-${cardId}`);
  if (!state.size) {
    if (msgEl) {
      msgEl.textContent = "Please select a size.";
      msgEl.style.color = "#9B2C2C";
      msgEl.style.display = "block";
    }
    return;
  }
  if (msgEl) {
    msgEl.style.display = "none";
    msgEl.textContent = "";
  }
  const container = document.querySelector(`[data-card-id="${cardId}"]`);
  const category = container ? container.dataset.category : '';
  const design = container ? container.dataset.design : '';
  const price = container ? container.dataset.price : '';

  pendingPurchase = {
    cardId,
    category,
    design,
    size: state.size,
    price
  };
  try {
    sessionStorage.setItem('pendingPurchase', JSON.stringify(pendingPurchase));
  } catch (e) {}

  // Flow: View & Buy -> Select Size -> Buy Now -> Login / Sign Up -> Delivery Details -> Payment
  // 1. If NOT logged in -> show the existing Login / Sign Up page first
  if (!isCustomerLoggedIn()) {
    openAuthModal('login', true);
    return;
  }

  // 4. If the customer is already logged in -> skip Login and open Delivery Details directly
  openCheckoutModal(pendingPurchase);
}

document.addEventListener('click', (e) => {
  const viewDetailsBtn = e.target.closest('.btn-view-details');
  if (viewDetailsBtn) {
    const designCard = viewDetailsBtn.closest('.design-card');
    const container = designCard.querySelector('.flip-container');
    if (container) {
      toggleFlip(container.dataset.cardId);
    }
    return;
  }

  const backArrow = e.target.closest('.back-arrow');
  if (backArrow) {
    const container = backArrow.closest('.flip-container');
    if (container) {
      toggleFlip(container.dataset.cardId);
    }
    return;
  }

  const sizeChip = e.target.closest('.size-chip');
  if (sizeChip) {
    const container = sizeChip.closest('.flip-container');
    if (container) {
      selectSize(container.dataset.cardId, sizeChip.dataset.size);
    }
    return;
  }

  const buyNowBtn = e.target.closest('.buy-now-btn');
  if (buyNowBtn) {
    const card = buyNowBtn.closest('.design-card');
    const container = card ? card.querySelector('.flip-container') : null;
    if (container) {
      handleBuyNow(container.dataset.cardId);
    }
    return;
  }

  const customLink = e.target.closest('.customisation-link');
  if (customLink) {
    sessionStorage.removeItem('openedFromMobileMenu');
    sessionStorage.removeItem('mobileMenuOriginRoute');
    const card = customLink.closest('.design-card');
    const container = card ? card.querySelector('.flip-container') : null;
    const designName = container ? container.dataset.design : null;
    sessionStorage.setItem('customOriginRoute', location.hash || '#/');
    if (designName) {
      sessionStorage.setItem('customOriginDesign', designName);
    }
  }
});

/* =========================================================
   CATALOGUE RENDERING
   ========================================================= */

function renderSubcatNav(pageKey, activeSubcat) {
  const nav = document.getElementById(`${pageKey}-subcat-nav`);
  if (!nav) return;
  const cats = CATALOGUE_DATA[pageKey].categories;
  nav.innerHTML = Object.keys(cats).map(key => `
    <button type="button" class="subcat-btn${key === activeSubcat ? ' active' : ''}"
            data-page="${pageKey}" data-subcat="${key}">${cats[key].label}</button>
  `).join('');
}

function renderCategory(pageKey, subcatKey) {
  const grid = document.getElementById(`${pageKey}-grid`);
  if (!grid || !CATALOGUE_DATA[pageKey]) return;
  const cat = CATALOGUE_DATA[pageKey].categories[subcatKey];
  if (!cat) {
    grid.innerHTML = '';
    return;
  }
  const catLabel = CATALOGUE_DATA[pageKey].catLabel;

  grid.innerHTML = cat.items.map((item, index) => {
    const cardId = `${pageKey}-${subcatKey}-${index}`;
    const sizes = catLabel === "Kids" ? KIDS_SIZES : (item.sizes || DEFAULT_SIZES);
    const baseCustomUrl = `#/customisation?category=${encodeURIComponent(catLabel)}&design=${encodeURIComponent(item.name)}`;

    return `
      <div class="design-card">
        <div class="flip-container" data-card-id="${cardId}" data-category="${catLabel}" data-design="${item.name}" data-price="${item.price}">
          <div class="flip-inner">
            <div class="flip-front">
              <img src="${item.img}" alt="${item.name}" class="card-img" loading="lazy">
            </div>
            <div class="flip-back">
              <button type="button" class="back-arrow" aria-label="Back to image">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <div class="details-content">
                <div class="details-label">AVAILABLE SIZES</div>
                <div class="size-chips">
                  ${sizes.map(s => `<button type="button" class="size-chip" data-size="${s}">${s}</button>`).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
        <h4>${item.name}</h4>
        <div class="price">${item.price}</div>
        <div class="card-actions">
          <div class="card-action-col left-col">
            <button type="button" class="btn-card btn-card-primary btn-view-details normal-only">View & Buy</button>
            <button type="button" class="btn-card btn-card-primary buy-now-btn flipped-only">Buy Now</button>
            <div class="buy-now-message" id="msg-${cardId}"></div>
          </div>
          <div class="card-action-col right-col">
            <p class="secondary-text flipped-only">Couldn't find your<br>desired size?</p>
            <a href="${baseCustomUrl}" class="btn-card btn-card-secondary customisation-link">Customisation</a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function updateCategoryURL(pageKey, subcatKey) {
  const newHash = `#/${pageKey}?category=${encodeURIComponent(subcatKey)}`;
  if (location.hash !== newHash) {
    history.replaceState(null, '', newHash);
  }
  if (appHistory.length > 0) {
    appHistory[appHistory.length - 1] = newHash;
  }
}

function handleSubcatClick(e) {
  const btn = e.target.closest('.subcat-btn');
  if (!btn) return;
  const pageKey = btn.dataset.page;
  const subcatKey = btn.dataset.subcat;
  if (!pageKey || !subcatKey) return;

  renderSubcatNav(pageKey, subcatKey);
  renderCategory(pageKey, subcatKey);
  updateCategoryURL(pageKey, subcatKey);
}

document.addEventListener('click', handleSubcatClick);

// Ensure opening a main category from nav, mobile menu, homepage, or footer ALWAYS starts with the FIRST subcategory
document.addEventListener('click', (e) => {
  const catLink = e.target.closest('a[href^="#/women"], a[href^="#/kids"], a[href^="#/bridal"], a[href^="#/ethnic"], a[href^="#/western"], a[data-link^="#/women"], a[data-link^="#/kids"], a[data-link^="#/bridal"], a[data-link^="#/ethnic"], a[data-link^="#/western"]');
  if (catLink && !catLink.closest('.subcat-nav')) {
    const href = catLink.getAttribute('href') || catLink.getAttribute('data-link') || '';
    const rawPath = href.replace(/^#\/?/, '').split('?')[0];
    const targetPageKey = rawPath.replace('/', '');
    if (CATALOGUE_DATA[targetPageKey]) {
      const firstSubcat = Object.keys(CATALOGUE_DATA[targetPageKey].categories)[0];
      const targetHash = `#/${targetPageKey}?category=${encodeURIComponent(firstSubcat)}`;
      e.preventDefault();
      if (location.hash === targetHash) {
        renderSubcatNav(targetPageKey, firstSubcat);
        renderCategory(targetPageKey, firstSubcat);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        location.hash = targetHash;
      }
    }
  }
});

/* =========================================================
   CUSTOMISATION PAGE HELPERS
   ========================================================= */

function selectCustomSize(size) {
  const input = document.getElementById('f-selected-size');
  if (input) input.value = size;
  document.querySelectorAll('#custom-size-chips .size-chip').forEach(btn => {
    btn.classList.toggle('active', btn.textContent === size);
  });
}
window.selectCustomSize = selectCustomSize;

/* ==========================================
   ROUTING & HISTORY
   ========================================== */

const scrollPositions = {};
let currentPath = '/';
const appHistory = [];
let isNavigatingBack = false;

function findDesignOrigin(categoryParam, designParam) {
  if (!designParam) return null;
  const targetDesign = designParam.toLowerCase();

  for (const pKey in CATALOGUE_DATA) {
    const pData = CATALOGUE_DATA[pKey];
    if (categoryParam && pData.catLabel.toLowerCase() !== categoryParam.toLowerCase() && pKey.toLowerCase() !== categoryParam.toLowerCase()) {
      continue;
    }
    for (const sKey in pData.categories) {
      const subcat = pData.categories[sKey];
      const found = subcat.items.find(item => item.name.toLowerCase() === targetDesign);
      if (found) {
        return { pageKey: pKey, subcatKey: sKey, designName: found.name };
      }
    }
  }

  for (const pKey in CATALOGUE_DATA) {
    const pData = CATALOGUE_DATA[pKey];
    for (const sKey in pData.categories) {
      const subcat = pData.categories[sKey];
      const found = subcat.items.find(item => item.name.toLowerCase() === targetDesign);
      if (found) {
        return { pageKey: pKey, subcatKey: sKey, designName: found.name };
      }
    }
  }
  return null;
}

function scrollToDesignCard(designName) {
  if (!designName) return;
  const attemptScroll = (retries = 8) => {
    const containers = document.querySelectorAll('.flip-container');
    let targetCard = null;
    for (const c of containers) {
      if (c.dataset.design === designName) {
        targetCard = c.closest('.design-card') || c;
        break;
      }
    }
    if (targetCard) {
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (retries > 0) {
      setTimeout(() => attemptScroll(retries - 1), 70);
    }
  };
  setTimeout(() => attemptScroll(), 60);
}

function handleCustomisationBack() {
  const { params } = parseHash();
  const design = params.get('design') || sessionStorage.getItem('customOriginDesign');
  const cat = params.get('category');

  let originRoute = sessionStorage.getItem('customOriginRoute');
  if (!originRoute || originRoute === '#/' || originRoute.startsWith('#/customisation')) {
    const origin = findDesignOrigin(cat, design);
    if (origin) {
      originRoute = `#/${origin.pageKey}?category=${encodeURIComponent(origin.subcatKey)}`;
    }
  }

  const targetHash = originRoute || '#/';
  const targetDesign = design;

  sessionStorage.removeItem('customOriginRoute');
  sessionStorage.removeItem('customOriginDesign');

  isNavigatingBack = true;
  window.location.hash = targetHash;

  if (targetDesign) {
    scrollToDesignCard(targetDesign);
  }
}

let isBackActionDebounced = false;
function handleBack() {
  if (isBackActionDebounced) return;
  isBackActionDebounced = true;
  setTimeout(() => { isBackActionDebounced = false; }, 350);

  const { path } = parseHash();

  if (sessionStorage.getItem('openedFromMobileMenu') === 'true') {
    sessionStorage.removeItem('openedFromMobileMenu');
    const origin = sessionStorage.getItem('mobileMenuOriginRoute') || '#/';
    sessionStorage.removeItem('mobileMenuOriginRoute');
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.hash = origin;
    }
    openMobileMenu();
    return;
  }

  if (path === '/customisation') {
    handleCustomisationBack();
    return;
  }

  if (appHistory.length > 1 && window.history.length > 1) {
    window.history.back();
  } else {
    window.location.hash = '#/';
  }
}
window.handleBack = handleBack;

const pages = {
  '/': 'home', '/women': 'women', '/kids': 'kids',
  '/bridal': 'bridal', '/ethnic': 'ethnic',
  '/western': 'western', '/customisation': 'customisation',
  '/help': 'help',
  '/admin': 'admin'
};

function parseHash() {
  const raw = location.hash.replace('#', '') || '/';
  const [path, query = ''] = raw.split('?');
  return { path: path || '/', params: new URLSearchParams(query) };
}

function navigate() {
  const { path, params } = parseHash();
  const fullHash = location.hash || '#/';

  if (isNavigatingBack) {
    isNavigatingBack = false;
    appHistory.push(fullHash);
  } else {
    if (appHistory.length > 0) {
      const lastEntry = appHistory[appHistory.length - 1];
      const lastPath = (lastEntry.replace('#', '').split('?')[0]) || '/';
      if (lastPath === path) {
        appHistory[appHistory.length - 1] = fullHash;
      } else {
        const prevIdx = appHistory.lastIndexOf(fullHash);
        if (prevIdx !== -1 && prevIdx === appHistory.length - 2) {
          appHistory.pop();
        } else {
          appHistory.push(fullHash);
        }
      }
    } else {
      appHistory.push(fullHash);
    }
  }

  scrollPositions[currentPath] = window.scrollY;
  currentPath = path;

  const pageKey = pages[path] || 'home';

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.querySelector(`.page[data-page="${pageKey}"]`);
  if (target) target.classList.add('active');

  if (path !== '/' && path !== '' && popupOverlay && popupOverlay.classList.contains('open')) {
    closeCollectionPopup(true, false);
  }

  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('data-link') === '#' + path);
  });

  if (CATALOGUE_DATA[pageKey]) {
    const urlCat = params.get('category');
    const validSubcats = Object.keys(CATALOGUE_DATA[pageKey].categories);
    const activeSubcat = urlCat && validSubcats.includes(urlCat)
      ? urlCat
      : CATALOGUE_DATA[pageKey].defaultCat;
    renderSubcatNav(pageKey, activeSubcat);
    renderCategory(pageKey, activeSubcat);
    updateCategoryURL(pageKey, activeSubcat);
  }

  if (pageKey === 'customisation') {
    const cat = params.get('category');
    const design = params.get('design');
    const size = params.get('size');
    const summaryContainer = document.getElementById('customisation-summary');
    if (summaryContainer) {
      if (design) {
        let price = "";
        let itemSizes = DEFAULT_SIZES;
        for (const pKey in CATALOGUE_DATA) {
          for (const sKey in CATALOGUE_DATA[pKey].categories) {
            const item = CATALOGUE_DATA[pKey].categories[sKey].items.find(i => i.name === design);
            if (item) {
              price = item.price;
              itemSizes = (pKey === "kids") ? KIDS_SIZES : (item.sizes || DEFAULT_SIZES);
              break;
            }
          }
        }

        if (!document.getElementById('f-selected-size')) {
          const sizeInput = document.createElement('input');
          sizeInput.type = 'hidden';
          sizeInput.name = 'selected_size';
          sizeInput.id = 'f-selected-size';
          document.getElementById('enquiryForm').appendChild(sizeInput);
        }

        let selectionsHtml = '';
        if (size) {
          selectionsHtml += `<div class="summary-item"><span class="summary-key">Size:</span> <span class="summary-val">${size}</span></div>`;
        }

        summaryContainer.innerHTML = `
          <div class="customisation-summary-box">
            <div class="summary-label">Customise your design</div>
            <h3 class="summary-design">${escapeHtml(design)}</h3>
            ${price ? `<div class="summary-price">${escapeHtml(price)}</div>` : ''}
            
            <div style="margin-top: 24px; text-align: left; max-width: 400px; margin-left: auto; margin-right: auto;">
              <div class="details-label" style="margin-bottom: 8px;">Size</div>
              <div class="size-chips" id="custom-size-chips" style="margin-bottom: 20px;">
                ${itemSizes.map(s => `<button type="button" class="size-chip ${size === s ? 'active' : ''}" onclick="selectCustomSize('${escapeHtml(s)}')">${escapeHtml(s)}</button>`).join('')}
              </div>
            </div>
          </div>
        `;
        summaryContainer.style.display = 'block';

        if (size) {
          const sizeInput = document.getElementById('f-selected-size');
          if (sizeInput) sizeInput.value = size;
        }
      } else {
        summaryContainer.style.display = 'none';
      }
    }

    if (design) {
      const designField = document.getElementById('f-design');
      if (designField && !designField.value) {
        designField.value = design;
      }
    }
    if (size) {
      const measurementsField = document.getElementById('f-measurements');
      if (measurementsField && !measurementsField.value) {
        measurementsField.value = `Size: ${size}`;
      }
    }
  }

  if (pageKey === 'help') {
    if (helpValidation) helpValidation.style.display = 'none';
  }

  if (pageKey === 'admin') {
    handleAdminRoute();
  } else {
    const nav = document.getElementById('nav');
    if (nav) nav.style.display = '';
    const footer = document.querySelector('footer');
    if (footer) footer.style.display = '';
  }

  if (path === '/login' || path === '/auth') {
    openAuthModal('login');
  } else if (path === '/signup') {
    openAuthModal('signup');
  }

  const savedPos = scrollPositions[path];
  if (savedPos !== undefined) window.scrollTo({ top: savedPos, behavior: 'instant' });
  else window.scrollTo({ top: 0, behavior: 'instant' });
}

window.addEventListener('hashchange', navigate);

let lastScrollY = window.scrollY;
let ticking = false;
const nav = document.getElementById('nav');
const mobileMenu = document.getElementById('mobileMenu');

function updateNavbar() {
  const currentScrollY = window.scrollY;
  if (mobileMenu.classList.contains('open')) { ticking = false; return; }
  if (currentScrollY <= 10) nav.classList.remove('nav-hidden');
  else {
    if (currentScrollY > lastScrollY + 10) nav.classList.add('nav-hidden');
    else if (currentScrollY < lastScrollY - 10) nav.classList.remove('nav-hidden');
  }
  lastScrollY = currentScrollY;
  ticking = false;
}

window.addEventListener('scroll', () => {
  if (!ticking) { window.requestAnimationFrame(updateNavbar); ticking = true; }
}, { passive: true });

const menuBtn = document.getElementById('navMenuBtn');
const mobileMenuClose = document.getElementById('mobileMenuClose');
const mobileMenuLinks = document.querySelectorAll('.mobile-menu-link, .mobile-menu-cta');
let mobileMenuOriginRoute = '#/';

function openMobileMenu() {
  mobileMenuOriginRoute = location.hash || '#/';
  mobileMenu.classList.add('open');
  mobileMenu.setAttribute('aria-hidden', 'false');
  document.body.classList.add('menu-open');
  nav.classList.remove('nav-hidden');
}

function closeMobileMenu() {
  mobileMenu.classList.remove('open');
  mobileMenu.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('menu-open');
}

menuBtn.addEventListener('click', openMobileMenu);
mobileMenuClose.addEventListener('click', () => {
  sessionStorage.removeItem('openedFromMobileMenu');
  sessionStorage.removeItem('mobileMenuOriginRoute');
  closeMobileMenu();
});

mobileMenuLinks.forEach(link => {
  link.addEventListener('click', () => {
    sessionStorage.setItem('openedFromMobileMenu', 'true');
    sessionStorage.setItem('mobileMenuOriginRoute', mobileMenuOriginRoute || location.hash || '#/');
    closeMobileMenu();
  });
});

document.addEventListener('click', (e) => {
  if (e.target.closest('.nav-links a, .nav-brand, .footer a, #footerAuthLink, #openAuthBtn')) {
    sessionStorage.removeItem('openedFromMobileMenu');
    sessionStorage.removeItem('mobileMenuOriginRoute');
    sessionStorage.removeItem('openedFromViewCollection');
    sessionStorage.removeItem('viewCollectionOriginRoute');
  }
});

const form = document.getElementById('enquiryForm');
const success = document.getElementById('formSuccess');
const successHomeBtn = document.getElementById('successHomeBtn');

// Homepage marquee carousel hover pause & resume
const marqueeContainer = document.querySelector('.marquee-container');
const marqueeTrack = document.querySelector('.marquee-track');
if (marqueeContainer && marqueeTrack) {
  marqueeContainer.addEventListener('mouseenter', () => {
    marqueeTrack.style.animationPlayState = 'paused';
  });
  marqueeContainer.addEventListener('mouseleave', () => {
    marqueeTrack.style.animationPlayState = 'running';
  });
}

const nameInput = document.getElementById('f-name');
const phoneInput = document.getElementById('f-phone');
const nameError = document.getElementById('nameError');
const phoneError = document.getElementById('phoneError');

if (nameInput) {
  nameInput.addEventListener('input', () => {
    if (nameInput.value.trim()) {
      nameInput.classList.remove('error');
      if (nameError) nameError.style.display = 'none';
    }
  });
}

if (phoneInput) {
  phoneInput.addEventListener('input', () => {
    if (phoneInput.value.trim()) {
      phoneInput.classList.remove('error');
      if (phoneError) phoneError.style.display = 'none';
    }
  });
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    const fullName = (formData.get('name') || '').trim();
    const contactNumber = (formData.get('phone') || '').trim();

    let hasError = false;

    if (!fullName) {
      if (nameInput) nameInput.classList.add('error');
      if (nameError) nameError.style.display = 'block';
      hasError = true;
    } else {
      if (nameInput) nameInput.classList.remove('error');
      if (nameError) nameError.style.display = 'none';
    }

    if (!contactNumber) {
      if (phoneInput) phoneInput.classList.add('error');
      if (phoneError) phoneError.style.display = 'block';
      hasError = true;
    } else {
      if (phoneInput) phoneInput.classList.remove('error');
      if (phoneError) phoneError.style.display = 'none';
    }

    if (hasError) {
      if (!fullName && nameInput) {
        nameInput.focus();
      } else if (!contactNumber && phoneInput) {
        phoneInput.focus();
      }
      return;
    }

    const colour = (formData.get('colour') || '').trim();
    const fabric = (formData.get('fabric') || '').trim();
    const design = (formData.get('design') || '').trim();
    const measurements = (formData.get('measurements') || '').trim();
    const embellishments = (formData.get('embellishment') || '').trim();
    const additionalInformation = (formData.get('requirements') || '').trim();

    const customer = typeof getCustomerSession === 'function' ? getCustomerSession() : null;
    const authUser = window.fbAuth?.currentUser;
    const userId = authUser?.uid || customer?.uid || '';
    const email = authUser?.email || customer?.email || '';

    const payload = {
      // Required customisation fields (standard keys)
      fullName,
      contactNumber,
      colour,
      fabric,
      design,
      measurements,
      embellishments,
      additionalInformation,
      additionalRequirements: additionalInformation,
      userId,
      email,
      createdAt: window.fbFns?.serverTimestamp ? window.fbFns.serverTimestamp() : new Date().toISOString(),
      status: 'New Request',

      // Exact prompt title-cased keys
      'Full Name': fullName,
      'Contact Number': contactNumber,
      'Colour': colour,
      'Fabric': fabric,
      'Design': design,
      'Measurements': measurements,
      'Embellishments': embellishments,
      'Additional Information': additionalInformation,

      referenceImage: '',
      submissionDate: new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    };

    const submitBtn = form.querySelector('.form-submit button');
    const originalText = submitBtn ? submitBtn.innerHTML : 'Submit Enquiry';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Submitting...';
    }

    try {
      if (window.fbDb && window.fbFns) {
        await window.fbFns.addDoc(window.fbFns.collection(window.fbDb, 'customisationRequests'), payload);
        await window.fbFns.addDoc(window.fbFns.collection(window.fbDb, 'customisations'), payload);
        await window.fbFns.addDoc(window.fbFns.collection(window.fbDb, 'enquiries'), payload);
      }
      saveLocalCustomisation(payload);
      form.style.display = 'none';
      if (success) {
        success.classList.add('show');
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (err) {
      console.warn('Enquiry fallback to local storage:', err);
      saveLocalCustomisation(payload);
      form.style.display = 'none';
      if (success) {
        success.classList.add('show');
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    }
  });
}

const fileUploadInput = document.getElementById('f-image');
const fileUploadNameEl = document.getElementById('fileUploadName');
if (fileUploadInput && fileUploadNameEl) {
  fileUploadInput.addEventListener('change', () => {
    if (fileUploadInput.files && fileUploadInput.files.length > 0) {
      const names = Array.from(fileUploadInput.files).map(f => f.name).join(', ');
      fileUploadNameEl.textContent = `Attached: ${names}`;
      fileUploadNameEl.style.display = 'block';
    } else {
      fileUploadNameEl.textContent = '';
      fileUploadNameEl.style.display = 'none';
    }
  });
}

if (successHomeBtn) {
  successHomeBtn.addEventListener('click', () => {
    window.location.hash = '#/';
    if (form) {
      form.reset();
      form.style.display = '';
    }
    if (success) success.classList.remove('show');
    if (fileUploadNameEl) {
      fileUploadNameEl.textContent = '';
      fileUploadNameEl.style.display = 'none';
    }
  });
}

/* =========================================================
   HELP CENTRE FORM FUNCTIONALITY
   ========================================================= */

const helpForm = document.getElementById('helpForm');
const helpText = document.getElementById('helpText');
const helpValidation = document.getElementById('helpValidation');
const helpSuccess = document.getElementById('helpSuccess');
const helpHomeBtn = document.getElementById('helpHomeBtn');

if (helpForm && helpText) {
  helpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = helpText.value.trim();
    if (!val) {
      if (helpValidation) {
        helpValidation.textContent = 'Please tell us how we can help.';
        helpValidation.style.display = 'block';
      }
      return;
    }
    if (helpValidation) {
      helpValidation.style.display = 'none';
    }

    const submitBtn = helpForm.querySelector('.help-submit-btn') || helpForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Submit';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
    }

    const customer = typeof getCustomerSession === 'function' ? getCustomerSession() : null;
    const authUser = window.fbAuth?.currentUser;
    const userId = authUser?.uid || customer?.uid || '';
    const email = authUser?.email || customer?.email || '';

    const helpPayload = {
      message: val,
      userId: userId,
      email: email,
      createdAt: window.fbFns?.serverTimestamp ? window.fbFns.serverTimestamp() : new Date().toISOString(),
      status: 'Not Resolved',

      // Additional fields for admin compatibility
      customerName: customer?.name || authUser?.displayName || (email ? email.split('@')[0] : 'Website Customer'),
      submissionDate: new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    try {
      if (window.fbDb && window.fbFns) {
        await window.fbFns.addDoc(window.fbFns.collection(window.fbDb, 'helpRequests'), helpPayload);
        await window.fbFns.addDoc(window.fbFns.collection(window.fbDb, 'help'), helpPayload);
      }
      saveLocalHelp(val);
      helpForm.style.display = 'none';
      if (helpSuccess) {
        helpSuccess.style.display = 'block';
      }
    } catch (err) {
      console.warn('Firestore help request write error:', err);
      saveLocalHelp(val);
      helpForm.style.display = 'none';
      if (helpSuccess) {
        helpSuccess.style.display = 'block';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    }
  });

  helpText.addEventListener('input', () => {
    if (helpValidation && helpValidation.style.display !== 'none') {
      helpValidation.style.display = 'none';
    }
  });
}

if (helpHomeBtn) {
  helpHomeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.hash = '#/';
    if (helpForm) helpForm.style.display = '';
    if (helpSuccess) helpSuccess.style.display = 'none';
    if (helpText) helpText.value = '';
    if (helpValidation) helpValidation.style.display = 'none';
  });
}

const popupOverlay = document.getElementById('categoryPopupOverlay');
const popupClose = document.getElementById('popupClose');
const openPopupBtn = document.getElementById('openPopupBtn');
const popupCats = document.querySelectorAll('.popup-cat');

function openCollectionPopup(instant = false, pushState = true) {
  if (instant) {
    popupOverlay.style.transition = 'none';
    const popupCard = popupOverlay.querySelector('.category-popup');
    if (popupCard) popupCard.style.transition = 'none';
  }
  popupOverlay.classList.add('open');
  updateModalLockState();
  if (instant) {
    requestAnimationFrame(() => {
      popupOverlay.style.transition = '';
      const popupCard = popupOverlay.querySelector('.category-popup');
      if (popupCard) popupCard.style.transition = '';
    });
  }

  if (pushState && (!window.history.state || window.history.state.popup !== 'collection')) {
    window.history.pushState({ popup: 'collection' }, '', window.location.href);
  }
}

function closeCollectionPopup(instant = false, syncHistory = false) {
  if (syncHistory && window.history.state && window.history.state.popup === 'collection') {
    if (instant) {
      popupOverlay.style.transition = 'none';
      const popupCard = popupOverlay.querySelector('.category-popup');
      if (popupCard) popupCard.style.transition = 'none';
    }
    popupOverlay.classList.remove('open');
    updateModalLockState();
    if (instant) {
      requestAnimationFrame(() => {
        popupOverlay.style.transition = '';
        const popupCard = popupOverlay.querySelector('.category-popup');
        if (popupCard) popupCard.style.transition = '';
      });
    }

    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.history.replaceState(null, '', window.location.href);
    }
    return;
  }

  if (instant) {
    popupOverlay.style.transition = 'none';
    const popupCard = popupOverlay.querySelector('.category-popup');
    if (popupCard) popupCard.style.transition = 'none';
  }
  popupOverlay.classList.remove('open');
  updateModalLockState();
  if (instant) {
    requestAnimationFrame(() => {
      popupOverlay.style.transition = '';
      const popupCard = popupOverlay.querySelector('.category-popup');
      if (popupCard) popupCard.style.transition = '';
    });
  }
}

if (openPopupBtn) openPopupBtn.addEventListener('click', () => openCollectionPopup(false, true));
if (popupClose) popupClose.addEventListener('click', () => closeCollectionPopup(false, true));
if (popupOverlay) {
  popupOverlay.addEventListener('click', (e) => {
    if (e.target === popupOverlay) closeCollectionPopup(false, true);
  });
}
popupCats.forEach(cat => {
  cat.addEventListener('click', (e) => {
    e.preventDefault();
    const targetRoute = cat.getAttribute('href') || cat.dataset.route;
    if (!targetRoute) return;

    sessionStorage.removeItem('openedFromMobileMenu');
    sessionStorage.removeItem('mobileMenuOriginRoute');

    closeCollectionPopup(true, false);
    const targetPageKey = targetRoute.replace(/^#\/?/, '').split('?')[0];
    if (CATALOGUE_DATA[targetPageKey]) {
      const firstSubcat = Object.keys(CATALOGUE_DATA[targetPageKey].categories)[0];
      const targetHash = `#/${targetPageKey}?category=${encodeURIComponent(firstSubcat)}`;
      if (window.location.hash === targetHash) {
        renderSubcatNav(targetPageKey, firstSubcat);
        renderCategory(targetPageKey, firstSubcat);
      } else {
        window.location.hash = targetHash;
      }
    } else {
      window.location.hash = targetRoute;
    }
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && popupOverlay && popupOverlay.classList.contains('open')) {
    closeCollectionPopup(false, true);
  }
});

window.addEventListener('popstate', (e) => {
  if (e.state && e.state.popup === 'collection') {
    openCollectionPopup(false, false);
  } else {
    if (popupOverlay && popupOverlay.classList.contains('open')) {
      closeCollectionPopup(false, false);
    }
  }
});

/* =========================================================
   CUSTOMER AUTHENTICATION (LOGIN / SIGN UP)
   ========================================================= */

const authModalOverlay = document.getElementById('authModalOverlay');
const authCloseBtn = document.getElementById('authCloseBtn');
const openAuthBtn = document.getElementById('openAuthBtn');
const mobileAuthBtn = document.getElementById('mobileAuthBtn');
const footerAuthLink = document.getElementById('footerAuthLink');

const authTabLogin = document.getElementById('authTabLogin');
const authTabSignUp = document.getElementById('authTabSignUp');
const authHeading = document.getElementById('authHeading');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authSwitchPrompt = document.getElementById('authSwitchPrompt');
const authSwitchAction = document.getElementById('authSwitchAction');
const authEmailForm = document.getElementById('authEmailForm');
const authEmailInput = document.getElementById('authEmailInput');
const authFeedback = document.getElementById('authFeedback');
const authSocialBtns = document.querySelectorAll('.auth-social-btn');

const authFormView = document.getElementById('authFormView');
const authUserView = document.getElementById('authUserView');
const authUserEmail = document.getElementById('authUserEmail');
const authUserInitials = document.getElementById('authUserInitials');
const authSignOutBtn = document.getElementById('authSignOutBtn');

let currentAuthMode = 'login'; // 'login' | 'signup'

function getCustomerSession() {
  try {
    const raw = localStorage.getItem('jayashree_customer');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function isCustomerLoggedIn() {
  const session = getCustomerSession();
  return Boolean(session && session.email && session.provider !== 'guest');
}

function setCustomerSession(customer) {
  try {
    localStorage.setItem('jayashree_customer', JSON.stringify(customer));
  } catch (e) {}
  updateAuthUI();
}

function clearCustomerSession() {
  try {
    localStorage.removeItem('jayashree_customer');
  } catch (e) {}
  updateAuthUI();
}

const ORDER_STATUS_OPTIONS = [
  'Processing',
  'Confirmed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
  'Other'
];

function getOrderTimestamp(order) {
  if (!order) return 0;
  if (typeof order.orderTimestamp === 'number' && !isNaN(order.orderTimestamp)) {
    return order.orderTimestamp;
  }
  const c = order.createdAt;
  if (c) {
    if (typeof c.toMillis === 'function') return c.toMillis();
    if (typeof c.toDate === 'function') return c.toDate().getTime();
    if (typeof c === 'object' && typeof c.seconds === 'number') {
      return c.seconds * 1000 + (c.nanoseconds ? Math.floor(c.nanoseconds / 1e6) : 0);
    }
    if (typeof c === 'number') return c;
    if (typeof c === 'string') {
      const parsed = Date.parse(c);
      if (!isNaN(parsed)) return parsed;
    }
  }
  if (order.updatedAt) {
    const u = order.updatedAt;
    if (typeof u.toMillis === 'function') return u.toMillis();
    if (typeof u.toDate === 'function') return u.toDate().getTime();
    if (typeof u === 'object' && typeof u.seconds === 'number') {
      return u.seconds * 1000;
    }
    if (typeof u === 'string') {
      const parsed = Date.parse(u);
      if (!isNaN(parsed)) return parsed;
    }
  }
  if (order.orderDate && typeof order.orderDate === 'string') {
    const parsed = Date.parse(order.orderDate);
    if (!isNaN(parsed)) return parsed;
  }
  if (order.date && typeof order.date === 'string') {
    const parsed = Date.parse(order.date);
    if (!isNaN(parsed)) return parsed;
  }
  if (typeof order.id === 'string') {
    const numMatch = order.id.match(/\d{10,}/);
    if (numMatch) return parseInt(numMatch[0], 10);
  }
  return 0;
}

function getDisplayOrderNumber(order) {
  if (!order) return '1001';
  const explicit = order.displayOrderNumber || order.orderNumber;
  if (explicit) {
    const clean = String(explicit).trim();
    if (/^\d{4}$/.test(clean)) return clean;
    const digits = clean.replace(/\D/g, '');
    if (digits.length >= 4) return digits.slice(-4);
    if (digits.length > 0) return digits.padStart(4, '0');
  }
  const idStr = String(order.orderId || order.id || '').trim();
  if (!idStr) return '1001';

  const trailingDigitsMatch = idStr.match(/(\d{4,})$/);
  if (trailingDigitsMatch) {
    return trailingDigitsMatch[1].slice(-4);
  }
  const allDigits = idStr.replace(/\D/g, '');
  if (allDigits.length >= 4) {
    return allDigits.slice(-4);
  }

  // Deterministic 4-digit number (1000 - 9999) for arbitrary Firestore IDs
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) {
    hash = ((hash << 5) - hash + idStr.charCodeAt(i)) | 0;
  }
  const num = 1000 + (Math.abs(hash) % 9000);
  return String(num);
}

function getOrderDateObj(order) {
  if (!order) return new Date();
  if (order instanceof Date) return order;
  const c = order.createdAt;
  if (c) {
    if (typeof c.toDate === 'function') return c.toDate();
    if (typeof c === 'object' && typeof c.seconds === 'number') return new Date(c.seconds * 1000);
    if (typeof c === 'number') return new Date(c);
    if (typeof c === 'string') {
      const parsed = Date.parse(c);
      if (!isNaN(parsed)) return new Date(parsed);
    }
  }
  if (order.orderDate && typeof order.orderDate === 'string') {
    const parsed = Date.parse(order.orderDate);
    if (!isNaN(parsed)) return new Date(parsed);
  }
  if (order.date && typeof order.date === 'string') {
    const parsed = Date.parse(order.date);
    if (!isNaN(parsed)) return new Date(parsed);
  }
  return new Date();
}

function formatOrderDisplayDate(order) {
  const d = getOrderDateObj(order);
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatOrderSimpleDate(order) {
  if (!order) return '—';
  if (typeof order.date === 'string' && /^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/.test(order.date.trim())) {
    return order.date.trim();
  }
  const d = getOrderDateObj(order);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatOrderDateTime(val) {
  if (!val) return 'Recently';
  let d = null;
  if (typeof val?.toDate === 'function') d = val.toDate();
  else if (typeof val === 'object' && typeof val?.seconds === 'number') d = new Date(val.seconds * 1000);
  else if (typeof val === 'number') d = new Date(val);
  else if (typeof val === 'string') {
    const p = Date.parse(val);
    if (!isNaN(p)) d = new Date(p);
  }
  if (d && !isNaN(d.getTime())) {
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${h}:${min} ${ampm}`;
  }
  return String(val);
}

function getExpectedDeliveryForOrder(order) {
  if (order && order.expectedDelivery && typeof order.expectedDelivery === 'string' && order.expectedDelivery.trim() !== '') {
    return order.expectedDelivery.trim();
  }
  if (order && order.estimatedDelivery && typeof order.estimatedDelivery === 'string' && order.estimatedDelivery.trim() !== '') {
    return order.estimatedDelivery.trim();
  }
  const pinCode = order?.pinCode || '';
  const state = order?.state || '';
  const orderDate = getOrderDateObj(order);
  return formatDynamicDeliveryDateRange(pinCode, state, orderDate);
}

function isOrderCancellable(order) {
  if (!order) return false;
  const status = (order.status || order.orderStatus || 'Processing').trim().toLowerCase();
  const nonCancellable = ['shipped', 'out for delivery', 'delivered', 'cancelled'];
  if (nonCancellable.includes(status)) {
    return false;
  }
  const createdMs = getOrderTimestamp(order);
  if (!createdMs) return false;
  const now = Date.now();
  const deadlineMs = createdMs + (24 * 60 * 60 * 1000);
  return now < deadlineMs;
}

function formatRemainingCancellationTime(createdMs) {
  if (!createdMs || isNaN(createdMs)) {
    return { expired: true, text: '00:00:00', remainingMs: 0 };
  }
  const now = Date.now();
  const deadlineMs = createdMs + (24 * 60 * 60 * 1000);
  const remainingMs = deadlineMs - now;
  if (remainingMs <= 0) {
    return { expired: true, text: '00:00:00', remainingMs: 0 };
  }
  const totalSecs = Math.floor(remainingMs / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const text = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return { expired: false, text, remainingMs };
}

let cancellationCountdownIntervalId = null;

function updateCancellationCountdowns() {
  const countdownEls = document.querySelectorAll('.my-order-countdown[data-created-at]');
  if (!countdownEls || countdownEls.length === 0) {
    stopCancellationCountdownTicker();
    return;
  }

  countdownEls.forEach(el => {
    const createdMs = Number(el.getAttribute('data-created-at'));
    const res = formatRemainingCancellationTime(createdMs);

    if (res.expired) {
      const actionArea = el.closest('.my-order-action-area');
      if (actionArea) {
        actionArea.innerHTML = `
          <div class="my-order-cancel-wrap my-order-cancel-panel is-expired">
            <div class="my-order-cancel-main">
              <div class="my-order-cancel-clock-badge" aria-hidden="true">
                <svg class="my-order-cancel-clock-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div class="my-order-cancel-text-block">
                <span class="my-order-cancel-title">CANCELLATION WINDOW</span>
                <div class="my-order-countdown is-expired">
                  <span class="my-order-period-ended">Cancellation period ended</span>
                </div>
                <p class="my-order-cancel-policy-hint">Orders can only be cancelled within 24 hours of placing them.</p>
              </div>
            </div>
            <div class="my-order-cancel-divider" aria-hidden="true"></div>
            <button type="button" class="my-order-hold-cancel-btn is-disabled" disabled aria-disabled="true" aria-label="Cancellation period ended">
              <span class="hold-btn-content">
                <svg class="hold-btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <span class="hold-btn-text">Cancellation Closed</span>
              </span>
            </button>
          </div>
        `;
      }
    } else {
      const timerEl = el.querySelector('.my-order-countdown-timer');
      if (timerEl && timerEl.textContent !== res.text) {
        timerEl.textContent = res.text;
      }
    }
  });
}

function startCancellationCountdownTicker() {
  stopCancellationCountdownTicker();
  updateCancellationCountdowns();
  const remainingCountdowns = document.querySelectorAll('.my-order-countdown[data-created-at]');
  if (remainingCountdowns && remainingCountdowns.length > 0) {
    cancellationCountdownIntervalId = setInterval(updateCancellationCountdowns, 1000);
  }
}

function stopCancellationCountdownTicker() {
  if (cancellationCountdownIntervalId) {
    clearInterval(cancellationCountdownIntervalId);
    cancellationCountdownIntervalId = null;
  }
}

async function executeCustomerOrderCancellation(orderId, btn) {
  let order = currentCustomerOrders.find(o => (o.docId && o.docId === orderId) || o.id === orderId || o.orderId === orderId);
  if (!order) {
    const adminOrders = getAdminOrders();
    order = adminOrders.find(o => (o.docId && o.docId === orderId) || o.id === orderId || o.orderId === orderId);
    if (order && !currentCustomerOrders.includes(order)) {
      currentCustomerOrders.push(order);
    }
  }
  if (!order) return;

  // 1. Security Check: Customer can only cancel their own order
  const currentUser = (window.fbAuth && window.fbAuth.currentUser) || (typeof getCustomerSession === 'function' ? getCustomerSession() : null);
  if (currentUser) {
    const currentUid = currentUser.uid;
    const currentEmail = (currentUser.email || '').toLowerCase().trim();
    const orderUid = order.userId;
    const orderEmail = (order.customerEmail || order.email || '').toLowerCase().trim();
    if (orderUid && orderUid !== currentUid && (!orderEmail || orderEmail !== currentEmail)) {
      alert('Security violation: You can only cancel your own order.');
      renderCustomerOrdersList(currentCustomerOrders);
      return;
    }
  }

  // 2. Status Validation: Cannot cancel already cancelled or delivered orders
  const status = (order.status || order.orderStatus || 'Processing').trim().toLowerCase();
  if (status === 'cancelled') {
    alert('This order has already been cancelled.');
    renderCustomerOrdersList(currentCustomerOrders);
    return;
  }
  if (['shipped', 'out for delivery', 'delivered'].includes(status)) {
    alert(`Orders in '${order.status || order.orderStatus}' status cannot be cancelled per store policy.`);
    renderCustomerOrdersList(currentCustomerOrders);
    return;
  }

  // 3. 24-Hour Rule Validation: Cannot cancel after 24 hours
  if (!isOrderCancellable(order)) {
    alert('Orders can only be cancelled within 24 hours of placing them.');
    renderCustomerOrdersList(currentCustomerOrders);
    return;
  }

  const nowIso = new Date().toISOString();
  const targetDocId = order.docId || order.id || order.orderId;

  // 4. Immediately update local customer state synchronously
  order.status = 'Cancelled';
  order.orderStatus = 'Cancelled';
  order.cancelledBy = 'customer';
  order.cancelledAt = nowIso;

  // 5. Immediately update local admin store synchronously
  try {
    const adminOrders = getAdminOrders();
    const adminOrder = adminOrders.find(o =>
      (o.docId && o.docId === targetDocId) ||
      o.id === targetDocId ||
      o.orderId === targetDocId ||
      o.id === order.id ||
      o.orderId === order.orderId ||
      (order.orderNumber && (o.orderNumber === order.orderNumber || o.displayOrderNumber === order.orderNumber))
    );
    if (adminOrder) {
      adminOrder.status = 'Cancelled';
      adminOrder.orderStatus = 'Cancelled';
      adminOrder.cancelledBy = 'customer';
      adminOrder.cancelledAt = nowIso;
      saveAdminOrders(adminOrders);
    }
  } catch (e) {}

  // 6. Hold completes -> immediately show "Cancelled by you" without any intermediate effect, state, or delay
  renderCustomerOrdersList(currentCustomerOrders);

  // Broadcast event so Admin panel updates instantly
  window.dispatchEvent(new CustomEvent('adminOrderStatusChanged', {
    detail: { id: targetDocId, status: 'Cancelled', cancelledBy: 'customer', cancelledAt: nowIso }
  }));
  if (typeof renderAdminOrders === 'function') {
    renderAdminOrders();
  }

  // 7. Update Firestore doc to persist cancellation (DO NOT DELETE THE ORDER DOCUMENT)
  if (window.fbDb && window.fbFns) {
    try {
      const docRef = window.fbFns.doc(window.fbDb, 'orders', targetDocId);
      await window.fbFns.updateDoc(docRef, {
        status: 'Cancelled',
        orderStatus: 'Cancelled',
        cancelledBy: 'customer',
        cancelledAt: window.fbFns.serverTimestamp ? window.fbFns.serverTimestamp() : nowIso,
        updatedAt: window.fbFns.serverTimestamp ? window.fbFns.serverTimestamp() : nowIso
      });
      // Keep verified state
      order.status = 'Cancelled';
      order.orderStatus = 'Cancelled';
      order.cancelledBy = 'customer';
      order.cancelledAt = nowIso;
      renderCustomerOrdersList(currentCustomerOrders);
    } catch (err) {
      console.warn('Firestore customer cancel order error:', err);
    }
  }
}

function handleCustomerCancelOrder(orderId, btn) {
  return executeCustomerOrderCancellation(orderId, btn);
}

window.executeCustomerOrderCancellation = executeCustomerOrderCancellation;
window.handleCustomerCancelOrder = handleCustomerCancelOrder;

function attachHoldToCancelListeners(container) {
  if (!container) return;
  const holdBtns = container.querySelectorAll('.my-order-hold-cancel-btn');
  holdBtns.forEach(btn => {
    if (btn._holdListenersAttached) return;
    btn._holdListenersAttached = true;

    const orderId = btn.getAttribute('data-order-id');
    const textEl = btn.querySelector('.hold-btn-text');
    const fillEl = btn.querySelector('.hold-progress-fill');
    const HOLD_TIME_MS = 2000;

    let isHolding = false;
    let isCompleted = false;
    let startTimestamp = 0;
    let rafId = null;
    let holdTimeoutId = null;

    function completeHold() {
      if (isCompleted) return;
      isCompleted = true;
      isHolding = false;
      if (holdTimeoutId) {
        clearTimeout(holdTimeoutId);
        holdTimeoutId = null;
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      // Trigger cancellation execution immediately without intermediate states
      window.executeCustomerOrderCancellation(orderId, btn);
    }

    function resetHoldAnimation() {
      if (isCompleted) return;
      if (isHolding) {
        isHolding = false;
      }
      if (holdTimeoutId) {
        clearTimeout(holdTimeoutId);
        holdTimeoutId = null;
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      btn.classList.remove('is-holding');
      if (fillEl) {
        fillEl.style.transition = 'width 240ms cubic-bezier(0.4, 0, 0.2, 1)';
        fillEl.style.width = '0%';
      }
    }

    function onHoldProgress(currentTimestamp) {
      if (!isHolding || isCompleted) return;
      const elapsed = currentTimestamp - startTimestamp;
      const progressRatio = Math.min(1, elapsed / HOLD_TIME_MS);
      const progressPercent = progressRatio * 100;

      if (fillEl) {
        fillEl.style.width = progressPercent + '%';
      }

      if (progressRatio >= 1) {
        completeHold();
        return;
      }

      rafId = requestAnimationFrame(onHoldProgress);
    }

    function startHold(e) {
      if (isCompleted || btn.disabled) return;
      // Filter out non-primary clicks for mouse
      if (e && e.pointerType === 'mouse' && e.button !== 0) return;

      isHolding = true;
      btn.classList.add('is-holding');
      if (fillEl) {
        fillEl.style.transition = 'none';
        fillEl.style.width = '0%';
      }
      startTimestamp = performance.now();

      // Reliable 2-second completion timer ensures hold finishes even if rAF is throttled
      if (holdTimeoutId) clearTimeout(holdTimeoutId);
      holdTimeoutId = setTimeout(() => {
        if (isHolding && !isCompleted) {
          if (fillEl) fillEl.style.width = '100%';
          completeHold();
        }
      }, HOLD_TIME_MS);

      rafId = requestAnimationFrame(onHoldProgress);
    }

    // Unified pointer events
    btn.addEventListener('pointerdown', (e) => {
      startHold(e);
    });

    btn.addEventListener('pointerup', () => {
      resetHoldAnimation();
    });

    btn.addEventListener('pointerleave', () => {
      resetHoldAnimation();
    });

    btn.addEventListener('pointercancel', () => {
      resetHoldAnimation();
    });

    // Touch events fallback
    btn.addEventListener('touchstart', (e) => {
      startHold(e);
    }, { passive: true });

    btn.addEventListener('touchend', () => {
      resetHoldAnimation();
    });

    btn.addEventListener('touchcancel', () => {
      resetHoldAnimation();
    });

    // Keyboard support (Space / Enter)
    btn.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault();
        if (!isHolding && !isCompleted) {
          startHold(e);
        }
      }
    });

    btn.addEventListener('keyup', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        resetHoldAnimation();
      }
    });

    // Normal click must NEVER cancel the order
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });
}

/**
 * Resolves refund details for cancelled orders based on payment method and status
 */
function getRefundDetails(order) {
  if (!order) return null;
  const rawStatus = (order.status || order.orderStatus || '').trim().toLowerCase();
  if (rawStatus !== 'cancelled') {
    return null;
  }

  const payMethod = (order.paymentMethod || '').trim();
  const lowerMethod = payMethod.toLowerCase();

  // Check if Cash on Delivery
  const isCod = lowerMethod === 'cod' ||
                lowerMethod === 'cash on delivery' ||
                lowerMethod.includes('cash on delivery') ||
                lowerMethod.includes('pay on delivery');

  const payStatus = (order.paymentStatus || '').trim().toLowerCase();
  const isPaid = payStatus === 'paid' ||
                 payStatus === 'completed' ||
                 order.isPaid === true ||
                 (lowerMethod.startsWith('prepaid') && payStatus !== 'failed' && payStatus !== 'pending' && payStatus !== 'unpaid') ||
                 (Boolean(order.razorpayPaymentId) && payStatus !== 'failed');

  // Rule: For Cash on Delivery orders that have not been paid, do not display a refund timeline.
  if (isCod && !isPaid) {
    return null;
  }

  // Unpaid online orders (e.g. failed payment) also require no refund timeline
  if (!isPaid) {
    return null;
  }

  // Resolve payment method category and timeline
  const resolved = resolveRazorpayPaymentMethod(order.paymentMethod || order.razorpayMethod || order.paymentDetails);
  const { category, label, timeline, refundMessage, isIdentified } = resolved;

  // Check refund status
  const rawRefundStatus = (order.refundStatus || '').trim().toLowerCase();
  const isInitiated = rawRefundStatus === 'initiated' ||
                      rawRefundStatus === 'processing' ||
                      rawRefundStatus === 'completed' ||
                      rawRefundStatus === 'refunded' ||
                      Boolean(order.refundInitiatedAt || order.refundDate || order.refundInitiationDate);

  // Format initiation date if available
  let initiationDateFormatted = '';
  const dateVal = order.refundInitiatedAt || order.refundDate || order.refundInitiationDate;
  if (dateVal) {
    if (typeof dateVal === 'string') {
      try {
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
          initiationDateFormatted = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        } else {
          initiationDateFormatted = dateVal;
        }
      } catch (e) {
        initiationDateFormatted = dateVal;
      }
    } else if (typeof dateVal === 'object' && dateVal.seconds) {
      const d = new Date(dateVal.seconds * 1000);
      initiationDateFormatted = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  }

  return {
    isPaid,
    methodCategory: category,
    methodLabel: label,
    timeline,
    expectedTimelineText: timeline ? `Expected refund timeline: ${timeline}` : '',
    refundMessage,
    isIdentified,
    isInitiated,
    rawRefundStatus: order.refundStatus || (isInitiated ? 'Initiated' : 'Pending'),
    initiationDate: initiationDateFormatted
  };
}

function formatRefundInfoHtml(order) {
  const info = getRefundDetails(order);
  if (!info) return '';

  if (info.isInitiated) {
    // Refund initiated: Show badge, initiation date where available, and applicable timeline
    const timelineHtml = info.timeline
      ? `<div class="my-order-refund-row">
           <span class="my-order-refund-label">Expected refund timeline:</span>
           <span class="my-order-refund-val my-order-refund-timeline-highlight">${escapeHtml(info.timeline)}</span>
         </div>
         ${info.refundMessage ? `<div class="my-order-refund-note" style="margin-top: 4px; font-size: 11.5px; color: #5c544d;">${escapeHtml(info.refundMessage)}</div>` : ''}`
      : `<div class="my-order-refund-row">
           <span class="my-order-refund-label">Refund details:</span>
           <span class="my-order-refund-val">${escapeHtml(info.refundMessage || 'Please contact support for refund timeframe assistance.')}</span>
         </div>`;

    const dateHtml = info.initiationDate
      ? `<div class="my-order-refund-row">
           <span class="my-order-refund-label">Initiated on:</span>
           <span class="my-order-refund-val">${escapeHtml(info.initiationDate)}</span>
         </div>`
      : '';

    return `
      <div class="my-order-card-separator"></div>
      <div class="my-order-refund-box">
        <div class="my-order-refund-header">
          <div class="my-order-refund-title-wrap">
            <svg class="my-order-refund-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            <span class="my-order-refund-title">Refund Information</span>
          </div>
          <span class="my-order-refund-badge is-initiated">Refund Initiated</span>
        </div>
        <div class="my-order-refund-content">
          ${dateHtml}
          ${timelineHtml}
        </div>
      </div>
    `;
  } else {
    // Refund pending initiation: Explain accurately without implying countdown has started
    const timelineNote = info.timeline
      ? `<div class="my-order-refund-row">
           <span class="my-order-refund-label">Applicable timeline once initiated:</span>
           <span class="my-order-refund-val">${escapeHtml(info.timeline)}</span>
         </div>
         ${info.refundMessage ? `<div class="my-order-refund-note" style="margin-top: 4px; font-size: 11.5px; color: #5c544d;">${escapeHtml(info.refundMessage)}</div>` : ''}`
      : `<div class="my-order-refund-row">
           <span class="my-order-refund-label">Refund details:</span>
           <span class="my-order-refund-val">${escapeHtml(info.refundMessage || 'Please contact support for refund timeframe assistance.')}</span>
         </div>`;

    return `
      <div class="my-order-card-separator"></div>
      <div class="my-order-refund-box is-pending">
        <div class="my-order-refund-header">
          <div class="my-order-refund-title-wrap">
            <svg class="my-order-refund-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span class="my-order-refund-title">Refund Information</span>
          </div>
          <span class="my-order-refund-badge is-pending">Pending Initiation</span>
        </div>
        <div class="my-order-refund-content">
          <p class="my-order-refund-note">Refund has not yet been initiated. Once approved and initiated by Jayashree, your refund will be processed back to your original payment method.</p>
          ${timelineNote}
        </div>
      </div>
    `;
  }
}

function renderCustomerOrdersList(orders) {
  stopCancellationCountdownTicker();
  if (Array.isArray(orders)) {
    currentCustomerOrders = orders;
  }
  window.currentCustomerOrders = currentCustomerOrders;
  const listEl = document.getElementById('customerMyOrdersList');
  const badgeEl = document.getElementById('customerOrdersCountBadge');
  if (!listEl) return;

  if (badgeEl) {
    badgeEl.textContent = `${orders.length} ${orders.length === 1 ? 'Order' : 'Orders'}`;
  }

  if (!orders || orders.length === 0) {
    listEl.innerHTML = `
      <div class="my-orders-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
        <p>No orders placed yet.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = orders.map(order => {
    const rawStatus = (order.status || order.orderStatus || 'Processing').trim();
    const statusClass = 'my-order-status-' + rawStatus.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const orderDocId = order.id || order.orderId || '—';
    const displayNum = getDisplayOrderNumber(order);
    const productName = order.product || order.productName || 'Designer Outfit';
    const size = order.size || 'Standard';
    const qty = order.quantity || 1;
    const amount = order.amount || order.price || '—';
    const orderDateFormatted = formatOrderDisplayDate(order);
    const expectedDeliveryFormatted = getExpectedDeliveryForOrder(order);
    const customMsg = (order.customMessage || '').trim();
    const createdMs = getOrderTimestamp(order);
    const cancellable = isOrderCancellable(order);
    const isCancelled = rawStatus.toLowerCase() === 'cancelled';
    const isDelivered = rawStatus.toLowerCase() === 'delivered';
    const isShipped = rawStatus.toLowerCase() === 'shipped';
    const isOutForDelivery = rawStatus.toLowerCase() === 'out for delivery';
    const isIneligibleStatus = isDelivered || isShipped || isOutForDelivery;

    // Reliable identification of customisation orders vs normal catalogue orders
    const isCustom = Boolean(
      order.isCustomOrder ||
      order.customisationRequestId ||
      order.customisationId ||
      order.customisationOrder ||
      order.isCustom ||
      (typeof order.orderType === 'string' && order.orderType.toLowerCase().includes('custom'))
    );

    // 1. Cancellation Display:
    // If cancelled, show ONLY "Cancelled by you" or "Cancelled by Jayashree".
    // Do NOT show a separate "Cancelled" badge. One clear cancellation status only.
    let footerHtml = '';
    if (isCancelled) {
      const isCancelledByAdmin = (order.cancelledBy || '').toLowerCase().trim() === 'admin';
      const label = isCancelledByAdmin ? 'Cancelled by Jayashree' : 'Cancelled by you';
      footerHtml = `
        <div class="my-order-cancel-wrap">
          <div class="my-order-cancelled-notice">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <span>${escapeHtml(label)}</span>
          </div>
        </div>
      `;
    } else if (isIneligibleStatus) {
      // Shipped, out for delivery, and delivered orders cannot be cancelled per store policy
      footerHtml = '';
    } else {
      const countdown = formatRemainingCancellationTime(createdMs);
      if (cancellable && !countdown.expired) {
        // Within 24 hours: Live Countdown + Hold to Cancel button
        footerHtml = `
          <div class="my-order-cancel-wrap my-order-cancel-panel">
            <div class="my-order-cancel-main">
              <div class="my-order-cancel-clock-badge" aria-hidden="true">
                <svg class="my-order-cancel-clock-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div class="my-order-cancel-text-block">
                <span class="my-order-cancel-title">CANCELLATION WINDOW</span>
                <div class="my-order-countdown" data-order-id="${escapeHtml(orderDocId)}" data-created-at="${createdMs}">
                  <span class="my-order-countdown-timer">${escapeHtml(countdown.text)}</span>
                </div>
                <p class="my-order-cancel-policy-hint">You can cancel this order within 24 hours of placing it.</p>
              </div>
            </div>
            <div class="my-order-cancel-divider" aria-hidden="true"></div>
            <button type="button" class="my-order-hold-cancel-btn" data-order-id="${escapeHtml(orderDocId)}" aria-label="Hold to Cancel">
              <span class="hold-progress-fill" aria-hidden="true"></span>
              <span class="hold-btn-content">
                <svg class="hold-btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <span class="hold-btn-text">Hold to Cancel</span>
              </span>
            </button>
          </div>
        `;
      } else {
        // After 24 hours: Show expired cancellation window without contradictory cancel instructions
        footerHtml = `
          <div class="my-order-cancel-wrap my-order-cancel-panel is-expired">
            <div class="my-order-cancel-main">
              <div class="my-order-cancel-clock-badge" aria-hidden="true">
                <svg class="my-order-cancel-clock-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div class="my-order-cancel-text-block">
                <span class="my-order-cancel-title">CANCELLATION WINDOW</span>
                <div class="my-order-countdown is-expired">
                  <span class="my-order-period-ended">Cancellation period ended</span>
                </div>
                <p class="my-order-cancel-policy-hint">Orders can only be cancelled within 24 hours of placing them.</p>
              </div>
            </div>
            <div class="my-order-cancel-divider" aria-hidden="true"></div>
            <button type="button" class="my-order-hold-cancel-btn is-disabled" disabled aria-disabled="true" aria-label="Cancellation period ended">
              <span class="hold-btn-content">
                <svg class="hold-btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <span class="hold-btn-text">Cancellation Closed</span>
              </span>
            </button>
          </div>
        `;
      }
    }

    // 2. Header Status Badge:
    // When cancelled, NEVER show a separate "Cancelled" badge.
    // For customisation orders, show the active status badge (e.g. Processing, Completed, etc.).
    // For normal catalogue orders, keep simple: show no processing pill (clean ORDER #XXXX),
    // only show milestone pill if shipped/delivered.
    let headerStatusBadgeHtml = '';
    if (!isCancelled) {
      if (isCustom) {
        headerStatusBadgeHtml = `<span class="my-order-status-pill ${statusClass}">${escapeHtml(rawStatus)}</span>`;
      } else if (rawStatus.toLowerCase() === 'shipped' || rawStatus.toLowerCase() === 'delivered') {
        headerStatusBadgeHtml = `<span class="my-order-status-pill ${statusClass}">${escapeHtml(rawStatus)}</span>`;
      }
    }

    // 3. Customisation Details (Only for customisation orders):
    let customisationDetailsHtml = '';
    if (isCustom) {
      let customSpecs = order.customisationDetails || null;
      if (!customSpecs && order.customisationRequestId) {
        try {
          const allCustomisations = getAdminCustomisations();
          const foundReq = allCustomisations.find(r => r.id === order.customisationRequestId);
          if (foundReq) {
            customSpecs = {
              colour: foundReq.colour,
              fabric: foundReq.fabric,
              design: foundReq.design,
              measurements: foundReq.measurements,
              embellishments: foundReq.embellishments || foundReq.embellishment
            };
          }
        } catch (e) {}
      }

      if (customSpecs) {
        const specItems = [];
        if (customSpecs.design && customSpecs.design !== 'Not specified') {
          specItems.push(`<div class="my-order-custom-spec-row"><span class="my-order-custom-spec-label">Design:</span> <span class="my-order-custom-spec-val">${escapeHtml(customSpecs.design)}</span></div>`);
        }
        if (customSpecs.fabric && customSpecs.fabric !== 'Not specified') {
          specItems.push(`<div class="my-order-custom-spec-row"><span class="my-order-custom-spec-label">Fabric:</span> <span class="my-order-custom-spec-val">${escapeHtml(customSpecs.fabric)}</span></div>`);
        }
        if (customSpecs.colour && customSpecs.colour !== 'Not specified') {
          specItems.push(`<div class="my-order-custom-spec-row"><span class="my-order-custom-spec-label">Colour:</span> <span class="my-order-custom-spec-val">${escapeHtml(customSpecs.colour)}</span></div>`);
        }
        if (customSpecs.measurements && customSpecs.measurements !== 'Not specified') {
          specItems.push(`<div class="my-order-custom-spec-row"><span class="my-order-custom-spec-label">Measurements:</span> <span class="my-order-custom-spec-val">${escapeHtml(customSpecs.measurements)}</span></div>`);
        }
        if (customSpecs.embellishments && customSpecs.embellishments !== 'Not specified') {
          specItems.push(`<div class="my-order-custom-spec-row"><span class="my-order-custom-spec-label">Embellishments:</span> <span class="my-order-custom-spec-val">${escapeHtml(customSpecs.embellishments)}</span></div>`);
        }

        if (specItems.length > 0) {
          customisationDetailsHtml = `
            <div class="my-order-custom-specs-box">
              <div class="my-order-custom-specs-header">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                <span>Customisation Details</span>
              </div>
              <div class="my-order-custom-specs-list">
                ${specItems.join('')}
              </div>
            </div>
          `;
        }
      }
    }

    return `
      <div class="my-order-card" data-order-id="${escapeHtml(orderDocId)}">
        <div class="my-order-card-header">
          <div class="my-order-id-wrap">
            <span class="my-order-id">ORDER #${escapeHtml(displayNum)}</span>
            ${isCustom ? '<span class="admin-custom-tag" style="margin-left: 6px;">Custom Outfit</span>' : ''}
          </div>
          ${headerStatusBadgeHtml}
        </div>
        <div class="my-order-body">
          <div class="my-order-info">
            <h4 class="my-order-product-name">${escapeHtml(productName)}</h4>
            <div class="my-order-meta">
              <span>Size: <strong>${escapeHtml(size)}</strong></span>
              <span>•</span>
              <span>Qty: <strong>${qty}</strong></span>
            </div>
          </div>
          <div class="my-order-amount">${escapeHtml(amount)}</div>
        </div>

        ${footerHtml ? `
        <div class="my-order-card-separator"></div>
        <div class="my-order-action-area">
          ${footerHtml}
        </div>
        ` : ''}

        ${isCancelled ? formatRefundInfoHtml(order) : ''}

        ${!isCancelled ? `
        <div class="my-order-card-separator"></div>

        <div class="my-order-delivery-item">
          <span class="my-order-date-label">Estimated Delivery:</span>
          <span class="my-order-date-val my-order-delivery-val">${escapeHtml(expectedDeliveryFormatted)}</span>
        </div>

        <div class="my-order-card-separator"></div>

        <div class="my-order-payment-item">
          <span class="my-order-date-label">Payment:</span>
          <div class="my-order-payment-details">
            <span class="my-order-payment-method">${formatPaymentMethodDisplay(order.paymentMethod)}</span>
            ${formatPaymentStatusBadge(order.paymentStatus)}
          </div>
        </div>
        ` : ''}

        ${isCustom && customisationDetailsHtml ? customisationDetailsHtml : ''}

        ${isCustom && customMsg ? `
          <div class="my-order-custom-msg-box">
            <div class="my-order-custom-msg-header">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>Message from Jayashree</span>
            </div>
            <p class="my-order-custom-msg-text">${escapeHtml(customMsg)}</p>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Attach hold to cancel interaction to rendered buttons
  attachHoldToCancelListeners(listEl);
  startCancellationCountdownTicker();
}

let customerOrdersUnsubscribe = null;
let currentCustomerOrders = [];

function setupCustomerOrdersListener(userOrCustomer) {
  if (customerOrdersUnsubscribe) {
    try { customerOrdersUnsubscribe(); } catch (e) {}
    customerOrdersUnsubscribe = null;
  }

  const listEl = document.getElementById('customerMyOrdersList');
  const badgeEl = document.getElementById('customerOrdersCountBadge');
  if (!userOrCustomer || !userOrCustomer.uid || userOrCustomer.provider === 'guest') {
    currentCustomerOrders = [];
    if (listEl) listEl.innerHTML = '';
    if (badgeEl) badgeEl.textContent = '0 Orders';
    return;
  }

  const uid = userOrCustomer.uid;
  const email = (userOrCustomer.email || '').toLowerCase().trim();

  function processAndRender(ordersList) {
    const map = new Map();
    ordersList.forEach(o => {
      const orderId = o.id || o.orderId;
      if (orderId && !map.has(orderId)) {
        map.set(orderId, o);
      }
    });
    const uniqueOrders = Array.from(map.values());
    // Strict sort: newest order FIRST (descending creation timestamp)
    uniqueOrders.sort((a, b) => getOrderTimestamp(b) - getOrderTimestamp(a));
    currentCustomerOrders = uniqueOrders;
    renderCustomerOrdersList(uniqueOrders);
  }

  // First populate immediately from local orders if matching
  try {
    const allLocal = getAdminOrders().filter(o =>
      o.userId === uid || (email && o.customerEmail && o.customerEmail.toLowerCase() === email)
    );
    processAndRender(allLocal);
  } catch (e) {}

  if (!window.fbDb || !window.fbFns) return;

  try {
    const qUser = window.fbFns.query(
      window.fbFns.collection(window.fbDb, 'orders'),
      window.fbFns.where('userId', '==', uid)
    );

    customerOrdersUnsubscribe = window.fbFns.onSnapshot(qUser, (snapshot) => {
      const fetched = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        fetched.push({
          docId: docSnap.id,
          id: docSnap.id,
          orderId: data.orderId || docSnap.id,
          orderNumber: data.orderNumber || null,
          displayOrderNumber: data.displayOrderNumber || data.orderNumber || null,
          userId: data.userId || uid,
          product: data.product || data.productName || 'Designer Outfit',
          productName: data.productName || data.product || 'Designer Outfit',
          size: data.size || 'Standard',
          quantity: data.quantity || 1,
          amount: data.amount || data.price || '₹0',
          price: data.price || data.amount || '₹0',
          status: data.orderStatus || data.status || 'Processing',
          orderStatus: data.orderStatus || data.status || 'Processing',
          customMessage: data.customMessage || data.statusMessage || '',
          statusMessage: data.statusMessage || data.customMessage || '',
          date: data.orderDate || data.date || 'Recent',
          orderDate: data.orderDate || data.date || 'Recent',
          createdAt: data.createdAt || null,
          orderTimestamp: data.orderTimestamp || null,
          expectedDelivery: data.expectedDelivery || data.estimatedDelivery || '',
          estimatedDelivery: data.estimatedDelivery || data.expectedDelivery || '',
          state: data.state || '',
          pinCode: data.pinCode || '',
          customerName: data.customerName || '',
          customerEmail: data.customerEmail || data.email || '',
          email: data.email || data.customerEmail || '',
          cancelledBy: data.cancelledBy || '',
          cancelledAt: data.cancelledAt || null,
          paymentMethod: data.paymentMethod || '',
          paymentStatus: data.paymentStatus || '',
          address: data.deliveryAddress || data.address || data.fullAddress || '',
          deliveryAddress: data.deliveryAddress || data.address || data.fullAddress || '',
          customisationDetails: data.customisationDetails || null,
          customisationRequestId: data.customisationRequestId || null,
          isCustomOrder: Boolean(data.isCustomOrder || data.customisationRequestId)
        });
      });
      // Merge matching local orders so pending or offline orders are preserved
      try {
        const allLocal = getAdminOrders().filter(o =>
          o.userId === uid || (email && o.customerEmail && o.customerEmail.toLowerCase() === email)
        );
        allLocal.forEach(localOrd => {
          const localId = localOrd.id || localOrd.orderId;
          if (!fetched.some(f => (f.id || f.orderId) === localId)) {
            fetched.push(localOrd);
          }
        });
      } catch (e) {}

      processAndRender(fetched);
    }, (err) => {
      console.warn('Customer orders listener error:', err);
    });
  } catch (err) {
    console.warn('setupCustomerOrdersListener error:', err);
  }
}

// Live update listener for instant same-window admin updates
window.addEventListener('adminOrderStatusChanged', (e) => {
  if (!e.detail || !e.detail.id) return;
  const { id, status, customMessage, cancelledBy, cancelledAt } = e.detail;
  let changed = false;
  currentCustomerOrders.forEach(o => {
    if (o.id === id || o.orderId === id) {
      o.status = status;
      o.orderStatus = status;
      if (typeof customMessage !== 'undefined') o.customMessage = customMessage;
      if (typeof cancelledBy !== 'undefined') o.cancelledBy = cancelledBy;
      if (typeof cancelledAt !== 'undefined') o.cancelledAt = cancelledAt;
      changed = true;
    }
  });
  if (changed) {
    renderCustomerOrdersList(currentCustomerOrders);
  }
});

function updateAuthUI() {
  const customer = getCustomerSession();
  const openAuthBtn = document.getElementById('openAuthBtn');
  const loggedOutView = document.getElementById('navAuthLoggedOut');
  const loggedInView = document.getElementById('navAuthLoggedIn');
  const navAvatar = document.getElementById('navProfileAvatar');
  const label = document.querySelector('.auth-btn-label');
  const mobileLabel = document.querySelector('.mobile-auth-label');

  const isAuthenticated = Boolean(customer && customer.email && customer.provider !== 'guest');

  if (isAuthenticated) {
    const displayName = customer.name || (customer.email ? customer.email.split('@')[0] : 'Customer');
    const initial = (customer.name || customer.email || 'J').charAt(0).toUpperCase();

    // Replace "Login" button with user's profile icon/avatar in navbar
    if (loggedOutView) loggedOutView.style.display = 'none';
    if (loggedInView) loggedInView.style.display = 'inline-flex';
    if (openAuthBtn) {
      openAuthBtn.classList.add('is-authenticated');
      openAuthBtn.setAttribute('aria-label', `Account: ${displayName}`);
      openAuthBtn.setAttribute('title', `Account: ${displayName}`);
    }

    if (navAvatar) {
      if (customer.photoURL) {
        const img = document.createElement('img');
        img.src = customer.photoURL;
        img.alt = displayName || 'User';
        img.className = 'nav-profile-img';
        navAvatar.replaceChildren(img);
      } else {
        const span = document.createElement('span');
        span.className = 'nav-profile-initial';
        span.id = 'navProfileInitial';
        span.textContent = initial || 'J';
        navAvatar.replaceChildren(span);
      }
    }

    if (mobileLabel) mobileLabel.textContent = 'Account';
    if (authUserEmail) authUserEmail.textContent = customer.email;
    if (authUserInitials) authUserInitials.textContent = initial;

    setupCustomerOrdersListener(customer);
  } else {
    // When user logs out, change it back to "Login"
    if (loggedOutView) loggedOutView.style.display = 'inline-flex';
    if (loggedInView) loggedInView.style.display = 'none';
    if (openAuthBtn) {
      openAuthBtn.classList.remove('is-authenticated');
      openAuthBtn.setAttribute('aria-label', 'Login');
      openAuthBtn.removeAttribute('title');
    }
    if (label) label.textContent = 'Login';
    if (mobileLabel) mobileLabel.textContent = 'Login / Sign Up';

    setupCustomerOrdersListener(null);
  }
}

function setAuthMode(mode) {
  currentAuthMode = mode;
  if (authFeedback) {
    authFeedback.style.display = 'none';
    authFeedback.textContent = '';
    authFeedback.className = 'auth-feedback';
  }

  const pwdInput = document.getElementById('authPasswordInput');

  if (mode === 'signup') {
    if (pwdInput) {
      pwdInput.setAttribute('autocomplete', 'new-password');
      pwdInput.setAttribute('placeholder', 'Min. 6 characters');
    }
    if (authTabLogin) {
      authTabLogin.classList.remove('active');
      authTabLogin.setAttribute('aria-selected', 'false');
    }
    if (authTabSignUp) {
      authTabSignUp.classList.add('active');
      authTabSignUp.setAttribute('aria-selected', 'true');
    }
    if (authHeading) authHeading.textContent = 'Create Account';
    if (authSubmitBtn) authSubmitBtn.textContent = 'Sign Up';
    if (authSwitchPrompt) authSwitchPrompt.textContent = 'Already have an account?';
    if (authSwitchAction) authSwitchAction.textContent = 'Login';
  } else {
    if (pwdInput) {
      pwdInput.setAttribute('autocomplete', 'current-password');
      pwdInput.setAttribute('placeholder', '••••••••');
    }
    if (authTabLogin) {
      authTabLogin.classList.add('active');
      authTabLogin.setAttribute('aria-selected', 'true');
    }
    if (authTabSignUp) {
      authTabSignUp.classList.remove('active');
      authTabSignUp.setAttribute('aria-selected', 'false');
    }
    if (authHeading) authHeading.textContent = 'Welcome Back';
    if (authSubmitBtn) authSubmitBtn.textContent = 'Login';
    if (authSwitchPrompt) authSwitchPrompt.textContent = "Don't have an account?";
    if (authSwitchAction) authSwitchAction.textContent = 'Sign Up';
  }
}

function openAuthModal(mode = 'login', fromBuyNow = false) {
  if (!authModalOverlay) return;
  setAuthMode(mode);

  const customer = getCustomerSession();
  const authModalEl = document.querySelector('.auth-modal');
  if (fromBuyNow) {
    if (authFormView) authFormView.style.display = 'block';
    if (authUserView) authUserView.style.display = 'none';
    if (authModalEl) authModalEl.classList.remove('has-user-view');
    const prefillEmail = pendingOrderCheckout?.email || (customer && customer.email) || '';
    if (authEmailInput && prefillEmail) {
      authEmailInput.value = prefillEmail;
    }
  } else {
    if (customer && customer.email && customer.provider !== 'guest') {
      if (authFormView) authFormView.style.display = 'none';
      if (authUserView) authUserView.style.display = 'block';
      if (authModalEl) authModalEl.classList.add('has-user-view');
      setupCustomerOrdersListener(customer);
    } else {
      if (authFormView) authFormView.style.display = 'block';
      if (authUserView) authUserView.style.display = 'none';
      if (authModalEl) authModalEl.classList.remove('has-user-view');
    }
  }

  const sw = window.innerWidth - document.documentElement.clientWidth;
  authModalOverlay.classList.add('open');
  updateModalLockState();

  if (authEmailInput && authFormView.style.display !== 'none') {
    setTimeout(() => authEmailInput.focus(), 150);
  }
}

function closeAuthModal() {
  if (!authModalOverlay) return;
  stopCancellationCountdownTicker();
  authModalOverlay.classList.remove('open');
  const authModalEl = document.querySelector('.auth-modal');
  if (authModalEl) authModalEl.classList.remove('has-user-view');
  updateModalLockState();
  const { path } = parseHash();
  if (path === '/login' || path === '/signup' || path === '/auth') {
    window.location.hash = '#/';
  }
  const submitBtn = document.getElementById('checkoutSubmitBtn');
  if (submitBtn && !submitBtn.disabled) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>Buy Now</span>';
  }
}

if (openAuthBtn) {
  openAuthBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openAuthModal('login');
  });
}

if (mobileAuthBtn) {
  mobileAuthBtn.addEventListener('click', (e) => {
    e.preventDefault();
    closeMobileMenu();
    openAuthModal('login');
  });
}

if (footerAuthLink) {
  footerAuthLink.addEventListener('click', (e) => {
    e.preventDefault();
    openAuthModal('login');
  });
}

if (authTabLogin) {
  authTabLogin.addEventListener('click', () => setAuthMode('login'));
}
if (authTabSignUp) {
  authTabSignUp.addEventListener('click', () => setAuthMode('signup'));
}

if (authSwitchAction) {
  authSwitchAction.addEventListener('click', () => {
    setAuthMode(currentAuthMode === 'login' ? 'signup' : 'login');
  });
}

if (authCloseBtn) {
  authCloseBtn.addEventListener('click', closeAuthModal);
}

if (authModalOverlay) {
  authModalOverlay.addEventListener('click', (e) => {
    if (e.target === authModalOverlay) closeAuthModal();
  });
}

// Social Login / Sign Up options (Google, Apple)
authSocialBtns.forEach(btn => {
  btn.addEventListener('click', async () => {
    const providerName = btn.dataset.provider;
    if (!providerName) return;

    if (authFeedback) {
      authFeedback.className = 'auth-feedback';
      authFeedback.style.display = 'block';
      authFeedback.textContent = `Connecting to ${providerName}...`;
    }

    try {
      if (!window.fbAuth || !window.fbFns) {
        throw new Error('Authentication service not initialized');
      }

      let authProvider;
      if (providerName === 'Google') {
        authProvider = new window.fbFns.GoogleAuthProvider();
        authProvider.setCustomParameters({ prompt: 'select_account' });
      } else if (providerName === 'Apple') {
        authProvider = new window.fbFns.OAuthProvider('apple.com');
        authProvider.addScope('email');
        authProvider.addScope('name');
      } else {
        return;
      }

      const result = await window.fbFns.signInWithPopup(window.fbAuth, authProvider);
      const user = result.user;
      const email = user.email || `${providerName.toLowerCase()}user@jayashreefashion.com`;
      const name = user.displayName || email.split('@')[0];

      // Store authenticated user's email in Firestore
      if (window.fbDb) {
        try {
          await window.fbFns.setDoc(window.fbFns.doc(window.fbDb, 'users', user.uid), {
            uid: user.uid,
            email: email,
            displayName: name,
            provider: providerName.toLowerCase(),
            updatedAt: window.fbFns.serverTimestamp()
          }, { merge: true });
        } catch (fsErr) {
          console.warn('Firestore user doc write error:', fsErr);
        }
      }

      if (authFeedback) {
        authFeedback.className = 'auth-feedback success';
        authFeedback.style.display = 'block';
        authFeedback.textContent = currentAuthMode === 'signup'
          ? `Account created with ${providerName}! Welcome to Jayashree.`
          : `Signed in with ${providerName}! Welcome back.`;
      }

      setCustomerSession({
        uid: user.uid,
        email: email,
        name: name,
        photoURL: user.photoURL || '',
        provider: providerName.toLowerCase()
      });

      const currentPendingPurchase = pendingPurchase || getSavedPendingPurchase();
      const currentPendingOrder = pendingOrderCheckout || getSavedPendingOrder();
      pendingPurchase = null;
      pendingOrderCheckout = null;
      try {
        sessionStorage.removeItem('pendingPurchase');
        sessionStorage.removeItem('pendingOrderCheckout');
      } catch (e) {}

      setTimeout(() => {
        closeAuthModal();
        if (currentPendingPurchase) {
          // Automatically continue to the Delivery Details screen with preserved product, size & price
          openCheckoutModal(currentPendingPurchase);
        } else if (currentPendingOrder) {
          restorePendingOrderDetails(currentPendingOrder, email);
          executeOrderPayment(currentPendingOrder);
        }
      }, 700);
    } catch (err) {
      console.error(`${providerName} authentication error:`, err);
      let errorMsg = `Unable to complete ${providerName} sign-in. Please try again.`;
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        errorMsg = 'Sign in was cancelled. Please try again when ready.';
      } else if (err.code === 'auth/unauthorized-domain') {
        errorMsg = 'This domain is not authorized in Firebase Authentication.';
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        errorMsg = 'An account already exists with this email using another sign-in method.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMsg = `${providerName} authentication is not enabled in Firebase.`;
      }
      if (authFeedback) {
        authFeedback.className = 'auth-feedback error';
        authFeedback.style.display = 'block';
        authFeedback.textContent = errorMsg;
      }
    }
  });
});

// Email Form Submission (Login / Sign Up)
if (authEmailForm) {
  authEmailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = authEmailInput ? authEmailInput.value.trim() : '';
    const pwdInput = document.getElementById('authPasswordInput');
    const password = pwdInput ? pwdInput.value : '';

    if (!email) {
      if (authFeedback) {
        authFeedback.className = 'auth-feedback error';
        authFeedback.style.display = 'block';
        authFeedback.textContent = 'Please enter your email address.';
      }
      return;
    }
    if (!password) {
      if (authFeedback) {
        authFeedback.className = 'auth-feedback error';
        authFeedback.style.display = 'block';
        authFeedback.textContent = 'Please enter your password.';
      }
      return;
    }
    if (currentAuthMode === 'signup' && password.length < 6) {
      if (authFeedback) {
        authFeedback.className = 'auth-feedback error';
        authFeedback.style.display = 'block';
        authFeedback.textContent = 'Password must be at least 6 characters.';
      }
      return;
    }

    if (authSubmitBtn) {
      authSubmitBtn.disabled = true;
      authSubmitBtn.textContent = 'Processing...';
    }

    try {
      let user = null;
      if (currentAuthMode === 'signup') {
        if (window.fbAuth && window.fbFns) {
          const cred = await window.fbFns.createUserWithEmailAndPassword(window.fbAuth, email, password);
          user = cred.user;
          if (window.fbDb) {
            try {
              await window.fbFns.setDoc(window.fbFns.doc(window.fbDb, 'users', user.uid), {
                uid: user.uid,
                email: user.email,
                displayName: email.split('@')[0],
                createdAt: window.fbFns.serverTimestamp(),
                updatedAt: window.fbFns.serverTimestamp()
              });
            } catch (fsErr) {
              console.warn('Firestore user doc write error:', fsErr);
            }
          }
        }
        if (authFeedback) {
          authFeedback.className = 'auth-feedback success';
          authFeedback.style.display = 'block';
          authFeedback.textContent = 'Account created successfully! Welcome to Jayashree.';
        }
      } else {
        if (window.fbAuth && window.fbFns) {
          const cred = await window.fbFns.signInWithEmailAndPassword(window.fbAuth, email, password);
          user = cred.user;
        }
        if (authFeedback) {
          authFeedback.className = 'auth-feedback success';
          authFeedback.style.display = 'block';
          authFeedback.textContent = 'Welcome back! Logged in successfully.';
        }
      }

      setCustomerSession({
        uid: user?.uid || '',
        email: email,
        name: user?.displayName || email.split('@')[0],
        photoURL: user?.photoURL || '',
        provider: 'email'
      });

      if (authSubmitBtn) {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = currentAuthMode === 'signup' ? 'Sign Up' : 'Login';
      }

      const currentPendingPurchase = pendingPurchase || getSavedPendingPurchase();
      const currentPendingOrder = pendingOrderCheckout || getSavedPendingOrder();
      pendingPurchase = null;
      pendingOrderCheckout = null;
      try {
        sessionStorage.removeItem('pendingPurchase');
        sessionStorage.removeItem('pendingOrderCheckout');
      } catch (e) {}

      setTimeout(() => {
        closeAuthModal();
        if (currentPendingPurchase) {
          // Automatically continue to the Delivery Details screen with preserved product, size & price
          openCheckoutModal(currentPendingPurchase);
        } else if (currentPendingOrder) {
          restorePendingOrderDetails(currentPendingOrder, email);
          executeOrderPayment(currentPendingOrder);
        }
      }, 700);
    } catch (err) {
      console.error('Authentication error:', err);
      let errorMsg = 'Authentication failed. Please check your details and try again.';
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = 'This email is already registered. Please login instead.';
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errorMsg = 'Incorrect email or password. Please try again.';
      } else if (err.code === 'auth/user-not-found') {
        errorMsg = 'No account found with this email. Please sign up.';
      } else if (err.code === 'auth/weak-password') {
        errorMsg = 'Password must be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = 'Please enter a valid email address.';
      }
      if (authFeedback) {
        authFeedback.className = 'auth-feedback error';
        authFeedback.style.display = 'block';
        authFeedback.textContent = errorMsg;
      }
      if (authSubmitBtn) {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = currentAuthMode === 'signup' ? 'Sign Up' : 'Login';
      }
    }
  });
}

// Sign Out button inside profile view
if (authSignOutBtn) {
  authSignOutBtn.addEventListener('click', async () => {
    if (window.fbAuth && window.fbFns) {
      try { await window.fbFns.signOut(window.fbAuth); } catch (e) {}
    }
    clearCustomerSession();
    if (authUserView) authUserView.style.display = 'none';
    if (authFormView) authFormView.style.display = 'block';
    setAuthMode('login');
    if (authFeedback) {
      authFeedback.className = 'auth-feedback success';
      authFeedback.style.display = 'block';
      authFeedback.textContent = 'Signed out successfully.';
    }
  });
}

// Check for redirect result on page load (for mobile / popup-redirect scenarios)
if (window.fbAuth && window.fbFns && window.fbFns.getRedirectResult) {
  window.fbFns.getRedirectResult(window.fbAuth).then(async (result) => {
    if (result && result.user) {
      const user = result.user;
      const providerId = user.providerData && user.providerData[0] ? user.providerData[0].providerId : '';
      let detectedProvider = 'email';
      if (providerId.includes('google')) detectedProvider = 'google';
      else if (providerId.includes('apple')) detectedProvider = 'apple';

      const email = user.email || `${detectedProvider}user@jayashreefashion.com`;
      const name = user.displayName || (email ? email.split('@')[0] : 'Customer');

      setCustomerSession({
        uid: user.uid,
        email: email,
        name: name,
        photoURL: user.photoURL || '',
        provider: detectedProvider
      });

      if (window.fbDb && window.fbFns) {
        try {
          await window.fbFns.setDoc(window.fbFns.doc(window.fbDb, 'users', user.uid), {
            uid: user.uid,
            email: email,
            displayName: name,
            provider: detectedProvider,
            resendEmail: email,
            lastLoginAt: window.fbFns.serverTimestamp(),
            updatedAt: window.fbFns.serverTimestamp()
          }, { merge: true });
        } catch (fsErr) {
          console.warn('Firestore redirect user sync error:', fsErr);
        }
      }
    }
  }).catch((err) => {
    console.warn('Redirect auth result warning:', err);
  });
}

// Listen to Firebase Auth state (persists across page refresh)
if (window.fbAuth && window.fbFns) {
  window.fbFns.onAuthStateChanged(window.fbAuth, async (user) => {
    if (user) {
      const providerId = user.providerData && user.providerData[0] ? user.providerData[0].providerId : '';
      let detectedProvider = 'email';
      if (providerId.includes('google')) detectedProvider = 'google';
      else if (providerId.includes('apple')) detectedProvider = 'apple';
      else if (providerId.includes('password')) detectedProvider = 'email';

      const email = user.email || `${detectedProvider}user@jayashreefashion.com`;
      const name = user.displayName || (email ? email.split('@')[0] : 'Customer');

      setCustomerSession({
        uid: user.uid,
        email: email,
        name: name,
        photoURL: user.photoURL || '',
        provider: detectedProvider
      });

      // Store authenticated user's email in Firestore for future order confirmation emails through Resend
      if (window.fbDb && window.fbFns && email) {
        try {
          await window.fbFns.setDoc(window.fbFns.doc(window.fbDb, 'users', user.uid), {
            uid: user.uid,
            email: email,
            displayName: name,
            provider: detectedProvider,
            resendEmail: email,
            updatedAt: window.fbFns.serverTimestamp()
          }, { merge: true });
        } catch (fsErr) {
          console.warn('Firestore onAuthStateChanged user sync error:', fsErr);
        }
      }
    } else {
      const sess = getCustomerSession();
      if (sess && sess.provider !== 'guest') {
        clearCustomerSession();
      }
    }
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && authModalOverlay && authModalOverlay.classList.contains('open')) {
    closeAuthModal();
  }
  const checkoutOverlay = document.getElementById('checkoutModalOverlay');
  if (e.key === 'Escape' && checkoutOverlay && checkoutOverlay.classList.contains('open')) {
    closeCheckoutModal();
  }
});

// Setup checkout modal event listeners
const checkoutModalOverlayEl = document.getElementById('checkoutModalOverlay');
const checkoutCloseBtnEl = document.getElementById('checkoutCloseBtn');
const checkoutDeliveryFormEl = document.getElementById('checkoutDeliveryForm');
const confirmCloseBtnEl = document.getElementById('confirmCloseBtn');

if (checkoutCloseBtnEl) {
  checkoutCloseBtnEl.addEventListener('click', closeCheckoutModal);
}

if (checkoutModalOverlayEl) {
  checkoutModalOverlayEl.addEventListener('click', (e) => {
    if (e.target === checkoutModalOverlayEl) closeCheckoutModal();
  });
}

if (confirmCloseBtnEl) {
  confirmCloseBtnEl.addEventListener('click', () => {
    closeCheckoutModal();
    if (checkoutDeliveryFormEl) checkoutDeliveryFormEl.reset();
  });
}

if (checkoutDeliveryFormEl) {
  checkoutDeliveryFormEl.addEventListener('submit', handleCheckoutSubmit);
}

// Payment Method option listeners
const paymentMethodRadios = document.querySelectorAll('input[name="checkoutPaymentMethod"]');
paymentMethodRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    updatePaymentMethodUI(radio.value);
  });
});

['labelPaymentCod', 'labelPaymentOnline'].forEach(labelId => {
  const labelEl = document.getElementById(labelId);
  if (labelEl) {
    labelEl.addEventListener('click', () => {
      const radio = labelEl.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        updatePaymentMethodUI(radio.value);
      }
    });
  }
});

ensureStateOptions();

['deliveryState', 'deliveryDistrict', 'deliveryCity', 'deliveryArea', 'deliveryPin', 'deliveryAddress', 'deliveryEmail'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    const onValChange = () => {
      const wrap = el.closest('.checkout-field');
      if (wrap) wrap.classList.remove('has-error');

      if (id === 'deliveryState') {
        handleStateSelectionChange(el.value);
      } else if (id === 'deliveryDistrict') {
        const stateVal = document.getElementById('deliveryState')?.value || '';
        handleDistrictSelectionChange(el.value, stateVal);
      } else if (id === 'deliveryPin') {
        const stateVal = document.getElementById('deliveryState')?.value || '';
        updateLogisticsDisplay(el.value, stateVal);
      }

      updateCheckoutSummaryFields();
    };
    el.addEventListener('input', onValChange);
    el.addEventListener('change', onValChange);
  }
});

// Initialize customer authentication state on startup
window.updateAuthUI = updateAuthUI;
window.clearCustomerSession = clearCustomerSession;
window.setCustomerSession = setCustomerSession;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.openCheckoutModal = openCheckoutModal;
window.closeCheckoutModal = closeCheckoutModal;
window.ORDER_STATUS_OPTIONS = ORDER_STATUS_OPTIONS;
window.getOrderTimestamp = getOrderTimestamp;
window.getDisplayOrderNumber = getDisplayOrderNumber;
window.formatOrderDisplayDate = formatOrderDisplayDate;
window.formatOrderSimpleDate = formatOrderSimpleDate;
window.getExpectedDeliveryForOrder = getExpectedDeliveryForOrder;
window.isOrderCancellable = isOrderCancellable;
window.formatRemainingCancellationTime = formatRemainingCancellationTime;
window.startCancellationCountdownTicker = startCancellationCountdownTicker;
window.stopCancellationCountdownTicker = stopCancellationCountdownTicker;
window.updateCancellationCountdowns = updateCancellationCountdowns;
window.handleCustomerCancelOrder = handleCustomerCancelOrder;
window.renderCustomerOrdersList = renderCustomerOrdersList;
window.attachHoldToCancelListeners = attachHoldToCancelListeners;
window.setupCustomerOrdersListener = setupCustomerOrdersListener;
window.showAdminDashboard = showAdminDashboard;
window.renderAdminOrders = renderAdminOrders;
window.showOrderDetailsModal = showOrderDetailsModal;
window.loadAdminDataFromFirestore = loadAdminDataFromFirestore;
window.getRefundDetails = getRefundDetails;
window.formatRefundInfoHtml = formatRefundInfoHtml;
updateAuthUI();

/* =========================================================
   ADMIN LOGIC (SIMPLE DASHBOARD - SKETCH SPEC)
   ========================================================= */

const DEFAULT_ADMIN_ORDERS = [
  {
    id: 'JAY-1051',
    orderId: 'JAY-1051',
    orderNumber: '1051',
    customerName: 'Priya Sharma',
    customerEmail: 'priya.sharma@example.com',
    customerPhone: '+91 98200 12345',
    product: 'Handwoven Silk Anarkali Suit',
    size: 'M',
    quantity: 1,
    amount: '₹22,000',
    price: '₹22,000',
    date: '8 Oct 2026',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: 'Processing',
    orderStatus: 'Processing',
    customMessage: '',
    address: 'Flat 402, Green Meadows, Anna Nagar, Chennai 600040',
    state: 'Tamil Nadu',
    pinCode: '600040',
    estimatedDelivery: '14–16 October 2026',
    cancelledBy: '',
    cancelledAt: null,
    paymentMethod: 'Prepaid (UPI)'
  },
  {
    id: 'JAY-1054',
    orderId: 'JAY-1054',
    orderNumber: '1054',
    customerName: 'Priya Sharma',
    customerEmail: 'priya.sharma@example.com',
    customerPhone: '+91 98200 12345',
    product: 'Tussar Silk Embroidered Dupatta',
    size: 'Free Size',
    quantity: 1,
    amount: '₹8,500',
    price: '₹8,500',
    date: '8 Oct 2026',
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    status: 'Cancelled',
    orderStatus: 'Cancelled',
    customMessage: '',
    address: 'Flat 402, Green Meadows, Anna Nagar, Chennai 600040',
    state: 'Tamil Nadu',
    pinCode: '600040',
    estimatedDelivery: '14–16 October 2026',
    cancelledBy: 'admin',
    cancelledAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    paymentMethod: 'Prepaid (UPI)',
    paymentStatus: 'Paid',
    refundStatus: 'Pending'
  },
  {
    id: 'JAY-1053',
    orderId: 'JAY-1053',
    orderNumber: '1053',
    customerName: 'Priya Sharma',
    customerEmail: 'priya.sharma@example.com',
    customerPhone: '+91 98200 12345',
    product: 'Georgette Sharara Set',
    size: 'M',
    quantity: 1,
    amount: '₹9,800',
    price: '₹9,800',
    date: '8 Oct 2026',
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    status: 'Cancelled',
    orderStatus: 'Cancelled',
    customMessage: '',
    address: 'Flat 402, Green Meadows, Anna Nagar, Chennai 600040',
    state: 'Tamil Nadu',
    pinCode: '600040',
    estimatedDelivery: '14–16 October 2026',
    cancelledBy: 'customer',
    cancelledAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    paymentMethod: 'Cash on Delivery',
    paymentStatus: 'Pending',
    isPaid: false
  },
  {
    id: 'JAY-1052',
    orderId: 'JAY-1052',
    orderNumber: '1052',
    customerName: 'Priya Sharma',
    customerEmail: 'priya.sharma@example.com',
    customerPhone: '+91 98200 12345',
    product: 'Pastel Organza Saree with Mirror Work',
    size: 'Free Size',
    quantity: 1,
    amount: '₹15,200',
    price: '₹15,200',
    date: '8 Oct 2026',
    createdAt: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
    status: 'Cancelled',
    orderStatus: 'Cancelled',
    customMessage: '',
    address: 'Flat 402, Green Meadows, Anna Nagar, Chennai 600040',
    state: 'Tamil Nadu',
    pinCode: '600040',
    estimatedDelivery: '14–16 October 2026',
    cancelledBy: 'customer',
    cancelledAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    paymentMethod: 'Prepaid (UPI)',
    paymentStatus: 'Paid',
    refundStatus: 'Initiated',
    refundInitiatedAt: '2026-10-09T10:00:00.000Z'
  },
  {
    id: 'JAY-1050',
    orderId: 'JAY-1050',
    orderNumber: '1050',
    customerName: 'Priya Sharma',
    customerEmail: 'priya.sharma@example.com',
    customerPhone: '+91 98200 12345',
    product: 'Chanderi Embroidered Kurta Set',
    size: 'S',
    quantity: 1,
    amount: '₹12,400',
    price: '₹12,400',
    date: '8 Oct 2026',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    status: 'Cancelled',
    orderStatus: 'Cancelled',
    customMessage: '',
    address: 'Flat 402, Green Meadows, Anna Nagar, Chennai 600040',
    state: 'Tamil Nadu',
    pinCode: '600040',
    estimatedDelivery: '12–14 October 2026',
    cancelledBy: 'customer',
    cancelledAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    paymentMethod: 'Prepaid (Card)',
    paymentStatus: 'Paid',
    refundStatus: 'Initiated',
    refundInitiatedAt: '2026-10-08T18:00:00.000Z'
  },
  {
    id: 'JAY-1049',
    orderId: 'JAY-1049',
    orderNumber: '1049',
    customerName: 'Priya Sharma',
    customerEmail: 'priya.sharma@example.com',
    customerPhone: '+91 98200 12345',
    product: 'Banarasi Brocade Dupatta Ensemble',
    size: 'Free Size',
    quantity: 1,
    amount: '₹16,800',
    price: '₹16,800',
    date: '7 Oct 2026',
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    status: 'Cancelled',
    orderStatus: 'Cancelled',
    customMessage: '',
    address: 'Flat 402, Green Meadows, Anna Nagar, Chennai 600040',
    state: 'Tamil Nadu',
    pinCode: '600040',
    estimatedDelivery: '10–12 October 2026',
    cancelledBy: 'admin',
    cancelledAt: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
    paymentMethod: 'Prepaid (Net Banking)',
    paymentStatus: 'Paid',
    refundStatus: 'Initiated',
    refundInitiatedAt: '2026-10-07T20:00:00.000Z'
  },
  {
    id: 'JAY-1048',
    orderId: 'JAY-1048',
    orderNumber: '1048',
    customerName: 'Priya Sharma',
    customerEmail: 'priya.sharma@example.com',
    customerPhone: '+91 98200 12345',
    product: 'Raw Silk Bridal Anarkali',
    size: 'M',
    quantity: 1,
    amount: '₹18,500',
    price: '₹18,500',
    date: '28 Sep 2026',
    createdAt: '2026-09-28T10:00:00.000Z',
    status: 'Processing',
    orderStatus: 'Processing',
    customMessage: '',
    address: 'Flat 402, Green Meadows, Anna Nagar, Chennai 600040',
    state: 'Tamil Nadu',
    pinCode: '600040',
    estimatedDelivery: '7–9 October 2026',
    cancelledBy: '',
    cancelledAt: null,
    paymentMethod: 'Prepaid (UPI)'
  },
  {
    id: 'JAY-1047',
    orderId: 'JAY-1047',
    orderNumber: '1047',
    customerName: 'Ananya Reddy',
    customerEmail: 'ananya.r@example.com',
    customerPhone: '+91 98490 23456',
    product: 'Embroidered Organza Kurta Set',
    size: 'L',
    quantity: 2,
    amount: '₹14,800',
    price: '₹14,800',
    date: '26 Sep 2026',
    createdAt: '2026-09-26T14:30:00.000Z',
    status: 'Shipped',
    orderStatus: 'Shipped',
    customMessage: '',
    address: '12, Jubilee Hills, Hyderabad 500033',
    state: 'Telangana',
    pinCode: '500033',
    estimatedDelivery: '5–7 October 2026',
    cancelledBy: '',
    cancelledAt: null,
    paymentMethod: 'Credit Card (HDFC)'
  },
  {
    id: 'JAY-1046',
    orderId: 'JAY-1046',
    orderNumber: '1046',
    customerName: 'Meera Nair',
    customerEmail: 'meera.nair@example.com',
    customerPhone: '+91 97455 34567',
    product: 'Zari Handloom Kanjeevaram Saree',
    size: 'Free Size',
    quantity: 1,
    amount: '₹34,000',
    price: '₹34,000',
    date: '24 Sep 2026',
    createdAt: '2026-09-24T09:15:00.000Z',
    status: 'Delivered',
    orderStatus: 'Delivered',
    customMessage: '',
    address: '7A, Skyline Apts, Panampilly Nagar, Kochi 682036',
    state: 'Kerala',
    pinCode: '682036',
    estimatedDelivery: '3–5 October 2026',
    cancelledBy: '',
    cancelledAt: null,
    paymentMethod: 'Net Banking'
  },
  {
    id: 'JAY-1045',
    orderId: 'JAY-1045',
    orderNumber: '1045',
    customerName: 'Dr. Pooja Chawla',
    customerEmail: 'pooja.c@example.com',
    customerPhone: '+91 98111 45678',
    product: 'Velvet Festive Kurta with Dupatta',
    size: 'S',
    quantity: 1,
    amount: '₹11,200',
    price: '₹11,200',
    date: '22 Sep 2026',
    createdAt: '2026-09-22T16:45:00.000Z',
    status: 'Delivered',
    orderStatus: 'Delivered',
    customMessage: '',
    address: 'C-14, Vasant Vihar, New Delhi 110057',
    state: 'Delhi',
    pinCode: '110057',
    estimatedDelivery: '1–3 October 2026',
    cancelledBy: '',
    cancelledAt: null,
    paymentMethod: 'Prepaid (UPI)'
  },
  {
    id: 'JAY-1044',
    orderId: 'JAY-1044',
    orderNumber: '1044',
    customerName: 'Tanvi Patel',
    customerEmail: 'tanvi.p@example.com',
    customerPhone: '+91 99099 56789',
    product: 'Mirror Work Georgette Lehenga',
    size: 'M',
    quantity: 1,
    amount: '₹26,500',
    price: '₹26,500',
    date: '19 Sep 2026',
    createdAt: '2026-09-19T11:20:00.000Z',
    status: 'Confirmed',
    orderStatus: 'Confirmed',
    customMessage: '',
    address: '801, Riviera Heights, Bodakdev, Ahmedabad 380054',
    state: 'Gujarat',
    pinCode: '380054',
    estimatedDelivery: '28–30 September 2026',
    cancelledBy: '',
    cancelledAt: null,
    paymentMethod: 'Debit Card'
  }
];

const DEFAULT_ADMIN_CUSTOMISATIONS = [
  {
    id: 'CUST-304',
    fullName: 'Kavitha Sundaram',
    contactNumber: '+91 98765 43210',
    email: 'kavitha.sundaram@example.com',
    colour: 'Deep Maroon with Antique Gold Zari',
    fabric: 'Velvet with Dupion Silk dupatta',
    design: 'Handcrafted lehenga with sweetheart neckline blouse and elbow-length sleeves',
    measurements: 'Bust: 36, Waist: 30, Hip: 39, Blouse Length: 15',
    embellishments: 'Heavy hand-embroidered zardozi work along the hemline',
    additionalRequirements: 'Required for Wedding Reception by 15 Nov 2026. Budget ~ ₹50,000.',
    referenceImage: 'lehenga_sketch_ref.jpg',
    submissionDate: '27 Sep 2026',
    status: 'New Request'
  },
  {
    id: 'CUST-303',
    fullName: 'Ritika Sengupta',
    contactNumber: '+91 98450 11223',
    email: 'ritika.sengupta@example.com',
    colour: 'Sage Green & Dusty Rose combination',
    fabric: 'Pure Tussar Silk with soft organza dupatta',
    design: 'Floor-length flared Anarkali with scalloped borders and bell sleeves',
    measurements: 'Length: 52 inches, Chest: 34, Waist: 28',
    embellishments: 'Subtle pearl and cutdana work on yoke and sleeve cuffs',
    additionalRequirements: "For Sister's Sangeet ceremony by 05 Nov 2026",
    referenceImage: 'anarkali_sample.png',
    submissionDate: '25 Sep 2026',
    status: 'In Review'
  },
  {
    id: 'CUST-302',
    fullName: 'Deepa Varma',
    contactNumber: '+91 97110 54321',
    email: 'deepa.varma@example.com',
    colour: 'Mustard Yellow with Rani Pink border',
    fabric: 'Pure Kanjeevaram Pattu Silk with soft cotton inner lining',
    design: 'Traditional South Indian Pattu Pavadai skirt and matching blouse for 6-year-old child',
    measurements: 'Chest: 24, Skirt Length: 28, Waist: 22',
    embellishments: 'Delicate zari border work, no sharp sequins for comfort',
    additionalRequirements: 'Temple festival by 20 Oct 2026. Extra fabric inside hem for future alterations.',
    referenceImage: '',
    submissionDate: '21 Sep 2026',
    status: 'In Progress'
  },
  {
    id: 'CUST-301',
    fullName: 'Ananya Sharma',
    contactNumber: '+91 98200 44556',
    email: 'ananya.sharma@example.com',
    colour: 'Emerald Green with Antique Gold Border',
    fabric: 'Raw Silk with Brocade border',
    design: 'Custom crop top and pleated maxi skirt with matching dupatta',
    measurements: 'Bust: 34, Waist: 28, Skirt Length: 42',
    embellishments: 'Handcrafted zari embroidery along neckline and belt',
    additionalRequirements: 'Bespoke festive collection',
    referenceImage: '',
    submissionDate: '18 Sep 2026',
    status: 'Completed',
    orderCreated: false
  }
];

const HELP_STATUS_OPTIONS = ['Not Resolved', 'In Progress', 'Resolved'];
window.HELP_STATUS_OPTIONS = HELP_STATUS_OPTIONS;

function normalizeHelpStatus(status) {
  if (!status) return 'Not Resolved';
  const s = String(status).trim().toLowerCase();
  if (s === 'resolved' || s === 'completed') return 'Resolved';
  if (s === 'in progress' || s === 'in-progress' || s === 'inreview' || s === 'in review') return 'In Progress';
  return 'Not Resolved';
}
window.normalizeHelpStatus = normalizeHelpStatus;

const DEFAULT_ADMIN_HELP = [
  {
    id: 'HELP-201',
    customerName: 'Sneha Pillai',
    email: 'sneha.pillai@example.com',
    message: 'Hello, I placed an enquiry for custom bridal wear 2 days ago. Could you please confirm if you have availability for a fitting appointment in Chennai this weekend?',
    submissionDate: '29 Sep 2026, 11:30 AM',
    status: 'Not Resolved'
  },
  {
    id: 'HELP-200',
    customerName: 'Rajesh Gupta',
    email: 'rajesh.g@example.com',
    message: 'Hi team, I would like to know if international shipping to Dubai is available for ready-to-wear kurtas, and how many days it typically takes.',
    submissionDate: '27 Sep 2026, 04:15 PM',
    status: 'In Progress'
  },
  {
    id: 'HELP-199',
    customerName: 'Sunita Deshmukh',
    email: 'sunita.d@example.com',
    message: 'Can I send my own fabric to your studio for a custom tailored blouse? Please let me know the process and charges.',
    submissionDate: '24 Sep 2026, 02:40 PM',
    status: 'Resolved'
  }
];

function getAdminOrders() {
  if (sessionStorage.getItem('jayashree_admin_logged') !== 'true') {
    return [];
  }
  try {
    const saved = localStorage.getItem('jayashree_orders_store');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  localStorage.setItem('jayashree_orders_store', JSON.stringify(DEFAULT_ADMIN_ORDERS));
  return DEFAULT_ADMIN_ORDERS;
}

function saveAdminOrders(orders) {
  if (sessionStorage.getItem('jayashree_admin_logged') !== 'true') {
    return;
  }
  try {
    localStorage.setItem('jayashree_orders_store', JSON.stringify(orders));
  } catch (e) {}
}

function getAdminCustomisations() {
  try {
    const saved = localStorage.getItem('jayashree_customisations_store');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  localStorage.setItem('jayashree_customisations_store', JSON.stringify(DEFAULT_ADMIN_CUSTOMISATIONS));
  return DEFAULT_ADMIN_CUSTOMISATIONS;
}

function saveAdminCustomisations(items) {
  try {
    localStorage.setItem('jayashree_customisations_store', JSON.stringify(items));
  } catch (e) {}
}

function saveLocalCustomisation(payload) {
  const list = getAdminCustomisations();
  const newItem = {
    id: 'CUST-' + (300 + list.length + 1),
    fullName: payload.fullName || 'Valued Customer',
    contactNumber: payload.contactNumber || '—',
    email: payload.email || payload.customerEmail || '',
    colour: payload.colour || 'Not specified',
    fabric: payload.fabric || 'Not specified',
    design: payload.design || 'Not specified',
    measurements: payload.measurements || 'Not specified',
    embellishments: payload.embellishments || payload.embellishment || 'Not specified',
    additionalRequirements: payload.additionalRequirements || 'None',
    referenceImage: payload.referenceImage || '',
    submissionDate: new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
    status: 'New Request'
  };
  list.unshift(newItem);
  saveAdminCustomisations(list);
}

function getAdminHelp() {
  try {
    const saved = localStorage.getItem('jayashree_help_store');
    if (saved) {
      const parsed = JSON.parse(saved);
      let changed = false;
      parsed.forEach(q => {
        const norm = normalizeHelpStatus(q.status);
        if (q.status !== norm) {
          q.status = norm;
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem('jayashree_help_store', JSON.stringify(parsed));
      }
      return parsed;
    }
  } catch (e) {}
  localStorage.setItem('jayashree_help_store', JSON.stringify(DEFAULT_ADMIN_HELP));
  return DEFAULT_ADMIN_HELP;
}

function saveAdminHelp(items) {
  try {
    localStorage.setItem('jayashree_help_store', JSON.stringify(items));
  } catch (e) {}
}

function saveLocalHelp(msg) {
  const list = getAdminHelp();
  const customer = getCustomerSession();
  const newItem = {
    id: 'HELP-' + (200 + list.length + 1),
    customerName: customer ? customer.name || 'Customer' : 'Website Customer',
    email: customer ? customer.email || '—' : '—',
    message: msg,
    submissionDate: new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    status: 'Not Resolved'
  };
  list.unshift(newItem);
  saveAdminHelp(list);
}

let currentAdminTab = 'orders';

function handleAdminRoute() {
  const nav = document.getElementById('nav');
  if (nav) nav.style.display = 'none';
  const footer = document.querySelector('footer');
  if (footer) footer.style.display = 'none';

  const hash = window.location.hash || '';
  const isAdminLogged = sessionStorage.getItem('jayashree_admin_logged') === 'true';
  if (isAdminLogged) {
    if (hash.includes('tab=customisation')) {
      currentAdminTab = 'customisation';
    } else if (hash.includes('tab=help')) {
      currentAdminTab = 'help';
    } else {
      currentAdminTab = 'orders';
    }

    if (hash.includes('filter=not-resolved')) {
      currentHelpFilter = 'Not Resolved';
    } else if (hash.includes('filter=in-progress')) {
      currentHelpFilter = 'In Progress';
    } else if (hash.includes('filter=resolved')) {
      currentHelpFilter = 'Resolved';
    }

    showAdminDashboard();

    if (hash.includes('modal=order')) {
      const orders = getAdminOrders();
      if (orders.length > 0) showOrderDetailsModal(orders[0].id);
    } else if (hash.includes('modal=customisation')) {
      const reqs = getAdminCustomisations();
      if (reqs.length > 0) showCustomisationDetailsModal(reqs[0].id);
    } else if (hash.includes('modal=help')) {
      const queries = getAdminHelp();
      if (queries.length > 0) showHelpDetailsModal(queries[0].id);
    }
  } else {
    showAdminLogin();
  }
}

function showAdminLogin() {
  const loginView = document.getElementById('adminLoginView');
  const dashView = document.getElementById('adminDashboardView');
  if (loginView) loginView.style.display = '';
  if (dashView) dashView.style.display = 'none';
}

function showAdminDashboard() {
  const loginView = document.getElementById('adminLoginView');
  const dashView = document.getElementById('adminDashboardView');
  if (loginView) loginView.style.display = 'none';
  if (dashView) dashView.style.display = '';
  switchAdminTab(currentAdminTab);
  loadAdminDataFromFirestore();
  setupAdminOrdersListener();
  setupAdminCustomisationsListener();
}

function switchAdminTab(tabName) {
  currentAdminTab = tabName;
  const tabButtons = {
    orders: document.getElementById('adminTabOrders'),
    customisation: document.getElementById('adminTabCustomisation'),
    help: document.getElementById('adminTabHelp')
  };
  const sections = {
    orders: document.getElementById('adminSectionOrders'),
    customisation: document.getElementById('adminSectionCustomisation'),
    help: document.getElementById('adminSectionHelp')
  };

  Object.keys(tabButtons).forEach(key => {
    if (tabButtons[key]) {
      tabButtons[key].classList.toggle('active', key === tabName);
      tabButtons[key].setAttribute('aria-selected', key === tabName ? 'true' : 'false');
    }
    if (sections[key]) {
      sections[key].style.display = key === tabName ? '' : 'none';
    }
  });

  if (tabName === 'orders') renderAdminOrders();
  else if (tabName === 'customisation') renderAdminCustomisation();
  else if (tabName === 'help') renderAdminHelp();
}

function renderAdminOrders() {
  const container = document.getElementById('adminOrdersContent');
  if (!container) return;

  const orders = getAdminOrders();
  if (orders.length === 0) {
    container.innerHTML = `
      <div class="admin-orders-header">
        <div class="admin-orders-header-title">Orders</div>
        <div class="admin-orders-count-badge">0 Orders</div>
      </div>
      <p style="text-align: center; color: var(--muted); padding: 40px 0;">No customer orders found.</p>
    `;
    return;
  }

  container.innerHTML = `
    <div class="admin-orders-header">
      <div class="admin-orders-header-title">Orders</div>
      <div class="admin-orders-count-badge">${orders.length} ${orders.length === 1 ? 'Order' : 'Orders'}</div>
    </div>
    <div class="admin-table-wrapper">
      <table class="admin-table">
        <colgroup>
          <col class="col-order-cust">
          <col class="col-product-size">
          <col class="col-qty">
          <col class="col-amount">
          <col class="col-payment">
          <col class="col-date">
          <col class="col-status">
          <col class="col-action">
        </colgroup>
        <thead>
          <tr>
            <th class="col-order-cust">ORDER &amp; CUSTOMER</th>
            <th class="col-product-size">PRODUCT &amp; SIZE</th>
            <th class="col-qty th-center">QTY</th>
            <th class="col-amount">AMOUNT</th>
            <th class="col-payment">PAYMENT METHOD</th>
            <th class="col-date">ORDER DATE</th>
            <th class="col-status">STATUS</th>
            <th class="col-action th-center">ACTION</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(order => {
            const currentStatus = order.status || order.orderStatus || 'Processing';
            const isOther = currentStatus === 'Other';
            const isCancelled = (currentStatus || '').toLowerCase() === 'cancelled';
            const isCustomerCancelled = isCancelled && (order.cancelledBy || '').toLowerCase().trim() === 'customer';
            const customMsg = order.customMessage || '';
            const displayNum = getDisplayOrderNumber(order);
            const isCustom = Boolean(order.customisationRequestId || order.isCustomOrder);
            const simpleDate = formatOrderSimpleDate(order);
            const customerEmail = order.customerEmail || order.email || order.phone || order.contactNumber || '—';
            return `
              <tr>
                <td class="admin-td-order-cust">
                  <div class="admin-order-badge-row">
                    <span class="admin-order-badge">ORDER #${escapeHtml(displayNum)}</span>
                    ${isCustom ? '<span class="admin-custom-tag">Custom</span>' : ''}
                  </div>
                  <div class="admin-customer-name">${escapeHtml(order.customerName || 'Customer')}</div>
                  <div class="admin-customer-email">${escapeHtml(customerEmail)}</div>
                </td>
                <td class="admin-td-product">
                  <div class="admin-product-title">${escapeHtml(order.product || order.productName || 'Designer Outfit')}</div>
                  <div class="admin-product-size">Size: <span>${escapeHtml(order.size || 'Standard')}</span></div>
                </td>
                <td class="admin-td-qty">
                  <span class="admin-qty-badge">${order.quantity || 1}</span>
                </td>
                <td class="admin-td-amount">
                  <span class="admin-amount-text">${escapeHtml(order.amount || order.price || '₹0')}</span>
                </td>
                <td class="admin-td-payment">
                  <div class="admin-payment-info">
                    <span class="admin-payment-method-name">${formatPaymentMethodDisplay(order.paymentMethod)}</span>
                    ${formatPaymentStatusBadge(order.paymentStatus)}
                  </div>
                </td>
                <td class="admin-td-date">
                  <span class="admin-date-text">${escapeHtml(simpleDate)}</span>
                </td>
                <td class="admin-td-status">
                  <div class="admin-status-wrap">
                    ${isCustomerCancelled ? `
                      <span class="admin-status-static-badge">Cancelled</span>
                      <div class="admin-cancelled-details-block">
                        <div class="admin-cancelled-line">Cancelled by: <strong>Customer</strong></div>
                        ${order.cancelledAt ? `<div class="admin-cancelled-line admin-cancelled-time">Cancelled at: <span>${escapeHtml(formatOrderDateTime(order.cancelledAt))}</span></div>` : ''}
                      </div>
                    ` : `
                      <select class="admin-order-status-select" data-order-id="${escapeHtml(order.id)}" onchange="handleAdminOrderStatusChange('${escapeHtml(order.id)}', this.value)">
                        ${ORDER_STATUS_OPTIONS.map(opt => `
                          <option value="${opt}" ${currentStatus === opt ? 'selected' : ''}>${opt}</option>
                        `).join('')}
                      </select>
                      ${isCancelled ? `
                        <div class="admin-cancelled-details-block">
                          <div class="admin-cancelled-line">Cancelled by: <strong>${(order.cancelledBy || '').toLowerCase() === 'customer' ? 'Customer' : 'Admin'}</strong></div>
                          ${order.cancelledAt ? `<div class="admin-cancelled-line admin-cancelled-time">Cancelled at: <span>${escapeHtml(formatOrderDateTime(order.cancelledAt))}</span></div>` : ''}
                        </div>
                      ` : ''}
                      <div class="admin-custom-msg-wrap" id="adminCustomWrap_${escapeHtml(order.id)}" style="${isOther ? 'display: block;' : 'display: none;'}">
                        <input type="text" class="admin-custom-msg-input" id="adminCustomInput_${escapeHtml(order.id)}"
                          placeholder="Custom message..."
                          value="${escapeHtml(customMsg)}"
                          oninput="handleAdminOrderCustomMsgChange('${escapeHtml(order.id)}', this.value)"
                          onchange="handleAdminOrderCustomMsgChange('${escapeHtml(order.id)}', this.value)"
                          onblur="handleAdminOrderCustomMsgChange('${escapeHtml(order.id)}', this.value)">
                      </div>
                    `}
                  </div>
                </td>
                <td class="admin-td-action">
                  <button type="button" class="admin-view-btn" data-action="view-order" data-id="${escapeHtml(order.id)}">Details</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

const CUSTOMISATION_STATUS_OPTIONS = ['New Request', 'In Review', 'In Progress', 'Completed', 'Cancelled'];
window.CUSTOMISATION_STATUS_OPTIONS = CUSTOMISATION_STATUS_OPTIONS;

function renderAdminCustomisation() {
  const container = document.getElementById('adminCustomisationContent');
  if (!container) return;

  const requests = getAdminCustomisations();
  if (requests.length === 0) {
    container.innerHTML = `
      <div class="admin-section-header">
        <div class="admin-section-title">Customisation Requests</div>
        <div class="admin-section-count">0 Requests</div>
      </div>
      <p style="text-align: center; color: var(--muted); padding: 40px 0;">No customisation requests submitted yet.</p>
    `;
    return;
  }

  container.innerHTML = `
    <div class="admin-section-header">
      <div class="admin-section-title">Customisation Requests</div>
      <div class="admin-section-count">${requests.length} ${requests.length === 1 ? 'Request' : 'Requests'}</div>
    </div>
    <div class="admin-card-list">
      ${requests.map(req => {
        const currentStatus = req.status || 'New Request';
        const isCompleted = currentStatus === 'Completed';
        const embellishments = req.embellishments || req.embellishment || '';
        return `
          <div class="admin-cust-card" data-req-id="${escapeHtml(req.id)}">
            <div class="admin-cust-card-header">
              <span class="admin-cust-tag">REQUEST #${escapeHtml(req.id)}</span>
              <div class="admin-cust-status-wrap">
                <span class="admin-cust-status-label">STATUS</span>
                <select class="admin-cust-status-dropdown" data-req-id="${escapeHtml(req.id)}" onchange="handleAdminCustomisationStatusChange('${escapeHtml(req.id)}', this.value)">
                  ${CUSTOMISATION_STATUS_OPTIONS.map(opt => `
                    <option value="${opt}" ${currentStatus === opt ? 'selected' : ''}>${opt}</option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div class="admin-cust-card-body">
              <div class="admin-cust-person-block">
                <h3 class="admin-cust-person-name">${escapeHtml(req.fullName)}</h3>
                <div class="admin-cust-meta-line">
                  <a href="tel:${escapeHtml(req.contactNumber)}" class="admin-cust-phone">${escapeHtml(req.contactNumber)}</a>
                  <span class="admin-cust-bullet">·</span>
                  <span class="admin-cust-date">${escapeHtml(req.submissionDate || 'Recent')}</span>
                </div>
              </div>

              <div class="admin-cust-content-block">
                ${req.design ? `
                  <div class="admin-cust-line">
                    <span class="admin-cust-label">DESIGN:</span> <span class="admin-cust-val">${escapeHtml(req.design)}</span>
                  </div>
                ` : ''}

                ${req.colour ? `
                  <div class="admin-cust-line">
                    <span class="admin-cust-label">COLOUR:</span> <span class="admin-cust-val">${escapeHtml(req.colour)}</span>
                  </div>
                ` : ''}

                ${req.fabric ? `
                  <div class="admin-cust-line">
                    <span class="admin-cust-label">FABRIC:</span> <span class="admin-cust-val">${escapeHtml(req.fabric)}</span>
                  </div>
                ` : ''}

                ${req.measurements ? `
                  <div class="admin-cust-line">
                    <span class="admin-cust-label">MEASUREMENTS:</span> <span class="admin-cust-val">${escapeHtml(req.measurements)}</span>
                  </div>
                ` : ''}

                ${embellishments ? `
                  <div class="admin-cust-line">
                    <span class="admin-cust-label">EMBELLISHMENTS:</span> <span class="admin-cust-val">${escapeHtml(embellishments)}</span>
                  </div>
                ` : ''}

                ${(req.additionalRequirements && req.additionalRequirements !== 'None') ? `
                  <div class="admin-cust-line">
                    <span class="admin-cust-label">ADDITIONAL INFORMATION:</span> <span class="admin-cust-val">${escapeHtml(req.additionalRequirements)}</span>
                  </div>
                ` : ''}

                ${req.referenceImage ? `
                  <div class="admin-cust-line">
                    <span class="admin-cust-label">REFERENCE IMAGE:</span> <span class="admin-cust-val">📎 ${escapeHtml(req.referenceImage)}</span>
                  </div>
                ` : ''}
              </div>

              <div class="admin-cust-card-actions">
                <div class="admin-cust-order-action-area">
                  ${isCompleted ? (
                    req.orderCreated ? `
                      <div class="admin-order-created-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>Order Created • <strong>Order #${escapeHtml(req.orderNumber || '—')}</strong></span>
                      </div>
                    ` : `
                      <button type="button" class="btn-create-order-cta" onclick="handleCreateOrderFromCustomisation('${escapeHtml(req.id)}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                        <span>Create Order</span>
                      </button>
                    `
                  ) : ''}
                </div>
                <button type="button" class="admin-view-btn admin-cust-view-btn" data-action="view-customisation" data-id="${escapeHtml(req.id)}">View Complete Request</button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

let currentHelpFilter = 'All';

window.setAdminHelpFilter = function(filter) {
  currentHelpFilter = filter;
  renderAdminHelp();
};

function renderAdminHelp() {
  const container = document.getElementById('adminHelpContent');
  if (!container) return;

  const allQueries = getAdminHelp().map(q => {
    q.status = normalizeHelpStatus(q.status);
    return q;
  });

  if (allQueries.length === 0) {
    container.innerHTML = `
      <div class="admin-section-header">
        <div class="admin-section-title">Help Centre Requests</div>
        <div class="admin-section-count">0 Queries</div>
      </div>
      <p style="text-align: center; color: var(--muted); padding: 40px 0;">No customer help requests received yet.</p>
    `;
    return;
  }

  const filterOptions = ['All', 'Not Resolved', 'In Progress', 'Resolved'];
  const filteredQueries = currentHelpFilter === 'All'
    ? allQueries
    : allQueries.filter(q => q.status === currentHelpFilter);

  container.innerHTML = `
    <div class="admin-section-header">
      <div class="admin-section-title">Help Centre Requests</div>
      <div class="admin-section-count">${allQueries.length} ${allQueries.length === 1 ? 'Query' : 'Queries'}</div>
    </div>

    <!-- Status Filter Bar -->
    <div class="admin-help-filter-bar" role="group" aria-label="Filter Help Requests by Status">
      ${filterOptions.map(opt => `
        <button type="button"
          class="admin-help-filter-btn ${currentHelpFilter === opt ? 'active' : ''}"
          onclick="setAdminHelpFilter('${opt}')"
          data-filter="${opt}">
          ${opt}
        </button>
      `).join('')}
    </div>

    ${filteredQueries.length === 0 ? `
      <div class="admin-empty-filter-state">
        <p style="text-align: center; color: var(--muted); padding: 36px 0;">No requests with status <strong>${escapeHtml(currentHelpFilter)}</strong>.</p>
      </div>
    ` : `
      <div class="admin-card-list">
        ${filteredQueries.map(q => {
          const normStatus = normalizeHelpStatus(q.status);
          const statusSlug = normStatus.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          return `
            <div class="admin-item-card">
              <div class="admin-card-top">
                <div class="admin-card-header-left">
                  <div class="admin-card-person-name">${escapeHtml(q.customerName || 'Customer')}</div>
                  <div class="admin-card-contact-sub">${escapeHtml(q.email || 'No email provided')}</div>
                </div>
                <div class="admin-help-status-wrapper">
                  <select class="admin-status-pill admin-status-${statusSlug} admin-help-status-dropdown-card"
                    data-id="${escapeHtml(q.id)}"
                    onchange="updateHelpStatus('${escapeHtml(q.id)}', this.value)"
                    title="Change request status">
                    ${HELP_STATUS_OPTIONS.map(opt => `
                      <option value="${opt}" ${normStatus === opt ? 'selected' : ''}>${opt}</option>
                    `).join('')}
                  </select>
                </div>
              </div>
              <div class="admin-message-preview">${escapeHtml(q.message)}</div>
              <div class="admin-card-bottom">
                <span class="admin-card-date">Submitted: ${escapeHtml(q.submissionDate)} • ${escapeHtml(q.id)}</span>
                <div class="admin-card-btn-group">
                  <button type="button" class="admin-reply-btn" data-action="reply-help" data-id="${escapeHtml(q.id)}" title="Reply to customer via email">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right: 4px;">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1-0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                      <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                    <span>Reply via Email</span>
                  </button>
                  <button type="button" class="admin-view-btn" data-action="view-help" data-id="${escapeHtml(q.id)}">Read Full Message</button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;
}

function showOrderDetailsModal(orderId) {
  const orders = getAdminOrders();
  const order = orders.find(o => o.id === orderId || o.orderId === orderId);
  if (!order) return;

  const currentStatus = order.status || order.orderStatus || 'Processing';
  const isOther = currentStatus === 'Other';
  const isCancelled = (currentStatus || '').toLowerCase() === 'cancelled';
  const isCustomerCancelled = isCancelled && (order.cancelledBy || '').toLowerCase().trim() === 'customer';
  const customMsg = order.customMessage || '';
  const displayNum = getDisplayOrderNumber(order);
  const displayDate = formatOrderDisplayDate(order);
  const expectedDel = getExpectedDeliveryForOrder(order);

  const content = `
    <div class="admin-order-modal-body">
      <!-- 1. ORDER DETAILS -->
      <div class="admin-modal-section">
        <div class="admin-modal-sec-header">
          <span class="admin-modal-sec-tag">01</span>
          <h4 class="admin-modal-sec-title">ORDER DETAILS</h4>
        </div>
        <div class="admin-modal-grid-2">
          <div class="admin-modal-item">
            <span class="admin-modal-item-label">Order Number</span>
            <span class="admin-modal-item-value admin-order-number-val">#${escapeHtml(displayNum)}</span>
          </div>
          <div class="admin-modal-item">
            <span class="admin-modal-item-label">Order Date</span>
            <span class="admin-modal-item-value">${escapeHtml(displayDate)}</span>
          </div>
          ${order.customisationRequestId ? `
            <div class="admin-modal-item" style="grid-column: 1 / -1; margin-top: 4px;">
              <span class="admin-modal-item-label">Origin</span>
              <span class="admin-modal-item-value">
                <span class="admin-custom-tag">Created from Customisation Request #${escapeHtml(order.customisationRequestId)}</span>
              </span>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- 2. CUSTOMER -->
      <div class="admin-modal-section">
        <div class="admin-modal-sec-header">
          <span class="admin-modal-sec-tag">02</span>
          <h4 class="admin-modal-sec-title">CUSTOMER</h4>
        </div>
        <div class="admin-modal-grid-3">
          <div class="admin-modal-item">
            <span class="admin-modal-item-label">Customer Name</span>
            <span class="admin-modal-item-value"><strong>${escapeHtml(order.customerName || 'Customer')}</strong></span>
          </div>
          <div class="admin-modal-item">
            <span class="admin-modal-item-label">Email</span>
            <span class="admin-modal-item-value">${order.customerEmail ? `<a href="mailto:${escapeHtml(order.customerEmail)}">${escapeHtml(order.customerEmail)}</a>` : '—'}</span>
          </div>
          <div class="admin-modal-item">
            <span class="admin-modal-item-label">Phone</span>
            <span class="admin-modal-item-value">${order.customerPhone && order.customerPhone !== '—' ? `<a href="tel:${escapeHtml(order.customerPhone)}">${escapeHtml(order.customerPhone)}</a>` : '—'}</span>
          </div>
        </div>
      </div>

      <!-- 3. DELIVERY -->
      <div class="admin-modal-section">
        <div class="admin-modal-sec-header">
          <span class="admin-modal-sec-tag">03</span>
          <h4 class="admin-modal-sec-title">DELIVERY</h4>
        </div>
        <div class="admin-modal-grid-1">
          <div class="admin-modal-item">
            <span class="admin-modal-item-label">Shipping Address</span>
            <span class="admin-modal-item-value">${escapeHtml(order.address || order.fullAddress || '—')}</span>
          </div>
          <div class="admin-modal-item" style="margin-top: 6px;">
            <span class="admin-modal-item-label">Expected Delivery</span>
            <span class="admin-modal-item-value admin-expected-del-val">${escapeHtml(expectedDel)}</span>
          </div>
        </div>
      </div>

      <!-- 4. PRODUCT -->
      <div class="admin-modal-section">
        <div class="admin-modal-sec-header">
          <span class="admin-modal-sec-tag">04</span>
          <h4 class="admin-modal-sec-title">PRODUCT</h4>
        </div>
        <div class="admin-modal-grid-4">
          <div class="admin-modal-item">
            <span class="admin-modal-item-label">Product</span>
            <span class="admin-modal-item-value"><strong>${escapeHtml(order.product || order.productName || 'Designer Outfit')}</strong></span>
          </div>
          <div class="admin-modal-item">
            <span class="admin-modal-item-label">Size</span>
            <span class="admin-modal-item-value">${escapeHtml(order.size || 'Standard')}</span>
          </div>
          <div class="admin-modal-item">
            <span class="admin-modal-item-label">Quantity</span>
            <span class="admin-modal-item-value">${order.quantity || 1}</span>
          </div>
          <div class="admin-modal-item">
            <span class="admin-modal-item-label">Amount</span>
            <span class="admin-modal-item-value admin-amount-val">${escapeHtml(order.amount || order.price || '₹0')}</span>
          </div>
        </div>
      </div>

      <!-- 5. PAYMENT -->
      <div class="admin-modal-section">
        <div class="admin-modal-sec-header">
          <span class="admin-modal-sec-tag">05</span>
          <h4 class="admin-modal-sec-title">PAYMENT</h4>
        </div>
        <div class="admin-modal-grid-2">
          <div class="admin-modal-item">
            <span class="admin-modal-item-label">Payment Method</span>
            <span class="admin-modal-item-value">${formatPaymentMethodDisplay(order.paymentMethod)}</span>
          </div>
          <div class="admin-modal-item">
            <span class="admin-modal-item-label">Payment Status</span>
            <span class="admin-modal-item-value">${formatPaymentStatusBadge(order.paymentStatus)}</span>
          </div>
        </div>
      </div>

      <!-- 6. ORDER STATUS -->
      <div class="admin-modal-section admin-modal-sec-status">
        <div class="admin-modal-sec-header">
          <span class="admin-modal-sec-tag">06</span>
          <h4 class="admin-modal-sec-title">ORDER STATUS</h4>
        </div>
        ${isCancelled ? `
          <div class="admin-cancelled-alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            <div class="admin-cancelled-alert-body">
              <div class="admin-cancelled-alert-row">Cancelled by: <strong>${(order.cancelledBy || '').toLowerCase() === 'customer' ? 'Customer' : 'Admin'}</strong></div>
              ${order.cancelledAt ? `<div class="admin-cancelled-alert-row">Cancelled at: <strong>${escapeHtml(formatOrderDateTime(order.cancelledAt))}</strong></div>` : ''}
            </div>
          </div>
        ` : ''}
        <div class="admin-status-control-box">
          <label class="admin-modal-item-label" style="display: block; margin-bottom: 6px;">Status</label>
          ${isCustomerCancelled ? `
            <div><span class="admin-status-static-badge">Cancelled</span></div>
          ` : `
            <select class="admin-status-dropdown" data-order-id="${escapeHtml(order.id)}" onchange="handleAdminOrderStatusChange('${escapeHtml(order.id)}', this.value)">
              ${ORDER_STATUS_OPTIONS.map(opt => `
                <option value="${opt}" ${currentStatus === opt ? 'selected' : ''}>${opt}</option>
              `).join('')}
            </select>
            <div class="admin-custom-msg-wrap" id="modalCustomWrap_${escapeHtml(order.id)}" style="${isOther ? 'display: block; margin-top: 10px;' : 'display: none; margin-top: 10px;'}">
              <label class="admin-modal-item-label" style="display: block; margin-bottom: 4px;">Admin Custom Message</label>
              <input type="text" class="admin-custom-msg-input" id="modalCustomInput_${escapeHtml(order.id)}"
                placeholder="Fabric not found — this may take some time to deliver the product."
                value="${escapeHtml(customMsg)}"
                oninput="handleAdminOrderCustomMsgChange('${escapeHtml(order.id)}', this.value)"
                onchange="handleAdminOrderCustomMsgChange('${escapeHtml(order.id)}', this.value)"
                onblur="handleAdminOrderCustomMsgChange('${escapeHtml(order.id)}', this.value)">
            </div>
          `}
        </div>
      </div>
    </div>
  `;
  openAdminModal(`ORDER #${displayNum} Details`, content);
}

function showCustomisationDetailsModal(reqId) {
  const requests = getAdminCustomisations();
  const req = requests.find(r => r.id === reqId);
  if (!req) return;

  const currentStatus = req.status || 'New Request';
  const isCompleted = currentStatus === 'Completed';

  const content = `
    <div class="admin-order-modal-body">
      <!-- 1. CUSTOMER -->
      <div class="admin-modal-section">
        <div class="admin-modal-sec-header">
          <span class="admin-modal-sec-tag">01</span>
          <h4 class="admin-modal-sec-title">CUSTOMER</h4>
        </div>
        <div class="admin-modal-grid-2">
          <div class="admin-modal-item">
            <span class="admin-modal-item-label">Full Name</span>
            <span class="admin-modal-item-value"><strong>${escapeHtml(req.fullName)}</strong></span>
          </div>
          <div class="admin-modal-item">
            <span class="admin-modal-item-label">Contact Number</span>
            <span class="admin-modal-item-value"><a href="tel:${escapeHtml(req.contactNumber)}">${escapeHtml(req.contactNumber)}</a></span>
          </div>
          <div class="admin-modal-item">
            <span class="admin-modal-item-label">Email</span>
            <span class="admin-modal-item-value">${req.email ? `<a href="mailto:${escapeHtml(req.email)}">${escapeHtml(req.email)}</a>` : '—'}</span>
          </div>
          <div class="admin-modal-item">
            <span class="admin-modal-item-label">Submission Date</span>
            <span class="admin-modal-item-value">${escapeHtml(req.submissionDate || 'Recent')}</span>
          </div>
          <div class="admin-modal-item" style="grid-column: 1 / -1; margin-top: 4px;">
            <span class="admin-modal-item-label">Request Status</span>
            <select class="admin-status-dropdown" data-req-id="${escapeHtml(req.id)}" onchange="handleAdminCustomisationStatusChange('${escapeHtml(req.id)}', this.value)">
              ${CUSTOMISATION_STATUS_OPTIONS.map(opt => `
                <option value="${opt}" ${currentStatus === opt ? 'selected' : ''}>${opt}</option>
              `).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- 2. REQUEST -->
      <div class="admin-modal-section">
        <div class="admin-modal-sec-header">
          <span class="admin-modal-sec-tag">02</span>
          <h4 class="admin-modal-sec-title">REQUEST</h4>
        </div>
        <div class="admin-modal-grid-2">
          <div class="admin-modal-item">
            <span class="admin-modal-item-label">Colour</span>
            <span class="admin-modal-item-value">${escapeHtml(req.colour || 'Not specified')}</span>
          </div>
          <div class="admin-modal-item">
            <span class="admin-modal-item-label">Fabric</span>
            <span class="admin-modal-item-value">${escapeHtml(req.fabric || 'Not specified')}</span>
          </div>
          <div class="admin-modal-item">
            <span class="admin-modal-item-label">Measurements</span>
            <span class="admin-modal-item-value">${escapeHtml(req.measurements || 'Not specified')}</span>
          </div>
          <div class="admin-modal-item">
            <span class="admin-modal-item-label">Embellishments</span>
            <span class="admin-modal-item-value">${escapeHtml(req.embellishments || req.embellishment || 'Not specified')}</span>
          </div>
        </div>
        <div class="admin-modal-item" style="margin-top: 10px;">
          <span class="admin-modal-item-label">Design</span>
          <div class="admin-detail-msg-box">${escapeHtml(req.design || 'Not specified')}</div>
        </div>
        ${(req.additionalRequirements && req.additionalRequirements !== 'None') ? `
          <div class="admin-modal-item" style="margin-top: 10px;">
            <span class="admin-modal-item-label">Additional Information</span>
            <div class="admin-detail-msg-box">${escapeHtml(req.additionalRequirements)}</div>
          </div>
        ` : ''}
        ${req.referenceImage ? `
          <div class="admin-modal-item" style="margin-top: 10px;">
            <span class="admin-modal-item-label">Reference Image / Sketch</span>
            <div class="admin-cust-ref-img-wrap">📎 ${escapeHtml(req.referenceImage)}</div>
          </div>
        ` : ''}
      </div>

      <!-- 3. ORDER WORKFLOW -->
      ${isCompleted ? `
        <div class="admin-modal-section admin-modal-sec-status">
          <div class="admin-modal-sec-header">
            <span class="admin-modal-sec-tag">03</span>
            <h4 class="admin-modal-sec-title">ORDER WORKFLOW</h4>
          </div>
          ${req.orderCreated ? `
            <div class="admin-order-created-alert">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <div>
                <div style="font-weight: 700; color: #1B6E36;">Order Created</div>
                <div style="font-size: 13px; margin-top: 2px;">Associated: <strong>Order #${escapeHtml(req.orderNumber || '—')}</strong></div>
              </div>
            </div>
          ` : `
            <div class="admin-create-order-prompt">
              <p style="margin: 0 0 10px 0; font-size: 13px; color: var(--charcoal); line-height: 1.4;">
                Customisation work is marked as <strong>Completed</strong>. You can now create a customer order in the system.
              </p>
              <button type="button" class="btn-create-order-cta" onclick="handleCreateOrderFromCustomisation('${escapeHtml(req.id)}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                <span>Create Order</span>
              </button>
            </div>
          `}
        </div>
      ` : ''}
    </div>
  `;
  openAdminModal(`Customisation Request • ${escapeHtml(req.fullName)}`, content);
}

function showHelpDetailsModal(helpId) {
  const queries = getAdminHelp();
  const q = queries.find(item => item.id === helpId);
  if (!q) return;

  const status = normalizeHelpStatus(q.status);

  const content = `
    <div class="admin-detail-grid">
      <div class="admin-detail-block">
        <span class="admin-detail-label">Customer Information</span>
        <span class="admin-detail-val"><strong>${escapeHtml(q.customerName || 'Customer')}</strong></span>
      </div>
      <div class="admin-detail-block">
        <span class="admin-detail-label">Submission Date</span>
        <span class="admin-detail-val">${escapeHtml(q.submissionDate)}</span>
      </div>
      <div class="admin-detail-block">
        <span class="admin-detail-label">Email</span>
        <span class="admin-detail-val">${q.email && q.email !== '—' ? `<a href="mailto:${escapeHtml(q.email)}">${escapeHtml(q.email)}</a>` : 'Not provided'}</span>
      </div>
      <div class="admin-detail-block">
        <span class="admin-detail-label">Status</span>
        <select class="admin-status-dropdown" onchange="updateHelpStatus('${escapeHtml(q.id)}', this.value)">
          ${HELP_STATUS_OPTIONS.map(opt => `
            <option value="${opt}" ${status === opt ? 'selected' : ''}>${opt}</option>
          `).join('')}
        </select>
      </div>
      <div class="admin-detail-block admin-detail-full">
        <span class="admin-detail-label">Complete Message</span>
        <div class="admin-detail-msg-box">${escapeHtml(q.message)}</div>
      </div>
      <div class="admin-detail-block admin-detail-full" style="display: flex; justify-content: flex-end; margin-top: 14px;">
        <button type="button" class="admin-reply-btn" data-action="reply-help" data-id="${escapeHtml(q.id)}" style="padding: 7px 16px; font-size: 13px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;" aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          <span>Reply via Email</span>
        </button>
      </div>
    </div>
  `;
  openAdminModal(`Help Request • ${escapeHtml(q.customerName || 'Customer')}`, content);
}

window.updateHelpStatus = async function(id, newStatus) {
  const normalized = normalizeHelpStatus(newStatus);
  const queries = getAdminHelp();
  const q = queries.find(item => item.id === id);
  if (q) {
    q.status = normalized;
    saveAdminHelp(queries);
  }

  // Persist to Firestore
  if (window.fbDb && window.fbFns) {
    try {
      const nowIso = new Date().toISOString();
      await window.fbFns.updateDoc(
        window.fbFns.doc(window.fbDb, 'helpRequests', id),
        {
          status: normalized,
          updatedAt: window.fbFns.serverTimestamp ? window.fbFns.serverTimestamp() : nowIso
        }
      );
    } catch (err) {
      console.warn('Firestore update help request status error:', err);
    }
  }

  // Re-render Help tab
  renderAdminHelp();

  // If details modal is open for this request, refresh it
  const modal = document.getElementById('adminModalOverlay');
  if (modal && modal.style.display !== 'none') {
    showHelpDetailsModal(id);
  }
};

let adminCustomMsgDebounce = {};
let adminOrdersUnsubscribe = null;
let adminCustomisationsUnsubscribe = null;

let currentCancellingOrder = null;
let currentCancellingItem = null;
let currentCancellingType = 'order';

function openAdminCancelModal(item, itemType = 'order') {
  currentCancellingItem = item;
  currentCancellingType = itemType;
  currentCancellingOrder = item;
  const overlay = document.getElementById('adminCancelModalOverlay');
  if (!overlay) return;

  const isCustomisation = itemType === 'customisation';
  const displayNum = isCustomisation ? (item.id || '') : getDisplayOrderNumber(item);
  const custName = isCustomisation
    ? (item.fullName || item.customerName || item.name || 'Customer').trim()
    : (item.customerName || item.name || 'Customer').trim();
  const custEmail = (item.email || item.customerEmail || '').trim();
  const productName = isCustomisation
    ? (item.design || 'Customised Outfit').trim()
    : (item.product || item.productName || 'Designer Outfit').trim();

  const titleEl = document.getElementById('adminCancelModalTitle');
  const bannerStrong = overlay.querySelector('.admin-cancel-warning-banner strong');
  const bannerP = overlay.querySelector('.admin-cancel-warning-banner p');
  const numLabelEl = document.getElementById('adminCancelNumberLabel');
  const numEl = document.getElementById('adminCancelOrderNum');
  const nameEl = document.getElementById('adminCancelCustName');
  const emailEl = document.getElementById('adminCancelCustEmail');
  const prodLabelEl = document.getElementById('adminCancelProductLabel');
  const prodEl = document.getElementById('adminCancelProduct');
  const feedbackEl = document.getElementById('adminCancelFeedback');

  if (titleEl) {
    titleEl.textContent = isCustomisation ? 'Cancel Customisation Confirmation' : 'Cancel Order Confirmation';
  }
  if (bannerStrong) {
    bannerStrong.textContent = isCustomisation
      ? 'Are you sure you want to cancel this customisation request?'
      : 'Are you sure you want to cancel this order?';
  }
  if (bannerP) {
    bannerP.textContent = isCustomisation
      ? 'This will mark the customisation request as Cancelled. The customer will be informed accordingly.'
      : 'This will mark the order as Cancelled. Estimated delivery and payment details will be hidden from the customer\'s My Orders page.';
  }
  if (numLabelEl) {
    numLabelEl.textContent = isCustomisation ? 'Request Number:' : 'Order Number:';
  }
  if (numEl) numEl.textContent = isCustomisation ? `REQUEST #${displayNum}` : `ORDER #${displayNum}`;
  if (nameEl) nameEl.textContent = custName || 'Customer';
  if (emailEl) emailEl.textContent = custEmail || 'Not provided';
  if (prodLabelEl) {
    prodLabelEl.textContent = isCustomisation ? 'Design / Outfit:' : 'Product:';
  }
  if (prodEl) prodEl.textContent = productName;

  if (feedbackEl) {
    feedbackEl.style.display = 'none';
    feedbackEl.className = 'admin-cancel-feedback';
    feedbackEl.innerHTML = '';
  }

  // Reset buttons
  const btnKeep = document.getElementById('btnAdminKeepOrder');
  const btnCancelOnly = document.getElementById('btnAdminCancelOnly');
  const btnCancelEmail = document.getElementById('btnAdminCancelAndEmail');

  if (btnKeep) {
    btnKeep.disabled = false;
    btnKeep.textContent = isCustomisation ? 'Keep Request' : 'Keep Order';
  }
  if (btnCancelOnly) {
    btnCancelOnly.disabled = false;
    btnCancelOnly.textContent = isCustomisation ? 'Cancel Request' : 'Cancel Order';
  }
  if (btnCancelEmail) {
    btnCancelEmail.disabled = false;
    btnCancelEmail.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
        <polyline points="22,6 12,13 2,6"></polyline>
      </svg>
      <span>${isCustomisation ? 'Cancel Request & Send Email' : 'Cancel Order & Send Email'}</span>
    `;
  }

  overlay.style.display = 'flex';
}

function closeAdminCancelModal(revertDropdowns = false) {
  const overlay = document.getElementById('adminCancelModalOverlay');
  if (overlay) overlay.style.display = 'none';

  if (revertDropdowns && (currentCancellingItem || currentCancellingOrder)) {
    const item = currentCancellingItem || currentCancellingOrder;
    if (currentCancellingType === 'customisation') {
      const prevStatus = item.status || 'New Request';
      document.querySelectorAll(`select[data-req-id="${item.id}"]`).forEach(sel => {
        sel.value = prevStatus;
      });
    } else {
      const prevStatus = item.status || item.orderStatus || 'Processing';
      document.querySelectorAll(`select[data-order-id="${item.id}"]`).forEach(sel => {
        sel.value = prevStatus;
      });
    }
  }
  currentCancellingItem = null;
  currentCancellingOrder = null;
  currentCancellingType = 'order';
}

async function commitAdminOrderStatusChange(id, newStatus, extraData = {}) {
  const orders = getAdminOrders();
  const order = orders.find(o => o.id === id);
  if (order && (order.status || order.orderStatus || '').toLowerCase() === 'cancelled' && (order.cancelledBy || '').toLowerCase().trim() === 'customer') {
    console.warn('Cannot change status of an order cancelled by customer');
    return;
  }
  if (order) {
    order.status = newStatus;
    order.orderStatus = newStatus;
    if (extraData.cancelledBy) order.cancelledBy = extraData.cancelledBy;
    if (extraData.cancelledAt) order.cancelledAt = extraData.cancelledAt;
    if (extraData.notificationStatus) order.notificationStatus = extraData.notificationStatus;
    saveAdminOrders(orders);
  }

  // Update dropdown value in DOM if present
  document.querySelectorAll(`select[data-order-id="${id}"]`).forEach(sel => {
    if (sel.value !== newStatus) sel.value = newStatus;
  });

  // Toggle custom message wrap in table and in modal
  const adminWrap = document.getElementById(`adminCustomWrap_${id}`);
  if (adminWrap) adminWrap.style.display = newStatus === 'Other' ? 'block' : 'none';

  const modalWrap = document.getElementById(`modalCustomWrap_${id}`);
  if (modalWrap) modalWrap.style.display = newStatus === 'Other' ? 'block' : 'none';

  if (newStatus === 'Other') {
    const inp = document.getElementById(`modalCustomInput_${id}`) || document.getElementById(`adminCustomInput_${id}`);
    if (inp) setTimeout(() => inp.focus(), 60);
  }

  // Persist to Firestore
  if (window.fbDb && window.fbFns) {
    try {
      const updateData = {
        status: newStatus,
        orderStatus: newStatus,
        updatedAt: window.fbFns.serverTimestamp ? window.fbFns.serverTimestamp() : new Date().toISOString()
      };
      if (newStatus === 'Cancelled') {
        const currentBy = (order?.cancelledBy || '').toLowerCase();
        if (!currentBy || extraData.cancelledBy) {
          const nowIso = extraData.cancelledAt || new Date().toISOString();
          updateData.cancelledBy = extraData.cancelledBy || 'admin';
          updateData.cancelledAt = window.fbFns.serverTimestamp ? window.fbFns.serverTimestamp() : nowIso;
          if (order) {
            order.cancelledBy = updateData.cancelledBy;
            order.cancelledAt = nowIso;
          }
        }
        if (extraData.notificationStatus) {
          updateData.notificationStatus = extraData.notificationStatus;
          if (extraData.notificationStatus === 'sent') {
            updateData.notificationSentAt = window.fbFns.serverTimestamp ? window.fbFns.serverTimestamp() : new Date().toISOString();
          }
        }
      }
      if (order && typeof order.customMessage !== 'undefined') {
        updateData.customMessage = order.customMessage;
      }
      await window.fbFns.updateDoc(window.fbFns.doc(window.fbDb, 'orders', id), updateData);
    } catch (err) {
      console.warn('Firestore handleAdminOrderStatusChange error:', err);
    }
  }

  // Broadcast same-window event for instant local update
  window.dispatchEvent(new CustomEvent('adminOrderStatusChanged', {
    detail: { 
      id, 
      status: newStatus, 
      customMessage: order?.customMessage || '', 
      cancelledBy: order?.cancelledBy || '',
      cancelledAt: order?.cancelledAt || '',
      notificationStatus: order?.notificationStatus || ''
    }
  }));

  if (typeof renderAdminOrders === 'function') {
    renderAdminOrders();
  }
}

async function commitAdminCustomisationStatusChange(reqId, newStatus, extraData = {}) {
  const requests = getAdminCustomisations();
  const req = requests.find(r => r.id === reqId);
  if (!req) return;

  req.status = newStatus;
  if (extraData.cancelledBy) req.cancelledBy = extraData.cancelledBy;
  if (extraData.cancelledAt) req.cancelledAt = extraData.cancelledAt;
  if (extraData.notificationStatus) req.notificationStatus = extraData.notificationStatus;
  saveAdminCustomisations(requests);

  // Update dropdown value in DOM
  document.querySelectorAll(`select[data-req-id="${reqId}"]`).forEach(sel => {
    if (sel.value !== newStatus) sel.value = newStatus;
  });

  const nowIso = extraData.cancelledAt || new Date().toISOString();
  if (window.fbDb && window.fbFns) {
    try {
      const updateData = {
        status: newStatus,
        updatedAt: window.fbFns.serverTimestamp ? window.fbFns.serverTimestamp() : nowIso
      };
      if (newStatus === 'Cancelled') {
        updateData.cancelledBy = extraData.cancelledBy || 'admin';
        updateData.cancelledAt = window.fbFns.serverTimestamp ? window.fbFns.serverTimestamp() : nowIso;
        if (extraData.notificationStatus) {
          updateData.notificationStatus = extraData.notificationStatus;
          if (extraData.notificationStatus === 'sent') {
            updateData.notificationSentAt = window.fbFns.serverTimestamp ? window.fbFns.serverTimestamp() : nowIso;
          }
        }
      }
      await window.fbFns.updateDoc(
        window.fbFns.doc(window.fbDb, 'customisationRequests', reqId),
        updateData
      );
    } catch (err) {
      console.warn('Firestore update customisation status error:', err);
    }
  }

  // Broadcast event for customisation status changed
  window.dispatchEvent(new CustomEvent('adminCustomisationStatusChanged', {
    detail: {
      id: reqId,
      status: newStatus,
      cancelledBy: req.cancelledBy || '',
      cancelledAt: req.cancelledAt || '',
      notificationStatus: req.notificationStatus || ''
    }
  }));

  // Refresh customisation view
  if (typeof renderAdminCustomisation === 'function') {
    renderAdminCustomisation();
  }

  // If modal is open for this request, refresh it
  const modal = document.getElementById('adminModalOverlay');
  if (modal && modal.style.display !== 'none') {
    showCustomisationDetailsModal(reqId);
  }
}

async function executeAdminOrderCancellation(targetId, sendEmail) {
  const isCustomisation = currentCancellingType === 'customisation';
  let targetItem = null;

  if (isCustomisation) {
    const requests = getAdminCustomisations();
    targetItem = requests.find(r => r.id === targetId) || currentCancellingItem;
  } else {
    const orders = getAdminOrders();
    targetItem = orders.find(o => o.id === targetId) || currentCancellingItem;
  }

  if (!targetItem) return;

  const btnKeep = document.getElementById('btnAdminKeepOrder');
  const btnCancelOnly = document.getElementById('btnAdminCancelOnly');
  const btnCancelEmail = document.getElementById('btnAdminCancelAndEmail');
  const feedbackEl = document.getElementById('adminCancelFeedback');

  if (btnKeep) btnKeep.disabled = true;
  if (btnCancelOnly) btnCancelOnly.disabled = true;
  if (btnCancelEmail) {
    btnCancelEmail.disabled = true;
    if (sendEmail) {
      btnCancelEmail.innerHTML = `<span>Sending notification...</span>`;
    }
  }

  const nowIso = new Date().toISOString();
  const recipientEmail = isCustomisation
    ? (targetItem.email || targetItem.customerEmail || '').trim()
    : (targetItem.customerEmail || targetItem.email || '').trim();
  const customerName = isCustomisation
    ? (targetItem.fullName || targetItem.customerName || 'Customer').trim()
    : (targetItem.customerName || targetItem.name || 'Customer').trim();
  const itemNumber = isCustomisation
    ? (targetItem.orderNumber || targetItem.id || targetId)
    : getDisplayOrderNumber(targetItem);
  const productName = isCustomisation
    ? (targetItem.design || 'Customised Outfit').trim()
    : (targetItem.product || targetItem.productName || 'Designer Outfit').trim();
  const itemLabel = isCustomisation ? 'Customisation request' : 'Order';

  // If requesting email but no valid email address is found:
  if (sendEmail && (!recipientEmail || !recipientEmail.includes('@'))) {
    if (feedbackEl) {
      feedbackEl.className = 'admin-cancel-feedback error';
      feedbackEl.textContent = `No registered customer email address found for this ${isCustomisation ? 'request' : 'order'}. You can cancel without sending an email.`;
      feedbackEl.style.display = 'block';
    }
    if (btnKeep) { btnKeep.disabled = false; btnKeep.textContent = isCustomisation ? 'Keep Request' : 'Keep Order'; }
    if (btnCancelOnly) { btnCancelOnly.disabled = false; btnCancelOnly.textContent = isCustomisation ? 'Cancel Request' : 'Cancel Order'; }
    if (btnCancelEmail) {
      btnCancelEmail.disabled = true;
      btnCancelEmail.innerHTML = `<span>No Email Available</span>`;
    }
    return;
  }

  // 1. If not requesting email, immediately commit local & firestore cancellation
  if (!sendEmail) {
    if (isCustomisation) {
      await commitAdminCustomisationStatusChange(targetId, 'Cancelled', {
        cancelledBy: 'admin',
        cancelledAt: nowIso,
        notificationStatus: 'not_requested'
      });
      if (targetItem.orderId) {
        await commitAdminOrderStatusChange(targetItem.orderId, 'Cancelled', {
          cancelledBy: 'admin',
          cancelledAt: nowIso,
          notificationStatus: 'not_requested'
        });
      }
    } else {
      await commitAdminOrderStatusChange(targetId, 'Cancelled', {
        cancelledBy: 'admin',
        cancelledAt: nowIso,
        notificationStatus: 'not_requested'
      });
    }
    closeAdminCancelModal(false);
    return;
  }

  // 2. Requesting email: Call secure server-side endpoint
  let authToken = null;
  try {
    if (window.fbAuth?.currentUser) {
      authToken = await window.fbAuth.currentUser.getIdToken();
    }
  } catch (tokenErr) {
    console.warn('Could not get admin ID token:', tokenErr);
  }

  try {
    const res = await fetch('/api/admin/cancel-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        'X-Admin-Verified': 'true'
      },
      body: JSON.stringify({
        orderId: targetId,
        itemType: isCustomisation ? 'customisation' : 'order',
        sendEmail: true,
        orderData: {
          customerName,
          customerEmail: recipientEmail,
          product: productName,
          orderNumber: itemNumber
        }
      })
    });

    const data = await res.json();

    if (res.ok && data.success && data.emailSent) {
      // Both cancellation & email succeeded!
      if (isCustomisation) {
        await commitAdminCustomisationStatusChange(targetId, 'Cancelled', {
          cancelledBy: 'admin',
          cancelledAt: nowIso,
          notificationStatus: 'sent'
        });
        if (targetItem.orderId) {
          await commitAdminOrderStatusChange(targetItem.orderId, 'Cancelled', {
            cancelledBy: 'admin',
            cancelledAt: nowIso,
            notificationStatus: 'sent'
          });
        }
      } else {
        await commitAdminOrderStatusChange(targetId, 'Cancelled', {
          cancelledBy: 'admin',
          cancelledAt: nowIso,
          notificationStatus: 'sent'
        });
      }

      if (feedbackEl) {
        feedbackEl.className = 'admin-cancel-feedback success';
        feedbackEl.textContent = `✓ ${itemLabel} cancelled and notification email sent to ${recipientEmail}.`;
        feedbackEl.style.display = 'block';
      }

      setTimeout(() => {
        closeAdminCancelModal(false);
      }, 1200);
    } else {
      // Cancellation committed, but email delivery reported error
      if (isCustomisation) {
        await commitAdminCustomisationStatusChange(targetId, 'Cancelled', {
          cancelledBy: 'admin',
          cancelledAt: nowIso,
          notificationStatus: 'failed'
        });
        if (targetItem.orderId) {
          await commitAdminOrderStatusChange(targetItem.orderId, 'Cancelled', {
            cancelledBy: 'admin',
            cancelledAt: nowIso,
            notificationStatus: 'failed'
          });
        }
      } else {
        await commitAdminOrderStatusChange(targetId, 'Cancelled', {
          cancelledBy: 'admin',
          cancelledAt: nowIso,
          notificationStatus: 'failed'
        });
      }

      if (feedbackEl) {
        feedbackEl.className = 'admin-cancel-feedback error';
        feedbackEl.textContent = `${itemLabel} was cancelled, but email could not be sent: ${data.error || 'Email service unavailable'}. You can retry sending email below.`;
        feedbackEl.style.display = 'block';
      }

      if (btnCancelEmail) {
        btnCancelEmail.disabled = false;
        btnCancelEmail.innerHTML = `<span>Retry Email Notification</span>`;
      }
      if (btnKeep) {
        btnKeep.disabled = false;
        btnKeep.textContent = 'Close';
      }
    }
  } catch (netErr) {
    // Network / server connection error
    if (isCustomisation) {
      await commitAdminCustomisationStatusChange(targetId, 'Cancelled', {
        cancelledBy: 'admin',
        cancelledAt: nowIso,
        notificationStatus: 'failed'
      });
      if (targetItem.orderId) {
        await commitAdminOrderStatusChange(targetItem.orderId, 'Cancelled', {
          cancelledBy: 'admin',
          cancelledAt: nowIso,
          notificationStatus: 'failed'
        });
      }
    } else {
      await commitAdminOrderStatusChange(targetId, 'Cancelled', {
        cancelledBy: 'admin',
        cancelledAt: nowIso,
        notificationStatus: 'failed'
      });
    }

    if (feedbackEl) {
      feedbackEl.className = 'admin-cancel-feedback error';
      feedbackEl.textContent = `${itemLabel} was marked cancelled, but email request failed: ${netErr.message}. You can retry.`;
      feedbackEl.style.display = 'block';
    }

    if (btnCancelEmail) {
      btnCancelEmail.disabled = false;
      btnCancelEmail.innerHTML = `<span>Retry Email Notification</span>`;
    }
    if (btnKeep) {
      btnKeep.disabled = false;
      btnKeep.textContent = 'Close';
    }
  }
}

// Bind admin cancel modal buttons
document.getElementById('adminCancelModalCloseBtn')?.addEventListener('click', () => {
  closeAdminCancelModal(true);
});
document.getElementById('btnAdminKeepOrder')?.addEventListener('click', () => {
  closeAdminCancelModal(true);
});
document.getElementById('btnAdminCancelOnly')?.addEventListener('click', () => {
  const item = currentCancellingItem || currentCancellingOrder;
  if (item) {
    executeAdminOrderCancellation(item.id, false);
  }
});
document.getElementById('btnAdminCancelAndEmail')?.addEventListener('click', () => {
  const item = currentCancellingItem || currentCancellingOrder;
  if (item) {
    executeAdminOrderCancellation(item.id, true);
  }
});

window.handleAdminOrderStatusChange = async function(id, newStatus) {
  const orders = getAdminOrders();
  const order = orders.find(o => o.id === id);
  if (order && (order.status || order.orderStatus || '').toLowerCase() === 'cancelled' && (order.cancelledBy || '').toLowerCase().trim() === 'customer') {
    console.warn('Cannot change status of an order cancelled by customer');
    return;
  }

  // Intercept 'Cancelled' to trigger confirmation popup
  if (newStatus === 'Cancelled') {
    if (order) {
      openAdminCancelModal(order);
    }
    return;
  }

  // Normal status transition
  await commitAdminOrderStatusChange(id, newStatus);
};


window.handleAdminOrderCustomMsgChange = async function(id, customMsg) {
  const text = (customMsg || '').trim();
  const orders = getAdminOrders();
  const order = orders.find(o => o.id === id);
  if (order) {
    order.customMessage = text;
    saveAdminOrders(orders);
  }

  // Sync inputs across table and modal
  const adminInp = document.getElementById(`adminCustomInput_${id}`);
  const modalInp = document.getElementById(`modalCustomInput_${id}`);
  if (adminInp && adminInp.value !== customMsg) adminInp.value = customMsg;
  if (modalInp && modalInp.value !== customMsg) modalInp.value = customMsg;

  // Immediately dispatch event for synchronous UI sync
  window.dispatchEvent(new CustomEvent('adminOrderStatusChanged', {
    detail: { id, status: order?.status || 'Other', customMessage: text }
  }));

  // Debounced Firestore update
  if (adminCustomMsgDebounce[id]) {
    clearTimeout(adminCustomMsgDebounce[id]);
  }
  adminCustomMsgDebounce[id] = setTimeout(async () => {
    if (window.fbDb && window.fbFns) {
      try {
        await window.fbFns.updateDoc(window.fbFns.doc(window.fbDb, 'orders', id), {
          customMessage: text,
          updatedAt: window.fbFns.serverTimestamp ? window.fbFns.serverTimestamp() : new Date().toISOString()
        });
      } catch (err) {
        console.warn('Firestore handleAdminOrderCustomMsgChange error:', err);
      }
    }
  }, 250);
};

window.handleAdminCustomisationStatusChange = async function(reqId, newStatus) {
  const requests = getAdminCustomisations();
  const req = requests.find(r => r.id === reqId);
  if (!req) return;

  // Intercept 'Cancelled' to trigger confirmation popup
  if (newStatus === 'Cancelled') {
    openAdminCancelModal(req, 'customisation');
    return;
  }

  // Normal status transition
  await commitAdminCustomisationStatusChange(reqId, newStatus);
};

const activeOrderCreationLocks = new Set();

window.handleCreateOrderFromCustomisation = async function(reqId) {
  if (activeOrderCreationLocks.has(reqId)) return;
  activeOrderCreationLocks.add(reqId);

  try {
    const requests = getAdminCustomisations();
    const req = requests.find(r => r.id === reqId);
    if (!req) return;

    if (req.orderCreated || req.orderNumber) {
      alert(`An order has already been created for this request (Order #${req.orderNumber}).`);
      return;
    }

    // Generate unique 4-digit order number
    const existingOrders = getAdminOrders();
    const existingNums = new Set(existingOrders.map(o => getDisplayOrderNumber(o)));
    let displayOrderNum = '';
    for (let attempt = 0; attempt < 100; attempt++) {
      const candidate = String(Math.floor(1000 + Math.random() * 9000));
      if (!existingNums.has(candidate)) {
        displayOrderNum = candidate;
        break;
      }
    }
    if (!displayOrderNum) {
      displayOrderNum = String(Math.floor(1000 + Math.random() * 9000));
    }

    const orderDateObj = new Date();
    const dynamicDelivery = formatDynamicDeliveryDateRange(req.pinCode || '600001', req.state || 'Tamil Nadu', orderDateObj);
    const amount = req.amount || req.price || '₹1,999';
    const customerEmail = req.email || req.customerEmail || '';
    let customerUid = req.userId || '';
    if (!customerUid || customerUid === 'guest') {
      const sess = typeof getCustomerSession === 'function' ? getCustomerSession() : null;
      if (sess && sess.uid && sess.provider !== 'guest') {
        if (!customerEmail || (sess.email && sess.email.toLowerCase() === customerEmail.toLowerCase())) {
          customerUid = sess.uid;
        }
      }
    }
    if (!customerUid) {
      customerUid = window.fbAuth?.currentUser?.uid || 'guest';
    }

    const customerName = req.fullName || 'Valued Customer';
    const contactNumber = req.contactNumber || '—';
    const productName = req.design ? `Customised Outfit — ${req.design}` : 'Customised Bespoke Outfit';
    const size = req.measurements && req.measurements !== 'Not specified' ? req.measurements : 'Custom Fit';

    const orderPayload = {
      userId: customerUid,
      customerName: customerName,
      customerEmail: customerEmail,
      email: customerEmail,
      contactNumber: contactNumber,
      phone: contactNumber,
      customerPhone: contactNumber,
      product: productName,
      productName: productName,
      size: size,
      quantity: 1,
      amount: amount,
      price: amount,
      orderDate: formatOrderDisplayDate(orderDateObj),
      date: formatOrderDisplayDate(orderDateObj),
      createdAt: window.fbFns?.serverTimestamp ? window.fbFns.serverTimestamp() : orderDateObj.toISOString(),
      orderTimestamp: Date.now(),
      expectedDelivery: dynamicDelivery,
      estimatedDelivery: dynamicDelivery,
      deliveryAddress: req.address || req.deliveryAddress || (contactNumber !== '—' ? `Contact: ${contactNumber}` : 'Bespoke Order Address'),
      address: req.address || req.deliveryAddress || (contactNumber !== '—' ? `Contact: ${contactNumber}` : 'Bespoke Order Address'),
      paymentMethod: 'Custom Order (Offline/Bespoke)',
      paymentInfo: 'Custom Order (Offline/Bespoke)',
      orderStatus: 'Processing',
      status: 'Processing',
      statusMessage: '',
      customMessage: '',
      orderNumber: displayOrderNum,
      displayOrderNumber: displayOrderNum,
      customisationRequestId: req.id,
      isCustomOrder: true,
      customisationDetails: {
        colour: req.colour,
        fabric: req.fabric,
        design: req.design,
        measurements: req.measurements,
        embellishments: req.embellishments || req.embellishment
      }
    };

    let createdDocId = 'ORD-' + displayOrderNum;
    if (window.fbDb && window.fbFns) {
      try {
        const docRef = await window.fbFns.addDoc(window.fbFns.collection(window.fbDb, 'orders'), orderPayload);
        createdDocId = docRef.id;
      } catch (fsErr) {
        console.warn('Firestore addDoc order error:', fsErr);
      }
    }
    orderPayload.id = createdDocId;
    orderPayload.orderId = createdDocId;

    // Mark customisation request as orderCreated
    req.orderCreated = true;
    req.orderId = createdDocId;
    req.orderNumber = displayOrderNum;
    saveAdminCustomisations(requests);

    if (window.fbDb && window.fbFns) {
      try {
        await window.fbFns.updateDoc(
          window.fbFns.doc(window.fbDb, 'customisationRequests', req.id),
          {
            orderCreated: true,
            orderId: createdDocId,
            orderNumber: displayOrderNum,
            updatedAt: window.fbFns?.serverTimestamp ? window.fbFns.serverTimestamp() : new Date().toISOString()
          }
        );
      } catch (upErr) {
        console.warn('Firestore update customisationRequest error:', upErr);
      }
    }

    // Prepend new order to Admin orders
    const adminOrders = getAdminOrders();
    adminOrders.unshift(orderPayload);
    saveAdminOrders(adminOrders);

    // If customer is currently viewing My Orders in the same session, update live
    const sess = typeof getCustomerSession === 'function' ? getCustomerSession() : null;
    if (sess && (sess.uid === customerUid || (sess.email && customerEmail && sess.email.toLowerCase() === customerEmail.toLowerCase()))) {
      currentCustomerOrders.unshift(orderPayload);
      renderCustomerOrdersList(currentCustomerOrders);
    }

    // Re-render admin views
    renderAdminOrders();
    renderAdminCustomisation();

    // If modal is open, refresh it
    const modal = document.getElementById('adminModalOverlay');
    if (modal && modal.style.display !== 'none') {
      showCustomisationDetailsModal(req.id);
    }

    alert(`Order Created\nOrder #${displayOrderNum}`);
  } finally {
    activeOrderCreationLocks.delete(reqId);
  }
};

window.updateOrderStatus = window.handleAdminOrderStatusChange;

function setupAdminOrdersListener() {
  if (!window.fbDb || !window.fbFns) return;
  if (adminOrdersUnsubscribe) {
    try { adminOrdersUnsubscribe(); } catch (e) {}
    adminOrdersUnsubscribe = null;
  }
  try {
    adminOrdersUnsubscribe = window.fbFns.onSnapshot(
      window.fbFns.collection(window.fbDb, 'orders'),
      (snapshot) => {
        const fbOrders = [];
        snapshot.forEach(d => {
          const data = d.data();
          fbOrders.push({
            id: data.orderId || d.id,
            orderId: data.orderId || d.id,
            orderNumber: data.orderNumber || null,
            displayOrderNumber: data.displayOrderNumber || data.orderNumber || null,
            userId: data.userId || '',
            date: data.orderDate || data.date || 'Recent',
            orderDate: data.orderDate || data.date || 'Recent',
            createdAt: data.createdAt || null,
            orderTimestamp: data.orderTimestamp || null,
            customerName: data.customerName || (data.customerEmail ? data.customerEmail.split('@')[0] : 'Customer'),
            customerEmail: data.customerEmail || data.email || '',
            email: data.email || data.customerEmail || '',
            customerPhone: data.customerPhone || data.phone || data.contactNumber || '—',
            phone: data.customerPhone || data.phone || data.contactNumber || '—',
            product: data.productName || data.product || 'Designer Outfit',
            productName: data.productName || data.product || 'Designer Outfit',
            size: data.size || 'Standard',
            quantity: data.quantity || 1,
            amount: data.amount || data.price || '₹0',
            price: data.price || data.amount || '₹0',
            status: data.orderStatus || data.status || 'Processing',
            orderStatus: data.orderStatus || data.status || 'Processing',
            customMessage: data.customMessage || data.statusMessage || '',
            paymentMethod: data.paymentMethod || '',
            paymentStatus: data.paymentStatus || '',
            address: data.deliveryAddress || data.address || data.fullAddress || '—',
            deliveryAddress: data.deliveryAddress || data.address || data.fullAddress || '—',
            expectedDelivery: data.expectedDelivery || data.estimatedDelivery || '',
            estimatedDelivery: data.estimatedDelivery || data.expectedDelivery || '',
            state: data.state || '',
            pinCode: data.pinCode || '',
            cancelledBy: data.cancelledBy || '',
            cancelledAt: data.cancelledAt || null,
            customisationDetails: data.customisationDetails || null,
            customisationRequestId: data.customisationRequestId || null,
            isCustomOrder: Boolean(data.isCustomOrder || data.customisationRequestId)
          });
        });
        fbOrders.sort((a, b) => getOrderTimestamp(b) - getOrderTimestamp(a));
        saveAdminOrders(fbOrders);
        if (currentAdminTab === 'orders') {
          const active = document.activeElement;
          const isTyping = active && active.classList && active.classList.contains('admin-custom-msg-input');
          if (!isTyping) {
            renderAdminOrders();
          }
        }
      },
      (err) => {
        console.warn('Admin orders listener error:', err);
      }
    );
  } catch (err) {
    console.warn('setupAdminOrdersListener error:', err);
  }
}

function setupAdminCustomisationsListener() {
  if (!window.fbDb || !window.fbFns) return;
  if (adminCustomisationsUnsubscribe) {
    try { adminCustomisationsUnsubscribe(); } catch (e) {}
    adminCustomisationsUnsubscribe = null;
  }
  try {
    adminCustomisationsUnsubscribe = window.fbFns.onSnapshot(
      window.fbFns.collection(window.fbDb, 'customisationRequests'),
      (snapshot) => {
        if (!snapshot.empty) {
          const fbCust = [];
          snapshot.forEach(d => {
            const data = d.data();
            fbCust.push({
              id: d.id,
              fullName: data.fullName || data['Full Name'] || 'Valued Customer',
              contactNumber: data.contactNumber || data['Contact Number'] || '—',
              colour: data.colour || data['Colour'] || 'Not specified',
              fabric: data.fabric || data['Fabric'] || 'Not specified',
              design: data.design || data['Design'] || 'Not specified',
              measurements: data.measurements || data['Measurements'] || 'Not specified',
              embellishments: data.embellishments || data['Embellishments'] || data.embellishment || 'Not specified',
              additionalRequirements: data.additionalRequirements || data.additionalInformation || data['Additional Information'] || 'None',
              referenceImage: data.referenceImage || '',
              submissionDate: data.submissionDate || 'Recent',
              status: data.status || 'New Request',
              userId: data.userId || '',
              email: data.email || '',
              createdAt: data.createdAt || null,
              orderCreated: Boolean(data.orderCreated),
              orderId: data.orderId || null,
              orderNumber: data.orderNumber || null
            });
          });
          saveAdminCustomisations(fbCust);
          if (currentAdminTab === 'customisation') {
            renderAdminCustomisation();
          }
        }
      },
      (err) => {
        console.warn('Admin customisations listener error:', err);
      }
    );
  } catch (err) {
    console.warn('setupAdminCustomisationsListener error:', err);
  }
}

async function loadAdminDataFromFirestore() {
  if (!window.fbDb || !window.fbFns) return;
  try {
    const ordersSnap = await window.fbFns.getDocs(window.fbFns.collection(window.fbDb, 'orders'));
    if (!ordersSnap.empty) {
      const fbOrders = [];
      ordersSnap.forEach(d => {
        const data = d.data();
        fbOrders.push({
          id: data.orderId || d.id,
          orderId: data.orderId || d.id,
          orderNumber: data.orderNumber || null,
          displayOrderNumber: data.displayOrderNumber || data.orderNumber || null,
          userId: data.userId || '',
          date: data.orderDate || data.date || 'Recent',
          orderDate: data.orderDate || data.date || 'Recent',
          createdAt: data.createdAt || null,
          orderTimestamp: data.orderTimestamp || null,
          customerName: data.customerName || (data.customerEmail ? data.customerEmail.split('@')[0] : 'Customer'),
          customerEmail: data.customerEmail || data.email || '',
          email: data.email || data.customerEmail || '',
          customerPhone: data.customerPhone || data.phone || data.contactNumber || '—',
          phone: data.customerPhone || data.phone || data.contactNumber || '—',
          product: data.productName || data.product || 'Designer Outfit',
          productName: data.productName || data.product || 'Designer Outfit',
          size: data.size || 'Standard',
          quantity: data.quantity || 1,
          amount: data.amount || data.price || '₹0',
          price: data.price || data.amount || '₹0',
          status: data.orderStatus || data.status || 'Processing',
          orderStatus: data.orderStatus || data.status || 'Processing',
          customMessage: data.customMessage || data.statusMessage || '',
          paymentMethod: data.paymentMethod || '',
          paymentStatus: data.paymentStatus || '',
          address: data.deliveryAddress || data.address || data.fullAddress || '—',
          deliveryAddress: data.deliveryAddress || data.address || data.fullAddress || '—',
          expectedDelivery: data.expectedDelivery || data.estimatedDelivery || '',
          estimatedDelivery: data.estimatedDelivery || data.expectedDelivery || '',
          state: data.state || '',
          pinCode: data.pinCode || '',
          cancelledBy: data.cancelledBy || '',
          cancelledAt: data.cancelledAt || null,
          customisationDetails: data.customisationDetails || null,
          customisationRequestId: data.customisationRequestId || null,
          isCustomOrder: Boolean(data.isCustomOrder || data.customisationRequestId)
        });
      });
      fbOrders.sort((a, b) => getOrderTimestamp(b) - getOrderTimestamp(a));
      saveAdminOrders(fbOrders);
      if (currentAdminTab === 'orders') renderAdminOrders();
    }
  } catch (e) {
    console.warn('Admin load orders error:', e);
  }

  try {
    const custSnap = await window.fbFns.getDocs(window.fbFns.collection(window.fbDb, 'customisationRequests'));
    if (!custSnap.empty) {
      const fbCust = [];
      custSnap.forEach(d => {
        const data = d.data();
        fbCust.push({
          id: d.id,
          fullName: data.fullName || data['Full Name'] || 'Valued Customer',
          contactNumber: data.contactNumber || data['Contact Number'] || '—',
          colour: data.colour || data['Colour'] || 'Not specified',
          fabric: data.fabric || data['Fabric'] || 'Not specified',
          design: data.design || data['Design'] || 'Not specified',
          measurements: data.measurements || data['Measurements'] || 'Not specified',
          embellishments: data.embellishments || data['Embellishments'] || data.embellishment || 'Not specified',
          additionalRequirements: data.additionalRequirements || data.additionalInformation || data['Additional Information'] || 'None',
          referenceImage: data.referenceImage || '',
          submissionDate: data.submissionDate || 'Recent',
          status: data.status || 'New Request',
          userId: data.userId || '',
          email: data.email || '',
          createdAt: data.createdAt || null,
          orderCreated: Boolean(data.orderCreated),
          orderId: data.orderId || null,
          orderNumber: data.orderNumber || null
        });
      });
      saveAdminCustomisations(fbCust);
      if (currentAdminTab === 'customisation') renderAdminCustomisation();
    }
  } catch (e) {
    console.warn('Admin load customisations error:', e);
  }

  try {
    const helpSnap = await window.fbFns.getDocs(window.fbFns.collection(window.fbDb, 'helpRequests'));
    if (!helpSnap.empty) {
      const fbHelp = [];
      helpSnap.forEach(d => {
        const data = d.data();
        fbHelp.push({
          id: d.id,
          customerName: data.customerName || 'Customer',
          email: data.email || '—',
          message: data.message || '',
          submissionDate: data.submissionDate || 'Recent',
          status: normalizeHelpStatus(data.status || 'Not Resolved')
        });
      });
      saveAdminHelp(fbHelp);
      if (currentAdminTab === 'help') renderAdminHelp();
    }
  } catch (e) {
    console.warn('Admin load help error:', e);
  }
}

function openAdminModal(title, html) {
  const overlay = document.getElementById('adminModalOverlay');
  const titleEl = document.getElementById('adminModalTitle');
  const bodyEl = document.getElementById('adminModalBody');
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.innerHTML = html;
  if (overlay) overlay.style.display = 'flex';
  updateModalLockState();
}

function closeAdminModal() {
  const overlay = document.getElementById('adminModalOverlay');
  if (overlay) overlay.style.display = 'none';
  updateModalLockState();
}

let currentReplyHelpId = null;

function extractQueryTopic(q) {
  if (!q) return 'recent';

  // Combine query and message fields
  let text = [q.query, q.subject, q.topic, q.title, q.message].filter(Boolean).join(' ').trim();
  if (!text) return 'recent';

  // 1. Check for slug/code formats like "Help-Inquiry-Bridal-Fittings-1791462360109"
  const slugRegex = /(?:^(?:help|inquiry|customer|query|ticket)[-_][a-zA-Z0-9\-_]+|[a-zA-Z]+(?:-[a-zA-Z]+)+-\d+)/i;
  const slugMatch = text.match(slugRegex);
  if (slugMatch) {
    let slugTopic = slugMatch[0]
      .replace(/-\d+$/, '')
      .replace(/^(?:help|inquiry|customer|query|ticket)[-_]+/i, '')
      .replace(/[-_]+/g, ' ')
      .trim()
      .toLowerCase();

    // Specific slug normalizations
    if (/bridal.*outfit.*size/i.test(slugTopic)) return 'bridal outfit sizing';
    if (/cotton.*fabric/i.test(slugTopic)) return 'cotton fabric';
    if (/bridal.*fitting/i.test(slugTopic)) return 'bridal fittings';
    if (slugTopic.length > 2 && !/\d/.test(slugTopic)) {
      return slugTopic.replace(/\s+(?:enquiry|inquiry)$/i, '');
    }
  }

  const lower = text.toLowerCase();

  // 2. High-signal studio/store topic patterns matching requested examples
  if (/(?:bridal|wedding).*(?:outfit\s+)?(?:sizes?|sizing)/i.test(lower)) {
    return 'bridal outfit sizing';
  }
  if (/(?:bridal|wedding).*(?:fitting|appointment)|(?:fitting|appointment).*(?:bridal|wedding)/i.test(lower)) {
    return 'bridal fittings';
  }
  if (/cotton\s+(?:fabrics?|materials?)/i.test(lower)) {
    return 'cotton fabric';
  }
  if (/silk\s+(?:fabrics?|sarees?|materials?)/i.test(lower)) {
    return 'silk fabric';
  }
  if (/(?:custom\s+tailored?\s+blouse|fabric.*blouse|blouse\s+tailoring)/i.test(lower)) {
    return 'custom blouse tailoring';
  }
  if (/international\s+shipping/i.test(lower)) {
    return 'international shipping';
  }
  if (/(?:bridal|wedding)\s+(?:wear|lehenga|couture|collection)/i.test(lower)) {
    return 'bridal wear';
  }
  if (/(?:custom\s+tailoring|custom\s+stitching|tailoring\s+process)/i.test(lower)) {
    return 'custom tailoring';
  }
  if (/(?:send.*fabric|fabric\s+material)/i.test(lower)) {
    return 'fabric tailoring';
  }
  if (/(?:shipping|delivery|dispatch)/i.test(lower)) {
    return 'order delivery';
  }
  if (/fitting\s+appointment/i.test(lower)) {
    return 'fitting appointment';
  }
  if (/(?:size|sizing|measurements?)/i.test(lower)) {
    return 'sizing and measurements';
  }

  // 3. Natural language fallback: clean sentence & strip conversational filler and IDs
  let cleaned = text
    .replace(/\b(?:HELP|REQ|ORD|ID)?[-_]?\d{3,}\b/gi, '') // Remove IDs / timestamps
    .replace(/#\d+/g, '')
    .replace(/^(?:hello|hi|dear|hey|greetings)(?:\s+[\w\s]+)?[\,\.\-\!\:]*\s*/i, '')
    .replace(/^(?:i\s+(?:would\s+like|want)\s+to\s+(?:know|inquire|ask)|can\s+(?:i|you)|please\s+(?:let\s+me\s+know|confirm|tell\s+me)|i\s+placed\s+an\s+enquiry\s+for|inquiry\s+regarding|question\s+about)\s+/i, '')
    .trim();

  // Extract first 2-5 words of the core query
  const words = cleaned.split(/\s+/).filter(w => w.length > 0 && !/^\d+$/.test(w));
  if (words.length > 0) {
    let candidate = words.slice(0, Math.min(4, words.length)).join(' ').toLowerCase();
    candidate = candidate.replace(/[^\w\s\-]/g, '').replace(/\s+(?:enquiry|inquiry)$/i, '').trim();
    if (candidate.length >= 3) {
      return candidate;
    }
  }

  return 'recent';
}

function generateHelpEmailSubject(q) {
  const topic = extractQueryTopic(q);
  return `Update on your ${topic} enquiry`;
}

function openAdminReplyModal(helpId) {
  const queries = getAdminHelp();
  const q = queries.find(item => item.id === helpId);
  if (!q) return;

  currentReplyHelpId = helpId;
  const overlay = document.getElementById('adminReplyModalOverlay');
  const recipientInput = document.getElementById('adminReplyRecipient');
  const subjectInput = document.getElementById('adminReplySubject');
  const messageTextarea = document.getElementById('adminReplyMessage');
  const feedbackEl = document.getElementById('adminReplyFeedback');

  const customerEmail = (q.email && q.email !== '—' && q.email !== 'Not provided') ? q.email : '';
  if (recipientInput) recipientInput.value = customerEmail;
  if (subjectInput) subjectInput.value = generateHelpEmailSubject(q);
  if (messageTextarea) {
    messageTextarea.value = `Dear ${q.customerName || 'Customer'},\n\nThank you for reaching out to Jayashree Help Centre.\n\n\n\nBest regards,\nJayashree`;
  }
  if (feedbackEl) {
    feedbackEl.style.display = 'none';
    feedbackEl.textContent = '';
    feedbackEl.className = 'admin-reply-feedback';
  }

  if (overlay) overlay.style.display = 'flex';
  updateModalLockState();

  setTimeout(() => {
    if (recipientInput && !recipientInput.value) {
      recipientInput.focus();
    } else if (messageTextarea) {
      messageTextarea.focus();
      const pos = messageTextarea.value.indexOf('\n\n\n') + 2;
      if (pos > 1) {
        messageTextarea.setSelectionRange(pos, pos);
      }
    }
  }, 60);
}

function closeAdminReplyModal() {
  const overlay = document.getElementById('adminReplyModalOverlay');
  if (overlay) overlay.style.display = 'none';
  currentReplyHelpId = null;
  updateModalLockState();
}

// Navigation Tab Click Listeners
document.getElementById('adminTabOrders')?.addEventListener('click', () => switchAdminTab('orders'));
document.getElementById('adminTabCustomisation')?.addEventListener('click', () => switchAdminTab('customisation'));
document.getElementById('adminTabHelp')?.addEventListener('click', () => switchAdminTab('help'));

// Modal Close Listeners
document.getElementById('adminModalCloseBtn')?.addEventListener('click', closeAdminModal);
document.getElementById('adminModalOverlay')?.addEventListener('click', (e) => {
  const replyBtn = e.target.closest('[data-action="reply-help"]');
  if (replyBtn) {
    const id = replyBtn.dataset.id;
    closeAdminModal();
    openAdminReplyModal(id);
    return;
  }
  if (e.target.id === 'adminModalOverlay') closeAdminModal();
});

// Reply Modal Listeners
document.getElementById('adminReplyModalCloseBtn')?.addEventListener('click', closeAdminReplyModal);
document.getElementById('adminReplyCancelBtn')?.addEventListener('click', closeAdminReplyModal);
document.getElementById('adminReplyModalOverlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'adminReplyModalOverlay') closeAdminReplyModal();
});

// Send via Gmail Listener
document.getElementById('adminReplySendGmailBtn')?.addEventListener('click', () => {
  const recipientInput = document.getElementById('adminReplyRecipient');
  const subjectInput = document.getElementById('adminReplySubject');
  const messageTextarea = document.getElementById('adminReplyMessage');
  const feedbackEl = document.getElementById('adminReplyFeedback');

  const to = (recipientInput?.value || '').trim();
  const subject = (subjectInput?.value || '').trim();
  const message = messageTextarea?.value || '';

  if (!to) {
    if (feedbackEl) {
      feedbackEl.textContent = 'Please enter the customer\'s email address.';
      feedbackEl.className = 'admin-reply-feedback error';
      feedbackEl.style.display = 'block';
    }
    recipientInput?.focus();
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    if (feedbackEl) {
      feedbackEl.textContent = 'Please enter a valid email address.';
      feedbackEl.className = 'admin-reply-feedback error';
      feedbackEl.style.display = 'block';
    }
    recipientInput?.focus();
    return;
  }

  // Hide any previous error banner
  if (feedbackEl) {
    feedbackEl.style.display = 'none';
    feedbackEl.textContent = '';
  }

  // Target the designerjayashree9@gmail.com account in Gmail
  const senderAccount = 'designerjayashree9@gmail.com';
  const gmailUrl = `https://mail.google.com/mail/u/${encodeURIComponent(senderAccount)}/?view=cm&fs=1&authuser=${encodeURIComponent(senderAccount)}&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  window.open(gmailUrl, '_blank', 'noopener,noreferrer');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAdminModal();
    closeAdminReplyModal();
    closeAdminCancelModal(true);
  }
});

// Card Action Delegation
document.querySelector('.admin-main-card')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if (action === 'view-order') showOrderDetailsModal(id);
  else if (action === 'view-customisation') showCustomisationDetailsModal(id);
  else if (action === 'view-help') showHelpDetailsModal(id);
  else if (action === 'reply-help') openAdminReplyModal(id);
});

// Admin Login Form
const adminLoginForm = document.getElementById('adminLoginForm');
if (adminLoginForm) {
  adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(adminLoginForm);
    const email = (fd.get('email') || '').trim();
    const password = fd.get('password') || '';
    const errEl = document.getElementById('adminError');
    if (errEl) errEl.classList.remove('show');

    if (!email || !password) {
      if (errEl) {
        errEl.textContent = 'Please enter email and password.';
        errEl.classList.add('show');
      }
      return;
    }

    try {
      if (!window.fbAuth || !window.fbFns) {
        throw new Error('Authentication service not initialized');
      }

      const cred = await window.fbFns.signInWithEmailAndPassword(window.fbAuth, email, password);
      const user = cred.user;

      // Authorisation check: must be in admins collection or known admin email
      let isAuthorized = (
        email === 'designerjayashree9@gmail.com' ||
        email === 'admin@jayashreefashion.com' ||
        email === 'admin@example.com'
      );
      if (!isAuthorized && window.fbDb) {
        try {
          const adminDocSnap = await window.fbFns.getDoc(window.fbFns.doc(window.fbDb, 'admins', user.uid));
          if (adminDocSnap.exists()) isAuthorized = true;
        } catch (authErr) {
          console.warn('Admin check lookup failed:', authErr);
        }
      }

      if (!isAuthorized) {
        await window.fbFns.signOut(window.fbAuth);
        if (errEl) {
          errEl.textContent = 'Access denied: You do not have administrator permissions.';
          errEl.classList.add('show');
        }
        return;
      }

      sessionStorage.setItem('jayashree_admin_logged', 'true');
      showAdminDashboard();
      await loadAdminDataFromFirestore();
    } catch (err) {
      console.error('Admin login error:', err);
      if (errEl) {
        let msg = 'Invalid admin credentials.';
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
          msg = 'Incorrect admin email or password.';
        } else if (err.code === 'auth/user-not-found') {
          msg = 'No admin account found with this email.';
        }
        errEl.textContent = msg;
        errEl.classList.add('show');
      }
    }
  });
}

// Admin Logout
const adminLogoutBtn = document.getElementById('adminLogoutBtn');
if (adminLogoutBtn) {
  adminLogoutBtn.addEventListener('click', async () => {
    sessionStorage.removeItem('jayashree_admin_logged');
    if (adminOrdersUnsubscribe) {
      try { adminOrdersUnsubscribe(); } catch (e) {}
      adminOrdersUnsubscribe = null;
    }
    if (window.fbAuth && window.fbFns) {
      try { await window.fbFns.signOut(window.fbAuth); } catch (e) {}
    }
    showAdminLogin();
  });
}

let confirmResolve = null;
function showConfirm(title, message, okLabel, onOk, danger = false) {
  const titleEl = document.getElementById('confirmTitle');
  const msgEl = document.getElementById('confirmMessage');
  const okBtn = document.getElementById('confirmOk');
  const overlay = document.getElementById('confirmOverlay');

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (okBtn) {
    okBtn.textContent = okLabel;
    okBtn.classList.toggle('danger', !!danger);
  }
  if (overlay) overlay.classList.add('open');
  updateModalLockState();

  confirmResolve = { onOk };
}

const confirmCancelBtn = document.getElementById('confirmCancel');
if (confirmCancelBtn) {
  confirmCancelBtn.addEventListener('click', () => {
    const overlay = document.getElementById('confirmOverlay');
    if (overlay) overlay.classList.remove('open');
    updateModalLockState();
    confirmResolve = null;
  });
}

const confirmOkBtn = document.getElementById('confirmOk');
if (confirmOkBtn) {
  confirmOkBtn.addEventListener('click', async () => {
    const overlay = document.getElementById('confirmOverlay');
    if (overlay) overlay.classList.remove('open');
    updateModalLockState();
    if (confirmResolve && confirmResolve.onOk) {
      try { await confirmResolve.onOk(); } catch (e) { console.error(e); }
    }
    confirmResolve = null;
  });
}

currentPath = parseHash().path;
if (!location.hash) {
  location.hash = '#/';
}
navigate();

if (window.history.state && window.history.state.popup === 'collection') {
  openCollectionPopup(true, false);
}

// Explicit window exports for module helpers
window.updatePaymentMethodUI = updatePaymentMethodUI;
window.handleCheckoutSubmit = handleCheckoutSubmit;
window.executeOrderPayment = executeOrderPayment;
window.openCheckoutModal = openCheckoutModal;
window.closeCheckoutModal = closeCheckoutModal;
window.setCustomerSession = setCustomerSession;
window.showAdminDashboard = showAdminDashboard;
window.loadAdminDataFromFirestore = loadAdminDataFromFirestore;
window.switchAdminTab = switchAdminTab;
window.renderCustomerOrdersList = renderCustomerOrdersList;
window.openAuthModal = openAuthModal;

// ==========================================================================
// JAYASHREE RULE-BASED FASHION CHATBOT INITIALIZATION
// ==========================================================================
function initJayashreeChatbot() {
  const launcherBtn = document.getElementById('chatbotLauncherBtn');
  const drawer = document.getElementById('chatbotDrawer');
  const closeBtn = document.getElementById('chatbotCloseBtn');
  const form = document.getElementById('chatbotForm');
  const input = document.getElementById('chatbotInput');
  const messagesContainer = document.getElementById('chatbotMessages');
  const chipsContainer = document.getElementById('chatbotChips');
  const msgIcon = launcherBtn?.querySelector('.chatbot-icon-msg');
  const closeIcon = launcherBtn?.querySelector('.chatbot-icon-close');

  if (!launcherBtn || !drawer || !form || !input || !messagesContainer) {
    return;
  }

  let isOpen = false;

  function toggleChatbot(forceState) {
    isOpen = typeof forceState === 'boolean' ? forceState : !isOpen;
    if (isOpen) {
      drawer.style.display = 'flex';
      if (msgIcon) msgIcon.style.display = 'none';
      if (closeIcon) closeIcon.style.display = 'block';
      launcherBtn.setAttribute('aria-expanded', 'true');
      input.focus();
      scrollChatToBottom();
    } else {
      drawer.style.display = 'none';
      if (msgIcon) msgIcon.style.display = 'block';
      if (closeIcon) closeIcon.style.display = 'none';
      launcherBtn.setAttribute('aria-expanded', 'false');
    }
  }

  function scrollChatToBottom() {
    setTimeout(() => {
      const body = document.getElementById('chatbotBody');
      if (body) {
        body.scrollTop = body.scrollHeight;
      }
    }, 20);
  }

  function scrollChatToLatestExchange(userMsgEl, botMsgEl) {
    const body = document.getElementById('chatbotBody');
    if (!body) return;

    requestAnimationFrame(() => {
      setTimeout(() => {
        if (userMsgEl && botMsgEl) {
          const bodyRect = body.getBoundingClientRect();
          const userRect = userMsgEl.getBoundingClientRect();
          const botRect = botMsgEl.getBoundingClientRect();

          const userAbsoluteTop = userRect.top - bodyRect.top + body.scrollTop;
          const botAbsoluteBottom = botRect.bottom - bodyRect.top + body.scrollTop;
          const exchangeHeight = botAbsoluteBottom - userAbsoluteTop;
          const viewportHeight = body.clientHeight;

          if (exchangeHeight <= viewportHeight) {
            // Both customer question and bot reply fit inside visible height
            body.scrollTop = Math.max(0, userAbsoluteTop - 10);
          } else {
            // Exchange is taller than viewport: position customer question near top
            // so customer reads from the start of the reply without scrolling up
            body.scrollTop = Math.max(0, userAbsoluteTop - 10);
          }
        } else if (botMsgEl) {
          const bodyRect = body.getBoundingClientRect();
          const botRect = botMsgEl.getBoundingClientRect();
          const botAbsoluteTop = botRect.top - bodyRect.top + body.scrollTop;
          body.scrollTop = Math.max(0, botAbsoluteTop - 10);
        } else {
          body.scrollTop = body.scrollHeight;
        }
      }, 30);
    });
  }

  function formatBotText(text) {
    if (!text) return '';
    // Format bold **text** -> <strong>text</strong>
    let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Format [label](url) -> internal hash link or external target="_blank"
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, href) => {
      if (href.startsWith('#')) {
        return `<a href="${href}" class="chat-link chat-link-hash">${label}</a>`;
      }
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="chat-link">${label}</a>`;
    });
    // Format markdown code `code` -> <code>code</code>
    html = html.replace(/`([^`]+)`/g, '<span style="font-family: monospace; background: rgba(0,0,0,0.06); padding: 1px 4px; border-radius: 4px;">$1</span>');
    // Split into paragraphs / lines
    const paragraphs = html.split('\n\n').filter(Boolean);
    return paragraphs.map(para => {
      const lines = para.split('\n');
      const listItems = lines.filter(l => l.trim().startsWith('•') || /^\d+\./.test(l.trim()));
      if (listItems.length > 0 && listItems.length === lines.length) {
        return `<ul style="margin: 4px 0 6px 16px; padding: 0;">` +
          lines.map(l => `<li>${l.replace(/^[•\d\.]+\s*/, '')}</li>`).join('') +
          `</ul>`;
      }
      return `<p style="margin: 0 0 6px;">${lines.join('<br>')}</p>`;
    }).join('');
  }

  function appendMessage(sender, text) {
    const msgEl = document.createElement('div');
    msgEl.className = `chat-msg ${sender === 'user' ? 'user-msg' : 'bot-msg'}`;
    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'chat-msg-bubble';

    if (sender === 'user') {
      const p = document.createElement('p');
      p.textContent = text;
      bubbleEl.appendChild(p);
    } else {
      bubbleEl.innerHTML = formatBotText(text);
    }

    msgEl.appendChild(bubbleEl);
    messagesContainer.appendChild(msgEl);
    if (sender === 'user') {
      scrollChatToBottom();
    }
    return msgEl;
  }

  const clientChatHistory = [];

  function showTypingIndicator() {
    const typingEl = document.createElement('div');
    typingEl.className = 'chat-msg bot-msg chat-typing-msg';
    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'chat-msg-bubble chat-typing-bubble';
    bubbleEl.innerHTML = '<span class="chat-typing-dot"></span><span class="chat-typing-dot"></span><span class="chat-typing-dot"></span>';
    typingEl.appendChild(bubbleEl);
    messagesContainer.appendChild(typingEl);
    scrollChatToBottom();
    return typingEl;
  }

  function removeTypingIndicator(typingEl) {
    if (typingEl && typingEl.parentNode) {
      typingEl.parentNode.removeChild(typingEl);
    }
  }

  async function handleUserInput(questionText) {
    const q = (questionText || input.value || '').trim();
    if (!q) return;

    const userMsgEl = appendMessage('user', q);
    input.value = '';
    clientChatHistory.push({ role: 'user', content: q });

    // 1. Evaluate deterministic rule-based response first (0ms latency, zero API cost)
    let evaluation = null;
    try {
      evaluation = evaluateRuleChatbot(q);
    } catch (err) {
      console.error('Chatbot rule evaluation error:', err);
    }

    const isDeterministicSuccess = evaluation && 
      evaluation.intent && 
      evaluation.intent !== 'fashion_query_unavailable' && 
      evaluation.intent !== 'unrecognized_refusal';

    if (isDeterministicSuccess) {
      setTimeout(() => {
        const botMsgEl = appendMessage('bot', evaluation.answer);
        clientChatHistory.push({ role: 'assistant', content: evaluation.answer });
        scrollChatToLatestExchange(userMsgEl, botMsgEl);
      }, 80);
      return;
    }

    // 2. For queries needing AI or authenticated order assistance, call secure backend endpoint
    const typingEl = showTypingIndicator();
    let authToken = null;
    try {
      if (window.fbAuth?.currentUser) {
        authToken = await window.fbAuth.currentUser.getIdToken();
      }
    } catch (tokenErr) {
      console.warn('Could not retrieve Firebase auth token for chatbot:', tokenErr);
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          message: q,
          history: clientChatHistory.slice(-4)
        })
      });

      removeTypingIndicator(typingEl);

      if (res.ok) {
        const data = await res.json();
        const replyText = data.answer || evaluation?.answer || "I'm here to help with Jayashree's collections and policies. How can I assist you?";
        const botMsgEl = appendMessage('bot', replyText);
        clientChatHistory.push({ role: 'assistant', content: replyText });
        scrollChatToLatestExchange(userMsgEl, botMsgEl);
      } else {
        const fallbackText = evaluation?.answer || "I'm sorry, I'm currently unable to process your request. Please visit our [Help Centre](#/help) or contact us at +91 9177976293.";
        const botMsgEl = appendMessage('bot', fallbackText);
        clientChatHistory.push({ role: 'assistant', content: fallbackText });
        scrollChatToLatestExchange(userMsgEl, botMsgEl);
      }
    } catch (networkErr) {
      console.warn('Chatbot backend request failed, using local rule fallback:', networkErr);
      removeTypingIndicator(typingEl);
      const fallbackText = evaluation?.answer || "I'm sorry, that information isn't available on our website. Please contact the Jayashree team for assistance.";
      const botMsgEl = appendMessage('bot', fallbackText);
      clientChatHistory.push({ role: 'assistant', content: fallbackText });
      scrollChatToLatestExchange(userMsgEl, botMsgEl);
    }
  }

  launcherBtn.addEventListener('click', () => toggleChatbot());
  closeBtn?.addEventListener('click', () => toggleChatbot(false));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleUserInput();
  });

  chipsContainer?.addEventListener('click', (e) => {
    const chip = e.target.closest('.chat-chip');
    if (chip) {
      const q = chip.getAttribute('data-question');
      if (q) {
        handleUserInput(q);
      }
    }
  });

  // Auto-minimize chatbot on mobile when customer navigates to internal page (e.g. Help Centre)
  messagesContainer.addEventListener('click', (e) => {
    const hashLink = e.target.closest('.chat-link-hash');
    if (hashLink) {
      if (window.innerWidth <= 768) {
        toggleChatbot(false);
      }
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      toggleChatbot(false);
    }
  });

  // Expose for verification and testing
  window.askJayashreeBot = evaluateRuleChatbot;
  window.resetJayashreeChatbotState = resetConversationState;
  window.toggleJayashreeChatbot = toggleChatbot;
}

initJayashreeChatbot();

