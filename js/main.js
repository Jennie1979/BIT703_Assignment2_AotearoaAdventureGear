/* ============================================================================
   main.js — E-commerce functionality (4+ features)

   Features included:
   1) Homepage: Bootstrap Featured Products carousel initialisation
   2) Homepage: “Fancy” floating Back-to-top anchor (show/hide + smooth scroll)
   3) Checkout: Shipping offer — FREE shipping automatically when subtotal >= $600
      (also updates summary totals across cart/shipping/payment pages)
   4) Shop page: Live product search/filter (filters product grid as you type)
   BONUS (optional): Cart page qty changes + remove item recalculates totals

   This file uses:
   - data-page on <body> (home/shop/cart/shipping/payment)
   - Bootstrap bundle already loaded (for Carousel)
   ========================================================================== */

(() => {
  "use strict";

  /* ----------------------------- Utilities -------------------------------- */

  const SHIPPING_FREE_THRESHOLD = 600;
  const NEXT_DAY_COST = 20;
  const TAX_RATE = 0.03; // simple demo tax (3%). Adjust or set to 0 if you prefer.

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const parseMoney = (text) => {
    // Reads "$1,234" or "1234" -> number
    if (!text) return 0;
    const cleaned = String(text).replace(/[^0-9.]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  };

  const formatMoney = (n) => {
        const num = Number(n) || 0;
    return `$${num.toFixed(2)}`;
  };

  const clampInt = (value, min = 1, max = 999) => {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  };

  /* ----------------------- Summary Totals (Checkout) ----------------------- */
  /**
   * To allow JS to update totals, add these data attributes to your summary:
   *   <span data-summary-subtotal>$600</span>
   *   <span data-summary-shipping>FREE</span>
   *   <span data-summary-taxes>$13</span>
   *   <span data-summary-total>$613</span>
   *
   * Optional (for shipping offer message):
   *   <div id="shipping-offer" class="small text-muted"></div>
   */

  function setSummaryValues({ subtotal, shipping, taxes, total }) {
    const subtotalEl = $("[data-summary-subtotal]");
    const shippingEl = $("[data-summary-shipping]");
    const taxesEl = $("[data-summary-taxes]");
    const totalEl = $("[data-summary-total]");

    if (subtotalEl) subtotalEl.textContent = formatMoney(subtotal);
    if (shippingEl) shippingEl.textContent = shipping === 0 ? "FREE" : formatMoney(shipping);
    if (taxesEl) taxesEl.textContent = formatMoney(taxes);
    if (totalEl) totalEl.textContent = formatMoney(total);
  }

  function computeTaxes(subtotal) {
    // Simple tax example. If you don’t want tax, return 0.
    return Math.round(subtotal * TAX_RATE * 100) / 100;
  }

  function computeCheckoutTotals({ subtotal, shippingCost }) {
    const taxes = computeTaxes(subtotal);
    const total = subtotal + shippingCost + taxes;
    return { subtotal, shipping: shippingCost, taxes, total };
  }

  /* --------------------------- Cart Calculations --------------------------- */
  /**
   * This works two ways:
   * A) If your cart item rows contain data-price on the row (recommended), e.g.
   *    <div class="cart-item" data-price="300">
   *      <input class="qty-input" ...>
   *      <button class="btn-remove">Remove</button>
   *    </div>
   *
   * B) If you’re using the earlier template from us, it will try to read:
   *    - price text inside the item block (first $...)
   *    - quantity input (type=number)
   */

  function readCartSubtotalFromDOM() {
    // Try recommended structure first:
    const itemRows = $$(".cart-item");

    if (itemRows.length) {
      return itemRows.reduce((sum, row) => {
        const price = parseMoney(row.dataset.price);
        const qtyInput = $(".qty-input", row) || $('input[type="number"]', row);
        const qty = clampInt(qtyInput ? qtyInput.value : 1);
        return sum + price * qty;
      }, 0);
    }

    // Fallback: parse from the cart page structure you already have
    const possibleRows = $$('[aria-label^="Quantity for"], input[aria-label^="Quantity for"]').map(
      (input) => input.closest(".d-flex") || input.closest(".border-bottom") || input.parentElement
    );

    const uniqueRows = Array.from(new Set(possibleRows)).filter(Boolean);

    if (!uniqueRows.length) return 0;

    return uniqueRows.reduce((sum, row) => {
      const priceText = (row.textContent.match(/\$[0-9,.]+/) || [null])[0];
      const price = parseMoney(priceText);
      const qtyInput = $('input[type="number"]', row);
      const qty = clampInt(qtyInput ? qtyInput.value : 1);
      return sum + price * qty;
    }, 0);
  }

  function updateCheckoutSummaryForCurrentPage(shippingCost = 0) {
    const subtotal = readCartSubtotalFromDOM() || parseMoney($("[data-summary-subtotal]")?.textContent);
    const totals = computeCheckoutTotals({ subtotal, shippingCost });
    setSummaryValues(totals);
    return totals;
  }

  /* --------------------- Feature 1: Homepage Carousel ---------------------- */
  function initHomeCarousel() {
    const carouselEl = $("#featuredCarousel");
    if (!carouselEl || !window.bootstrap?.Carousel) return;

    const carousel = new window.bootstrap.Carousel(carouselEl, {
      interval: 4500,
      ride: "carousel",
      pause: "hover",
      touch: true
    });

    // Optional: keyboard controls
    carouselEl.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") carousel.prev();
      if (e.key === "ArrowRight") carousel.next();
    });
  }

  /* -------- Feature 2: Fancy Floating Back-to-top Anchor (Home) ----------- */
  function initFloatingAnchor() {
    const anchor = $(".floating-anchor-link");
      if (!anchor) return;

    const toggle = () => {
      const show = window.scrollY > 320;
      anchor.classList.toggle("is-visible", show);
    };

    toggle();
    window.addEventListener("scroll", toggle, { passive: true });

    anchor.addEventListener("click", (e) => {
      // Smooth scroll to top section
      e.preventDefault();
      const topTarget = $("#top") || document.body;
      topTarget.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  /* -------- Feature 3: Shipping Offer (Free over $600) + Totals ----------- */
  function initShippingOffer() {
    // Only run on shipping/payment/cart pages (where totals matter)
    const page = document.body?.dataset?.page;
   if (page !== "shipping") return;

    // Shipping radios (from our template)
    const freeRadio = $("#shipFree");
    const nextDayRadio = $("#shipNextDay");

    const offerEl = $("#shipping-offer");
    const showOfferMessage = (subtotal) => {
      if (!offerEl) return;
      if (subtotal >= SHIPPING_FREE_THRESHOLD) {
        offerEl.textContent = `Offer applied: Free shipping unlocked for orders over ${formatMoney(SHIPPING_FREE_THRESHOLD)}.`;
      } else {
        const remaining = SHIPPING_FREE_THRESHOLD - subtotal;
        offerEl.textContent = `Spend ${formatMoney(remaining)} more to unlock free shipping over ${formatMoney(SHIPPING_FREE_THRESHOLD)}.`;
      }
    };

    const computeShippingCost = (subtotal) => {
      // Auto FREE if threshold reached, regardless of chosen option (matches your requirement)
      if (subtotal >= SHIPPING_FREE_THRESHOLD) return 0;

      // Otherwise follow the selection (if present)
      if (nextDayRadio && nextDayRadio.checked) return NEXT_DAY_COST;
      return 0;
    };

    const recalc = () => {
      const subtotal = readCartSubtotalFromDOM() || parseMoney($("[data-summary-subtotal]")?.textContent);
      const shippingCost = computeShippingCost(subtotal);

      // If offer triggers, force “Free Shipping” radio visually
      if (subtotal >= SHIPPING_FREE_THRESHOLD) {
        if (freeRadio) freeRadio.checked = true;
      }

      showOfferMessage(subtotal);
      const totals = computeCheckoutTotals({ subtotal, shippingCost });
      setSummaryValues(totals);
    };

    // Run once on load
    recalc();

    // Recalc when shipping option changes
    if (freeRadio) freeRadio.addEventListener("change", recalc);
    if (nextDayRadio) nextDayRadio.addEventListener("change", recalc);

    // Recalc when cart qty changes (on cart page)
    $$('input[type="number"]').forEach((input) => {
      input.addEventListener("input", recalc);
      input.addEventListener("change", recalc);
    });
  }

  /* -------- Feature 4: Shop Live Search Filter (Shop page) --------------- */
  function initShopSearchFilter() {
    const page = document.body?.dataset?.page;
    if (page !== "shop") return;

    // Use your search bar input (either one)
    const searchInput =
      $('input[type="search"][aria-label="Search products"]') ||
      $('input[type="search"]');

    if (!searchInput) return;

    // Target product cards
    const cards = $$(".product-card");
    if (!cards.length) return;

    const getCardText = (card) => {
      // Use product name text inside card
      const title = $("h6, h5, h3", card);
      const bodyText = card.textContent || "";
      return (title?.textContent || bodyText).trim().toLowerCase();
    };

    const filter = () => {
      const q = searchInput.value.trim().toLowerCase();

      cards.forEach((card) => {
        const text = getCardText(card);
        const match = !q || text.includes(q);
        // Hide the column wrapper if present
        const col = card.closest(".col-12, .col-sm-6, .col-md-4, .col-lg-3") || card;
        col.style.display = match ? "" : "none";
      });
    };

    // Live filtering
    searchInput.addEventListener("input", filter);

    // Prevent form submit reload (optional)
    const form = searchInput.closest("form");
    if (form) form.addEventListener("submit", (e) => e.preventDefault());
  }

  /* -------- BONUS: Cart interactions (qty + remove) ---------------------- */
  function initCartInteractions() {
    const page = document.body?.dataset?.page;
    if (page !== "cart") return;

    // Remove buttons (supports our earlier template: button text "Remove")
    $$('button, a').forEach((btn) => {
      if (btn.textContent?.trim().toLowerCase() === "remove") {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          const row = btn.closest(".d-flex") || btn.closest(".border-bottom");
          if (row) row.remove();
          // Update summary after removal
          updateCheckoutSummaryForCurrentPage(0);
        });
      }
    });

    // Qty inputs update summary live
    $$('input[type="number"]').forEach((input) => {
      input.addEventListener("input", () => updateCheckoutSummaryForCurrentPage(0));
      input.addEventListener("change", () => updateCheckoutSummaryForCurrentPage(0));
    });

    // Initialise summary once
    updateCheckoutSummaryForCurrentPage(0);
  }

  /* ------------------------------ Init Router ----------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body?.dataset?.page;

    // Home-only
    if (page === "home") {
      initHomeCarousel();
      initFloatingAnchor();
    }

    // Shop-only
    initShopSearchFilter();

    // Checkout pages
    initCartInteractions();
    initShippingOffer();
  });
})();