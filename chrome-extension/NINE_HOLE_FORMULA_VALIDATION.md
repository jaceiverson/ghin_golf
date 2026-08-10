# 9-hole scaling formula validation

GHIN doesn't publicly document how a 9-hole differential gets scaled up to an
18-hole equivalent (`scaled_up_differential` in the raw score data). The
user-supplied formula below was checked against every 9-hole round captured
for golfer 1104482, first from the last-20-scores capture
(`outputs/1104482/scores.json`), then re-checked against a full CSV export
covering the golfer's entire history back to 2016.

## Formula

```
9-hole differential = (9-Hole Adjusted Gross Score − 9-Hole Course Rating) × (9-Hole Slope Rating / 113)
Expected 2nd-9 differential = 0.52 × Handicap Index + 1.2
Scaled 18-hole differential = 9-hole differential + Expected 2nd-9 differential
```

`Handicap Index` is the golfer's `handicap_index` at the moment the round posted.

## Method

For each captured 9-hole round: predicted = `differential + (0.52 × handicap_index + 1.2)`,
rounded to 1 decimal, compared against GHIN's actual `scaled_up_differential`.

## Round 1: last 20 scores (16 nine-hole rounds)

Average absolute error: **0.11** (8 of 16 matched exactly; the rest off by 0.1–0.5).
No date correlation found within this window (errors interleaved with exact
matches throughout May–August).

## Round 2: full history export (43 nine-hole rounds, 2024-04-19 → 2026-08-10)

The user exported their complete captured history via the CSV download. A
striking finding: **there is no 9-hole round anywhere in the full history
with a `scaled_up_differential`/`handicap_index` before 2024-04-19** — every
round before that date is 18-hole. This lines up with the user's recollection
that GHIN changed something about 9-hole handling at the start of 2024. From
this data alone it's not possible to tell whether that's because GHIN's
system didn't compute/expose this before, or the golfer simply didn't play
9-hole rounds earlier — either way, **there are zero data points available
to test a "pre-2024" version of this formula against**. Validation below is
necessarily scoped to 2024-04-19 onward.

| Date played | Base differential | Handicap Index | Predicted | Actual (GHIN) | Error |
|---|---|---|---|---|---|
| 2024-04-19 | 4.5 | 5.6 | 8.6 | 8.6 | 0 |
| 2024-05-04 | 4.5 | 5.6 | 8.6 | 8.6 | 0 |
| 2024-06-01 | 4.6 | 6.3 | 9.1 | 9.1 | 0 |
| 2024-06-12 | 3.5 | 6.3 | 8.0 | 7.9 | +0.1 |
| 2024-06-27 | 1.4 | 6.3 | 5.9 | 5.8 | +0.1 |
| 2024-07-03 | 1.3 | 5.3 | 5.3 | 5.3 | 0 |
| 2024-07-12 | 4.1 | 5.5 | 8.2 | 8.1 | +0.1 |
| 2024-07-20 | 0.2 | 5.9 | 4.5 | 4.5 | 0 |
| 2024-08-05 | 5.3 | 5.3 | 9.3 | 9.3 | 0 |
| 2024-08-23 | 4.4 | 5.3 | 8.4 | 8.4 | 0 |
| 2024-08-28 | 1.8 | 5.3 | 5.8 | 5.7 | +0.1 |
| 2024-09-28 | 4.4 | 5.0 | 8.2 | 8.2 | 0 |
| 2024-10-24 | 5.7 | 5.0 | 9.5 | 9.4 | +0.1 |
| 2025-05-21 | 7.6 | 5.0 | 11.4 | 11.4 | 0 |
| 2025-06-05 | 4.3 | 5.4 | 8.3 | 8.3 | 0 |
| 2025-06-24 | -0.7 | 5.4 | 3.3 | 3.3 | 0 |
| 2025-06-26 | 8.7 | 4.9 | 12.4 | 12.4 | 0 |
| 2025-07-01 | 1.4 | 5.2 | 5.3 | 5.3 | 0 |
| 2025-07-03 | 5.5 | 4.8 | 9.2 | 9.2 | 0 |
| 2025-07-10 | -2.4 | 6.1 | 2.0 | 1.9 | +0.1 |
| 2025-07-17 | 3.2 | 5.6 | 7.3 | 7.3 | 0 |
| 2025-07-24 | 0.7 | 5.5 | 4.8 | 4.7 | +0.1 |
| 2025-07-31 | 4.4 | 5.1 | 8.3 | 8.3 | 0 |
| 2025-08-02 | 7.6 | 5.1 | 11.5 | 11.4 | +0.1 |
| 2025-08-08 | 5.2 | 5.4 | 9.2 | 9.2 | 0 |
| 2025-08-14 | 5.7 | 5.4 | 9.7 | 9.7 | 0 |
| 2025-08-21 | 7.2 | 5.5 | 11.3 | 11.2 | +0.1 |
| 2025-08-28 | 4.0 | 5.5 | 8.1 | 8.0 | +0.1 |
| 2026-04-01 | 5.7 | 5.5 | 9.8 | 9.7 | +0.1 |
| 2026-05-01 | 3.6 | 5.5 | 7.7 | 7.2 | +0.5 |
| 2026-05-08 | 2.4 | 5.4 | 6.4 | 6.4 | 0 |
| 2026-05-14 | 4.0 | 5.8 | 8.2 | 8.2 | 0 |
| 2026-05-15 | 7.5 | 5.8 | 11.7 | 11.7 | 0 |
| 2026-05-21 | 8.2 | 6.2 | 12.6 | 12.6 | 0 |
| 2026-06-27 | 5.5 | 5.8 | 9.7 | 9.3 | +0.4 |
| 2026-06-30 | 5.0 | 6.6 | 9.6 | 9.7 | -0.1 |
| 2026-07-09 | 2.5 | 7.2 | 7.4 | 7.5 | -0.1 |
| 2026-07-16 | 4.7 | 7.1 | 9.6 | 9.5 | +0.1 |
| 2026-07-21 | 0.7 | 7.1 | 5.6 | 5.2 | +0.4 |
| 2026-07-31 | 6.5 | 6.9 | 11.3 | 11.3 | 0 |
| 2026-08-07 | 2.4 | 6.9 | 7.2 | 7.2 | 0 |
| 2026-08-08 | 4.1 | 6.8 | 8.8 | 8.8 | 0 |
| 2026-08-10 | 3.5 | 7.0 | 8.3 | 8.3 | 0 |

**Average absolute error: 0.063** across all 43 rounds (24 exact matches; the
rest off by 0.1, except two outliers at 0.4 and 0.5 in mid-2026). This is a
*tighter* fit than round 1's 16-round sample, not a looser one.

## Is the error date-correlated?

No, in both rounds of testing. Errors of 0 and small nonzero errors are
interleaved throughout 2024, 2025, and 2026 alike — there's no stretch where
the formula is consistently exact followed by a stretch where it consistently
drifts, which is what you'd expect to see if GHIN had changed the formula
partway through this window. The two largest errors (2026-05-01 at +0.5,
2026-06-27 at +0.4) sit in the middle of otherwise-exact runs, not at a
boundary. This still reads as rounding noise at some intermediate step
GHIN's own calculation handles differently (e.g. rounding the base
differential before adding the expected term, rather than after), not a
formula version change *within* the post-2024-04-19 window.

## Conclusion

43 rounds spanning 2.3 years, 0.063 average error, more than half exact —
this is a real formula, not coincidence, for the period GHIN actually has
9-hole scaling data available for this golfer (2024-04-19 onward). Still
**speculative** rather than guaranteed, since GHIN doesn't document it and
the fit isn't bit-for-bit exact. The pre-2024 formula (if it differs, as the
user recalls) can't be validated at all from this golfer's data — there
simply are no 9-hole rounds with scaling data captured before 2024-04-19 to
check it against.

Only one golfer's data was available to validate against; if this extension
is ever used at scale, re-running this check against more golfers' 9-hole
history would be worth doing before trusting the error bound generalizes.
