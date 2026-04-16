let forecastChart = null;
let baseForecastData = null; // Store for raw API data
let currentForecastData = null; // Store for export/simulated data
let performanceChart = null;

// Socket.IO for real-time updates
let socket = null;
let realtimeData = {
    inventory: {},
    sales: {total_today: 0, transactions: []},
    weather: {},
    competitors: {},
    suppliers: {},
    analytics: {},
    demand: {}
};

document.addEventListener('DOMContentLoaded', () => {
    initChart([], []);
    initPerformanceChart();
    initSocketConnection();

    // Form logic
    const form = document.getElementById('forecast-form');
    const exportBtn = document.getElementById('export-btn');
    
    // NEW CONTROLS
    const promoSlider = document.getElementById('promo_slider');
    const promoDisplay = document.getElementById('promo_val_display');
    const toggleRain = document.getElementById('toggle_rain');
    const toggleHoliday = document.getElementById('toggle_holiday');

    // Auto-recalculate on simulator changes
    promoSlider.addEventListener('input', (e) => {
        promoDisplay.textContent = e.target.value;
        if(baseForecastData) simulateAndRedraw();
    });
    toggleRain.addEventListener('change', () => { if(baseForecastData) simulateAndRedraw(); });
    toggleHoliday.addEventListener('change', () => { if(baseForecastData) simulateAndRedraw(); });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = document.getElementById('run-btn');
        const loader = document.getElementById('btn-loader');
        const btnText = btn.querySelector('span');
        
        btn.disabled = true;
        btnText.style.display = 'none';
        loader.style.display = 'block';

        const store_id = document.getElementById('store_id').value;
        const item_id = document.getElementById('item_id').value;
        const on_hand = parseInt(document.getElementById('on_hand').value);
        const lead_time = document.getElementById('lead_time').value;

        // Show Skeleton Loaders on metrics
        document.querySelectorAll('.val').forEach(el => el.classList.add('skeleton-loader'));
        
        // Emulate complex AI processing delay
        setTimeout(async () => {
            try {
                const response = await fetch('/api/forecast', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        store_id: store_id,
                        item_id: item_id,
                        on_hand: on_hand,
                        lead_time: lead_time,
                        horizon: 30
                    })
                });

                if (!response.ok) throw new Error("API Request Failed");

                const data = await response.json();
                
                // Store raw base data untouched by simulators
                baseForecastData = JSON.parse(JSON.stringify(data)); 
                
                // Generate simulated version based on active slider/toggles
                simulateAndRedraw();

                // Enable PDF Export
                exportBtn.disabled = false;
                exportBtn.style.color = '#fff';

            } catch (error) {
                console.error("Error:", error);
                alert("Failed to fetch forecast & inventory metrics.");
            } finally {
                btn.disabled = false;
                btnText.style.display = 'block';
                loader.style.display = 'none';
                
                // Remove Skeleton Loaders
                document.querySelectorAll('.val').forEach(el => el.classList.remove('skeleton-loader'));
            }
        }, 1500); // 1.5 second UI trick
    });

    // --- SIMULATION LOGIC --- //
    function simulateAndRedraw() {
        if (!baseForecastData) return;
        
        const promoVal = parseInt(promoSlider.value);
        const isRain = toggleRain.checked;
        const isHoliday = toggleHoliday.checked;

        // Clone base data
        currentForecastData = JSON.parse(JSON.stringify(baseForecastData));

        // Calculate Multipliers
        // e.g. 20% promo = 1.4x sales (Simulated elasticity)
        let multiplier = 1.0 + (promoVal * 0.02);
        
        if (isRain) multiplier *= 0.8; // Rain drops generic retail sales by 20%
        if (isHoliday) multiplier *= 1.5; // Holiday spikes sales 50%

        // Apply Multiplier to forecast array
        for(let i=0; i<currentForecastData.forecast.length; i++) {
            currentForecastData.forecast[i] = currentForecastData.forecast[i] * multiplier;
        }

        // Apply Multiplier to Operations Logic
        currentForecastData.inventory_policy.recommended_order_quantity *= multiplier;
        currentForecastData.inventory_policy.reorder_point *= multiplier;
        currentForecastData.inventory_policy.safety_stock *= multiplier;
        currentForecastData.inventory_policy.eoq *= Math.sqrt(multiplier); // EOQ scales by sqrt(demand)

        const on_hand = parseInt(document.getElementById('on_hand').value);
        
        updateMetrics(currentForecastData.inventory_policy, on_hand, multiplier);
        updateChart(currentForecastData.dates, currentForecastData.forecast);
    }


    // Tab Switching Logic
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    tabLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            tabLinks.forEach(l => l.classList.remove('active'));
            tabContents.forEach(c => c.style.display = 'none');
            
            link.classList.add('active');
            const targetId = link.getAttribute('data-tab');
            document.getElementById(targetId).style.display = 'block';
            
            if (targetId === 'tab-forecaster' && forecastChart) {
                forecastChart.resize();
            }
            if (targetId === 'tab-analytics' && performanceChart) {
                performanceChart.resize();
                performanceChart.update();
            }
        });
    });

    // PDF Download Event
    exportBtn.addEventListener('click', downloadPDF);

    // --- ACTION BUTTONS & MODALS LOGIC --- //
    
    // Purchase Order Modal
    const modal = document.getElementById('dispatch-modal');
    const confirmDispatchBtn = document.getElementById('confirm-dispatch-btn');
    const closeModalBtns = document.querySelectorAll('.close-modal');
    
    document.querySelectorAll('.reorder-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const itemName = e.target.getAttribute('data-name');
            const storeId = e.target.getAttribute('data-store');
            
            document.getElementById('modal-item').value = `${itemName}`;
            document.getElementById('modal-store').value = `Store ${storeId}`;
            modal.style.display = 'block';
        });
    });

    confirmDispatchBtn.addEventListener('click', () => {
        const qty = document.getElementById('modal-qty').value;
        const addressSelect = document.getElementById('modal-address');
        const address = addressSelect.options[addressSelect.selectedIndex].text;
        const itemName = document.getElementById('modal-item').value;
        
        modal.style.display = 'none';
        showToast(`Success! P.O. for ${qty} Units dispatched to: ${address}`);

        // Add to Live Tracking Data
        const orderId = Math.floor(10000 + Math.random() * 90000);
        const trackingId = `TRK-2026-${Math.floor(10000 + Math.random() * 90000)}`;
        
        const newOrder = {
            order_id: orderId.toString(),
            product: itemName,
            quantity: parseInt(qty),
            destination: address,
            status: "Just Dispatched",
            progress: 5,
            days_remaining: 3,
            tracking_id: trackingId,
            shipping_location: "Main Warehouse - 789 Supply Chain Blvd",
            current_location: {"lat": 19.0760, "lng": 72.8777, "name": "Mumbai Warehouse"},
            route: [
                {"lat": 19.0760, "lng": 72.8777, "name": "Mumbai Warehouse", "status": "Departed"},
                {"lat": 18.5204, "lng": 73.8567, "name": address, "status": "Pending"}
            ]
        };
        
        trackingData.unshift(newOrder); // Add to beginning
        updateTrackingUI();
    });

    // Email Manager Modal
    const emailModal = document.getElementById('email-modal');
    const sendEmailBtn = document.getElementById('send-email-btn');
    const closeEmailBtn = document.querySelector('.close-email-modal');

    document.querySelectorAll('.email-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const itemName = e.target.getAttribute('data-name');
            const storeName = e.target.getAttribute('data-store');
            
            // Auto draft body
            const body = `Hi Team,\n\nOur AI Predictive System has flagged a critical warning for ${itemName} at ${storeName}.\n\nUnless we dispatch an emergency re-order immediately, we will lose estimated sales.\n\nPlease approve the attached P.O.`;
            document.getElementById('email-body').value = body;

            emailModal.style.display = 'block';
        });
    });

    sendEmailBtn.addEventListener('click', () => {
        emailModal.style.display = 'none';
        showToast(`Secure Auto-Email dispatched to Regional Manager! 📧`);
    });

    // Close Modals
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    });
    closeEmailBtn.addEventListener('click', () => {
        emailModal.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
        if (e.target === emailModal) emailModal.style.display = 'none';
    });

    // Halt Ordering
    document.querySelectorAll('.stop-buying-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showToast("System Updated: Auto-replenishment halted for this item.");
            btn.textContent = "Halted";
            btn.style.backgroundColor = "transparent";
            btn.style.color = "#94a3b8";
            btn.style.borderColor = "#94a3b8";
        });
    });

    // View AI jump
    document.querySelectorAll('.view-ai-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.getElementById('item_id').value = e.target.getAttribute('data-item');
            document.getElementById('store_id').value = e.target.getAttribute('data-store');
            document.getElementById('link-forecaster').click();
        });
    });

    // Chatbot Initialization
    const chatbotToggle = document.getElementById('chatbot-toggle');
    const chatbotWindow = document.getElementById('chatbot-window');
    const closeChatbot = document.getElementById('close-chatbot');
    const chatbotInput = document.getElementById('chatbot-input-field');
    const chatbotSend = document.getElementById('chatbot-send');
    const chatbotMessages = document.getElementById('chatbot-messages');

    if (chatbotToggle) {
        chatbotToggle.addEventListener('click', () => {
            chatbotWindow.classList.toggle('active');
        });

        closeChatbot.addEventListener('click', () => {
            chatbotWindow.classList.remove('active');
        });

        const botResponses = [
            { keywords: ["best", "seller", "top"], reply: "Based on the latest data across all regions, your current best seller is the Sony Bravia 55\" 4K TV, netting over $12,450/mo!" },
            { keywords: ["worst", "bad", "loss", "losing"], reply: "You are losing the most money on Obsolete DVD Players. I recommend aggressive markdowns or returning them to the supplier." },
            { keywords: ["forecast", "predict", "future"], reply: "The predictive models indicate a 15% surge in upcoming demand due to seasonal trends. Ready your safety stock!" },
            { keywords: ["order", "stock", "replenish", "empty"], reply: "I suggest you look at the 'All Stock Levels' tab. Our Samsung Galaxy S24 stock is completely empty!" }
        ];

        function handleChat() {
            let text = chatbotInput.value.trim();
            if(!text) return;
            
            let uMsg = document.createElement('div');
            uMsg.className = 'msg user-msg';
            uMsg.textContent = text;
            chatbotMessages.appendChild(uMsg);
            chatbotInput.value = '';
            chatbotMessages.scrollTop = chatbotMessages.scrollHeight;

            let tMsg = document.createElement('div');
            tMsg.className = 'typing-indicator';
            tMsg.textContent = "AI is thinking...";
            chatbotMessages.appendChild(tMsg);
            chatbotMessages.scrollTop = chatbotMessages.scrollHeight;

            setTimeout(() => {
                tMsg.remove();
                let lowerText = text.toLowerCase();
                let foundReply = "I am an AI. According to my models, everything is optimized. Try asking about your 'best seller' or 'worst' items.";
                
                for(let r of botResponses) {
                    if (r.keywords.some(k => lowerText.includes(k))) {
                        foundReply = r.reply;
                        break;
                    }
                }
                
                let aMsg = document.createElement('div');
                aMsg.className = 'msg ai-msg';
                aMsg.textContent = foundReply;
                chatbotMessages.appendChild(aMsg);
                chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
            }, 1000);
        }

        chatbotSend.addEventListener('click', handleChat);
        chatbotInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') handleChat(); });
    }

    // Leaflet map setup (only init once when tracking tab is activated)
    let mapInitialized = false;
    let trackMap = null;
    let trackingData = [];

    async function loadTrackingData() {
        try {
            const response = await fetch('/api/tracking');
            trackingData = await response.json();
            updateTrackingUI();
        } catch (error) {
            console.error('Error loading tracking data:', error);
        }
    }

    function updateTrackingUI() {
        const container = document.getElementById('tracking-container');
        container.innerHTML = '';

        trackingData.forEach(order => {
            const card = document.createElement('section');
            card.className = 'glass-card flex-between';
            card.style.padding = '1.5rem';
            card.innerHTML = `
                <div>
                    <h3 style="margin-bottom: 0.5rem;">Order #${order.order_id} - ${order.product}</h3>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">
                        Tracking ID: ${order.tracking_id}<br>
                        From: ${order.shipping_location} • To: ${order.destination} • Qty: ${order.quantity}
                    </p>
                </div>
                <div style="width: 40%;">
                    <div class="flex-between" style="font-size: 0.8rem; margin-bottom: 5px;">
                        <span style="color: ${order.status === 'In Transit' ? '#10b981' : '#f59e0b'};">${order.status}</span>
                        <span class="text-secondary">Arriving in ${order.days_remaining} Days</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${order.progress}%; background: ${order.status === 'In Transit' ? '#10b981' : '#f59e0b'};"></div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

        // Update map with routes
        if (trackMap) {
            trackMap.eachLayer(layer => {
                if (layer instanceof L.Marker || layer instanceof L.Polyline) {
                    trackMap.removeLayer(layer);
                }
            });

            trackingData.forEach(order => {
                // Add route polyline
                const routeCoords = order.route.map(point => [point.lat, point.lng]);
                L.polyline(routeCoords, {color: '#38bdf8', weight: 3, opacity: 0.7}).addTo(trackMap);

                // Add markers for each point
                order.route.forEach((point, index) => {
                    const iconColor = point.status === 'Departed' ? '#10b981' : point.status === 'In Transit' ? '#f59e0b' : '#6b7280';
                    const markerIcon = L.divIcon({
                        className: 'route-marker',
                        html: `<div style="background-color: ${iconColor}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>`,
                        iconSize: [12, 12]
                    });

                    L.marker([point.lat, point.lng], {icon: markerIcon})
                        .addTo(trackMap)
                        .bindPopup(`<b>${point.name}</b><br>Status: ${point.status}`);
                });
            });

            // Fit map to show all routes
            if (trackingData.length > 0) {
                const allCoords = trackingData.flatMap(order => order.route.map(p => [p.lat, p.lng]));
                trackMap.fitBounds(allCoords, {padding: [20, 20]});
            }
        }
    }

    document.getElementById('link-tracking').addEventListener('click', () => {
        if (!mapInitialized) {
            setTimeout(() => {
                trackMap = L.map('tracking-map').setView([20.5937, 78.9629], 5); // Center India
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; OpenStreetMap, &copy; CartoDB',
                    maxZoom: 19
                }).addTo(trackMap);
                mapInitialized = true;
            }, 200);
        }
        loadTrackingData();
    });

    // ===== REAL-TIME FEATURES =====

    function initSocketConnection() {
        socket = io();

        socket.on('connect', () => {
            console.log('Connected to real-time server');
            showToast('🔴 Connected to Live Updates');
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from real-time server');
            showToast('⚠️ Real-time connection lost');
        });

        // Real-time data handlers
        socket.on('inventory_update', (data) => {
            realtimeData.inventory = data;
            updateRealtimeInventory();
        });

        socket.on('sales_update', (data) => {
            realtimeData.sales = data;
            updateRealtimeSales();
        });

        socket.on('weather_update', (data) => {
            realtimeData.weather = data;
            updateRealtimeWeather();
        });

        socket.on('competitor_update', (data) => {
            realtimeData.competitors = data;
            updateRealtimeCompetitors();
        });

        socket.on('supplier_update', (data) => {
            realtimeData.suppliers = data;
            updateRealtimeSuppliers();
        });

        socket.on('system_health_update', (data) => {
            updateRealtimeSystemHealth(data);
        });

        socket.on('analytics_update', (data) => {
            realtimeData.analytics = data;
            updateRealtimeAnalytics();
        });

        // Load initial data
        loadRealtimeData();
    }

    async function loadRealtimeData() {
        try {
            const [inventory, sales, weather, competitors, suppliers, analytics, demand] = await Promise.all([
                fetch('/api/inventory').then(r => r.json()),
                fetch('/api/sales').then(r => r.json()),
                fetch('/api/weather').then(r => r.json()),
                fetch('/api/competitors').then(r => r.json()),
                fetch('/api/suppliers').then(r => r.json()),
                fetch('/api/analytics').then(r => r.json()),
                fetch('/api/demand-patterns').then(r => r.json())
            ]);

            realtimeData = {inventory, sales, weather, competitors, suppliers, analytics, demand};
            updateAllRealtimeUI();
        } catch (error) {
            console.error('Error loading real-time data:', error);
        }
    }

    function updateAllRealtimeUI() {
        updateRealtimeInventory();
        updateRealtimeSales();
        updateRealtimeWeather();
        updateRealtimeCompetitors();
        updateRealtimeSuppliers();
        updateRealtimeAnalytics();
        updateRealtimeDemand();
    }

    function updateRealtimeInventory() {
        const container = document.getElementById('inventory-heatmap');
        if (!container) return;

        container.innerHTML = '';

        Object.entries(realtimeData.inventory).forEach(([store, products]) => {
            const storeDiv = document.createElement('div');
            storeDiv.className = 'store-inventory';
            storeDiv.innerHTML = `<h4>${store}</h4>`;

            const productList = document.createElement('div');
            productList.className = 'product-grid';

            Object.values(products).forEach(product => {
                const statusClass = product.status === 'Critical' ? 'critical' :
                                  product.status === 'Low Stock' ? 'warning' : 'normal';
                const productDiv = document.createElement('div');
                productDiv.className = `product-item ${statusClass}`;
                productDiv.innerHTML = `
                    <span class="product-name">${product.name}</span>
                    <span class="product-stock">${product.current_stock}</span>
                    <span class="product-status">${product.status}</span>
                `;
                productList.appendChild(productDiv);
            });

            storeDiv.appendChild(productList);
            container.appendChild(storeDiv);
        });
    }

    function updateRealtimeSales() {
        // Update revenue display
        const revenueEl = document.getElementById('live-revenue');
        if (revenueEl) {
            revenueEl.textContent = `₹${realtimeData.sales.total_today?.toLocaleString() || 0}`;
        }

        // Update sales ticker
        const tickerEl = document.getElementById('sales-ticker');
        if (tickerEl && realtimeData.sales.transactions) {
            tickerEl.innerHTML = realtimeData.sales.transactions.slice(0, 5).map(tx => `
                <div class="ticker-item">
                    <span class="store">${tx.store}</span> •
                    <span class="product">${tx.product_name}</span> •
                    <span class="amount">₹${tx.total}</span>
                </div>
            `).join('');
        }
    }

    function updateRealtimeWeather() {
        const container = document.getElementById('weather-dashboard');
        if (!container) return;

        container.innerHTML = '';

        Object.entries(realtimeData.weather).forEach(([city, data]) => {
            const weatherDiv = document.createElement('div');
            weatherDiv.className = 'weather-item';
            weatherDiv.innerHTML = `
                <h4>${city}</h4>
                <div class="weather-info">
                    <span class="temp">${data.temperature}°C</span>
                    <span class="condition">${data.condition}</span>
                    <span class="humidity">${data.humidity}% humidity</span>
                </div>
                <div class="forecast">
                    ${data.forecast?.map(f => `<span>${f.day}: ${f.temp}°C ${f.condition}</span>`).join(' • ') || ''}
                </div>
            `;
            container.appendChild(weatherDiv);
        });
    }

    function updateRealtimeCompetitors() {
        const container = document.getElementById('competitor-dashboard');
        if (!container) return;

        container.innerHTML = '';

        Object.values(realtimeData.competitors).forEach(product => {
            const productDiv = document.createElement('div');
            productDiv.className = 'competitor-product';
            productDiv.innerHTML = `
                <h4>${product.product_name}</h4>
                <div class="price-comparison">
                    <div class="our-price">Our Price: ₹${product.our_price}</div>
                    <div class="competitor-prices">
                        ${Object.entries(product.competitors).map(([comp, data]) => `
                            <span class="${data.price < product.our_price ? 'lower' : 'higher'}">
                                ${comp}: ₹${data.price} ${data.in_stock ? '✓' : '✗'}
                            </span>
                        `).join('')}
                    </div>
                </div>
            `;
            container.appendChild(productDiv);
        });
    }

    function updateRealtimeSuppliers() {
        const container = document.getElementById('supplier-dashboard');
        if (!container) return;

        container.innerHTML = '';

        Object.values(realtimeData.suppliers).forEach(supplier => {
            const statusClass = supplier.status === 'Active' ? 'active' :
                              supplier.status === 'Delayed' ? 'delayed' : 'on-hold';
            const supplierDiv = document.createElement('div');
            supplierDiv.className = `supplier-item ${statusClass}`;
            supplierDiv.innerHTML = `
                <h4>${supplier.name}</h4>
                <div class="supplier-info">
                    <span>Status: ${supplier.status}</span>
                    <span>Lead Time: ${supplier.lead_time_days} days</span>
                    <span>Reliability: ${supplier.reliability_score}%</span>
                    <span>Products: ${supplier.products_available}</span>
                </div>
            `;
            container.appendChild(supplierDiv);
        });
    }

    function updateRealtimeSystemHealth(data) {
        const container = document.getElementById('system-health-dashboard');
        if (!container) return;

        const cpuPercent = data.cpu || 0;
        const memoryPercent = data.memory || 0;
        const responseTime = data.response_time || 0;

        container.innerHTML = `
            <div class="health-metric">
                <span>CPU Usage</span>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${cpuPercent}%; background: ${cpuPercent > 70 ? '#ef4444' : '#10b981'};"></div>
                </div>
                <span>${cpuPercent}%</span>
            </div>
            <div class="health-metric">
                <span>Memory Usage</span>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${memoryPercent}%; background: ${memoryPercent > 80 ? '#ef4444' : '#10b981'};"></div>
                </div>
                <span>${memoryPercent}%</span>
            </div>
            <div class="health-metric">
                <span>Response Time</span>
                <span>${responseTime}ms</span>
            </div>
        `;
    }

    function updateRealtimeAnalytics() {
        if (!realtimeData.analytics) return;

        document.getElementById('analytics-inventory-value').textContent =
            `₹${realtimeData.analytics.inventory_value?.toLocaleString() || 0}`;
        document.getElementById('analytics-low-stock').textContent =
            realtimeData.analytics.low_stock_alerts || 0;
        document.getElementById('analytics-transactions').textContent =
            realtimeData.analytics.transaction_count || 0;
        document.getElementById('analytics-avg-value').textContent =
            `₹${Math.round(realtimeData.analytics.avg_transaction_value || 0)}`;

        if (performanceChart && realtimeData.analytics.trend_labels) {
            performanceChart.data.labels = realtimeData.analytics.trend_labels;
            performanceChart.data.datasets[0].data = realtimeData.analytics.revenue_trend || [];
            performanceChart.data.datasets[1].data = realtimeData.analytics.transaction_trend || [];
            performanceChart.update();
        }
    }

    function updateRealtimeDemand() {
        if (!realtimeData.demand) return;

        // Trending products
        const trendingEl = document.getElementById('trending-products');
        if (trendingEl && realtimeData.demand.trending_products) {
            trendingEl.innerHTML = realtimeData.demand.trending_products.map(product => `
                <div class="trending-item">
                    <span class="product-name">${product.name}</span>
                    <span class="demand-increase">+${product.demand_increase}%</span>
                    <span class="social-mentions">${product.social_mentions} mentions</span>
                </div>
            `).join('');
        }

        // Seasonal trends
        const seasonalEl = document.getElementById('seasonal-trends');
        if (seasonalEl && realtimeData.demand.seasonal_trends) {
            seasonalEl.innerHTML = Object.entries(realtimeData.demand.seasonal_trends).map(([season, items]) => `
                <div class="season-item">
                    <h4>${season.replace('_', ' ').toUpperCase()}</h4>
                    <div class="season-items">${items.join(', ')}</div>
                </div>
            `).join('');
        }

        // Price sensitivity
        const priceEl = document.getElementById('price-sensitivity');
        if (priceEl && realtimeData.demand.price_sensitivity) {
            priceEl.innerHTML = Object.entries(realtimeData.demand.price_sensitivity).map(([category, sensitivity]) => `
                <div class="price-item">
                    <span class="category">${category}</span>
                    <span class="sensitivity ${sensitivity.toLowerCase()}">${sensitivity}</span>
                </div>
            `).join('');
        }
    }

    function initPerformanceChart() {
        const ctx = document.getElementById('performanceChart');
        if (!ctx) return;

        performanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Revenue Trend',
                    data: [],
                    borderColor: '#00ff88',
                    backgroundColor: 'rgba(0, 255, 136, 0.1)',
                    tension: 0.4
                }, {
                    label: 'Transaction Count',
                    data: [],
                    borderColor: '#ff6b6b',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Initialize real-time features
    initSocketConnection();

}); // end DOMContentLoaded

// Toast / Pop-up Logic
function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = "toast show";
    setTimeout(function(){ toast.className = toast.className.replace("show", ""); }, 3000);
}

// Chart Logic
function updateMetrics(policy, on_hand, multiplier = 1.0) {
    document.getElementById('val_order_qty').textContent = Math.round(policy.recommended_order_quantity);
    document.getElementById('val_rop').textContent = Math.round(policy.reorder_point);
    document.getElementById('val_ss').textContent = Math.round(policy.safety_stock);
    document.getElementById('val_eoq').textContent = Math.round(policy.eoq);

    const badge = document.getElementById('stock-health');
    const riskLabel = document.getElementById('val_risk');
    
    // Evaluate new risk based on Multiplier
    if (multiplier > 1.4) {
        // High Demand Warning!
        badge.textContent = "Warning: Spike Detected!";
        badge.className = "badge danger";
        riskLabel.textContent = "High (Stockout Imminent)";
        riskLabel.className = "stat-val text-red";
    }
    else if (on_hand <= policy.reorder_point) {
        badge.textContent = "Action Needed: Order Now";
        badge.className = "badge danger";
        riskLabel.textContent = "High (Critical)";
        riskLabel.className = "stat-val text-red";
    } else if (on_hand > policy.reorder_point * 2) {
        badge.textContent = "Action Needed: Stop Buying";
        badge.className = "badge warning";
        riskLabel.textContent = "Zero (Too much stock)";
        riskLabel.className = "stat-val text-green";
    } else {
        badge.textContent = "Healthy Stock";
        badge.className = "badge success";
        riskLabel.textContent = "Low (< 5%)";
        riskLabel.className = "stat-val text-green";
    }
}

function initChart(labels, data) {
    const ctx = document.getElementById('forecastChart').getContext('2d');
    
    let gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0.6)');   
    gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)'); // fade to transparent

    forecastChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Forecasted Demand',
                data: data,
                borderColor: '#38bdf8',
                backgroundColor: gradient,
                borderWidth: 2,
                pointBackgroundColor: '#0ea5e9',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#38bdf8',
                pointRadius: 0, // hide points unless hovered
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4
            },
            {
                label: 'Average Trendline',
                data: [], // calculated dynamically
                borderColor: 'rgba(255, 255, 255, 0.5)',
                borderWidth: 1.5,
                borderDash: [5, 5],
                pointRadius: 0,
                pointHoverRadius: 0,
                fill: false,
                tension: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, labels: { color: '#94a3b8' } },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#38bdf8',
                    bodyColor: '#f8fafc',
                    borderColor: 'rgba(56, 189, 248, 0.3)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                    ticks: { color: '#94a3b8', maxTicksLimit: 7 }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                    ticks: { color: '#94a3b8' },
                    beginAtZero: true
                }
            },
            interaction: { mode: 'index', intersect: false },
        }
    });

    // Make chart slightly animate when data changes
    forecastChart.options.animation = {
        duration: 400
    };
}

function updateChart(labels, data) {
    forecastChart.data.labels = labels;
    forecastChart.data.datasets[0].data = data;
    
    // Calculate new average trendline
    let sum = data.reduce((a,b) => a + b, 0);
    let avg = data.length > 0 ? sum / data.length : 0;
    let avgData = new Array(data.length).fill(avg);
    forecastChart.data.datasets[1].data = avgData;
    
    forecastChart.update();
}

function downloadPDF() {
    if (!currentForecastData) return;
    showToast("Generating Executive PDF Report...");
    
    // We access jsPDF from window object globally
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Header Style
    doc.setFillColor(15, 23, 42); // match dark theme
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("Smart Retail AI - Executive Report", 15, 25);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text("AI Demand Forecast & Inventory Policy", 15, 55);
    
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 15, 65);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    // Add Policy Metrics
    doc.text(`Recommended Order Qty: ${Math.round(currentForecastData.inventory_policy.recommended_order_quantity)} units`, 15, 80);
    doc.text(`Reorder Point: ${Math.round(currentForecastData.inventory_policy.reorder_point)} units`, 15, 88);
    doc.text(`Safety Stock: ${Math.round(currentForecastData.inventory_policy.safety_stock)} units`, 15, 96);
    doc.text(`Economic Order Qty (EOQ): ${Math.round(currentForecastData.inventory_policy.eoq)} units`, 15, 104);
    
    // Add autoTable
    let tableData = currentForecastData.dates.map((d, i) => [d, Math.round(currentForecastData.forecast[i])]);
    
    doc.autoTable({
        startY: 115,
        head: [['Date (Next 30 Days)', 'Predicted AI Demand']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [14, 165, 233] }
    });
    
    doc.save("Executive_AI_Report.pdf");
}
