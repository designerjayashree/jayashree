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

  // Reset button state
  const submitBtn = document.getElementById('checkoutSubmitBtn');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>Buy Now</span>';
  }

  overlay.classList.add('open');
  document.body.classList.add('popup-open');
}

function closeCheckoutModal() {
  const overlay = document.getElementById('checkoutModalOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.classList.remove('popup-open');
  document.body.style.paddingRight = '';
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
      const stateVal = stateInput ? stateInput.value.trim() : '';
      const pinVal = pinInput ? pinInput.value.trim() : '';

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

/**
 * Simulated Payment Gateway Trigger
 * ---------------------------------
 * NOTE: Frontend-only phase. In production, this function will initialize
 * the real Razorpay checkout options (key, amount, order_id, handler callback).
 * Currently executes a placeholder simulated payment flow.
 */
function processPaymentSimulation(orderPayload, onSuccess, onError) {
  setTimeout(() => {
    const simulatedResponse = {
      paymentId: 'pay_sim_' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      status: 'success'
    };
    onSuccess(simulatedResponse);
  }, 700);
}

let pendingOrderCheckout = null;

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

  updateCheckoutSummaryFields();
}

function executeOrderPayment(orderPayload) {
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
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Processing payment...</span>';
  }

  processPaymentSimulation(orderPayload, async (paymentResponse) => {
    // Show Payment Success View
    if (deliveryView) deliveryView.style.display = 'none';
    if (successView) successView.style.display = 'block';

    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const orderId = `JF-${randomSuffix}`;
    const orderIdEl = document.getElementById('confirmOrderId');
    const productEl = document.getElementById('confirmProduct');
    const sizeEl = document.getElementById('confirmSize');
    const amountEl = document.getElementById('confirmAmount');
    const addrEl = document.getElementById('confirmAddress');
    const emailEl = document.getElementById('confirmEmailDisplay');

    const customer = typeof getCustomerSession === 'function' ? getCustomerSession() : null;
    const currentUser = window.fbAuth?.currentUser;
    const finalEmail = currentUser?.email || customer?.email || orderPayload.email || '';
    const finalUid = currentUser?.uid || customer?.uid || 'guest';
    const formattedPrice = formatPrice(orderPayload.purchase?.price);

    if (orderIdEl) orderIdEl.textContent = `#${orderId}`;
    if (productEl) productEl.textContent = orderPayload.purchase?.design || 'Designer Outfit';
    if (sizeEl) sizeEl.textContent = orderPayload.purchase?.size || 'Standard';
    if (amountEl) amountEl.textContent = formattedPrice;
    if (addrEl) addrEl.textContent = orderPayload.formattedAddress;
    if (emailEl) emailEl.textContent = finalEmail;
    const confirmEstimateEl = document.getElementById('confirmEstimate');
    if (confirmEstimateEl && orderPayload.estimatedDelivery) {
      confirmEstimateEl.textContent = orderPayload.estimatedDelivery;
    }

    const firestoreOrder = {
      orderId: orderId,
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
      paymentStatus: 'Paid',
      orderStatus: 'Processing',
      status: 'Processing',
      paymentMethod: 'Prepaid / Online',
      razorpayOrderId: 'sim_ord_' + randomSuffix,
      razorpayPaymentId: paymentResponse?.paymentId || ('pay_sim_' + randomSuffix),
      razorpaySignature: 'sim_sig_' + randomSuffix,
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      createdAt: window.fbFns?.serverTimestamp ? window.fbFns.serverTimestamp() : new Date().toISOString(),
      updatedAt: window.fbFns?.serverTimestamp ? window.fbFns.serverTimestamp() : new Date().toISOString()
    };

    if (window.fbDb && window.fbFns) {
      try {
        await window.fbFns.setDoc(window.fbFns.doc(window.fbDb, 'orders', orderId), firestoreOrder);
      } catch (err) {
        console.warn('Firestore setDoc order error:', err);
      }

      // Store/update authenticated user's email in Firestore for future order confirmation emails through Resend
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

    console.log(`[Order Confirmation] Resend email target set to: ${finalEmail} for order ${orderId}`);

    try {
      const currentAdminOrders = getAdminOrders();
      currentAdminOrders.unshift({
        id: orderId,
        date: firestoreOrder.date,
        customerName: firestoreOrder.customerName,
        customerEmail: finalEmail,
        customerPhone: '—',
        product: firestoreOrder.productName,
        size: firestoreOrder.size,
        quantity: 1,
        amount: formattedPrice,
        status: 'Processing',
        paymentMethod: 'Online',
        address: orderPayload.formattedAddress
      });
      saveAdminOrders(currentAdminOrders);
    } catch (e) {}

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Buy Now</span>';
    }
  });
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

function handleBack() {
  const { path } = parseHash();

  if (sessionStorage.getItem('openedFromMobileMenu') === 'true') {
    sessionStorage.removeItem('openedFromMobileMenu');
    const origin = sessionStorage.getItem('mobileMenuOriginRoute') || '#/';
    sessionStorage.removeItem('mobileMenuOriginRoute');
    isNavigatingBack = true;
    if (appHistory.length > 1) {
      appHistory.pop();
    }
    if (window.location.hash !== origin) {
      window.location.hash = origin;
    }
    openMobileMenu();
    return;
  }

  if (sessionStorage.getItem('openedFromViewCollection') === 'true') {
    isNavigatingBack = true;
    if (appHistory.length > 1) {
      appHistory.pop();
    }
    const origin = sessionStorage.getItem('viewCollectionOriginRoute') || '#/';
    if (window.location.hash !== origin) {
      window.location.hash = origin;
    }
    navigate();
    return;
  }

  if (path === '/customisation') {
    handleCustomisationBack();
    return;
  }
  if (appHistory.length > 1) {
    appHistory.pop();
    const prevRoute = appHistory.pop();
    isNavigatingBack = true;
    window.location.hash = prevRoute || '#/';
  } else {
    window.location.hash = '#/';
  }
}
window.handleBack = handleBack;

document.addEventListener('click', (e) => {
  const backBtn = e.target.closest('.back-home');
  if (backBtn) {
    e.preventDefault();
    handleBack();
  }
});

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

  if (pageKey === 'home' && sessionStorage.getItem('openedFromViewCollection') === 'true') {
    sessionStorage.removeItem('openedFromViewCollection');
    sessionStorage.removeItem('viewCollectionOriginRoute');
    openCollectionPopup(true);
  }
  if (path !== '/' && !['/women', '/kids', '/bridal', '/ethnic', '/western'].includes(path)) {
    sessionStorage.removeItem('openedFromViewCollection');
    sessionStorage.removeItem('viewCollectionOriginRoute');
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
            <h3 class="summary-design">${design}</h3>
            ${price ? `<div class="summary-price">${price}</div>` : ''}
            
            <div style="margin-top: 24px; text-align: left; max-width: 400px; margin-left: auto; margin-right: auto;">
              <div class="details-label" style="margin-bottom: 8px;">Size</div>
              <div class="size-chips" id="custom-size-chips" style="margin-bottom: 20px;">
                ${itemSizes.map(s => `<button type="button" class="size-chip ${size === s ? 'active' : ''}" onclick="selectCustomSize('${s}')">${s}</button>`).join('')}
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

    const payload = {
      fullName,
      contactNumber,
      colour: (formData.get('colour') || '').trim(),
      fabric: (formData.get('fabric') || '').trim(),
      design: (formData.get('design') || '').trim(),
      measurements: (formData.get('measurements') || '').trim(),
      embellishments: (formData.get('embellishment') || '').trim(),
      additionalRequirements: (formData.get('requirements') || '').trim(),
      referenceImage: '',
      status: 'New Request',
      createdAt: null
    };

    const submitBtn = form.querySelector('.form-submit button');
    const originalText = submitBtn ? submitBtn.innerHTML : 'Submit Enquiry';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Submitting...';
    }

    try {
      if (window.fbDb && window.fbFns) {
        await window.fbFns.addDoc(window.fbFns.collection(window.fbDb, 'customisationRequests'), {
          ...payload,
          createdAt: window.fbFns.serverTimestamp()
        });
        await window.fbFns.addDoc(window.fbFns.collection(window.fbDb, 'enquiries'), {
          ...payload,
          createdAt: window.fbFns.serverTimestamp()
        });
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
    helpForm.style.display = 'none';
    if (helpSuccess) {
      helpSuccess.style.display = 'block';
    }
    saveLocalHelp(val);

    const customer = typeof getCustomerSession === 'function' ? getCustomerSession() : null;
    const helpPayload = {
      customerName: customer ? customer.name || 'Customer' : 'Website Customer',
      email: customer ? customer.email || '—' : '—',
      message: val,
      submissionDate: new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'Open',
      createdAt: window.fbFns?.serverTimestamp ? window.fbFns.serverTimestamp() : new Date().toISOString()
    };
    if (window.fbDb && window.fbFns) {
      try {
        await window.fbFns.addDoc(window.fbFns.collection(window.fbDb, 'helpRequests'), helpPayload);
      } catch (err) {
        console.warn('Firestore help request write error:', err);
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

function openCollectionPopup(instant = false) {
  const sw = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.paddingRight = sw + 'px';
  if (instant) {
    popupOverlay.style.transition = 'none';
    const popupCard = popupOverlay.querySelector('.category-popup');
    if (popupCard) popupCard.style.transition = 'none';
  }
  popupOverlay.classList.add('open');
  document.body.classList.add('popup-open');
  if (instant) {
    requestAnimationFrame(() => {
      popupOverlay.style.transition = '';
      const popupCard = popupOverlay.querySelector('.category-popup');
      if (popupCard) popupCard.style.transition = '';
    });
  }
}

function closeCollectionPopup(instant = false) {
  if (instant) {
    popupOverlay.style.transition = 'none';
    const popupCard = popupOverlay.querySelector('.category-popup');
    if (popupCard) popupCard.style.transition = 'none';
  }
  popupOverlay.classList.remove('open');
  document.body.classList.remove('popup-open');
  document.body.style.paddingRight = '';
  if (instant) {
    requestAnimationFrame(() => {
      popupOverlay.style.transition = '';
      const popupCard = popupOverlay.querySelector('.category-popup');
      if (popupCard) popupCard.style.transition = '';
    });
  }
}

if (openPopupBtn) openPopupBtn.addEventListener('click', () => openCollectionPopup(false));
if (popupClose) popupClose.addEventListener('click', () => closeCollectionPopup(false));
if (popupOverlay) {
  popupOverlay.addEventListener('click', (e) => { if (e.target === popupOverlay) closeCollectionPopup(false); });
}
popupCats.forEach(cat => {
  cat.addEventListener('click', (e) => {
    e.preventDefault();
    const targetRoute = cat.getAttribute('href') || cat.dataset.route;
    if (!targetRoute) return;

    sessionStorage.removeItem('openedFromMobileMenu');
    sessionStorage.removeItem('mobileMenuOriginRoute');
    sessionStorage.setItem('openedFromViewCollection', 'true');
    sessionStorage.setItem('viewCollectionOriginRoute', '#/');

    closeCollectionPopup(true);
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
  if (e.key === 'Escape' && popupOverlay && popupOverlay.classList.contains('open')) closeCollectionPopup(false);
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
        navAvatar.innerHTML = `<img src="${customer.photoURL}" alt="${displayName}" class="nav-profile-img">`;
      } else {
        navAvatar.innerHTML = `<span class="nav-profile-initial" id="navProfileInitial">${initial}</span>`;
      }
    }

    if (mobileLabel) mobileLabel.textContent = 'Account';
    if (authUserEmail) authUserEmail.textContent = customer.email;
    if (authUserInitials) authUserInitials.textContent = initial;
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
  if (fromBuyNow) {
    if (authFormView) authFormView.style.display = 'block';
    if (authUserView) authUserView.style.display = 'none';
    const prefillEmail = pendingOrderCheckout?.email || (customer && customer.email) || '';
    if (authEmailInput && prefillEmail) {
      authEmailInput.value = prefillEmail;
    }
  } else {
    if (customer && customer.email && customer.provider !== 'guest') {
      if (authFormView) authFormView.style.display = 'none';
      if (authUserView) authUserView.style.display = 'block';
    } else {
      if (authFormView) authFormView.style.display = 'block';
      if (authUserView) authUserView.style.display = 'none';
    }
  }

  const sw = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.paddingRight = sw + 'px';
  authModalOverlay.classList.add('open');
  document.body.classList.add('popup-open');

  if (authEmailInput && authFormView.style.display !== 'none') {
    setTimeout(() => authEmailInput.focus(), 150);
  }
}

function closeAuthModal() {
  if (!authModalOverlay) return;
  authModalOverlay.classList.remove('open');
  const checkoutOverlay = document.getElementById('checkoutModalOverlay');
  if (!checkoutOverlay || !checkoutOverlay.classList.contains('open')) {
    document.body.classList.remove('popup-open');
    document.body.style.paddingRight = '';
  }
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
updateAuthUI();

/* =========================================================
   ADMIN LOGIC (SIMPLE DASHBOARD - SKETCH SPEC)
   ========================================================= */

const DEFAULT_ADMIN_ORDERS = [
  {
    id: 'JAY-1048',
    customerName: 'Priya Sharma',
    customerEmail: 'priya.sharma@example.com',
    customerPhone: '+91 98200 12345',
    product: 'Raw Silk Bridal Anarkali',
    size: 'M',
    quantity: 1,
    amount: '₹18,500',
    date: '28 Sep 2026',
    status: 'Processing',
    address: 'Flat 402, Green Meadows, Anna Nagar, Chennai 600040',
    paymentMethod: 'Prepaid (UPI)'
  },
  {
    id: 'JAY-1047',
    customerName: 'Ananya Reddy',
    customerEmail: 'ananya.r@example.com',
    customerPhone: '+91 98490 23456',
    product: 'Embroidered Organza Kurta Set',
    size: 'L',
    quantity: 2,
    amount: '₹14,800',
    date: '26 Sep 2026',
    status: 'Shipped',
    address: '12, Jubilee Hills, Hyderabad 500033',
    paymentMethod: 'Credit Card (HDFC)'
  },
  {
    id: 'JAY-1046',
    customerName: 'Meera Nair',
    customerEmail: 'meera.nair@example.com',
    customerPhone: '+91 97455 34567',
    product: 'Zari Handloom Kanjeevaram Saree',
    size: 'Free Size',
    quantity: 1,
    amount: '₹34,000',
    date: '24 Sep 2026',
    status: 'Delivered',
    address: '7A, Skyline Apts, Panampilly Nagar, Kochi 682036',
    paymentMethod: 'Net Banking'
  },
  {
    id: 'JAY-1045',
    customerName: 'Dr. Pooja Chawla',
    customerEmail: 'pooja.c@example.com',
    customerPhone: '+91 98111 45678',
    product: 'Velvet Festive Kurta with Dupatta',
    size: 'S',
    quantity: 1,
    amount: '₹11,200',
    date: '22 Sep 2026',
    status: 'Delivered',
    address: 'C-14, Vasant Vihar, New Delhi 110057',
    paymentMethod: 'Prepaid (UPI)'
  },
  {
    id: 'JAY-1044',
    customerName: 'Tanvi Patel',
    customerEmail: 'tanvi.p@example.com',
    customerPhone: '+91 99099 56789',
    product: 'Mirror Work Georgette Lehenga',
    size: 'M',
    quantity: 1,
    amount: '₹26,500',
    date: '19 Sep 2026',
    status: 'Confirmed',
    address: '801, Riviera Heights, Bodakdev, Ahmedabad 380054',
    paymentMethod: 'Debit Card'
  }
];

const DEFAULT_ADMIN_CUSTOMISATIONS = [
  {
    id: 'CUST-304',
    fullName: 'Kavitha Sundaram',
    contactNumber: '+91 98765 43210',
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
    colour: 'Mustard Yellow with Rani Pink border',
    fabric: 'Pure Kanjeevaram Pattu Silk with soft cotton inner lining',
    design: 'Traditional South Indian Pattu Pavadai skirt and matching blouse for 6-year-old child',
    measurements: 'Chest: 24, Skirt Length: 28, Waist: 22',
    embellishments: 'Delicate zari border work, no sharp sequins for comfort',
    additionalRequirements: 'Temple festival by 20 Oct 2026. Extra fabric inside hem for future alterations.',
    referenceImage: '',
    submissionDate: '21 Sep 2026',
    status: 'Quotation Sent'
  }
];

const DEFAULT_ADMIN_HELP = [
  {
    id: 'HELP-201',
    customerName: 'Sneha Pillai',
    email: 'sneha.pillai@example.com',
    message: 'Hello, I placed an enquiry for custom bridal wear 2 days ago. Could you please confirm if you have availability for a fitting appointment in Chennai this weekend?',
    submissionDate: '29 Sep 2026, 11:30 AM',
    status: 'Pending Reply'
  },
  {
    id: 'HELP-200',
    customerName: 'Rajesh Gupta',
    email: 'rajesh.g@example.com',
    message: 'Hi team, I would like to know if international shipping to Dubai is available for ready-to-wear kurtas, and how many days it typically takes.',
    submissionDate: '27 Sep 2026, 04:15 PM',
    status: 'Resolved'
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
  try {
    const saved = localStorage.getItem('jayashree_orders_store');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  localStorage.setItem('jayashree_orders_store', JSON.stringify(DEFAULT_ADMIN_ORDERS));
  return DEFAULT_ADMIN_ORDERS;
}

function saveAdminOrders(orders) {
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
    if (saved) return JSON.parse(saved);
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
    status: 'Pending Reply'
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

  const isLoggedIn = sessionStorage.getItem('jayashree_admin_logged') === 'true';
  if (isLoggedIn) {
    showAdminDashboard();
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
      <div class="admin-section-header">
        <div class="admin-section-title">Orders</div>
        <div class="admin-section-count">0 Orders</div>
      </div>
      <p style="text-align: center; color: var(--muted); padding: 40px 0;">No customer orders found.</p>
    `;
    return;
  }

  container.innerHTML = `
    <div class="admin-section-header">
      <div class="admin-section-title">Orders</div>
      <div class="admin-section-count">${orders.length} ${orders.length === 1 ? 'Order' : 'Orders'}</div>
    </div>
    <div class="admin-table-wrapper">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Product & Size</th>
            <th>Qty</th>
            <th>Amount</th>
            <th>Date</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(order => `
            <tr>
              <td>
                <div class="admin-customer-name">${escapeHtml(order.customerName)}</div>
                <div class="admin-customer-sub">${escapeHtml(order.id)}</div>
              </td>
              <td>
                <div class="admin-product-title">${escapeHtml(order.product)}</div>
                <div class="admin-product-meta">Size: <strong>${escapeHtml(order.size)}</strong></div>
              </td>
              <td><strong>${order.quantity}</strong></td>
              <td><strong style="color: var(--espresso);">${escapeHtml(order.amount)}</strong></td>
              <td>${escapeHtml(order.date)}</td>
              <td>
                <span class="admin-status-pill admin-status-${order.status.toLowerCase()}">${escapeHtml(order.status)}</span>
              </td>
              <td>
                <button type="button" class="admin-view-btn" data-action="view-order" data-id="${order.id}">Details</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

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
      ${requests.map(req => `
        <div class="admin-item-card">
          <div class="admin-card-top">
            <div class="admin-card-header-left">
              <div class="admin-card-person-name">${escapeHtml(req.fullName)}</div>
              <div class="admin-card-contact-sub"><a href="tel:${escapeHtml(req.contactNumber)}" style="color: inherit; text-decoration: none;">📞 ${escapeHtml(req.contactNumber)}</a></div>
            </div>
            <span class="admin-status-pill admin-status-new">${escapeHtml(req.status)}</span>
          </div>
          <div class="admin-card-grid-info">
            <div class="admin-info-item">
              <span class="admin-info-label">🎨 Colour</span>
              <span class="admin-info-value">${escapeHtml(req.colour || 'Not specified')}</span>
            </div>
            <div class="admin-info-item">
              <span class="admin-info-label">🧵 Fabric</span>
              <span class="admin-info-value">${escapeHtml(req.fabric || 'Not specified')}</span>
            </div>
            <div class="admin-info-item">
              <span class="admin-info-label">📐 Measurements</span>
              <span class="admin-info-value">${escapeHtml(req.measurements || 'Not specified')}</span>
            </div>
            <div class="admin-info-item">
              <span class="admin-info-label">✨ Embellishments</span>
              <span class="admin-info-value">${escapeHtml(req.embellishments || req.embellishment || 'Not specified')}</span>
            </div>
          </div>
          <div class="admin-message-preview"><strong>👗 Design:</strong> ${escapeHtml(req.design || 'Not specified')}</div>
          <div class="admin-card-bottom">
            <span class="admin-card-date">Submitted: ${escapeHtml(req.submissionDate)} • ${escapeHtml(req.id)}${req.referenceImage ? ' • 📎 Image attached' : ''}</span>
            <button type="button" class="admin-view-btn" data-action="view-customisation" data-id="${req.id}">View Complete Request</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderAdminHelp() {
  const container = document.getElementById('adminHelpContent');
  if (!container) return;

  const queries = getAdminHelp();
  if (queries.length === 0) {
    container.innerHTML = `
      <div class="admin-section-header">
        <div class="admin-section-title">Help Centre Requests</div>
        <div class="admin-section-count">0 Queries</div>
      </div>
      <p style="text-align: center; color: var(--muted); padding: 40px 0;">No customer help requests received yet.</p>
    `;
    return;
  }

  container.innerHTML = `
    <div class="admin-section-header">
      <div class="admin-section-title">Help Centre Requests</div>
      <div class="admin-section-count">${queries.length} ${queries.length === 1 ? 'Query' : 'Queries'}</div>
    </div>
    <div class="admin-card-list">
      ${queries.map(q => `
        <div class="admin-item-card">
          <div class="admin-card-top">
            <div class="admin-card-header-left">
              <div class="admin-card-person-name">${escapeHtml(q.customerName || 'Customer')}</div>
              <div class="admin-card-contact-sub">${escapeHtml(q.email || 'No email provided')}</div>
            </div>
            <span class="admin-status-pill admin-status-${q.status === 'Resolved' ? 'resolved' : 'pending'}">${escapeHtml(q.status)}</span>
          </div>
          <div class="admin-message-preview">${escapeHtml(q.message)}</div>
          <div class="admin-card-bottom">
            <span class="admin-card-date">Submitted: ${escapeHtml(q.submissionDate)} • ${escapeHtml(q.id)}</span>
            <button type="button" class="admin-view-btn" data-action="view-help" data-id="${q.id}">Read Full Message</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function showOrderDetailsModal(orderId) {
  const orders = getAdminOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  const content = `
    <div class="admin-detail-grid">
      <div class="admin-detail-block">
        <span class="admin-detail-label">Order Number</span>
        <span class="admin-detail-val"><strong>${escapeHtml(order.id)}</strong></span>
      </div>
      <div class="admin-detail-block">
        <span class="admin-detail-label">Order Date</span>
        <span class="admin-detail-val">${escapeHtml(order.date)}</span>
      </div>
      <div class="admin-detail-block">
        <span class="admin-detail-label">Customer Name</span>
        <span class="admin-detail-val"><strong>${escapeHtml(order.customerName)}</strong></span>
      </div>
      <div class="admin-detail-block">
        <span class="admin-detail-label">Contact Email</span>
        <span class="admin-detail-val"><a href="mailto:${escapeHtml(order.customerEmail)}">${escapeHtml(order.customerEmail)}</a></span>
      </div>
      <div class="admin-detail-block">
        <span class="admin-detail-label">Phone</span>
        <span class="admin-detail-val"><a href="tel:${escapeHtml(order.customerPhone)}">${escapeHtml(order.customerPhone)}</a></span>
      </div>
      <div class="admin-detail-block">
        <span class="admin-detail-label">Order Status</span>
        <select class="admin-status-dropdown" onchange="updateOrderStatus('${order.id}', this.value)">
          <option value="New" ${order.status === 'New' ? 'selected' : ''}>New</option>
          <option value="Confirmed" ${order.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
          <option value="Processing" ${order.status === 'Processing' ? 'selected' : ''}>Processing</option>
          <option value="Shipped" ${order.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
          <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
        </select>
      </div>
      <div class="admin-detail-block admin-detail-full">
        <span class="admin-detail-label">Shipping Address</span>
        <span class="admin-detail-val">${escapeHtml(order.address)}</span>
      </div>
      <div class="admin-detail-block">
        <span class="admin-detail-label">Product Name</span>
        <span class="admin-detail-val"><strong>${escapeHtml(order.product)}</strong></span>
      </div>
      <div class="admin-detail-block">
        <span class="admin-detail-label">Size & Quantity</span>
        <span class="admin-detail-val">Size: ${escapeHtml(order.size)} (Qty: ${order.quantity})</span>
      </div>
      <div class="admin-detail-block">
        <span class="admin-detail-label">Payment Method</span>
        <span class="admin-detail-val">${escapeHtml(order.paymentMethod)}</span>
      </div>
      <div class="admin-detail-block">
        <span class="admin-detail-label">Total Amount</span>
        <span class="admin-detail-val"><strong style="font-size: 16px; color: var(--espresso);">${escapeHtml(order.amount)}</strong></span>
      </div>
    </div>
  `;
  openAdminModal(`Order #${order.id} Details`, content);
}

function showCustomisationDetailsModal(reqId) {
  const requests = getAdminCustomisations();
  const req = requests.find(r => r.id === reqId);
  if (!req) return;

  const content = `
    <div class="admin-detail-grid">
      <div class="admin-detail-block">
        <span class="admin-detail-label">Full Name</span>
        <span class="admin-detail-val"><strong>${escapeHtml(req.fullName)}</strong></span>
      </div>
      <div class="admin-detail-block">
        <span class="admin-detail-label">Submission Date</span>
        <span class="admin-detail-val">${escapeHtml(req.submissionDate)}</span>
      </div>
      <div class="admin-detail-block">
        <span class="admin-detail-label">Contact Number</span>
        <span class="admin-detail-val"><a href="tel:${escapeHtml(req.contactNumber)}">${escapeHtml(req.contactNumber)}</a></span>
      </div>
      <div class="admin-detail-block">
        <span class="admin-detail-label">Request Status</span>
        <select class="admin-status-dropdown" onchange="updateCustomisationStatus('${req.id}', this.value)">
          <option value="New Request" ${req.status === 'New Request' ? 'selected' : ''}>New Request</option>
          <option value="In Review" ${req.status === 'In Review' ? 'selected' : ''}>In Review</option>
          <option value="Quotation Sent" ${req.status === 'Quotation Sent' ? 'selected' : ''}>Quotation Sent</option>
          <option value="Completed" ${req.status === 'Completed' ? 'selected' : ''}>Completed</option>
        </select>
      </div>
      <div class="admin-detail-block">
        <span class="admin-detail-label">🎨 Colour</span>
        <span class="admin-detail-val">${escapeHtml(req.colour || 'Not specified')}</span>
      </div>
      <div class="admin-detail-block">
        <span class="admin-detail-label">🧵 Fabric</span>
        <span class="admin-detail-val">${escapeHtml(req.fabric || 'Not specified')}</span>
      </div>
      <div class="admin-detail-block admin-detail-full">
        <span class="admin-detail-label">👗 Design</span>
        <div class="admin-detail-msg-box">${escapeHtml(req.design || 'Not specified')}</div>
      </div>
      <div class="admin-detail-block admin-detail-full">
        <span class="admin-detail-label">📐 Measurements</span>
        <div class="admin-detail-msg-box">${escapeHtml(req.measurements || 'Not specified')}</div>
      </div>
      <div class="admin-detail-block admin-detail-full">
        <span class="admin-detail-label">✨ Embellishments</span>
        <div class="admin-detail-msg-box">${escapeHtml(req.embellishments || req.embellishment || 'Not specified')}</div>
      </div>
      <div class="admin-detail-block admin-detail-full">
        <span class="admin-detail-label">Additional Information</span>
        <div class="admin-detail-msg-box">${escapeHtml(req.additionalRequirements || 'None')}</div>
      </div>
      ${req.referenceImage ? `
        <div class="admin-detail-block admin-detail-full">
          <span class="admin-detail-label">Reference Image / Sketch</span>
          <span class="admin-detail-val">📎 ${escapeHtml(req.referenceImage)}</span>
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
        <select class="admin-status-dropdown" onchange="updateHelpStatus('${q.id}', this.value)">
          <option value="Pending Reply" ${q.status === 'Pending Reply' ? 'selected' : ''}>Pending Reply</option>
          <option value="Resolved" ${q.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
        </select>
      </div>
      <div class="admin-detail-block admin-detail-full">
        <span class="admin-detail-label">Complete Message</span>
        <div class="admin-detail-msg-box">${escapeHtml(q.message)}</div>
      </div>
    </div>
  `;
  openAdminModal(`Help Request • ${escapeHtml(q.customerName || 'Customer')}`, content);
}

window.updateOrderStatus = async function(id, newStatus) {
  const orders = getAdminOrders();
  const order = orders.find(o => o.id === id);
  if (order) {
    order.status = newStatus;
    order.orderStatus = newStatus;
    saveAdminOrders(orders);
    renderAdminOrders();
  }
  if (window.fbDb && window.fbFns) {
    try {
      await window.fbFns.updateDoc(window.fbFns.doc(window.fbDb, 'orders', id), {
        status: newStatus,
        orderStatus: newStatus,
        updatedAt: window.fbFns.serverTimestamp()
      });
    } catch (err) {
      console.warn('Firestore updateOrderStatus error:', err);
    }
  }
};

window.updateCustomisationStatus = async function(id, newStatus) {
  const items = getAdminCustomisations();
  const item = items.find(i => i.id === id);
  if (item) {
    item.status = newStatus;
    saveAdminCustomisations(items);
    renderAdminCustomisation();
  }
  if (window.fbDb && window.fbFns) {
    try {
      await window.fbFns.updateDoc(window.fbFns.doc(window.fbDb, 'customisationRequests', id), {
        status: newStatus,
        updatedAt: window.fbFns.serverTimestamp()
      });
    } catch (err) {
      console.warn('Firestore updateCustomisationStatus error:', err);
    }
  }
};

window.updateHelpStatus = async function(id, newStatus) {
  const items = getAdminHelp();
  const item = items.find(i => i.id === id);
  if (item) {
    item.status = newStatus;
    saveAdminHelp(items);
    renderAdminHelp();
  }
  if (window.fbDb && window.fbFns) {
    try {
      await window.fbFns.updateDoc(window.fbFns.doc(window.fbDb, 'helpRequests', id), {
        status: newStatus,
        updatedAt: window.fbFns.serverTimestamp()
      });
    } catch (err) {
      console.warn('Firestore updateHelpStatus error:', err);
    }
  }
};

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
          date: data.date || 'Recent',
          customerName: data.customerName || (data.customerEmail ? data.customerEmail.split('@')[0] : 'Customer'),
          customerEmail: data.customerEmail || '',
          customerPhone: data.customerPhone || '—',
          product: data.productName || data.product || 'Designer Outfit',
          size: data.size || 'Standard',
          quantity: data.quantity || 1,
          amount: data.amount || data.price || '₹0',
          status: data.orderStatus || data.status || 'Processing',
          paymentMethod: data.paymentMethod || 'Online',
          address: data.address || data.fullAddress || '—'
        });
      });
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
          fullName: data.fullName || 'Valued Customer',
          contactNumber: data.contactNumber || '—',
          colour: data.colour || 'Not specified',
          fabric: data.fabric || 'Not specified',
          design: data.design || 'Not specified',
          measurements: data.measurements || 'Not specified',
          embellishments: data.embellishments || 'Not specified',
          additionalRequirements: data.additionalRequirements || 'None',
          referenceImage: data.referenceImage || '',
          submissionDate: data.submissionDate || 'Recent',
          status: data.status || 'New Request'
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
          status: data.status || 'Open'
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
}

function closeAdminModal() {
  const overlay = document.getElementById('adminModalOverlay');
  if (overlay) overlay.style.display = 'none';
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Navigation Tab Click Listeners
document.getElementById('adminTabOrders')?.addEventListener('click', () => switchAdminTab('orders'));
document.getElementById('adminTabCustomisation')?.addEventListener('click', () => switchAdminTab('customisation'));
document.getElementById('adminTabHelp')?.addEventListener('click', () => switchAdminTab('help'));

// Modal Close Listeners
document.getElementById('adminModalCloseBtn')?.addEventListener('click', closeAdminModal);
document.getElementById('adminModalOverlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'adminModalOverlay') closeAdminModal();
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
      let isAuthorized = (email === 'designerjayashree9@gmail.com' || email === 'admin@jayashreefashion.com');
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

  confirmResolve = { onOk };
}

const confirmCancelBtn = document.getElementById('confirmCancel');
if (confirmCancelBtn) {
  confirmCancelBtn.addEventListener('click', () => {
    const overlay = document.getElementById('confirmOverlay');
    if (overlay) overlay.classList.remove('open');
    confirmResolve = null;
  });
}

const confirmOkBtn = document.getElementById('confirmOk');
if (confirmOkBtn) {
  confirmOkBtn.addEventListener('click', async () => {
    const overlay = document.getElementById('confirmOverlay');
    if (overlay) overlay.classList.remove('open');
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
