# The Futurist Manifesto: the proofing diff

Every change RISE made to produce `manifeste.proofed.md` (from French Wikisource) and `initial-manifesto.proofed.md` (from the Internet Archive's OCR of the 1912 catalogue), for a person to read against the page images. Both passes were made by a model on 2026-10-17, reading every word against the scans.

## Counts

- French: 2055 words; 10 changes from Wikisource's text (5 transcription slips set back to the print, 4 printer's errors corrected, 1 space set as printed), listed in full below; the reprint's note under the title left out. `[?]`: 0.
- English: 1178 words; 34 hunks, 75 corrected or new lines, 5 OCR lines removed (three page numbers and the two lines of the plate caption); 1 printer's error corrected. `[?]`: 0.

## French: every change from Wikisource

Page numbers are the scan's (djvu page / printed page). Wikisource's reading first, then the reading served.

Transcription slips, where Wikisource's text differs from the print; set back to the print:

1. djvu 16 / p. 12: "D’une âme patiente et tatillonne" → "tâtillonne" (the print has the circumflex).
2. djvu 16 / p. 12: "en abandonnant dans le fossè" → "fossé".
3. djvu 22 / p. 18: "si ce n’st la contorsion" → "n’est".
4. djvu 22 / p. 18: "la fréqueniation quotidienne" → "fréquentation".
5. djvu 23 / p. 19: "plus jeunes et plus raillants que nous" → "vaillants".

Printer's errors in the 1909 reprint, where the print breaks the sense; corrected, the printed reading recorded here:

6. djvu 14 / p. 10: "nos cadavres tordus ne bagues byzantines" → "en bagues byzantines".
7. djvu 20 / p. 16: "d’archéologues de cicérones et d’antiquaires" → "d’archéologues, de cicérones et d’antiquaires" (a comma lost from the list).
8. djvu 21 / p. 17: "aux pieds de la Joconde. nous le concevons" → "Joconde, nous le concevons".
9. djvu 24 / p. 20: "accroupis près de nos aréoplanes" → "aéroplanes" (the word is spelled aright on p. 16).

Spacing:

10. djvu 13 / p. 9: "sur la terre!…" → "sur la terre !…" (the print sets the space).

Already corrected by Wikisource and kept: djvu 19 / p. 15 prints "l’éternelle vitesse omniprésente," with a comma before point 9; Wikisource sets a full stop.

## English: every change, OCR line to proofed line

Each hunk names the OCR file's line numbers; `-` is the OCR line, `+` the proofed line before lines are joined into paragraphs. A hunk with only `-` lines removed them. Blank lines are not compared.

```diff
@@ OCR line 1–4 @@
-Initial Manifesto of Futurism.
-t, We shail sing the love of danger, the habit of energy
+## Initial Manifesto of Futurism
+1. We shall sing the love of danger, the habit of energy
@@ OCR line 8 @@
-during, and rebellion,
+daring, and rebellion.
@@ OCR line 16–20 @@
-enriched by a new beauty ; the beauty of speed. A racing
-motoy-cay, its frame adorned with great pipes, like
-snakes with explosive breath . . . a roaring motor-car,
-which looks as though vunning on shrapnel, is more
-beautiful than the Victory OF SAMOTHRACE.
+enriched by a new beauty; the beauty of speed. A racing
+motor-car, its frame adorned with great pipes, like
+snakes with explosive breath… a roaring motor-car,
+which looks as though running on shrapnel, is more
+beautiful than the Victory of Samothrace.
@@ OCR line 23–24 @@
-whose ideal stem tvansfixes the Earth, rushing over the
-civcuit of her orbit.
+whose ideal stem transfixes the Earth, rushing over the
+circuit of her orbit.
@@ OCR line 28 @@
-jeyvour of the primordial elements.
+fervour of the primordial elements.
@@ OCR line 36–42 @@
-guries!. .. Why should we look behind us, when we
-4
-have to break in the mysterious portals of the Impossible ?
+turies!… Why should we look behind us, when we
+have to break in the mysterious portals of the Impossible?
@@ OCR line 50–52 @@
-Joy woman.
-to. We wish to destroy the museums, the libraries, to
+for woman.
+10. We wish to destroy the museums, the libraries, to
@@ OCR line 56–64 @@
-11, We shall sing of the great crowds in the excitement
-of labour, pleasure or rebellion ; of the multi-coloured and
-polyphonic surf of vevolutions in modern capital
-cities ; of the nocturnal vibration of arsenals and workshops
-beneath theiy violent electric moons ; of the greedy stations
-swallowing smoking snakes ; of factories suspended from
-the clouds by their strings of smoke , of bridges leaping
-like gymnasts over the diabolical cutlery of sunbathed rivers ;
-of adventurous liners scenting the horizon ; of broad-chested
+11. We shall sing of the great crowds in the excitement
+of labour, pleasure or rebellion; of the multi-coloured and
+polyphonic surf of revolutions in modern capital
+cities; of the nocturnal vibration of arsenals and workshops
+beneath their violent electric moons; of the greedy stations
+swallowing smoking snakes; of factories suspended from
+the clouds by their strings of smoke; of bridges leaping
+like gymnasts over the diabolical cutlery of sunbathed rivers;
+of adventurous liners scenting the horizon; of broad-chested
@@ OCR line 68–72 @@
-flags and the applause of an enthusiastic crowd. -
-Tt is in Italy that we launch this manifesto of violence,
-destyuctive and incendiary, by which we this day found
+flags and the applause of an enthusiastic crowd.
+It is in Italy that we launch this manifesto of violence,
+destructive and incendiary, by which we this day found
@@ OCR line 74 @@
-of professors, avche@ologists, cicevones and antiquaries.
+of professors, archæologists, cicerones and antiquaries.
@@ OCR line 77 @@
-dealers. We would free hey from the numberless museums
+dealers. We would free her from the numberless museums
@@ OCR line 80 @@
-Museums, cemeteries! . . . Tyuly identical with their
+Museums, cemeteries!… Truly identical with their
@@ OCR line 84 @@
-5
@@ OCR line 93–95 @@
-dead once a year. . . . That we can allow! . . . Deposit
-flowers even once a year at the feet of the G1oconDaA, if
-you will! ... But to walk daily in the museums with
+dead once a year… That we can allow!… Deposit
+flowers even once a year at the feet of the Gioconda, if
+you will!… But to walk daily in the museums with
@@ OCR line 97–100 @@
-is inadmissible /. , . Would you, then, poison yourselves ?
-Do you want to decay ?
-What can one find in an old picture untess it be the
+is inadmissible!… Would you, then, poison yourselves?
+Do you want to decay?
+What can one find in an old picture unless it be the
@@ OCR line 103 @@
-his dream ?
+his dream?
@@ OCR line 107 @@
-gushes of creation and action, Would you, then, waste
+gushes of creation and action. Would you, then, waste
@@ OCR line 110 @@
-downtrodden ?
+downtrodden?
@@ OCR line 114 @@
-calvavies of crucified dreams, those ledgers of broken
+calvaries of crucified dreams, those ledgers of broken
@@ OCR line 116–119 @@
-as to intelligent youths, intoxicated with their talent and
-theiv ambitious determination,
-For men on their death-bed, for invalids, and jor
+is to intelligent youths, intoxicated with their talent and
+their ambitious determination.
+For men on their death-bed, for invalids, and for
@@ OCR line 121–133 @@
-to theiv wounds, since the future is closed to them, . . ,
-Brut we will have none of it, we, the young, the strong, and
-‘he living rururists |
-Cone, then, the good incendiaries with their charred
-jingevs/ , , , Here they come} Herve they come! ...
-6
-Set five to the shelves of the libvaries ! Deviate the course
-of canals to flood the cellars of the museums! ... Oh?!
+to their wounds, since the future is closed to them…
+But we will have none of it, we, the young, the strong, and
+the living Futurists!
+Come, then, the good incendiaries with their charred
+fingers!… Here they come! Here they come!…
+Set fire to the shelves of the libraries! Deviate the course
+of canals to flood the cellars of the museums!… Oh!
@@ OCR line 136–138 @@
-cities !
-The oldest amongst us are thirty ; we have, therefore,
+cities!
+The oldest amongst us are thirty; we have, therefore,
@@ OCR line 140–141 @@
-forty, let others, younger and move valiant, throw us
-into the basket like useless manuscripts! .. . They will
+forty, let others, younger and more valiant, throw us
+into the basket like useless manuscripts!… They will
@@ OCR line 149–152 @@
-one winter's night, vight out in the country, beneath a
-dveavy shed, the monotonous vain-drops strumming on
-the voof, cowering by our trepidating aeroplanes, warming
-our hands at the miserable five which our books of today-
+one winter’s night, right out in the country, beneath a
+dreary shed, the monotonous rain-drops strumming on
+the roof, cowering by our trepidating aeroplanes, warming
+our hands at the miserable fire which our books of today
@@ OCR line 156–157 @@
-They will surge avound us, breathless with anxiety and
-disappoiniment, and all, exasperated by our dauntless
+They will surge around us, breathless with anxiety and
+disappointment, and all, exasperated by our dauntless
@@ OCR line 159 @@
-the move hatred because theiy hearts will be filled with love
+the more hatred because their hearts will be filled with love
@@ OCR line 161 @@
-healthy, will burst forth vadiantly in theiy eyes. For art
+healthy, will burst forth radiantly in their eyes. For art
@@ OCR line 164–165 @@
-The oldest amongst us ave thirty, and yet we have already
-squandered treasures, tyeasuves of strength, of love, of
+The oldest amongst us are thirty, and yet we have already
+squandered treasures, treasures of strength, of love, of
@@ OCR line 169 @@
-Look at us! We are not breathless. . . . Our heart
+Look at us! We are not breathless… Our heart
@@ OCR line 173–180 @@
-Laughter,
-5. Boccioni.
-five, hatred and speed! . . . That surprises you? It is
-because you do not vemembey even having lived! We
+fire, hatred and speed!… That surprises you? It is
+because you do not remember even having lived! We
@@ OCR line 182 @@
-our challenge to the stars /
+our challenge to the stars!
@@ OCR line 186 @@
-false -intelligence tells us. We aye, it says, only the
+false intelligence tells us. We are, it says, only the
@@ OCR line 188–191 @@
-Very well! .. . What matter? . . . But we do not wish
-to heav! Beware of repeating those infamous words |
-' Better lift your head /
+Very well!… What matter?… But we do not wish
+to hear! Beware of repeating those infamous words!
+Better lift your head!
@@ OCR line 195–199 @@
-we cast our challenge to the stars !
-F. fT. MARINETTI,
-Editor of “ Poesia,”
+we cast our challenge to the stars!
+F. T. Marinetti,
+Editor of “Poesia.”
```
