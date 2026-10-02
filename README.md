# Countdown Solver - Apple Watch Web Edition

An ultra-lightweight, high-performance Countdown Numbers game solver designed specifically for Apple Watch web browsers (µBrowser, WristWeb, or WebKit views) and mobile devices.

## Features
- **Ultra-Lightweight**: Pure Vanilla HTML5, CSS3, and JavaScript (~15KB gzipped) to keep memory use low on Apple Watch browser engines.
- **AMOLED True-Black Theme**: Designed for Apple Watch OLED displays with high-contrast color coding.
- **Native Number Entry**: Target and numbers are entered through standard `input type="number"` fields with a numeric keypad. Switch to the built-in keypad under **Rules → Input** if you prefer it; that choice is remembered.
- **Must-Use Expressions**: Optionally require the solution to include an expression such as `(3+4)!`, `√(9)`, `2^5`, or `3√(27)`. Every number in the expression must be one you added, and those numbers are spent by it — `(8+4)!` consumes your 8 and 4 instead of granting a free extra value. The required value is highlighted in the answer, and every result is guaranteed to use it.
- **Step-by-Step Arithmetic**: Outputs arithmetic steps line-by-line (e.g., `50 + 8 = 58`, `2 * 7 = 14`, `58 * 14 = 812`) as well as full algebraic expressions.
- **Touch & Keypad Optimized**: Large tactile tap targets, quick-add preset buttons (2 through 9), and a 3x4 numeric keypad modal with auto-dismiss.
- **Customizable Rules**: Enable/disable factorials (!), exponents (^), roots (√), exclude specific operations (+, -, *, /), block zero tricks, and switch number entry between native fields and the custom keypad. Rules persist across reloads.
- **Vercel Ready**: Ready for 1-click deployment to Vercel.

## Must-Use Expression Syntax

The **Must Use** field accepts whole-number arithmetic with `+`, `-`, `*`, `/`, `^` (or `**`), `!`,
parentheses, unary minus, and roots written as `√(9)`, `sqrt(9)`, `9√`, `3√(27)`.

Because Countdown arithmetic stays in whole numbers, every intermediate result must be a whole
number: `√(9)` and `3√(27)` are accepted, while `√(3)` is rejected with an explanation, as is `8/3`.

The expression is paid for out of your own numbers. Each literal has to match a number you added,
and matching numbers are removed from the pool for the rest of the puzzle, so they cannot also be
played on their own. `sqrt(9)` with no 9 added is rejected, `(3+3)` needs two 3s on the board, and
removing a number the expression depends on invalidates it immediately.

Because a spent number is no longer available to the rest of the solution, pick an expression whose
value can still reach your target. `(8+4)!` is `479001600`, so it needs to be brought back down —
dividing by `(7+6-5)!` and then by `9` gives `1320`.

## Zero Tricks

By default the solver will not produce a zero from `*` or `/`, which rules out neutralising an
awkward value instead of using it: with `(8+4)!` required, `(5-2-3)` is `0`, and
`7 + ((8+4)! * (5-2-3))` would reach `7` while treating the factorial as worthless. Turn on
**Rules → Solver Behaviour → Allow × 0** if you want those solutions back.


## Deployment to Vercel
```bash
# Push to GitHub, then import into Vercel, or deploy directly via Vercel CLI:
vercel
```
