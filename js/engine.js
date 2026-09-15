// Countdown Solver Engine - High Performance & Lightweight
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CountdownEngine = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const MAX_VALUE = 1000000;
    const MAX_DEPTH = 6;
    const MAX_FACTORIAL = 8;
    const MAX_EXPONENT = 6;
    const MAX_ROOT = 6;

    // Fast factorial lookup
    const FACTORIALS = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];

    function safeFactorial(n) {
        if (Number.isInteger(n) && n >= 0 && n <= MAX_FACTORIAL) {
            return FACTORIALS[n];
        }
        return null;
    }

    function safePower(a, b) {
        if (Number.isInteger(a) && Number.isInteger(b) && b >= 0 && b <= MAX_EXPONENT) {
            if (a === 0 && b === 0) return null;
            const res = Math.pow(a, b);
            if (Number.isSafeInteger(res) && Math.abs(res) <= MAX_VALUE) {
                return res;
            }
        }
        return null;
    }

    function safeRoot(a, k) {
        if (!Number.isInteger(a) || a < 0 || k < 2 || k > MAX_ROOT) return null;
        const r = Math.round(Math.pow(a, 1 / k));
        if (Math.pow(r, k) === a) {
            return r;
        }
        return null;
    }

    // AST Representation
    class ASTNode {
        constructor(type, value, left = null, right = null, op = '', degree = 2) {
            this.type = type; // 'num', 'binary', 'unary'
            this.value = value;
            this.left = left;
            this.right = right;
            this.op = op; // '+', '-', '*', '/', '^', '!', 'sqrt'
            this.degree = degree;
        }

        get complexity() {
            if (this.type === 'num') return 0;
            if (this.type === 'unary') {
                const base = (this.op === '!') ? 2 : 3;
                return (this.left ? this.left.complexity : 0) + base;
            }
            if (this.type === 'binary') {
                let opWeight = 1;
                if (this.op === '*' || this.op === '/') opWeight = 2;
                if (this.op === '^') opWeight = 4;
                return (this.left ? this.left.complexity : 0) + (this.right ? this.right.complexity : 0) + opWeight;
            }
            return 0;
        }

        get formatted() {
            if (this.type === 'num') return String(this.value);
            if (this.type === 'unary') {
                if (this.op === '!') {
                    return `(${this.left.formatted}!)`;
                }
                if (this.op === 'sqrt') {
                    return (this.degree === 2) ? `√(${this.left.formatted})` : `(${this.degree}√(${this.left.formatted}))`;
                }
            }
            if (this.type === 'binary') {
                return `(${this.left.formatted} ${this.op} ${this.right.formatted})`;
            }
            return '';
        }

        get canonicalSignature() {
            if (this.type === 'num') return `N:${this.value}`;
            if (this.type === 'unary') return `U:${this.op}:${this.degree}:${this.left.canonicalSignature}`;
            if (this.type === 'binary') {
                const s1 = this.left.canonicalSignature;
                const s2 = this.right.canonicalSignature;
                if (this.op === '+' || this.op === '*') {
                    return s1 < s2 ? `B:${this.op}(${s1},${s2})` : `B:${this.op}(${s2},${s1})`;
                }
                return `B:${this.op}(${s1},${s2})`;
            }
            return '';
        }

        getEvaluationSteps() {
            const steps = [];
            function traverse(node) {
                if (node.type === 'num') return node.value;
                if (node.type === 'unary') {
                    const childVal = traverse(node.left);
                    let res = node.value;
                    if (node.op === '!') {
                        steps.push({ line: `${childVal}! = ${res}`, result: res });
                    } else if (node.op === 'sqrt') {
                        const degStr = node.degree === 2 ? '√' : `${node.degree}√`;
                        steps.push({ line: `${degStr}(${childVal}) = ${res}`, result: res });
                    }
                    return res;
                }
                if (node.type === 'binary') {
                    const lVal = traverse(node.left);
                    const rVal = traverse(node.right);
                    const res = node.value;
                    steps.push({ line: `${lVal} ${node.op} ${rVal} = ${res}`, result: res });
                    return res;
                }
                return node.value;
            }
            traverse(this);
            return steps;
        }
    }

    const defaultConfig = {
        allowFactorial: false,
        allowExponents: false,
        allowRoots: false,
        excluded: new Set(),
        maxDepth: MAX_DEPTH,
        maxValue: MAX_VALUE,
        maxSolutions: 10
    };

    function solve(numbers, target, customConfig = {}) {
        const config = Object.assign({}, defaultConfig, customConfig);
        if (customConfig.excluded && Array.isArray(customConfig.excluded)) {
            config.excluded = new Set(customConfig.excluded);
        } else if (!config.excluded) {
            config.excluded = new Set();
        }

        const initial = numbers.map(n => ({
            val: n,
            node: new ASTNode('num', n)
        }));

        const solutions = [];
        const seenSignatures = new Set();
        const visited = new Set();

        function dfs(state, depth) {
            let reachedTarget = false;

            for (let i = 0; i < state.length; i++) {
                const item = state[i];
                if (item.val === target) {
                    const sig = item.node.canonicalSignature;
                    if (!seenSignatures.has(sig)) {
                        seenSignatures.add(sig);
                        solutions.push({
                            node: item.node,
                            formatted: item.node.formatted,
                            steps: item.node.getEvaluationSteps(),
                            complexity: item.node.complexity
                        });
                    }
                    reachedTarget = true;
                }
            }

            if (reachedTarget || depth >= config.maxDepth) {
                return;
            }

            // State key for pruning: sorted values + depth
            const values = state.map(s => s.val).sort((a, b) => a - b);
            const stateKey = `${values.join(',')}|${depth}`;
            if (visited.has(stateKey)) return;
            visited.add(stateKey);

            const n = state.length;

            // Unary Operations
            for (let i = 0; i < n; i++) {
                const item = state[i];
                const val = item.val;
                const node = item.node;

                // Factorial
                if (config.allowFactorial) {
                    const f = safeFactorial(val);
                    if (f !== null && f !== val && Math.abs(f) <= config.maxValue && !config.excluded.has(`${val}!`)) {
                        const next = state.slice();
                        next[i] = { val: f, node: new ASTNode('unary', f, node, null, '!') };
                        dfs(next, depth + 1);
                        if (solutions.length >= config.maxSolutions) return;
                    }
                }

                // Roots
                if (config.allowRoots) {
                    for (let k = 2; k <= MAX_ROOT; k++) {
                        const r = safeRoot(val, k);
                        if (r !== null && r !== val) {
                            const exclKey = k === 2 ? `sqrt(${val})` : `sqrt[${k}](${val})`;
                            if (!config.excluded.has(exclKey)) {
                                const next = state.slice();
                                next[i] = { val: r, node: new ASTNode('unary', r, node, null, 'sqrt', k) };
                                dfs(next, depth + 1);
                                if (solutions.length >= config.maxSolutions) return;
                            }
                        }
                    }
                }
            }

            // Binary Operations
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    const a = state[i].val;
                    const nodeA = state[i].node;
                    const b = state[j].val;
                    const nodeB = state[j].node;

                    const rest = [];
                    for (let k = 0; k < n; k++) {
                        if (k !== i && k !== j) rest.push(state[k]);
                    }

                    // Addition (+)
                    if (!config.excluded.has('+')) {
                        const valNew = a + b;
                        if (Math.abs(valNew) <= config.maxValue) {
                            const next = rest.concat([{ val: valNew, node: new ASTNode('binary', valNew, nodeA, nodeB, '+') }]);
                            dfs(next, depth + 1);
                            if (solutions.length >= config.maxSolutions) return;
                        }
                    }

                    // Subtraction (-)
                    if (!config.excluded.has('-')) {
                        // a - b
                        const val1 = a - b;
                        if (Math.abs(val1) <= config.maxValue) {
                            const next = rest.concat([{ val: val1, node: new ASTNode('binary', val1, nodeA, nodeB, '-') }]);
                            dfs(next, depth + 1);
                            if (solutions.length >= config.maxSolutions) return;
                        }
                        // b - a
                        const val2 = b - a;
                        if (Math.abs(val2) <= config.maxValue) {
                            const next = rest.concat([{ val: val2, node: new ASTNode('binary', val2, nodeB, nodeA, '-') }]);
                            dfs(next, depth + 1);
                            if (solutions.length >= config.maxSolutions) return;
                        }
                    }

                    // Multiplication (*)
                    if (!config.excluded.has('*')) {
                        const valNew = a * b;
                        if (Number.isSafeInteger(valNew) && Math.abs(valNew) <= config.maxValue) {
                            const next = rest.concat([{ val: valNew, node: new ASTNode('binary', valNew, nodeA, nodeB, '*') }]);
                            dfs(next, depth + 1);
                            if (solutions.length >= config.maxSolutions) return;
                        }
                    }

                    // Division (/)
                    if (!config.excluded.has('/')) {
                        if (b !== 0 && a % b === 0) {
                            const valNew = Math.floor(a / b);
                            const next = rest.concat([{ val: valNew, node: new ASTNode('binary', valNew, nodeA, nodeB, '/') }]);
                            dfs(next, depth + 1);
                            if (solutions.length >= config.maxSolutions) return;
                        }
                        if (a !== 0 && b % a === 0) {
                            const valNew = Math.floor(b / a);
                            const next = rest.concat([{ val: valNew, node: new ASTNode('binary', valNew, nodeB, nodeA, '/') }]);
                            dfs(next, depth + 1);
                            if (solutions.length >= config.maxSolutions) return;
                        }
                    }

                    // Exponent (^)
                    if (config.allowExponents) {
                        const p1 = safePower(a, b);
                        if (p1 !== null && !config.excluded.has(`${a}^${b}`)) {
                            const next = rest.concat([{ val: p1, node: new ASTNode('binary', p1, nodeA, nodeB, '^') }]);
                            dfs(next, depth + 1);
                            if (solutions.length >= config.maxSolutions) return;
                        }
                        const p2 = safePower(b, a);
                        if (p2 !== null && !config.excluded.has(`${b}^${a}`)) {
                            const next = rest.concat([{ val: p2, node: new ASTNode('binary', p2, nodeB, nodeA, '^') }]);
                            dfs(next, depth + 1);
                            if (solutions.length >= config.maxSolutions) return;
                        }
                    }
                }
            }
        }

        dfs(initial, 0);

        // Sort by complexity ascending (simplest solutions first)
        solutions.sort((a, b) => a.complexity - b.complexity);
        return solutions;
    }

    return {
        solve,
        ASTNode,
        defaultConfig
    };
}));
