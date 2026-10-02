# Countdown Solver - Apple Watch Web Edition

An ultra-lightweight, high-performance Countdown Numbers game solver designed specifically for Apple Watch web browsers (µBrowser, WristWeb, or WebKit views) and mobile devices.

## Features
- **Ultra-Lightweight**: Pure Vanilla HTML5, CSS3, and JavaScript (~15KB gzipped) to keep memory use low on Apple Watch browser engines.
- **AMOLED True-Black Theme**: Designed for Apple Watch OLED displays with high-contrast color coding.
- **Native Number Entry**: Target and numbers are entered through standard `input type="number"` fields with a numeric keypad. Switch to the built-in keypad under **Rules → Input** if you prefer it; that choice is remembered.
- **Must-Use Expressions**: Optionally require the solution to include an expression such as `(3+4)!`, `√(9)`, `2^5`, or `3√(27)`. The required value is highlighted in the answer, and every result is guaranteed to use it.
- **Step-by-Step Arithmetic**: Outputs arithmetic steps line-by-line (e.g., `50 + 8 = 58`, `2 * 7 = 14`, `58 * 14 = 812`) as well as full algebraic expressions.
- **Touch & Keypad Optimized**: Large tactile tap targets, quick-add preset buttons (25, 50, 75, 100), and a 3x4 numeric keypad modal with auto-dismiss.
- **Customizable Rules**: Enable/disable factorials (!), exponents (^), roots (√), exclude specific operations (+, -, *, /), and switch number entry between native fields and the custom keypad. Rules persist across reloads.
- **Vercel Ready**: Ready for 1-click deployment to Vercel.

## Must-Use Expression Syntax

The **Must Use** field accepts whole-number arithmetic with `+`, `-`, `*`, `/`, `^` (or `**`), `!`,
parentheses, unary minus, and roots written as `√(9)`, `sqrt(9)`, `9√`, `3√(27)`.

Because Countdown arithmetic stays in whole numbers, every intermediate result must be a whole
number: `√(9)` and `3√(27)` are accepted, while `√(3)` is rejected with an explanation, as is `8/3`.


## Deployment to Vercel
```bash
# Push to GitHub, then import into Vercel, or deploy directly via Vercel CLI:
vercel
```
