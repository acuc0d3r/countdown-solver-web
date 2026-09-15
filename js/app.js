// Countdown Watch Web App Controller
document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // State
    const state = {
        target: null,
        numbers: [],
        config: {
            allowFactorial: false,
            allowExponents: false,
            allowRoots: false,
            excluded: new Set()
        },
        keypad: {
            mode: 'target', // 'target' or 'number'
            buffer: ''
        }
    };

    // DOM Elements
    const views = {
        main: document.getElementById('main-view'),
        solution: document.getElementById('solution-view'),
        settings: document.getElementById('settings-view')
    };

    const dom = {
        targetBtn: document.getElementById('target-display-btn'),
        targetValue: document.getElementById('target-value'),
        numbersCount: document.getElementById('numbers-count'),
        numberChips: document.getElementById('number-chips'),
        btnClearNumbers: document.getElementById('btn-clear-numbers'),
        btnOpenNumKeypad: document.getElementById('btn-open-num-keypad'),
        btnSolve: document.getElementById('btn-solve'),
        solveBtnText: document.getElementById('solve-btn-text'),
        btnSettings: document.getElementById('btn-settings'),
        btnBackSettings: document.getElementById('btn-back-settings'),
        btnBackSolution: document.getElementById('btn-back-solution'),
        solutionTargetLabel: document.getElementById('solution-target-label'),
        solutionStepsList: document.getElementById('solution-steps-list'),
        solutionExprText: document.getElementById('solution-expr-text'),
        otherSolutionsContainer: document.getElementById('other-solutions-container'),
        otherCount: document.getElementById('other-count'),
        otherChevron: document.getElementById('other-chevron'),
        btnToggleOthers: document.getElementById('btn-toggle-others'),
        otherSolutionsList: document.getElementById('other-solutions-list'),
        // Settings elements
        toggleFactorial: document.getElementById('toggle-factorial'),
        toggleExponents: document.getElementById('toggle-exponents'),
        toggleRoots: document.getElementById('toggle-roots'),
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

    // Render Main View
    function renderMain() {
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
        const canSolve = state.target && state.target > 0 && state.numbers.length > 0;
        dom.btnSolve.disabled = !canSolve;
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
        if (state.keypad.buffer.length < maxLen) {
            if (state.keypad.buffer === '0') state.keypad.buffer = digit;
            else state.keypad.buffer += digit;
            haptic('light');
            updateKeypadDisplay();
        }
    }

    function backspace() {
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
    dom.toggleFactorial.addEventListener('change', (e) => {
        state.config.allowFactorial = e.target.checked;
        haptic('light');
    });

    dom.toggleExponents.addEventListener('change', (e) => {
        state.config.allowExponents = e.target.checked;
        haptic('light');
    });

    dom.toggleRoots.addEventListener('change', (e) => {
        state.config.allowRoots = e.target.checked;
        haptic('light');
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
            haptic('light');
        });
    });

    dom.btnResetRules.addEventListener('click', () => {
        haptic('warning');
        state.config.allowFactorial = false;
        state.config.allowExponents = false;
        state.config.allowRoots = false;
        state.config.excluded.clear();
        dom.toggleFactorial.checked = false;
        dom.toggleExponents.checked = false;
        dom.toggleRoots.checked = false;
        dom.excludeBtns.forEach(b => b.classList.remove('excluded'));
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
                const solutions = window.CountdownEngine.solve(
                    state.numbers,
                    state.target,
                    {
                        allowFactorial: state.config.allowFactorial,
                        allowExponents: state.config.allowExponents,
                        allowRoots: state.config.allowRoots,
                        excluded: state.config.excluded,
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
        dom.solutionTargetLabel.textContent = state.target;

        // Render step by step arithmetic
        dom.solutionStepsList.innerHTML = '';
        if (primary.steps && primary.steps.length > 0) {
            primary.steps.forEach(step => {
                const div = document.createElement('div');
                div.className = 'step-item';
                div.textContent = step.line;
                dom.solutionStepsList.appendChild(div);
            });
        } else {
            const div = document.createElement('div');
            div.className = 'step-item';
            div.textContent = primary.formatted;
            dom.solutionStepsList.appendChild(div);
        }

        // Render formula
        dom.solutionExprText.textContent = primary.formatted;

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
    renderMain();
});
