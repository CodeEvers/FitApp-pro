// --- KONFIGURACE SUPABASE ---
const SUPABASE_URL = 'https://cafvdjmjwevbmunydhtq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhZnZkam1qd2V2Ym11bnlkaHRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MjU0MDMsImV4cCI6MjA5MDEwMTQwM30.BVQNZhecgDD_s3S2jQ9kJ16_M0R54obbmYIcftx0c08';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    // --- INICIALIZACE ---
    let dbExercises = [];
    let dbFood = [];
    let dbWeights = {};
    let currentDate = new Date();
    let myChart = null;
    let currentUser = null;
    let isRegistrationMode = false;

    // --- DOM ELEMENTY ---
    const phaseInput = document.getElementById('exercise-phase');
    const nameInput = document.getElementById('exercise-name');
    const setsInput = document.getElementById('exercise-sets');
    const repsInput = document.getElementById('exercise-reps');
    const weightInput = document.getElementById('exercise-weight');
    const kcalInput = document.getElementById('exercise-kcal');
    const ratingInput = document.getElementById('exercise-rating');
    const editIdInput = document.getElementById('edit-id');
    const filterSelect = document.getElementById('filter-activity');
    const hiddenDateInput = document.getElementById('hidden-date-input');

    const foodNameInput = document.getElementById('food-name');
    const foodKcalInput = document.getElementById('food-kcal');
    const foodPInput = document.getElementById('food-p');
    const foodCInput = document.getElementById('food-c');
    const foodFInput = document.getElementById('food-f');
    const bodyWeightInput = document.getElementById('body-weight-input');
    const hiddenDateInputFood = document.getElementById('hidden-date-input-food');

    const btnLogin = document.getElementById('btn-login');
    const btnSwitch = document.getElementById('btn-switch-auth');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const switchText = document.getElementById('auth-switch-text');

    // --- 1. AUTH LOGIKA (LOGIN / REGISTRACE) ---
    showScreen('screen-login');

    btnSwitch.addEventListener('click', () => {
        isRegistrationMode = !isRegistrationMode;
        if (isRegistrationMode) {
            authTitle.innerHTML = "Nová <span>Registrace</span>";
            authSubtitle.innerText = "Vytvoř si účet a začni makat";
            btnLogin.innerText = "Vytvořit účet";
            switchText.innerText = "Už máš účet?";
            btnSwitch.innerText = "Přihlásit se";
        } else {
            authTitle.innerHTML = "FitApp <span>Pro</span>";
            authSubtitle.innerText = "Tvůj osobní fitness deník";
            btnLogin.innerText = "Vstoupit do aplikace";
            switchText.innerText = "Ještě nemáš účet?";
            btnSwitch.innerText = "Zaregistrovat se";
        }
    });

    btnLogin.addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if (!email || !password) return alert("Vyplň prosím email i heslo.");

        if (isRegistrationMode) {
            const { data, error } = await _supabase.auth.signUp({ email, password });
            if (error) return alert("Chyba: " + error.message);
            alert("Registrace byla úspěšná! Nyní se můžeš přihlásit.");
            btnSwitch.click(); 
        } else {
            const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
            if (error) return alert("Chyba: " + error.message);
            currentUser = data.user;
            await fetchData();
            showScreen('screen-dashboard');
        }
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
        if(confirm('Odhlásit?')) {
            await _supabase.auth.signOut();
            location.reload();
        }
    });

    // --- 2. DATA A POMOCNÉ FUNKCE ---
    async function fetchData() {
        if (!currentUser) return;
        const { data: ex } = await _supabase.from('exercises').select('*').eq('user_id', currentUser.id);
        const { data: fd } = await _supabase.from('food').select('*').eq('user_id', currentUser.id);
        const { data: wg } = await _supabase.from('weights').select('*').eq('user_id', currentUser.id);
        
        dbExercises = ex || [];
        dbFood = fd || [];
        dbWeights = {};
        wg?.forEach(w => { dbWeights[new Date(w.date).toDateString()] = w.weight; });
        updateDateDisplay();
    }

    function showScreen(screenId) {
        document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
        window.scrollTo(0, 0);
        if (screenId === 'screen-progress') updateProgressStats();
        if (screenId === 'screen-food') renderFood();
    }

    function resetForm() {
        nameInput.value = ""; setsInput.value = ""; repsInput.value = "";
        weightInput.value = ""; kcalInput.value = ""; ratingInput.value = "";
        editIdInput.value = "";
        document.getElementById('form-title').innerText = "Co jsi dnes dělal?";
        document.getElementById('btn-text').innerText = "Přidat do deníku";
    }

    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('click', () => showScreen(card.dataset.target));
    });
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => showScreen(btn.dataset.target));
    });

    // --- 3. DATUM A KALENDÁŘ ---
    function updateDateDisplay() {
        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        const formatted = currentDate.toLocaleDateString('cs-CZ', options);
        document.getElementById('current-date').innerText = formatted;
        document.getElementById('current-date-food').innerText = formatted;
        document.getElementById('dashboard-date').innerText = "Dnes je " + formatted;
        
        const dateISO = currentDate.toISOString().split('T')[0];
        hiddenDateInput.value = dateISO;
        if(hiddenDateInputFood) hiddenDateInputFood.value = dateISO;
        bodyWeightInput.value = dbWeights[currentDate.toDateString()] || "";

        renderExercises();
        renderFood();
    }

    document.querySelector('.date-wrapper')?.addEventListener('click', () => hiddenDateInput.showPicker ? hiddenDateInput.showPicker() : hiddenDateInput.click());
    hiddenDateInput.addEventListener('change', (e) => { currentDate = new Date(e.target.value); updateDateDisplay(); });
    document.getElementById('prev-date').addEventListener('click', (e) => { e.stopPropagation(); currentDate.setDate(currentDate.getDate() - 1); updateDateDisplay(); });
    document.getElementById('next-date').addEventListener('click', (e) => { e.stopPropagation(); currentDate.setDate(currentDate.getDate() + 1); updateDateDisplay(); });

    document.getElementById('date-wrapper-food')?.addEventListener('click', () => hiddenDateInputFood.showPicker ? hiddenDateInputFood.showPicker() : hiddenDateInputFood.click());
    hiddenDateInputFood?.addEventListener('change', (e) => { currentDate = new Date(e.target.value); updateDateDisplay(); });
    document.getElementById('prev-date-food')?.addEventListener('click', (e) => { e.stopPropagation(); currentDate.setDate(currentDate.getDate() - 1); updateDateDisplay(); });
    document.getElementById('next-date-food')?.addEventListener('click', (e) => { e.stopPropagation(); currentDate.setDate(currentDate.getDate() + 1); updateDateDisplay(); });

    // --- 4. JÍDLO A VÁHA ---
    document.getElementById('btn-save-weight').addEventListener('click', async () => {
        const weightVal = bodyWeightInput.value;
        const dateISO = currentDate.toISOString().split('T')[0];
        await _supabase.from('weights').upsert({ user_id: currentUser.id, date: dateISO, weight: weightVal });
        dbWeights[currentDate.toDateString()] = weightVal;
        alert('Váha uložena!');
    });

    document.getElementById('btn-add-food')?.addEventListener('click', async () => {
        const name = foodNameInput.value.trim();
        const kcal = foodKcalInput.value;
        const p = foodPInput.value || 0;
        const c = foodCInput.value || 0;
        const f = foodFInput.value || 0;
        const dateISO = currentDate.toISOString().split('T')[0];

        if (!name || !kcal) {
            alert('Vyplň prosím název jídla a kalorie.');
            return;
        }

        if (currentUser) {
            const { error } = await _supabase.from('food').insert([{
                user_id: currentUser.id,
                name: name,
                kcal: parseInt(kcal),
                p: parseFloat(p),
                c: parseFloat(c),
                f: parseFloat(f),
                date: dateISO
            }]);

            if (error) {
                alert('Chyba při ukládání jídla: ' + error.message);
            } else {
                foodNameInput.value = "";
                foodKcalInput.value = "";
                foodPInput.value = "";
                foodCInput.value = "";
                foodFInput.value = "";
                
                alert('Jídlo uloženo!');
                await fetchData(); 
            }
        }
    });

    // --- 5. TRÉNINK (LOGIKA PŘIDÁVÁNÍ) ---
    document.getElementById('btn-add-exercise').addEventListener('click', async () => {
        const name = nameInput.value.trim();
        const editId = editIdInput.value;
        if (name && currentUser) {
            const data = {
                user_id: currentUser.id, 
                date: currentDate.toISOString().split('T')[0],
                phase: phaseInput.value, 
                name: name, 
                sets: setsInput.value,
                reps: repsInput.value, 
                weight: weightInput.value || 0,
                kcal: kcalInput.value || 0, 
                rating: ratingInput.value
            };
            
            if (editId) {
                await _supabase.from('exercises').update(data).eq('id', editId);
            } else {
                await _supabase.from('exercises').insert([data]);
            }
            
            await fetchData();   
            resetForm();         
            renderExercises();   
        }
    });
    
    function renderFood() {
        const wrapper = document.getElementById('food-list-wrapper');
        if (!wrapper) return;
        wrapper.innerHTML = "";
        const dateISO = currentDate.toISOString().split('T')[0];
        const todays = dbFood.filter(f => f.date === dateISO);
        let tKcal = 0, tP = 0, tC = 0, tF = 0;
        
        if (todays.length > 0) {
            let html = `<div class="phase-group"><div class="phase-title">Dnešní jídla</div><div class="phase-content">`;
            todays.forEach(f => {
                tKcal += Number(f.kcal); tP += Number(f.p); tC += Number(f.c); tF += Number(f.f);
                html += `
                    <div class="exercise-item">
                        <div class="exercise-info">
                            <h4>${f.name}</h4>
                            <p>🔥 ${f.kcal} kcal | B:${f.p}g S:${f.c}g T:${f.f}g</p>
                        </div>
                        <button class="delete-exercise" onclick="deleteFood(${f.id})"><i class="fas fa-trash"></i></button>
                    </div>`;
            });
            const summaryHtml = `<div class="content-card" style="border-left: 5px solid var(--green); margin-bottom: 20px;">
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); text-align: center;">
                    <div><small>Kcal</small><br><strong>${tKcal}</strong></div>
                    <div><small>Bíl</small><br><strong>${tP}g</strong></div>
                    <div><small>Sach</small><br><strong>${tC}g</strong></div>
                    <div><small>Tuky</small><br><strong>${tF}g</strong></div>
                </div></div>`;
            wrapper.innerHTML = summaryHtml + html + "</div></div>";
        }
    }

    window.deleteFood = async (id) => { if(confirm('Smazat jídlo?')) { await _supabase.from('food').delete().eq('id', id); await fetchData(); } };

    // --- OSTATNÍ FUNKCE ---
    nameInput.addEventListener('input', (e) => {
        const isCardio = /běh|kolo|plavání|kardio|brusle|chůze/i.test(e.target.value);
        setsInput.placeholder = isCardio ? "Km" : "Série";
        repsInput.placeholder = isCardio ? "Minuty" : "Opakování";
        weightInput.placeholder = isCardio ? "Tep (avg)" : "Váha (kg)";
    });

    // --- UPRAVENÁ FUNKCE S BAREVNÝM ROZLIŠENÍM ---
    function renderExercises() {
        const wrapper = document.getElementById('exercise-list-wrapper');
        if (!wrapper) return;
        wrapper.innerHTML = "";
        const dateISO = currentDate.toISOString().split('T')[0];
        const todays = dbExercises.filter(ex => ex.date === dateISO);
        const phases = ["Ráno", "Dopoledne", "Odpoledne", "Večer"];

        phases.forEach(phase => {
            const phaseExs = todays.filter(ex => ex.phase === phase);
            if (phaseExs.length > 0) {
                let html = `<div class="phase-group"><div class="phase-title">${phase}</div><div class="phase-content">`;
                phaseExs.forEach(ex => {
                    const isC = /běh|kolo|plavání|kardio|brusle|chůze/i.test(ex.name);
                    const borderColor = isC ? "#38bdf8" : "#fb7185"; // Modrá pro kardio, růžová pro sílu
                    
                    let detail = isC ? `🏁 ${ex.sets} km | ⏱️ ${ex.reps} min` : `${ex.sets}×${ex.reps} | <strong>${ex.weight} kg</strong>`;
                    
                    html += `
                        <div class="exercise-item" style="border-left: 5px solid ${borderColor};">
                            <div class="exercise-info">
                                <h4 style="color: ${borderColor};">${ex.name}</h4>
                                <p>${detail} ${ex.kcal ? `<span style="margin-left:10px;">🔥 ${ex.kcal} kcal</span>` : ''}</p>
                                ${ex.rating ? `<div class="rating-tag">${ex.rating}</div>` : ''}
                            </div>
                            <div class="action-btns">
                                <button class="edit-exercise" onclick="editEx(${ex.id})"><i class="fas fa-edit"></i></button>
                                <button class="delete-exercise" onclick="deleteEx(${ex.id})"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>`;
                });
                wrapper.insertAdjacentHTML('beforeend', html + "</div></div>");
            }
        });
    }

    window.editEx = (id) => {
        const ex = dbExercises.find(e => e.id == id);
        if (ex) {
            showScreen('screen-training');
            phaseInput.value = ex.phase; nameInput.value = ex.name;
            setsInput.value = ex.sets; repsInput.value = ex.reps;
            weightInput.value = ex.weight; kcalInput.value = ex.kcal;
            ratingInput.value = ex.rating; editIdInput.value = ex.id;
            document.getElementById('form-title').innerText = "Upravit záznam";
            document.getElementById('btn-text').innerText = "Uložit změny";
        }
    };

    window.deleteEx = async (id) => { if(confirm('Opravdu smazat?')) { await _supabase.from('exercises').delete().eq('id', id); await fetchData(); } };

    // --- 6. PROGRESS (ZŮSTÁVÁ STEJNÝ) ---
    filterSelect.addEventListener('change', () => updateProgressStats());

    function updateProgressStats() {
        const filterValue = filterSelect.value;
        const statsWrapper = document.getElementById('monthly-stats-wrapper');
        const allNames = [...new Set(dbExercises.map(ex => ex.name))].sort();
        
        filterSelect.innerHTML = '<option value="all">Všechny aktivity (Souhrn)</option><option value="weight_progress">Tělesná váha</option>';
        allNames.forEach(n => {
            const opt = document.createElement('option'); opt.value = n; opt.textContent = n;
            if (n === filterValue) opt.selected = true;
            filterSelect.appendChild(opt);
        });

        const lifeMax = {};
        dbExercises.forEach(ex => {
            const isC = /běh|kolo|plavání|kardio/i.test(ex.name);
            const val = Number(isC ? ex.reps : ex.weight) || 0;
            if (val <= 0) return;
            if (!lifeMax[ex.name]) lifeMax[ex.name] = val;
            else lifeMax[ex.name] = isC ? Math.min(lifeMax[ex.name], val) : Math.max(lifeMax[ex.name], val);
        });

        let filtered = (filterValue === 'all' || filterValue === 'weight_progress') ? dbExercises : dbExercises.filter(ex => ex.name === filterValue);
        statsWrapper.innerHTML = "";
        
        const months = {};
        filtered.forEach(ex => {
            const d = new Date(ex.date);
            const key = d.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
            if (!months[key]) months[key] = [];
            months[key].push(ex);
        });

        Object.keys(months).sort((a, b) => new Date(months[b][0].date) - new Date(months[a][0].date)).forEach(monthKey => {
            const monthData = months[monthKey];
            const uniqueDays = [...new Set(monthData.map(ex => ex.date))].length;
            const totalKcal = monthData.reduce((sum, ex) => sum + (Number(ex.kcal) || 0), 0);
            
            const monthBest = {};
            monthData.forEach(ex => {
                const isC = /běh|kolo|plavání|kardio/i.test(ex.name);
                const val = Number(isC ? ex.reps : ex.weight) || 0;
                const kmValue = isC ? (Number(ex.sets) || 0) : 0;

                if (!monthBest[ex.name]) {
                    monthBest[ex.name] = { val: val, unit: isC ? "min" : "kg", km: kmValue };
                } else {
                    if (isC ? (val < monthBest[ex.name].val && val > 0) : (val > monthBest[ex.name].val)) {
                        monthBest[ex.name].val = val;
                        monthBest[ex.name].km = kmValue;
                    }
                }
            });

            const card = document.createElement('div');
            card.className = 'content-card';
            card.innerHTML = `<h3 class="month-header">${monthKey}</h3>
                <div class="stats-grid">
                    <div class="stat-card"><span class="stat-label">Dny</span><span class="stat-value">${uniqueDays}</span></div>
                    <div class="stat-card"><span class="stat-label">Kalorie</span><span class="stat-value">${totalKcal}</span></div>
                    <div class="stat-card"><span class="stat-label">Maxima</span><span class="stat-value">${Object.keys(monthBest).length}</span></div>
                </div>
                <div class="records-area" style="margin-top:20px;">
                    ${Object.keys(monthBest).map(exName => {
                        const isLB = monthBest[exName].val === lifeMax[exName];
                        const isC = /běh|kolo|plavání|kardio/i.test(exName);
                        const valDisplay = isC ? `${monthBest[exName].val} ${monthBest[exName].unit} (${monthBest[exName].km} km)` : `${monthBest[exName].val} ${monthBest[exName].unit}`;
                        
                        return `<div class="record-item">
                            <span style="font-weight:600;">${exName}</span>
                            <div class="record-tags">
                                <span class="badge ${isLB ? 'life-best' : 'monthly-best'}">${isLB ? 'LifeBest' : 'MonthlyBest'}</span>
                                <span class="record-val">${valDisplay}</span>
                            </div></div>`;
                    }).join('')}
                </div>`;
            statsWrapper.appendChild(card);
        });
        updateChart(filterValue);
    }

    function updateChart(name) {
        const ctx = document.getElementById('progressChart');
        const container = document.getElementById('chart-container');
        if (!ctx) return;
        if (name === 'all') { container.style.display = 'none'; return; }

        let labels = [], values = [], extraData = [], labelTxt = "";
        const isC = /běh|kolo|plavání|kardio/i.test(name);

        if (name === 'weight_progress') {
            const sw = Object.keys(dbWeights).map(d => ({ d: new Date(d), v: dbWeights[d] })).filter(x => x.v).sort((a, b) => a.d - b.d);
            labels = sw.map(x => x.d.toLocaleDateString('cs-CZ'));
            values = sw.map(x => x.v);
            labelTxt = "Váha (kg)";
        } else {
            const sorted = dbExercises.filter(ex => ex.name === name).sort((a, b) => new Date(a.date) - new Date(b.date));
            labels = sorted.map(ex => new Date(ex.date).toLocaleDateString('cs-CZ'));
            values = sorted.map(ex => Number(isC ? ex.sets : ex.weight));
            extraData = sorted.map(ex => Number(ex.reps));
            labelTxt = isC ? "Vzdálenost (km)" : "Váha (kg)";
        }

        if (labels.length === 0) { container.style.display = 'none'; return; }
        container.style.display = 'block';
        if (myChart) myChart.destroy();

        myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{ 
                    label: labelTxt, 
                    data: values, 
                    borderColor: '#38bdf8', 
                    tension: 0.3, 
                    fill: true, 
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    extra: extraData 
                }]
            },
            options: {
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let val = context.parsed.y;
                                if (isC) {
                                    let mins = context.dataset.extra[context.dataIndex];
                                    return `${val} km (Čas: ${mins} min)`;
                                }
                                return `${val} kg`;
                            }
                        }
                    }
                }
            }
        });
    }

    updateDateDisplay();
});
