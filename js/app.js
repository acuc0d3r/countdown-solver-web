// Countdown Watch Web App Controller
document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // State
    const state = {
        target: null,
        numbers: [],
        required: { ok: true, empty: true, value: null, node: null },
        keypadInput: false,
        config: {
            allowFactorial: false,
            allowExponents: false,
            allowRoots: false,
            allowZeroMultiply: false,
            excluded: new Set()
        },
        keypad: {
            mode: 'target', // 'target' or 'number'
            buffer: '',
            seeded: false
        }
    };

    const RULES_KEY = 'countdown.rules.v1';

    function saveRules() {
        try {
            localStorage.setItem(RULES_KEY, JSON.stringify({
                allowFactorial: state.config.allowFactorial,
                allowExponents: state.config.allowExponents,
                allowRoots: state.config.allowRoots,
                allowZeroMultiply: state.config.allowZeroMultiply,
                excluded: Array.from(state.config.excluded),
                keypadInput: state.keypadInput
            }));
        } catch (e) {
            // Private browsing or a full quota; rules just stay session-only.
        }
    }

    function loadRules() {
        let saved;
        try {
            const raw = localStorage.getItem(RULES_KEY);
            if (raw) saved = JSON.parse(raw);
        } catch (e) {
            // Unreadable or malformed storage; fall back to defaults.
        }
        if (!saved || typeof saved !== 'object') return;
        if (typeof saved.allowFactorial === 'boolean') state.config.allowFactorial = saved.allowFactorial;
        if (typeof saved.allowExponents === 'boolean') state.config.allowExponents = saved.allowExponents;
        if (typeof saved.allowRoots === 'boolean') state.config.allowRoots = saved.allowRoots;
        if (typeof saved.allowZeroMultiply === 'boolean') state.config.allowZeroMultiply = saved.allowZeroMultiply;
        if (Array.isArray(saved.excluded)) state.config.excluded = new Set(saved.excluded);
        if (typeof saved.keypadInput === 'boolean') state.keypadInput = saved.keypadInput;
    }

    // DOM Elements
    const views = {
        main: document.getElementById('main-view'),
        solution: document.getElementById('solution-view'),
        settings: document.getElementById('settings-view')
    };

    const dom = {
        targetBtn: document.getElementById('target-display-btn'),
        targetValue: document.getElementById('target-value'),
        targetInput: document.getElementById('target-input'),
        numbersCount: document.getElementById('numbers-count'),
        numberChips: document.getElementById('number-chips'),
        btnClearNumbers: document.getElementById('btn-clear-numbers'),
        numberInput: document.getElementById('number-input'),
        btnAddNumber: document.getElementById('btn-add-number'),
        nativeNumRow: document.getElementById('native-num-row'),
        btnOpenNumKeypad: document.getElementById('btn-open-num-keypad'),
        requiredInput: document.getElementById('required-input'),
        requiredFeedback: document.getElementById('required-feedback'),
        btnClearRequired: document.getElementById('btn-clear-required'),
        btnSolve: document.getElementById('btn-solve'),
        solveBtnText: document.getElementById('solve-btn-text'),
        btnSettings: document.getElementById('btn-settings'),
        btnBackSettings: document.getElementById('btn-back-settings'),
        btnBackSolution: document.getElementById('btn-back-solution'),
        solutionTargetLabel: document.getElementById('solution-target-label'),
        solutionRequiredBadge: document.getElementById('solution-required-badge'),
        solutionRequiredLabel: document.getElementById('solution-required-label'),
        solutionStepsList: document.getElementById('solution-steps-list'),
        solutionExprText: document.getElementById('solution-expr-text'),
        otherSolutionsContainer: document.getElementById('other-solutions-container'),
        otherCount: document.getElementById('other-count'),
        otherChevron: document.getElementById('other-chevron'),
        btnToggleOthers: document.getElementById('btn-toggle-others'),
        otherSolutionsList: document.getElementById('other-solutions-list'),
        // Settings elements
        toggleKeypadMode: document.getElementById('toggle-keypad-mode'),
        toggleFactorial: document.getElementById('toggle-factorial'),
        toggleExponents: document.getElementById('toggle-exponents'),
        toggleRoots: document.getElementById('toggle-roots'),
        toggleZeroMultiply: document.getElementById('toggle-zero-multiply'),
        excludeBtns: document.querySelectorAll('.exclude-btn'),
        btnResetRules: document.getElementById('btn-reset-rules'),
        // Keypad modal
        keypadModal: document.getElementById('keypad-modal'),
        keypadTitle: document.getElementById('keypad-title'),
        keypadDisplay: document.getElementById('keypad-display'),
        btnKeypadBackspace: document.getElementById('btn-keypad-backspace'),
        btnKeypadConfirm: document.getElementById('btn-keypad-confirm'),
        btnKeypadCancel: document.getElementById('btn-keypad-cancel'),
        numKeys: document.querySelectorAll('.num-key[data-key]'),
        presetBtns: document.querySelectorAll('.preset-btn'),
        // Toast
        toast: document.getElementById('alert-toast')
    };

    // Haptics helper
    function haptic(type = 'light') {
        if ('vibrate' in navigator) {
            try {
                if (type === 'light') navigator.vibrate(10);
                else if (type === 'success') navigator.vibrate([15, 30, 20]);
                else if (type === 'warning') navigator.vibrate([30, 40, 30]);
            } catch (e) {}
        }
    }

    // Toast helper
    let toastTimeout = null;
    function showToast(msg) {
        if (toastTimeout) clearTimeout(toastTimeout);
        dom.toast.textContent = msg;
        dom.toast.classList.remove('hidden');
        toastTimeout = setTimeout(() => {
            dom.toast.classList.add('hidden');
        }, 2200);
    }

    // View Navigation
    function showView(viewName) {
        haptic('light');
        Object.keys(views).forEach(name => {
            if (name === viewName) {
                views[name].classList.add('active');
            } else {
                views[name].classList.remove('active');
            }
        });
        window.scrollTo(0, 0);
    }

    // Native Input Helpers
    function readWholeNumber(input) {
        const raw = input.value.trim();
        if (!/^\d+$/.test(raw)) return null;
        const val = parseInt(raw, 10);
        if (!Number.isSafeInteger(val) || val <= 0) return null;
        return val;
    }

    function addNumber(val) {
        if (val === null) return false;
        if (val > 9999) {
            showToast('Numbers go up to 9999');
            return false;
        }
        state.numbers.push(val);
        return true;
    }

    function applyInputMode() {
        const keypadMode = state.keypadInput;
        dom.toggleKeypadMode.checked = keypadMode;
        dom.targetInput.classList.toggle('hidden', keypadMode);
        dom.targetBtn.classList.toggle('hidden', !keypadMode);
        dom.nativeNumRow.classList.toggle('hidden', keypadMode);
        dom.btnOpenNumKeypad.classList.toggle('hidden', !keypadMode);
        // Carry the target across when handing off to the keypad.
        if (keypadMode) {
            const nativeTarget = readWholeNumber(dom.targetInput);
            if (nativeTarget !== null) state.target = nativeTarget;
            if (dom.numberInput.value.trim()) dom.numberInput.value = '';
        }
    }

    // Render Main View
    function renderMain() {
        syncRequired();

        // Target display
        if (state.target && state.target > 0) {
            dom.targetValue.textContent = state.target;
            dom.targetValue.classList.remove('placeholder');
        } else {
            dom.targetValue.textContent = 'Set Target';
            dom.targetValue.classList.add('placeholder');
        }

        // Numbers display
        dom.numbersCount.textContent = state.numbers.length;
        dom.numberChips.innerHTML = '';

        if (state.numbers.length > 0) {
            dom.btnClearNumbers.classList.remove('hidden');
            state.numbers.forEach((num, idx) => {
                const chip = document.createElement('div');
                chip.className = 'chip';
                chip.innerHTML = `<span>${num}</span><span class="chip-del">✕</span>`;
                chip.addEventListener('click', () => {
                    haptic('light');
                    state.numbers.splice(idx, 1);
                    renderMain();
                });
                dom.numberChips.appendChild(chip);
            });
        } else {
            dom.btnClearNumbers.classList.add('hidden');
        }

        // Solve button state
        const requiredReady = state.required.ok || !dom.requiredInput.value.trim();
        const canSolve = state.target && state.target > 0 && state.numbers.length > 0 && requiredReady;
        dom.btnSolve.disabled = !canSolve;
    }

    // Required Expression Field
    function renderRequired() {
        const hasText = dom.requiredInput.value.trim().length > 0;
        dom.btnClearRequired.classList.toggle('hidden', !hasText);

        const fb = dom.requiredFeedback;
        fb.classList.add('hidden');
        if (!hasText) { fb.textContent = ''; return; }

        if (state.required.ok) {
            const used = state.required.used || [];
            const suffix = used.length ? ` · uses ${used.join(', ')}` : '';
            fb.textContent = `= ${state.required.value}${suffix}`;
            fb.classList.remove('error');
        } else {
            fb.textContent = state.required.error;
            fb.classList.add('error');
        }
        fb.classList.remove('hidden');
    }

    function handleRequiredInput() {
        renderMain();
    }

    // No early return on empty input: state must reset, or a cleared expression
    // would keep being enforced at solve time.
    function syncRequired() {
        state.required = window.CountdownEngine.evaluateRequired(dom.requiredInput.value, state.numbers);
        renderRequired();
    }

    function clearRequired() {
        dom.requiredInput.value = '';
        state.required = window.CountdownEngine.evaluateRequired('', state.numbers);
        haptic('light');
        renderRequired();
        renderMain();
    }

    // Keypad Logic
    function openKeypad(mode) {
        state.keypad.mode = mode;
        state.keypad.buffer = '';

        if (mode === 'target') {
            dom.keypadTitle.textContent = 'SET TARGET';
            if (state.target) state.keypad.buffer = String(state.target);
        } else {
            dom.keypadTitle.textContent = 'ADD NUMBER';
        }
        state.keypad.seeded = state.keypad.buffer.length > 0;

        updateKeypadDisplay();
        dom.keypadModal.classList.remove('hidden');
        haptic('light');
    }

    function closeKeypad() {
        dom.keypadModal.classList.add('hidden');
        haptic('light');
    }

    function updateKeypadDisplay() {
        dom.keypadDisplay.textContent = state.keypad.buffer || '0';
        const val = parseInt(state.keypad.buffer, 10);
        dom.btnKeypadConfirm.disabled = !(val && val > 0);
    }

    function appendDigit(digit) {
        const maxLen = state.keypad.mode === 'target' ? 4 : 3;
        // A buffer pre-filled from the existing target is replaced on first press,
        // so retyping a value does not append to it.
        if (state.keypad.seeded) {
            state.keypad.buffer = '';
            state.keypad.seeded = false;
        }
        if (state.keypad.buffer.length < maxLen) {
            if (state.keypad.buffer === '0') state.keypad.buffer = digit;
            else state.keypad.buffer += digit;
            haptic('light');
            updateKeypadDisplay();
        }
    }

    function backspace() {
        state.keypad.seeded = false;
        if (state.keypad.buffer.length > 0) {
            state.keypad.buffer = state.keypad.buffer.slice(0, -1);
            haptic('light');
            updateKeypadDisplay();
        }
    }

    function confirmKeypad() {
        const val = parseInt(state.keypad.buffer, 10);
        if (!val || val <= 0) return;

        haptic('success');
        if (state.keypad.mode === 'target') {
            state.target = val;
        } else {
            state.numbers.push(val);
        }

        closeKeypad(); // Automatically close modal after adding!
        renderMain();
    }

    // Quick Presets
    dom.presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const val = parseInt(btn.dataset.val, 10);
            if (val) {
                haptic('success');
                state.numbers.push(val);
                renderMain();
            }
        });
    });

    // Native Target Input
    dom.targetInput.addEventListener('input', () => {
        const val = readWholeNumber(dom.targetInput);
        if (val !== null) state.target = val;
        else state.target = null;
        renderMain();
    });

    dom.targetInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !dom.btnSolve.disabled) {
            e.preventDefault();
            dom.btnSolve.click();
        }
    });

    // Native Number Input
    function submitNumberInput() {
        if (!dom.numberInput.value.trim()) return;
        const val = readWholeNumber(dom.numberInput);
        if (val === null) {
            showToast('Enter a whole number');
            return;
        }
        if (!addNumber(val)) return;
        haptic('success');
        dom.numberInput.value = '';
        renderMain();
        dom.numberInput.focus();
    }

    dom.btnAddNumber.addEventListener('click', submitNumberInput);
    dom.numberInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitNumberInput();
        }
    });

    // Required Expression Input
    dom.requiredInput.addEventListener('input', handleRequiredInput);
    dom.btnClearRequired.addEventListener('click', clearRequired);

    // Keypad Event Listeners
    dom.numKeys.forEach(btn => {
        btn.addEventListener('click', () => appendDigit(btn.dataset.key));
    });

    dom.btnKeypadBackspace.addEventListener('click', backspace);
    dom.btnKeypadConfirm.addEventListener('click', confirmKeypad);
    dom.btnKeypadCancel.addEventListener('click', closeKeypad);

    dom.targetBtn.addEventListener('click', () => openKeypad('target'));
    dom.btnOpenNumKeypad.addEventListener('click', () => openKeypad('number'));

    dom.btnClearNumbers.addEventListener('click', () => {
        haptic('warning');
        state.numbers = [];
        renderMain();
    });

    // Navigation Buttons
    dom.btnSettings.addEventListener('click', () => showView('settings'));
    dom.btnBackSettings.addEventListener('click', () => showView('main'));
    dom.btnBackSolution.addEventListener('click', () => showView('main'));

    // Settings Toggle Handlers
    dom.toggleKeypadMode.addEventListener('change', (e) => {
        state.keypadInput = e.target.checked;
        saveRules();
        applyInputMode();
        renderMain();
        haptic('light');
    });

    [['toggleFactorial', 'allowFactorial'],
     ['toggleExponents', 'allowExponents'],
     ['toggleRoots', 'allowRoots'],
     ['toggleZeroMultiply', 'allowZeroMultiply']].forEach(([toggleKey, configKey]) => {
        dom[toggleKey].addEventListener('change', (e) => {
            state.config[configKey] = e.target.checked;
            saveRules();
            haptic('light');
        });
    });

    dom.excludeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const op = btn.dataset.op;
            if (state.config.excluded.has(op)) {
                state.config.excluded.delete(op);
                btn.classList.remove('excluded');
            } else {
                state.config.excluded.add(op);
                btn.classList.add('excluded');
            }
            saveRules();
            haptic('light');
        });
    });

    dom.btnResetRules.addEventListener('click', () => {
        haptic('warning');
        state.config.allowFactorial = false;
        state.config.allowExponents = false;
        state.config.allowRoots = false;
        state.config.allowZeroMultiply = false;
        state.config.excluded.clear();
        dom.toggleFactorial.checked = false;
        dom.toggleExponents.checked = false;
        dom.toggleRoots.checked = false;
        dom.toggleZeroMultiply.checked = false;
        dom.excludeBtns.forEach(b => b.classList.remove('excluded'));
        saveRules();
        showToast('Rules reset to default');
    });

    // Collapsible Other Solutions
    dom.btnToggleOthers.addEventListener('click', () => {
        const isHidden = dom.otherSolutionsList.classList.toggle('hidden');
        dom.otherChevron.textContent = isHidden ? '▾' : '▴';
        haptic('light');
    });

    // Solve Handler
    dom.btnSolve.addEventListener('click', () => {
        if (!state.target || state.numbers.length === 0) return;

        haptic('light');
        dom.btnSolve.disabled = true;
        dom.btnSolve.innerHTML = `<div class="spinner"></div><span>Solving...</span>`;

        // Run asynchronously via setTimeout so UI renders spinner
        setTimeout(() => {
            try {
                const usingRequired = state.required.ok && !state.required.empty;
                const requiredArg = usingRequired
                    ? { value: state.required.value, node: state.required.node }
                    : null;
                const pool = usingRequired ? state.required.remaining : state.numbers;

                const solutions = window.CountdownEngine.solve(
                    pool,
                    state.target,
                    {
                        allowFactorial: state.config.allowFactorial,
                        allowExponents: state.config.allowExponents,
allowRoots: state.config.allowRoots,
                        allowZeroMultiply: state.config.allowZeroMultiply,
                        excluded: state.config.excluded,
                        required: requiredArg,
                        maxSolutions: 8
                    }
                );

                dom.btnSolve.innerHTML = `<svg class="play-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>Solve</span>`;
                dom.btnSolve.disabled = false;

                if (solutions.length > 0) {
                    haptic('success');
                    displaySolution(solutions);
                    showView('solution');
                } else {
                    haptic('warning');
                    showToast('No solution found');
                }
            } catch (err) {
                console.error(err);
                dom.btnSolve.innerHTML = `<svg class="play-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>Solve</span>`;
                dom.btnSolve.disabled = false;
                showToast('Solver encountered an error');
            }
        }, 30);
    });

    function displaySolution(solutions) {
        const primary = solutions[0];
        const req = (state.required.ok && !state.required.empty) ? state.required : null;
        dom.solutionTargetLabel.textContent = state.target;

        if (req) {
            dom.solutionRequiredBadge.classList.remove('hidden');
            dom.solutionRequiredLabel.textContent = req.node.formatted;
        } else {
            dom.solutionRequiredBadge.classList.add('hidden');
        }

        // No prepend for the required expression: the solver only returns answers that
        // contain it, so getEvaluationSteps() already walks it.
        const steps = (primary.steps && primary.steps.length > 0)
            ? primary.steps
            : [{ line: primary.formatted, result: primary.value }];

        dom.solutionStepsList.innerHTML = '';
        steps.forEach(step => {
            const div = document.createElement('div');
            div.className = 'step-item';
            div.textContent = step.line;
            dom.solutionStepsList.appendChild(div);
        });

        if (req && primary.html) {
            dom.solutionExprText.innerHTML = primary.html;
        } else {
            dom.solutionExprText.textContent = primary.formatted;
        }

        // Render alternative solutions
        if (solutions.length > 1) {
            dom.otherSolutionsContainer.classList.remove('hidden');
            dom.otherCount.textContent = solutions.length - 1;
            dom.otherSolutionsList.innerHTML = '';
            dom.otherSolutionsList.classList.add('hidden');
            dom.otherChevron.textContent = '▾';

            for (let i = 1; i < solutions.length; i++) {
                const item = document.createElement('div');
                item.className = 'other-item';
                item.textContent = solutions[i].formatted;
                dom.otherSolutionsList.appendChild(item);
            }
        } else {
            dom.otherSolutionsContainer.classList.add('hidden');
        }
    }

    // Initialize
    loadRules();
    dom.toggleFactorial.checked = state.config.allowFactorial;
    dom.toggleExponents.checked = state.config.allowExponents;
    dom.toggleRoots.checked = state.config.allowRoots;
    dom.toggleZeroMultiply.checked = state.config.allowZeroMultiply;
    state.config.excluded.forEach(op => {
        const btn = document.querySelector(`.exclude-btn[data-op="${op}"]`);
        if (btn) btn.classList.add('excluded');
    });
    applyInputMode();
    renderRequired();
    renderMain();
});
