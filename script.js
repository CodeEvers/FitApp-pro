// --- KONFIGURACE SUPABASE ---
const SUPABASE_URL = 'https://cafvdjmjwevbmunydhtq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhZnZkam1qd2V2Ym11bnlkaHRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MjU0MDMsImV4cCI6MjA5MDEwMTQwM30.BVQNZhecgDD_s3S2jQ9kJ16_M0R54obbmYIcftx0c08';

// --- KONFIGURACE GEMINI AI ---
const GEMINI_API_KEY = 'AIzaSyAzmIgocC7RvMu_Qnht_xWDXZSdvBNa1H4';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    // --- INICIALIZACE PROMĚNNÝCH ---
    let dbExercises = [];
    let dbFood = [];
    let dbWeights = {};
    let currentDate = new Date();
    let myChart = null;
    let currentUser = null;
    let isRegistrationMode = false;

    // --- DOM ELEMENTY (TRÉNINK) ---
    const phaseInput = document.getElementById('exercise-phase');
    const nameInput = document.getElementById('exercise-name');
    const setsInput = document.getElementById('exercise-sets');
    const repsInput = document.getElementById('exercise-reps');
    const weightInput = document.getElementById('exercise-weight');
    const kcalInput = document.getElementById('exercise-kcal');
    const ratingInput = document.getElementById('exercise-rating');
    const editIdInput = document.getElementById('edit-id');
    const filterSelect = document.getElementById('filter-activity');
    const timeFilter = document.getElementById('filter-time'); 
    const hiddenDateInput = document.getElementById('hidden-date-input');

    // --- DYNAMICKÉ PŘEPÍNÁNÍ POLÍČEK (Běh -> Tepovka) ---
    nameInput.addEventListener('input', () => {
        const val = nameInput.value.toLowerCase();
        const isKardio = /běh|kolo|plavání|kardio|brusle|chůze|row/i.test(val);

        if (isKardio) {
            setsInput.placeholder = "Kilometry (km)";
            repsInput.placeholder = "Čas (min)";
            // ZDE OPRAVENO: Místo kalorií nastavujeme Tepovku
            if (weightInput) weightInput.placeholder = "Tepovka (bpm) - volitelné";
        } else {
            setsInput.placeholder = "Série";
            repsInput.placeholder = "Opakování";
            if (weightInput) weightInput.placeholder = "Váha (kg)";
        }
    });

    // --- DOM ELEMENTY (JÍDLO A VÁHA) ---
    const foodNameInput = document.getElementById('food-name');
    const foodKcalInput = document.getElementById('food-kcal');
    const foodPInput = document.getElementById('food-p');
    const foodCInput = document.getElementById('food-c');
    const foodFInput = document.getElementById('food-f');
    const bodyWeightInput = document.getElementById('body-weight-input');
    const hiddenDateInputFood = document.getElementById('hidden-date-input-food');
    
    const btnOpenWeight = document.getElementById('btn-open-weight');
    const weightSetup = document.getElementById('weight-setup'); 

    // --- DOM ELEMENTY (CÍLE) ---
    const btnOpenGoals = document.getElementById('btn-open-goals');
    const goalsSetup = document.getElementById('goals-setup');
    const btnCalculateGoals = document.getElementById('btn-calculate-goals');
    const goalAge = document.getElementById('goal-age');
    const goalHeight = document.getElementById('goal-height');
    const goalGender = document.getElementById('goal-gender');
    const goalActivity = document.getElementById('goal-activity');
    const goalType = document.getElementById('goal-type');

    // --- DOM ELEMENTY (AUTH) ---
    const btnLogin = document.getElementById('btn-login');
    const btnSwitch = document.getElementById('btn-switch-auth');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const switchText = document.getElementById('auth-switch-text');

    // --- 1. AUTH LOGIKA ---
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
        setsInput.placeholder = "Série";
        repsInput.placeholder = "Opakování";
        weightInput.placeholder = "Váha (kg)";
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

        const todayWeight = dbWeights[currentDate.toDateString()];
        if (todayWeight) {
            bodyWeightInput.value = todayWeight;
            if (btnOpenWeight) btnOpenWeight.innerText = `Moje váha: ${todayWeight} kg (Upravit)`;
            if (weightSetup) weightSetup.style.display = 'none'; 
        } else {
            bodyWeightInput.value = "";
            if (btnOpenWeight) btnOpenWeight.innerText = "Zadat dnešní váhu";
            if (weightSetup) weightSetup.style.display = 'none'; 
        }

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

    // --- 4. LOGIKA CÍLŮ A VÁHY ---
    btnOpenWeight?.addEventListener('click', () => {
        weightSetup.style.display = weightSetup.style.display === 'none' ? 'block' : 'none';
        goalsSetup.style.display = 'none'; 
    });

    btnOpenGoals?.addEventListener('click', () => {
        goalsSetup.style.display = goalsSetup.style.display === 'none' ? 'block' : 'none';
        if (weightSetup) weightSetup.style.display = 'none'; 
    });

    btnCalculateGoals?.addEventListener('click', async () => {
        const age = parseInt(goalAge.value);
        const height = parseInt(goalHeight.value);
        const weight = parseFloat(bodyWeightInput.value);
        const gender = goalGender.value;
        const activity = parseFloat(goalActivity.value);
        const goalModifier = parseInt(goalType.value);

        if (!age || !height || !weight) {
            alert("Prosím nejprve zadej a ulož svou váhu, abych mohl vypočítat tvůj cíl.");
            if(weightSetup) weightSetup.style.display = 'block';
            return;
        }

        let bmr = (10 * weight) + (6.25 * height) - (5 * age);
        bmr = (gender === 'male') ? bmr + 5 : bmr - 161;
        const totalKcal = Math.round((bmr * activity) + goalModifier);
        
        const myGoals = {
            kcal: totalKcal,
            p: Math.round((totalKcal * 0.25) / 4),
            c: Math.round((totalKcal * 0.45) / 4),
            f: Math.round((totalKcal * 0.30) / 9)
        };

        localStorage.setItem('userGoals', JSON.stringify(myGoals));
        alert(`Tvůj denní cíl byl nastaven na ${totalKcal} kcal!`);
        goalsSetup.style.display = 'none';
        renderFood();
    });

    // --- 5. JÍDLO A VÁHA ---
    document.getElementById('btn-save-weight').addEventListener('click', async () => {
        const weightVal = bodyWeightInput.value;
        if (!weightVal) return alert("Prosím zadej váhu.");
        
        const dateISO = currentDate.toISOString().split('T')[0];
        await _supabase.from('weights').upsert({ user_id: currentUser.id, date: dateISO, weight: weightVal });
        dbWeights[currentDate.toDateString()] = weightVal;
        
        alert('Váha uložena!');
        updateDateDisplay();
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
                foodNameInput.value = ""; foodKcalInput.value = "";
                foodPInput.value = ""; foodCInput.value = ""; foodFInput.value = "";
                alert('Jídlo uloženo!');
                await fetchData(); 
            }
        }
    });

    function renderFood() {
        const wrapper = document.getElementById('food-list-wrapper');
        if (!wrapper) return;
        wrapper.innerHTML = "";
        const dateISO = currentDate.toISOString().split('T')[0];
        const todays = dbFood.filter(f => f.date === dateISO);
        let tKcal = 0, tP = 0, tC = 0, tF = 0;
        
        todays.forEach(f => {
            tKcal += Number(f.kcal); tP += Number(f.p); tC += Number(f.c); tF += Number(f.f);
        });

        const savedGoals = JSON.parse(localStorage.getItem('userGoals')) || { kcal: 2000, p: 150, c: 250, f: 70 };
        const diffKcal = savedGoals.kcal - tKcal;

        const summaryHtml = `
            <div class="content-card" style="border-left: 5px solid var(--green); margin-bottom: 20px;">
                <h3 style="text-align:center; margin-bottom:15px; font-size: 0.9rem; color: var(--text-dim);">Zbývá na dnešek</h3>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); text-align: center;">
                    <div><small>Kcal</small><br><strong style="color: ${diffKcal < 0 ? '#fb7185' : '#4ade80'}">${diffKcal}</strong></div>
                    <div><small>Bíl</small><br><strong>${Math.max(0, Math.round(savedGoals.p - tP))}g</strong></div>
                    <div><small>Sach</small><br><strong>${Math.max(0, Math.round(savedGoals.c - tC))}g</strong></div>
                    <div><small>Tuky</small><br><strong>${Math.max(0, Math.round(savedGoals.f - tF))}g</strong></div>
                </div>
            </div>`;

        let listHtml = `<div class="phase-group"><div class="phase-title">Dnešní jídla</div><div class="phase-content">`;
        if (todays.length > 0) {
            todays.forEach(f => {
                listHtml += `
                    <div class="exercise-item">
                        <div class="exercise-info">
                            <h4>${f.name}</h4>
                            <p>🔥 ${f.kcal} kcal | B:${f.p}g S:${f.c}g T:${f.f}g</p>
                        </div>
                        <button class="delete-exercise" onclick="deleteFood(${f.id})"><i class="fas fa-trash"></i></button>
                    </div>`;
            });
            wrapper.innerHTML = summaryHtml + listHtml + "</div></div>";
        } else {
            wrapper.innerHTML = summaryHtml + `<p style="text-align:center; color:var(--text-dim); margin-top:20px;">Zatím žádná jídla.</p>`;
        }
    }

    window.deleteFood = async (id) => { if(confirm('Smazat jídlo?')) { await _supabase.from('food').delete().eq('id', id); await fetchData(); } };

    // --- 6. TRÉNINK (LOGIKA) ---
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
            
            if (editId) await _supabase.from('exercises').update(data).eq('id', editId);
            else await _supabase.from('exercises').insert([data]);
            
            await fetchData();   
            resetForm();         
            renderExercises();   
        }
    });

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
                    const mainColor = isC ? "#38bdf8" : "#fb7185";
                    const bgColor = isC ? "rgba(56, 189, 248, 0.15)" : "rgba(251, 113, 133, 0.15)";
                    // ZDE OPRAVENO: Pro kardio přidána ikonka srdíčka a bpm
                    let detail = isC ? `🏁 ${ex.sets} km | ⏱️ ${ex.reps} min | ❤️ ${ex.weight} bpm` : `${ex.sets}×${ex.reps} | <strong>${ex.weight} kg</strong>`;
                    
                    html += `
                        <div class="exercise-item" style="background-color: ${bgColor}; border-left: none; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 15px 20px;">
                            <div class="exercise-info">
                                <h4 style="color: ${mainColor}; margin-bottom: 4px;">${ex.name}</h4>
                                <p style="color: ${mainColor}; opacity: 0.9;">${detail} ${ex.kcal ? `<span style="margin-left:10px;">🔥 ${ex.kcal} kcal</span>` : ''}</p>
                                ${ex.rating ? `<div class="rating-tag" style="background: rgba(255,255,255,0.1); color: #fff;">${ex.rating}</div>` : ''}
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
            nameInput.dispatchEvent(new Event('input'));
        }
    };

    window.deleteEx = async (id) => { if(confirm('Opravdu smazat?')) { await _supabase.from('exercises').delete().eq('id', id); await fetchData(); } };

    // --- 7. PROGRESS A GRAFY (ÚPRAVA PRO VYHLEDÁVÁNÍ) ---
    filterSelect.addEventListener('change', () => updateProgressStats());
    timeFilter.addEventListener('input', () => updateProgressStats()); 

    function updateProgressStats() {
        const filterValue = filterSelect.value;
        const timeValue = timeFilter.value; 
        const statsWrapper = document.getElementById('monthly-stats-wrapper');
        
        const activeDates = [...new Set(dbExercises.map(ex => ex.date))].sort((a,b) => new Date(b) - new Date(a));
        let streak = 0;
        let checkDate = new Date();
        checkDate.setHours(0,0,0,0);
        for (let i = 0; i < activeDates.length; i++) {
            let logDate = new Date(activeDates[i]);
            logDate.setHours(0,0,0,0);
            let diff = Math.floor((checkDate - logDate) / (1000 * 60 * 60 * 24));
            if (diff === 0) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
            else if (diff === 1 && i === 0) { checkDate.setDate(checkDate.getDate() - 2); streak++; }
            else break;
        }
        document.getElementById('streak-value').innerHTML = `<i class="fas fa-fire streak-fire"></i>${streak}`;

        const allNames = [...new Set(dbExercises.map(ex => ex.name))].sort();
        filterSelect.innerHTML = '<option value="all">Všechny aktivity (Souhrn)</option><option value="weight_progress">Tělesná váha</option>';
        allNames.forEach(n => {
            const opt = document.createElement('option'); opt.value = n; opt.textContent = n;
            if (n === filterValue) opt.selected = true;
            filterSelect.appendChild(opt);
        });

        let filtered = dbExercises.filter(ex => {
            const matchesActivity = (filterValue === 'all' || filterValue === 'weight_progress' || ex.name === filterValue);
            const matchesTime = (timeValue === 'all' || timeValue === "" || ex.date.includes(timeValue));
            return matchesActivity && matchesTime;
        });

        statsWrapper.innerHTML = "";
        
        const months = {};
        filtered.forEach(ex => {
            const d = new Date(ex.date);
            const key = d.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
            if (!months[key]) months[key] = [];
            months[key].push(ex);
        });

        const lifeMax = {};
        dbExercises.forEach(ex => {
            const isC = /běh|kolo|plavání|kardio|chůze/i.test(ex.name);
            const val = Number(isC ? ex.reps : ex.weight) || 0;
            if (val <= 0) return;
            if (!lifeMax[ex.name]) lifeMax[ex.name] = val;
            else lifeMax[ex.name] = isC ? Math.min(lifeMax[ex.name], val) : Math.max(lifeMax[ex.name], val);
        });

        Object.keys(months).sort((a, b) => new Date(months[b][0].date) - new Date(months[a][0].date)).forEach(monthKey => {
            const monthData = months[monthKey];
            monthData.sort((a, b) => new Date(b.date) - new Date(a.date)); 

            const uniqueDays = [...new Set(monthData.map(ex => ex.date))].length;
            const totalKcal = monthData.reduce((sum, ex) => sum + (Number(ex.kcal) || 0), 0);
            
            const card = document.createElement('div');
            card.className = 'content-card';
            card.innerHTML = `
                <h3 class="month-header">${monthKey}</h3>
                <div class="stats-grid">
                    <div class="stat-card"><span class="stat-label">Dny</span><span class="stat-value">${uniqueDays}</span></div>
                    <div class="stat-card"><span class="stat-label">Kalorie</span><span class="stat-value">${totalKcal}</span></div>
                    <div class="stat-card"><span class="stat-label">Záznamů</span><span class="stat-value">${monthData.length}</span></div>
                </div>
                <div class="records-area" style="margin-top:20px;">
                    ${monthData.map(ex => {
                        const isC = /běh|kolo|plavání|kardio|chůze/i.test(ex.name);
                        const val = Number(isC ? ex.reps : ex.weight);
                        const isLB = val > 0 && val === lifeMax[ex.name];
                        const dateDay = new Date(ex.date).getDate();
                        const valDisplay = isC ? `${ex.reps} min (${ex.sets} km)` : `${ex.sets}×${ex.reps} | ${ex.weight} kg`;
                        
                        return `
                            <div class="record-item" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding: 10px 0;">
                                <div style="display:flex; flex-direction:column;">
                                    <span style="font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase;">${dateDay}. ${monthKey.split(' ')[0]}</span>
                                    <span style="font-weight:600; color: ${isC ? '#38bdf8' : '#fb7185'};">${ex.name}</span>
                                </div>
                                <div class="record-tags">
                                    ${isLB ? '<span class="badge life-best">LifeBest</span>' : ''}
                                    <span class="record-val" style="font-size: 0.85rem;">${valDisplay}</span>
                                </div>
                            </div>`;
                    }).join('')}
                </div>`;
            statsWrapper.appendChild(card);
        });

        const dynamicVal = document.getElementById('dynamic-stat-value');
        const dynamicLabel = document.getElementById('dynamic-stat-label');
        const totalKcalVal = document.getElementById('total-kcal-value');

        const currentKcal = filtered.reduce((s, ex) => s + (Number(ex.kcal) || 0), 0);
        totalKcalVal.innerText = currentKcal.toLocaleString();

        if (filterValue === 'all' || filterValue === 'weight_progress') {
            dynamicVal.innerText = filtered.length;
            dynamicLabel.innerText = "Celkem aktivit";
        } else {
            const isC = /běh|kolo|plavání|kardio/i.test(filterValue);
            if (isC) {
                const totalKm = filtered.reduce((s, ex) => s + (Number(ex.sets) || 0), 0);
                dynamicVal.innerText = totalKm.toFixed(1);
                dynamicLabel.innerText = "Celkem km";
            } else {
                const maxW = filtered.length > 0 ? Math.max(...filtered.map(ex => Number(ex.weight) || 0)) : 0;
                dynamicVal.innerText = maxW;
                dynamicLabel.innerText = "Max váha (kg)";
            }
        }
        updateChart(filterValue, timeValue);
    }

    function updateChart(name, timeRange) {
        const ctx = document.getElementById('progressChart');
        const container = document.getElementById('chart-container');
        if (!ctx) return;
        if (name === 'all') { container.style.display = 'none'; return; }

        let labels = [], values = [], extraData = [], labelTxt = "";
        const isC = /běh|kolo|plavání|kardio/i.test(name);

        if (name === 'weight_progress') {
            const sw = Object.keys(dbWeights)
                .map(d => ({ d: new Date(d), v: dbWeights[d], iso: new Date(d).toISOString().split('T')[0] }))
                .filter(x => x.v && (timeRange === 'all' || timeRange === "" || x.iso.includes(timeRange)))
                .sort((a, b) => a.d - b.d);
            labels = sw.map(x => x.d.toLocaleDateString('cs-CZ'));
            values = sw.map(x => x.v);
            labelTxt = "Váha (kg)";
        } else {
            const sorted = dbExercises
                .filter(ex => ex.name === name && (timeRange === 'all' || timeRange === "" || ex.date.includes(timeRange)))
                .sort((a, b) => new Date(a.date) - new Date(b.date));
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
            }
        });
    }

    // --- AI TRENÉR LOGIKA ---
    async function getAiRecommendation() {
        const loader = document.getElementById('ai-loader');
        const outputArea = document.getElementById('ai-response-area');
        const outputText = document.getElementById('ai-text-output');
        const btn = document.getElementById('btn-generate-plan');

        if (!GEMINI_API_KEY || GEMINI_API_KEY === 'SEM_VLOŽ_SVŮJ_KLÍČ_Z_GOOGLE_AI_STUDIO') {
            alert("Prosím vlož svůj API klíč do kódu (GEMINI_API_KEY).");
            return;
        }

        loader.style.display = 'block';
        outputArea.style.display = 'none';
        btn.disabled = true;

        try {
            // 1. STÁHNEME DATA ZE SUPABASE
            const { data: recentEx } = await _supabase
                .from('exercises')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('date', { ascending: false })
                .limit(10);

            // 2. VYTVOŘÍME KONTEXT
            const workoutHistory = recentEx && recentEx.length > 0 
                ? recentEx.map(ex => `- ${ex.date}: ${ex.name} (${ex.sets}x${ex.reps}, ${ex.weight}kg, pocity: ${ex.rating || 'neuvedeno'})`).join('\n')
                : "Uživatel zatím nemá žádné záznamy tréninků.";

            const prompt = `Jsi profesionální fitness trenér a stratég. Tvůj svěřenec chce radu na dnešek.
            Jeho historie tréninků:
            ${workoutHistory}
            
            Na základě těchto dat mu napiš doporučení na dnešek. 
            - Pokud včera dřel (např. těžké dřepy) a cítil se zničeně, navrhni spíše odpočinek.
            - Pokud má pauzu, motivuj ho.
            - Piš česky, stručně (max 3-4 věty) a buď konkrétní a lidský.`;

            // 3. ZAVOLÁME GEMINI API
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const result = await response.json();
            
            if (result.candidates && result.candidates[0].content.parts[0].text) {
                outputText.innerText = result.candidates[0].content.parts[0].text;
                outputArea.style.display = 'block';
            } else {
                throw new Error("AI nevrátilo platnou odpověď.");
            }

        } catch (error) {
            console.error("AI Error:", error);
            outputText.innerText = "Chyba při spojení s AI trenérem. Zkontroluj API klíč.";
            outputArea.style.display = 'block';
        } finally {
            loader.style.display = 'none';
            btn.disabled = false;
        }
    }

    // Listener pro AI tlačítko
    document.getElementById('btn-generate-plan')?.addEventListener('click', getAiRecommendation);

    // --- INICIALIZACE ---
    updateDateDisplay();
});
