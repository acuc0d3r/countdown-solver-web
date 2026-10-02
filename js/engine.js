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

    // A "must use" expression is evaluated once up front, never enumerated, so it
    // needs no search budget and can use bounds looser than MAX_* above.
    const REQ_MAX = 1e15;
    const REQ_MAX_FACTORIAL = 18; // 18! = 6402373705728000 is the last factorial below 2^53
    const REQ_MAX_ROOT = 6;

    // Fast factorial lookup
    const FACTORIALS = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];

    const REQ_FACTORIALS = (function () {
        const table = [1];
        for (let i = 1; i <= REQ_MAX_FACTORIAL; i++) table[i] = table[i - 1] * i;
        return table;
    })();

    function rootLabel(degree) {
        return degree === 2 ? '\u221A' : degree + '\u221A';
    }

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
                const base = (this.op === '!') ? 2 : (this.op === '-') ? 1 : 3;
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
                if (this.op === '-') {
                    return `(-${this.left.formatted})`;
                }
                return `${rootLabel(this.degree)}(${this.left.formatted})`;
            }
            if (this.type === 'binary') {
                return `(${this.left.formatted} ${this.op} ${this.right.formatted})`;
            }
            return '';
        }

        // Same shape as `formatted`, but wraps the markNode subtree in a span so
        // the solution view can highlight the required expression. Only numbers and
        // a fixed operator vocabulary reach this string, so no escaping is needed.
        format(markNode) {
            if (markNode && this === markNode) {
                return `<span class="expr-mark">${this.formatted}</span>`;
            }
            if (this.type === 'num') return String(this.value);
            if (this.type === 'unary') {
                if (this.op === '!') return `(${this.left.format(markNode)}!)`;
                if (this.op === '-') return `(-${this.left.format(markNode)})`;
                return `${rootLabel(this.degree)}(${this.left.format(markNode)})`;
            }
            if (this.type === 'binary') {
                return `(${this.left.format(markNode)} ${this.op} ${this.right.format(markNode)})`;
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
                    } else if (node.op === '-') {
                        steps.push({ line: `-${childVal} = ${res}`, result: res });
                    } else if (node.op === 'sqrt') {
                        steps.push({ line: `${rootLabel(node.degree)}(${childVal}) = ${res}`, result: res });
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

    class RequiredError extends Error {}

    function requireWhole(v) {
        if (!Number.isSafeInteger(v)) throw new RequiredError('that does not give a whole number');
        if (Math.abs(v) > REQ_MAX) throw new RequiredError('that is too large to use');
        return v;
    }

    function buildBinary(op, left, right) {
        const a = left.value;
        const b = right.value;
        let v;
        if (op === '+') v = a + b;
        else if (op === '-') v = a - b;
        else if (op === '*') v = a * b;
        else {
            if (b === 0) throw new RequiredError('division by zero');
            if (!Number.isInteger(b) || a % b !== 0) {
                throw new RequiredError(`${a} ÷ ${b} is not a whole number`);
            }
            v = Math.floor(a / b);
        }
        return new ASTNode('binary', requireWhole(v), left, right, op);
    }

    function buildPower(base, exp) {
        const a = base.value;
        const b = exp.value;
        if (!Number.isInteger(b) || b < 0) {
            throw new RequiredError('an exponent must be a whole number of 0 or more');
        }
        if (a === 0 && b === 0) throw new RequiredError('0 to the power 0 is undefined');
        const v = Math.pow(a, b);
        if (!Number.isFinite(v)) throw new RequiredError('that is too large to use');
        return new ASTNode('binary', requireWhole(v), base, exp, '^');
    }

    function buildFactorial(node) {
        const v = node.value;
        if (!Number.isInteger(v) || v < 0) throw new RequiredError(`${v}! is undefined`);
        if (v > REQ_MAX_FACTORIAL) throw new RequiredError(`${v}! is too large (max ${REQ_MAX_FACTORIAL}!)`);
        return new ASTNode('unary', REQ_FACTORIALS[v], node, null, '!');
    }

    function buildRoot(degree, node) {
        const a = node.value;
        if (degree < 2 || degree > REQ_MAX_ROOT) {
            throw new RequiredError(`root degree must be between 2 and ${REQ_MAX_ROOT}`);
        }
        if (!Number.isInteger(a)) throw new RequiredError(`${rootLabel(degree)} needs a whole number inside`);
        if (a < 0) throw new RequiredError(`cannot take ${rootLabel(degree)} of a negative number`);
        const r = Math.round(Math.pow(a, 1 / degree));
        if (Math.pow(r, degree) !== a) {
            throw new RequiredError(`${rootLabel(degree)}(${a}) is not a whole number`);
        }
        return new ASTNode('unary', r, node, null, 'sqrt', degree);
    }

    function buildNegate(node) {
        return new ASTNode('unary', requireWhole(-node.value), node, null, '-');
    }

    function tokenizeRequired(src) {
        const tokens = [];
        let i = 0;
        while (i < src.length) {
            const c = src[i];
            if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
            if (c === '\u221A') { tokens.push({ kind: 'root' }); i++; continue; }
            if ((c === 's' || c === 'S') && src.slice(i, i + 4).toLowerCase() === 'sqrt') {
                tokens.push({ kind: 'root' });
                i += 4;
                continue;
            }
            if (c >= '0' && c <= '9') {
                let j = i;
                while (j < src.length && src[j] >= '0' && src[j] <= '9') j++;
                const raw = src.slice(i, j);
                if (raw.length > 15) throw new RequiredError('that number is too large');
                tokens.push({ kind: 'num', value: Number(raw) });
                i = j;
                continue;
            }
            if (c === '*' && src[i + 1] === '*') {
                tokens.push({ kind: 'op', value: '^' });
                i += 2;
                continue;
            }
            if ('+-*/^!'.indexOf(c) !== -1) { tokens.push({ kind: 'op', value: c }); i++; continue; }
            if (c === '(') { tokens.push({ kind: '(' }); i++; continue; }
            if (c === ')') { tokens.push({ kind: ')' }); i++; continue; }
            throw new RequiredError(`"${c}" is not allowed here`);
        }
        return tokens;
    }

    function parseRequiredTokens(tokens) {
        let pos = 0;

        function peek(offset) {
            return tokens[pos + (offset || 0)];
        }
        function isOp(value) {
            const t = peek();
            return !!t && t.kind === 'op' && t.value === value;
        }
        function startsPrimary(t) {
            return !!t && (t.kind === 'num' || t.kind === 'root' || t.kind === '(');
        }

        function parseSum() {
            let left = parseProduct();
            while (isOp('+') || isOp('-')) {
                const op = tokens[pos++].value;
                left = buildBinary(op, left, parseProduct());
            }
            return left;
        }

        function parseProduct() {
            let left = parseUnary();
            while (isOp('*') || isOp('/')) {
                const op = tokens[pos++].value;
                left = buildBinary(op, left, parseUnary());
            }
            return left;
        }

        function parseUnary() {
            if (isOp('-')) { pos++; return buildNegate(parseUnary()); }
            if (isOp('+')) { pos++; return parseUnary(); }
            return parsePower();
        }

        function parsePower() {
            const base = parsePostfix();
            if (isOp('^')) {
                pos++;
                return buildPower(base, parseUnary());
            }
            return base;
        }

        function parsePostfix() {
            let node = parsePrimary();
            while (isOp('!')) {
                pos++;
                node = buildFactorial(node);
            }
            return node;
        }

        function parsePrimary() {
            const t = peek();
            if (!t) throw new RequiredError('the expression is incomplete');
            if (t.kind === 'root') { pos++; return buildRoot(2, parsePrimary()); }
            if (t.kind === '(') {
                pos++;
                const inner = parseSum();
                if (!peek() || peek().kind !== ')') throw new RequiredError('a ")" is missing');
                pos++;
                return inner;
            }
            if (t.kind === 'num') {
                pos++;
                const after = peek();
                if (after && after.kind === 'root') {
                    pos++;
                    // "2√(9)" reads the number as the degree; a bare "9√" reads it
                    // as the radicand, which is only decided by what follows the symbol.
                    if (startsPrimary(peek())) return buildRoot(t.value, parsePrimary());
                    return buildRoot(2, new ASTNode('num', requireWhole(t.value)));
                }
                return new ASTNode('num', requireWhole(t.value));
            }
            throw new RequiredError('the expression is incomplete');
        }

        const node = parseSum();
        if (pos < tokens.length) throw new RequiredError('there is extra input at the end');
        return node;
    }

    function collectRequiredLiterals(node, out) {
        if (node.type === 'num') { out.push(node.value); return out; }
        if (node.left) collectRequiredLiterals(node.left, out);
        if (node.right) collectRequiredLiterals(node.right, out);
        return out;
    }

    // Unclaimed numbers stay in `remaining` and remain playable, so a must-use
    // expression costs the player its literals instead of granting a free value.
    function claimRequiredNumbers(node, numbers) {
        const literals = collectRequiredLiterals(node, []);
        if (!Array.isArray(numbers)) return { used: null, remaining: null };

        const pool = numbers.slice();
        const used = [];
        for (const lit of literals) {
            const idx = pool.indexOf(lit);
            if (idx === -1) {
                const needed = literals.filter(v => v === lit).length;
                const have = numbers.filter(v => v === lit).length;
                return {
                    used: null,
                    remaining: null,
                    error: needed > 1
                        ? `needs ${needed} ${lit}s but only ${have} added`
                        : `${lit} is not one of your numbers`
                };
            }
            pool.splice(idx, 1);
            used.push(lit);
        }
        return { used, remaining: pool };
    }

    function evaluateRequired(source, numbers) {
        const src = String(source == null ? '' : source).trim();
        if (!src) {
            return {
                ok: true, empty: true, value: null, node: null,
                used: [], remaining: Array.isArray(numbers) ? numbers.slice() : null
            };
        }
        try {
            const node = parseRequiredTokens(tokenizeRequired(src));
            const claim = claimRequiredNumbers(node, numbers);
            if (claim.error) {
                return { ok: false, empty: false, value: null, node: null, used: null, remaining: null, error: claim.error };
            }
            return {
                ok: true, empty: false, value: node.value, node: node,
                used: claim.used, remaining: claim.remaining
            };
        } catch (err) {
            if (err instanceof RequiredError) return { ok: false, empty: false, value: null, node: null, used: null, remaining: null, error: err.message };
            throw err;
        }
    }

    const defaultConfig = {
        allowFactorial: false,
        allowExponents: false,
        allowRoots: false,
        allowZeroMultiply: false,
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

        // The required expression enters as one pre-evaluated atom. It can only ever
        // leave the state by being combined into an answer, so using it is mandatory
        // by construction rather than by a check that could be missed.
        const required = config.required || null;
        const requiredNode = required && required.node ? required.node : null;
        if (requiredNode && Number.isFinite(required.value)) {
            initial.push({ val: required.value, node: requiredNode });
        }

        // Identity, not value: a required √(9) shares its value with a plain 3 already
        // in the number list, so matching on 3 would accept answers that never used it.
        function containsRequired(node) {
            if (node === requiredNode) return true;
            if (node.left && containsRequired(node.left)) return true;
            if (node.right && containsRequired(node.right)) return true;
            return false;
        }

        // A zero cannot move a non-zero target closer, so it only ever serves to neutralise
        // an awkward value; gating it keeps that escape hatch opt-in.
        const zeroOk = (v) => config.allowZeroMultiply || v !== 0;

        const solutions = [];
        const seenSignatures = new Set();
        const visited = new Set();

        function dfs(state, depth) {
            let reachedTarget = false;

            for (let i = 0; i < state.length; i++) {
                const item = state[i];
                if (item.val === target) {
                    // A hit that never folded in the required subtree is not a valid
                    // answer, and must not end the branch: that subtree is still in the
                    // state and may yet combine into one.
                    if (!requiredNode || containsRequired(item.node)) {
                        const sig = item.node.canonicalSignature;
                        if (!seenSignatures.has(sig)) {
                            seenSignatures.add(sig);
                            solutions.push({
                                node: item.node,
                                value: item.node.value,
                                formatted: item.node.formatted,
                                html: item.node.format(requiredNode),
                                steps: item.node.getEvaluationSteps(),
                                complexity: item.node.complexity
                            });
                        }
                        reachedTarget = true;
                    }
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
                        if (Number.isSafeInteger(valNew) && Math.abs(valNew) <= config.maxValue
                            && zeroOk(valNew)) {
                            const next = rest.concat([{ val: valNew, node: new ASTNode('binary', valNew, nodeA, nodeB, '*') }]);
                            dfs(next, depth + 1);
                            if (solutions.length >= config.maxSolutions) return;
                        }
                    }

                    // Division (/)
                    if (!config.excluded.has('/')) {
                        if (b !== 0 && a % b === 0) {
                            const valNew = Math.floor(a / b);
                            if (zeroOk(valNew)) {
                                const next = rest.concat([{ val: valNew, node: new ASTNode('binary', valNew, nodeA, nodeB, '/') }]);
                                dfs(next, depth + 1);
                                if (solutions.length >= config.maxSolutions) return;
                            }
                        }
                        if (a !== 0 && b % a === 0) {
                            const valNew = Math.floor(b / a);
                            if (zeroOk(valNew)) {
                                const next = rest.concat([{ val: valNew, node: new ASTNode('binary', valNew, nodeB, nodeA, '/') }]);
                                dfs(next, depth + 1);
                                if (solutions.length >= config.maxSolutions) return;
                            }
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

        // The DFS abandons its search at maxSolutions, so a full array does not mean
        // the list is complete. Callers report "N+" rather than an unproven total.
        solutions.truncated = solutions.length >= config.maxSolutions;
        return solutions;
    }

    return {
        solve,
        evaluateRequired,
        ASTNode,
        defaultConfig
    };
}));
