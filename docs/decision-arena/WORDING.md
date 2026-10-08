# Decision Arena: wording rules

The report generator and every page or post built from an arena run follow
these rules. They exist because the sample is small and the cases were
written, and tuned, by RISE's authors.

1. **Agreement, not accuracy.** Say "agreement with author-written
   expectations". Never "accuracy", "correct", or "right answers" for the 39
   authored cases: the expectations are one author's taste, not ground truth.
2. **No ranking inside the noise.** When a paired bootstrap interval
   includes zero, is undefined, or rests on fewer than five shared cases
   (`withinNoise: true` from `scripts/arena/calibration.mjs`),
   do not order the deciders, name a winner, or use "better", "beats", or
   "leads". Say "no difference detectable at n = …".
3. **Calibration v1 tests stated-odds mechanics, not taste.** The
   known-probability controls check whether a decider puts the stated odds
   on the stated options. They say nothing about whether its reading choices
   are good.
4. **Results are per model id, date and release.** Every number carries the
   exact model id, the capture date and the RISE release (commit). Never
   generalise to a vendor or a model family, and say that frozen results age.
5. **Never "calibrated".** At most: "no miscalibration detectable at n = …"
   when the ECE sits below its simulated noise floor and the Brier interval
   is consistent with the stated odds. Report `confidence` and per-option
   probabilities separately; never merge them into one figure.
6. **Show the interval with the number.** Every Brier score, agreement rate
   and difference is printed with its 95% interval and its n. Reliability
   bins with fewer than 15 rows are marked as thin.
7. **Never pool repeats.** The runs of one decider ask the same cases, so
   they are not independent; an interval over all runs pooled is falsely
   narrow. State run 1 and show the other runs beside it as stability. Take
   agreement intervals and differences from the report's `agreement` block
   (`node scripts/arena/arena.mjs report`), never compute them on the page:
   explicit agreement carries a case-clustered bootstrap interval, contrast
   pairs a Wilson interval over run 1's pairs, and each difference a paired
   case-clustered interval with `withinNoise`.
