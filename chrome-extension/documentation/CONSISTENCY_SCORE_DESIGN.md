# Consistency score redesign

The old consistency score was just a ratio: `(best8Handicap / otherHandicap) * 100`,
where `otherHandicap` is either the all-20-round average or the worst-12 average.
I wasn't happy with it, so I replaced it with a spread-based formula instead
(it's `consistencyScore()` in `calc.js` now).

## Why I didn't like the ratio

1. **It's biased toward skill.** Two golfers with basically the same real-world
   spread can score completely differently just because their handicap numbers
   are different sizes. In this example, Golfer A (0.9 handicap, 4.5-stroke
   spread) gets **16.7%**, while Golfer B (17.9 handicap, 4.2-stroke spread —
   almost the same spread) gets **81.0%**. That's rewarding a low handicap, not
   actual consistency.
2. **It breaks for plus handicaps.** If someone's a plus golfer, both numbers
   are negative, so the ratio flips back positive - it can even blow past 100%
   (best8 = -4, other = -2 gives you 200%).
3. **It's unstable near zero.** Dividing by a handicap that's close to zero is
   shaky no matter the sign - a near-scratch golfer's score can swing wildly
   from small changes in `otherHandicap`.

## The new formula

```
spread  = abs(otherHandicap - best8Handicap)
t       = clamp((spread - RAMP_START) / (RAMP_END - RAMP_START), 0, 1)
scale   = SCALE_MIN + (SCALE_MAX - SCALE_MIN) * t
excess  = max(0, spread - CONSISTENCY_BUFFER)
score   = clamp(100 * (1 - excess / scale), 0, 100)
```

Constants (all in `calc.js`):

| Constant | Value | Meaning |
|---|---|---|
| `CONSISTENCY_BUFFER` | 0.1 | Strokes of spread I'm treating as GHIN's own 1-decimal rounding noise, not real inconsistency. Small enough that 100% is basically unreachable in practice. |
| `RAMP_START` | 2 | Spread at/below which the scale stays at its strictest (9). |
| `RAMP_END` | 12 | Spread at/above which the scale is fully at its most lenient (18). |
| `SCALE_MIN` | 9 | Scale for tight golfers - each stroke of excess spread costs more. |
| `SCALE_MAX` | 18 | Scale for erratic golfers - each stroke of excess spread costs less. |

In short: the first 0.1 strokes of spread are free. Past that, the score drops
linearly as spread grows - but how fast it drops depends on the spread itself.
A tight golfer (spread ≤ 2) gets judged on the strict scale, an erratic golfer
(spread ≥ 12) gets judged on the lenient scale, and anything in between slides
smoothly along the ramp. This works the same regardless of the sign or
magnitude of either handicap, since only the spread between them matters.
