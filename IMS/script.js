const storageKeys = {
  products: "imsProducts",
  orders: "imsOrders",
  settings: "imsSettings",
};

const defaultSettings = {
  notificationIntervalDays: 3,
};

const state = {
  products: [],
  orders: [],
  settings: { ...defaultSettings },
  editProductId: null,
  editOrderId: null,
};

const elements = {
  productTableBody: document.querySelector("#product-table-body"),
  orderTableBody: document.querySelector("#order-table-body"),
  notificationList: document.querySelector("#notification-list"),
  productDialog: document.querySelector("#product-dialog"),
  productForm: document.querySelector("#product-form"),
  orderDialog: document.querySelector("#order-dialog"),
  orderForm: document.querySelector("#order-form"),
  addProductBtn: document.querySelector("#add-product-btn"),
  addOrderBtn: document.querySelector("#add-order-btn"),
  orderProductSelect: document.querySelector(
    '#order-form select[name="product"]',
  ),
  notificationDurationInput: document.querySelector("#notification-duration"),
  saveSettingsBtn: document.querySelector("#save-settings"),
  notificationTemplate: document.querySelector("#notification-item-template"),
};

function uuid() {
  return crypto.randomUUID();
}

function saveState() {
  localStorage.setItem(storageKeys.products, JSON.stringify(state.products));
  localStorage.setItem(storageKeys.orders, JSON.stringify(state.orders));
  localStorage.setItem(storageKeys.settings, JSON.stringify(state.settings));
}

function loadState() {
  try {
    const savedProducts = JSON.parse(
      localStorage.getItem(storageKeys.products),
    );
    const savedOrders = JSON.parse(localStorage.getItem(storageKeys.orders));
    const savedSettings = JSON.parse(
      localStorage.getItem(storageKeys.settings),
    );

    if (Array.isArray(savedProducts)) {
      state.products = savedProducts;
    }
    if (Array.isArray(savedOrders)) {
      state.orders = savedOrders;
    }
    if (savedSettings && typeof savedSettings === "object") {
      state.settings = { ...defaultSettings, ...savedSettings };
    }
  } catch (error) {
    console.error("Failed to load state", error);
  }
}

function closeDialogs() {
  if (elements.productDialog.open) {
    elements.productDialog.close();
  }
  if (elements.orderDialog.open) {
    elements.orderDialog.close();
  }
  state.editProductId = null;
  state.editOrderId = null;
  elements.productForm.reset();
  elements.orderForm.reset();
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function renderProducts() {
  elements.productTableBody.innerHTML = "";

  if (state.products.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = "No products available yet.";
    cell.style.textAlign = "center";
    row.appendChild(cell);
    elements.productTableBody.appendChild(row);
    return;
  }

  state.products.forEach((product) => {
    const row = document.createElement("tr");
    row.dataset.id = product.id;

    const stockCell = document.createElement("td");
    stockCell.textContent = product.stock.toString();

    if (product.stock <= product.reorderPoint) {
      stockCell.classList.add("stock-low");
      row.classList.add("row-low-stock");
    }

    row.innerHTML = `
      <td>${product.sku}</td>
      <td>${product.name}</td>
      <td>${product.category || "—"}</td>
      <td>${product.stock}</td>
      <td>${product.reorderPoint}</td>
      <td>
        <div class="table-actions">
          <button class="table-action" data-action="edit">Edit</button>
          <button class="table-action" data-action="receive">Receive</button>
          <button class="table-action" data-action="dispatch">Dispatch</button>
          <button class="table-action" data-action="delete">Delete</button>
        </div>
      </td>
    `;
    elements.productTableBody.appendChild(row);
  });
}

function renderOrders() {
  elements.orderTableBody.innerHTML = "";

  if (state.orders.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = "No customer orders recorded yet.";
    cell.style.textAlign = "center";
    row.appendChild(cell);
    elements.orderTableBody.appendChild(row);
    return;
  }

  state.orders.forEach((order) => {
    const product = state.products.find((item) => item.id === order.productId);
    const productName = product ? product.name : "Product removed";

    const row = document.createElement("tr");
    row.dataset.id = order.id;
    row.innerHTML = `
      <td>${order.orderNumber}</td>
      <td>${order.customer}</td>
      <td>${productName}</td>
      <td>${order.quantity}</td>
      <td><span class="status-badge">${order.status}</span></td>
      <td>
        <div class="table-actions">
          <button class="table-action" data-action="edit-order">Edit</button>
          <button class="table-action" data-action="delete-order">Delete</button>
        </div>
      </td>
    `;
    elements.orderTableBody.appendChild(row);
  });
}

function renderOrderProductOptions() {
  elements.orderProductSelect.innerHTML = "";

  if (state.products.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No products available";
    elements.orderProductSelect.appendChild(option);
    return;
  }

  state.products.forEach((product) => {
    const option = document.createElement("option");
    option.value = product.id;
    option.textContent = `${product.name} (Stock: ${product.stock})`;
    elements.orderProductSelect.appendChild(option);
  });
}

function renderNotifications() {
  elements.notificationList.innerHTML = "";

  const lowStockProducts = state.products.filter(
    (product) => product.stock <= product.reorderPoint,
  );

  if (lowStockProducts.length === 0) {
    const li = document.createElement("li");
    li.className = "notification-item";
    li.innerHTML =
      '<span class="notification-text">All stocks are healthy.</span>';
    elements.notificationList.appendChild(li);
    return;
  }

  const template = elements.notificationTemplate.content;

  lowStockProducts.forEach((product) => {
    const clone = document.importNode(template, true);
    const text = clone.querySelector(".notification-text");
    const time = clone.querySelector(".notification-time");

    text.textContent = `${product.name} is low on stock (${product.stock} left).`;
    const reminderDate = product.lastReminder
      ? new Date(product.lastReminder)
      : new Date();
    time.textContent = `Last reminded: ${formatDateTime(reminderDate)}`;

    elements.notificationList.appendChild(clone);
  });
}

function handleProductFormSubmit(event) {
  event.preventDefault();

  const formData = new FormData(elements.productForm);
  const productData = {
    sku: formData.get("sku").trim(),
    name: formData.get("name").trim(),
    category: formData.get("category").trim(),
    stock: Number(formData.get("stock")),
    reorderPoint: Number(formData.get("reorderPoint")),
  };

  if (!productData.sku || !productData.name) {
    alert("SKU and Name are required.");
    return;
  }

  if (productData.stock < 0 || productData.reorderPoint < 0) {
    alert("Values cannot be negative.");
    return;
  }

  if (state.editProductId) {
    const index = state.products.findIndex(
      (product) => product.id === state.editProductId,
    );
    if (index >= 0) {
      state.products[index] = {
        ...state.products[index],
        ...productData,
      };
    }
  } else {
    const newProduct = {
      id: uuid(),
      lastReminder: null,
      ...productData,
    };

    state.products.push(newProduct);
  }

  saveState();
  renderProducts();
  renderOrderProductOptions();
  checkLowStock();
  renderNotifications();
  closeDialogs();
}

function handleOrderFormSubmit(event) {
  event.preventDefault();

  if (!state.products.length) {
    alert("Please add products before recording orders.");
    return;
  }

  const formData = new FormData(elements.orderForm);
  const orderData = {
    orderNumber: formData.get("orderNumber").trim(),
    customer: formData.get("customer").trim(),
    productId: formData.get("product"),
    quantity: Number(formData.get("quantity")),
    status: formData.get("status"),
  };

  if (!orderData.orderNumber || !orderData.customer) {
    alert("Order number and customer name are required.");
    return;
  }

  const product = state.products.find(
    (item) => item.id === orderData.productId,
  );

  if (!product) {
    alert("Selected product does not exist.");
    return;
  }

  if (orderData.quantity <= 0) {
    alert("Quantity must be greater than zero.");
    return;
  }

  if (!state.editOrderId && orderData.quantity > product.stock) {
    alert("Insufficient stock for this order.");
    return;
  }

  if (state.editOrderId) {
    const index = state.orders.findIndex(
      (order) => order.id === state.editOrderId,
    );
    if (index >= 0) {
      const originalOrder = state.orders[index];

      if (originalOrder.productId !== orderData.productId) {
        const previousProduct = state.products.find(
          (item) => item.id === originalOrder.productId,
        );
        if (previousProduct) {
          previousProduct.stock += originalOrder.quantity;
        }
        product.stock -= orderData.quantity;
      } else {
        const stockAdjustment = orderData.quantity - originalOrder.quantity;
        if (stockAdjustment > 0 && stockAdjustment > product.stock) {
          alert("Insufficient stock for this order.");
          return;
        }
        product.stock -= stockAdjustment;
      }

      state.orders[index] = { ...originalOrder, ...orderData };
    }
  } else {
    product.stock -= orderData.quantity;
    const newOrder = {
      id: uuid(),
      createdAt: Date.now(),
      ...orderData,
    };
    state.orders.unshift(newOrder);
  }

  saveState();
  renderProducts();
  renderOrders();
  renderOrderProductOptions();
  checkLowStock();
  renderNotifications();
  closeDialogs();
}

function deleteProduct(productId) {
  const index = state.products.findIndex((product) => product.id === productId);
  if (index === -1) return;

  const hasOrders = state.orders.some((order) => order.productId === productId);
  if (
    hasOrders &&
    !confirm("This product has related orders. Delete anyway?")
  ) {
    return;
  }

  state.products.splice(index, 1);
  state.orders = state.orders.filter((order) => order.productId !== productId);
  saveState();
  renderProducts();
  renderOrders();
  renderOrderProductOptions();
  renderNotifications();
}

function deleteOrder(orderId) {
  const index = state.orders.findIndex((order) => order.id === orderId);
  if (index === -1) return;

  const [removedOrder] = state.orders.splice(index, 1);
  const product = state.products.find(
    (item) => item.id === removedOrder.productId,
  );
  if (product) {
    product.stock += removedOrder.quantity;
  }

  saveState();
  renderProducts();
  renderOrders();
  renderOrderProductOptions();
  renderNotifications();
}

function receiveStock(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;

  const amount = Number(prompt(`Add how many units to ${product.name}?`, "0"));

  if (Number.isNaN(amount) || amount <= 0) {
    return;
  }

  product.stock += amount;
  saveState();
  renderProducts();
  renderOrderProductOptions();
  checkLowStock();
  renderNotifications();
}

function dispatchStock(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;

  const amount = Number(
    prompt(`Deduct how many units from ${product.name}?`, "0"),
  );

  if (Number.isNaN(amount) || amount <= 0) {
    return;
  }

  if (amount > product.stock) {
    alert("Not enough stock to dispatch that quantity.");
    return;
  }

  product.stock -= amount;
  saveState();
  renderProducts();
  renderOrderProductOptions();
  checkLowStock();
  renderNotifications();
}

function openProductDialog(productId = null) {
  state.editProductId = productId;

  if (productId) {
    const product = state.products.find((item) => item.id === productId);
    if (!product) return;

    elements.productForm.querySelector('input[name="sku"]').value = product.sku;
    elements.productForm.querySelector('input[name="name"]').value =
      product.name;
    elements.productForm.querySelector('input[name="category"]').value =
      product.category || "";
    elements.productForm.querySelector('input[name="stock"]').value =
      product.stock;
    elements.productForm.querySelector('input[name="reorderPoint"]').value =
      product.reorderPoint;
    elements.productDialog.querySelector("h3").textContent = "Update Product";
  } else {
    elements.productDialog.querySelector("h3").textContent = "Add Product";
    elements.productForm.reset();
  }

  elements.productDialog.showModal();
}

function openOrderDialog(orderId = null) {
  state.editOrderId = orderId;

  renderOrderProductOptions();

  if (!state.products.length) {
    alert("Add products before recording orders.");
    return;
  }

  if (orderId) {
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) return;

    elements.orderForm.querySelector('input[name="orderNumber"]').value =
      order.orderNumber;
    elements.orderForm.querySelector('input[name="customer"]').value =
      order.customer;
    elements.orderForm.querySelector('select[name="product"]').value =
      order.productId;
    elements.orderForm.querySelector('input[name="quantity"]').value =
      order.quantity;
    elements.orderForm.querySelector('select[name="status"]').value =
      order.status;
    elements.orderDialog.querySelector("h3").textContent = "Update Order";
  } else {
    elements.orderDialog.querySelector("h3").textContent =
      "Record Customer Order";
    elements.orderForm.reset();
  }

  elements.orderDialog.showModal();
}

function checkLowStock(force = false) {
  const now = Date.now();
  const intervalMs =
    state.settings.notificationIntervalDays * 24 * 60 * 60 * 1000;

  state.products.forEach((product) => {
    if (product.stock > product.reorderPoint) {
      product.lastReminder = null;
      return;
    }

    if (
      !product.lastReminder ||
      force ||
      now - product.lastReminder >= intervalMs
    ) {
      product.lastReminder = now;
      pushNotification(
        `${product.name} is below the reorder point. Remaining stock: ${product.stock}`,
      );
    }
  });

  saveState();
}

function pushNotification(message) {
  const notification = document.createElement("li");
  notification.className = "notification-item";
  const text = document.createElement("span");
  text.className = "notification-text";
  text.textContent = message;
  const time = document.createElement("time");
  time.className = "notification-time";
  time.textContent = formatDateTime(new Date());
  notification.appendChild(text);
  notification.appendChild(time);

  elements.notificationList.prepend(notification);

  if (elements.notificationList.children.length > 5) {
    elements.notificationList.removeChild(elements.notificationList.lastChild);
  }
}

function saveSettings() {
  const value = Number(elements.notificationDurationInput.value);

  if (Number.isNaN(value) || value <= 0) {
    alert("Notification interval must be greater than zero.");
    elements.notificationDurationInput.value =
      state.settings.notificationIntervalDays.toString();
    return;
  }

  state.settings.notificationIntervalDays = value;
  saveState();
  checkLowStock(true);
  renderNotifications();
  pushNotification(`Reminder interval updated to every ${value} day(s).`);
}

function handleProductTableClick(event) {
  if (!(event.target instanceof HTMLButtonElement)) return;
  const action = event.target.dataset.action;
  if (!action) return;

  const row = event.target.closest("tr");
  if (!row) return;

  const productId = row.dataset.id;

  switch (action) {
    case "edit":
      openProductDialog(productId);
      break;
    case "receive":
      receiveStock(productId);
      break;
    case "dispatch":
      dispatchStock(productId);
      break;
    case "delete":
      if (confirm("Delete this product?")) {
        deleteProduct(productId);
      }
      break;
    default:
      break;
  }
}

function handleOrderTableClick(event) {
  if (!(event.target instanceof HTMLButtonElement)) return;
  const action = event.target.dataset.action;
  if (!action) return;

  const row = event.target.closest("tr");
  if (!row) return;

  const orderId = row.dataset.id;

  switch (action) {
    case "edit-order":
      openOrderDialog(orderId);
      break;
    case "delete-order":
      if (confirm("Delete this order?")) {
        deleteOrder(orderId);
      }
      break;
    default:
      break;
  }
}

function seedSampleData() {
  if (state.products.length || state.orders.length) {
    return;
  }

  const exampleProducts = [
    {
      id: uuid(),
      sku: "SKU-101",
      name: "Eco-Friendly Tote Bag",
      category: "Accessories",
      stock: 25,
      reorderPoint: 15,
      lastReminder: null,
    },
    {
      id: uuid(),
      sku: "SKU-205",
      name: "Cold Brew Concentrate",
      category: "Beverages",
      stock: 12,
      reorderPoint: 20,
      lastReminder: null,
    },
  ];

  const exampleOrder = {
    id: uuid(),
    orderNumber: "ORD-1001",
    customer: "Juan Dela Cruz",
    productId: exampleProducts[0].id,
    quantity: 2,
    status: "Reserved",
    createdAt: Date.now(),
  };

  exampleProducts[0].stock -= exampleOrder.quantity;

  state.products.push(...exampleProducts);
  state.orders.push(exampleOrder);
}

function initEventListeners() {
  elements.addProductBtn.addEventListener("click", () => openProductDialog());
  elements.addOrderBtn.addEventListener("click", () => openOrderDialog());

  elements.productForm.addEventListener("submit", handleProductFormSubmit);
  elements.orderForm.addEventListener("submit", handleOrderFormSubmit);

  elements.productDialog.addEventListener("close", () => {
    state.editProductId = null;
    elements.productForm.reset();
  });

  elements.orderDialog.addEventListener("close", () => {
    state.editOrderId = null;
    elements.orderForm.reset();
  });

  elements.productTableBody.addEventListener("click", handleProductTableClick);
  elements.orderTableBody.addEventListener("click", handleOrderTableClick);

  elements.saveSettingsBtn.addEventListener("click", saveSettings);
}

function applySettings() {
  elements.notificationDurationInput.value =
    state.settings.notificationIntervalDays;
}

function scheduleLowStockChecks() {
  setInterval(() => {
    checkLowStock();
    renderNotifications();
  }, 60 * 1000);
}

function init() {
  loadState();
  seedSampleData();
  applySettings();
  initEventListeners();
  renderProducts();
  renderOrders();
  renderOrderProductOptions();
  renderNotifications();
  scheduleLowStockChecks();
  checkLowStock(true);
}

init();
