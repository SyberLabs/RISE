# Kepler, Harmonices Mundi Book V (Frisch, 1864), selection: the proofing diff

Every change RISE made to the Internet Archive's OCR (joanniskeplerias05kepl) to produce `harmonices-mundi-v.proofed.md`, for a person to read against the OCR (`harmonices-mundi-v.ocr.txt`, untouched) and, where in doubt, against the page images at https://archive.org/details/joanniskeplerias05kepl (leaf n = printed page + 15 in this part of the volume: page 275 is n290).

How the pass was made: the OCR was collated word by word with three other OCRs of the same edition (Toronto operaomniaedidit05kepluoft, Harvard joanniskepleria24frisgoog, Bavarian State Library 10602562bsb); a word two of them outvoted was replaced, and every other disagreement was settled by a model reading the page image. The models then read every line for sense and against the images for every number, fraction and page break.

Rules applied everywhere and not listed line by line:

- Lines are joined into the edition's paragraphs, and runs of spaces become one space.
- A word hyphenated across a line end is joined into one word; no hyphen in this selection belongs to its word across a line end.

Listed below: the decisions (every reading settled from a page image, every Greek run marked, every table, note and mark removed, every paragraph decision at a page break), then, line by line, every line removed (running heads, page numbers, signatures, footnotes, tables, figure labels, the imprint and colophon, the Greek lines after the first of a run) and every line corrected.

## Counts

- Words served: 7,623 Latin words, and 41 `[Greek]` markers (1 on the title page, 1 in the Prooemium, 39 in Caput X).
- Readings left unresolved, marked [?]: 0.
- Readings settled from the page images: 124.
- OCR lines removed: 284; corrected: 201.
- Line-end hyphens joined into one word: 233; kept as hyphens: 0.

## Decisions

Line numbers are those of `harmonices-mundi-v.ocr.txt`. IMAGE: a reading settled from the page image. GREEK: a run marked [Greek]. TABLE: a table, figure, imprint or colophon removed. NOTE: a footnote removed. MARK: a note marker or editorial reference struck. PARA: a paragraph decision at a page break.

### Title page

- IMAGE 1 page 268 (leaf n283, page number not printed; n282 is page 267, end of Liber IV): printed "JO. KEPLERI / HARMONICES MUNDI LIBER V."; OCR "MENDI" -> heading "## Harmonices Mundi Liber V"; the "JO. KEPLERI" line above it is not in the OCR span and is covered by the heading
- IMAGE 6 "hypothesesque" as printed (confirmed)
- GREEK 12-21 Galen, De usu partium III.10 ("Ieron logon ego ... dynameos aettetou"), the hymn to the Creator; Latin rendering "Id est: Sacrum sermonem ..." kept (lines 20 blank and 21 inside the run -> #DEL)
- IMAGE 31 "'eminentissimae" -> "eminentissimae": the OCR apostrophe is a speck in the image, not a printed mark
- IMAGE 32 the blank line before "opus producere, potentiae insuperabilis." is not a paragraph break (centred last line of the same paragraph) -> #DEL
- TABLE 34-39 imprint removed: "Cum S. C. M. Privilegio ad annos XV." and "LINCII AUSTRIAE. Excudebat Johannes Plancus, anno MDCXIX." with their blank lines

### Prooemium

- IMAGE 40 page 268 (n283): "PROOEMIUM." -> "## Prooemium"
- PARA 48-55 page break 268/269 (n283 -> n284): "Tychonem Braheum / conveni" runs on; no paragraph break, #DEL run left
- IMAGE 57 "Excitaverat" -> "excitaverat" (lower case in the image)
- IMAGE 59 "Supr-Anisanae" printed hyphenated within the line, kept; "astro-/nomica" collation join kept as "astronomica" on line 59 (marker removed)
- IMAGE 90 "annos centum ," -> "annos centum," (space removed; comma printed)
- IMAGE 105 "Y." -> "V." (roman numeral of chapter V)
- IMAGE 113 "VIII." confirmed (flag VIII.|VJLU.|VllL|VII. settled from the image)
- PARA 121 page break 269/270 (n284 -> n285): "IX. Demonstratio ..." begins a new indented entry of the chapter list -> blank line 121 kept as paragraph break
- IMAGE 128 "Yersionem" -> "Versionem"
- IMAGE 129 "Ptolemaici ," -> "Ptolemaici,"
- GREEK 137-141 Plato, Timaeus 27c ("All' o Sokrates, touto ge de pantes ... epomenos de hymin eipein"); token after "est:", lines 138-140 #DEL; the Latin rendering "Enim vero Socrates, ..." on 141 kept
- IMAGE 148-149 trailing blank lines after "accepta." -> #DEL (Caput I follows on the same page 270, outside this span)

### Caput III

- IMAGE 150 p.274 (n289): heading "CAPUT III." with subtitle "Summa doctrinae astronomicae, necessaria ad contemplationem harmoniarum coelestium." -> one heading line; subtitle lines 154-155 #DEL
- IMAGE 152 p.274: no ornament between CAPUT III. and the subtitle; OCR "% ■ %" is noise -> #DEL
- PARA 156 p.274: "Initio" opens the chapter's first paragraph (indented) -> blank kept as paragraph break after the heading
- PARA 160-167 p.275 (n290): first line "animo ejiciendas" runs on (not indented); p.274 ends "exque" without hyphen
- IMAGE 168 p.275: "namque veram" (collation's joined "namqueveram" split back; no hyphen in print)
- IMAGE 171 p.275: "locum" (OCR lOcum)
- IMAGE 173 p.275: line ends "ple-" (OCR em dash)
- IMAGE 178 p.275: "Copernico" (OCR CoperniCo)
- IMAGE 186 p.275: "volubili," flag settled, space removed
- IMAGE 192 p.275: "fitque hoc" (flag fit, que)
- PARA 222-238 p.276 (n291): first column line "simi, in opposita" runs on from "remotis-"
- TABLE 232-234 Fig. 45 caption and blank lines around the figure (diagram of the planetary spheres with the five solids) removed
- IMAGE 235-236 p.276: the two full-width lines under the figure ("perfecta denique astronomia polliceri. Nam post absolutam demonstrationem inter-" / "vallorum ex observationibus Brahei deprehendi hoc: cubi quidem angulis") belong after the column's last line "de per-"; their left halves (OCR 235-236, garbled "feeta ... Na" / "vallorum ... Brabei") are #DEL here and the full lines are written at 289-290
- IMAGE 266 p.276: "22 annos" (stray quote mark removed)
- IMAGE 288-290 p.276: "de per-" / "fecta denique astronomia polliceri. Nam post absolutam demonstrationem inter-" / "vallorum ex observationibus Brahei deprehendi hoc: cubi quidem angulis" (flags peri / interdeprehendi resolved by reading order)
- PARA 291-298 p.277 (n292): "intimo Saturni" runs on from "angulis"
- IMAGE 314 p.277: "icosaedricorum" (diaeresis not kept)
- MARK 317 Frisch's figure reference "(fig. 44)" (small type, editorial) struck after "dodecaedron"
- IMAGE 318-319 p.277: "quinquangu-" / "laribus" (OCR Iaribus)
- IMAGE 320-321 p.277: "mucrones", "mucronum"
- IMAGE 350 p.277: line ends "ar-" (OCR "ar->")
- PARA 351-358 p.278 (n293): "cus eccentricae" runs on from "ar-"
- IMAGE 361-373 p.278: commas after ellipticam, ellipsis, fieri, momentis, computati, proportio, aequales; semicolon after medios; "quibus" (OCR quibits)
- IMAGE 376 p.278: "supposito." ends with a full stop (OCR comma)
- IMAGE 388-390 p.278: numbers 10, 9, 81 ad 100 confirmed
- IMAGE 397-399 p.278: "theorema 8.", "capite 11." confirmed
- PARA 412-419 p.279 (n294): "ex Sole, sed ex Terra" runs on from "velut"
- IMAGE 422 p.279 (zoom): "fons motus" (speck, not an apostrophe)
- IMAGE 428 p.279: "motus)," flag settled
- IMAGE 437 p.279: letter-spaced "A p s i d a s" -> "Apsidas"
- IMAGE 443 p.279: "qui" (OCR qut)
- IMAGE 448-451 p.279: Virgil verse "sera quidem respexit inertem, / Respexit tamen et longo post tempore venit;" is set inside the sentence (centred line, not a new paragraph); blank 449 #DEL; dashes "— —" as printed
- IMAGE 451-453 p.279: "8. Mart.", "15. Maji" confirmed
- IMAGE 464 p.279: "quadrate" as printed (kept)
- MARK 466 footnote marker "*)" after "justissimam." struck
- IMAGE 468 p.279: "majus quam 9. Et" (full stop, OCR comma)
- NOTE 471-472 footnote removed, "*) Nam in Commentariis Martis cap XLVIII. fol. 232. (III. 353) probavi ..." (complete on p.279, ends "proxime minus.")
- PARA 473-480 p.280 (n295): "noncuplo mediocris" runs on from "altior est"
- IMAGE 488 p.280: "planetae" (OCR planetac)
- IMAGE 507 p.280: "suum medium" (OCR meditim)
- IMAGE 510-512 p.280: numbers 27 et 8, 8 ad 27, 9 ad 4, 27 est 3, de 8 est 2, 3 et 2, 9 et 4 confirmed
- IMAGE 513 p.280: "perihelius alterius 33 1/3." (flag ^ / 1/3.; printed 33¹/₃; checks: sqrt(27 x 33 1/3) = 30)
- IMAGE 514-517 p.280: 8 et 27, 4 et 30, 4, 9, 8, 18, 2, 30, 4, 27 confirmed
- IMAGE 518-519 p.280 (zoom): "intervallum 3 3/5." and "ut 18 ad 3 3/5. Ex quo patet" (OCR dropped the fraction; printed 3³/₅; checks: 30:4 = 27:3 3/5)
- IMAGE 520 p.280: the blank line inside the sentence is OCR noise, not a paragraph break -> #DEL
- IMAGE 523 p.280: "tricitates." (stray mark in the print, flag "*" removed)
- IMAGE 529-533 p.280: 8 et 10, 9, 80, 9 et rad. de 80, 20, 24, 22, 480, 22 confirmed; "et 22. Hujus" full stop (OCR comma)
- PARA 542 p.281 (n296): "Decimotertio." is indented as a new paragraph -> blank before it made a paragraph break
- IMAGE 546 p.281 (zoom): mark after "deficiat" is a faint comma-height mark; kept the comma all four OCRs read
- IMAGE 555-591 p.281: every diagram letter pair in the demonstration (DH, AE, HI, EM, CG, BF, GK, FL, G, F, H, E) checked against the page; "junctae" at 569 (flag); "DH" at 589
- IMAGE 576, 581, 584, 591 p.281: commas settled, spaces removed
- IMAGE 594-595 p.281 (zoom): "dimidia de 4/9 est 2/3, et 5/8 est adhuc major / quam 2/3 quantitate excessus 15/16"
- TABLE 598-599 diagram numbers and letters beside the demonstration ("4 5 8 9 / A. B. C. D.", with 5400 E, 3456 F, 2025 G, 1600 H, M, L, K, I on the lines) removed
- PARA 596-607 p.282 (n297): "est proportio 1600" runs on from "dupla facta"
- IMAGE 608 p.282 (zoom): "proportio" (damaged o in the print; OCR pruportio)
- IMAGE 608-615 p.282: 1600 ad 2025, 64 ad 81, 4 ad 5, 3456 ad 5400, 16 ad 25, 4 ad 9, 1600 ad 5400, 8 ad 27, 2025 ad 3456, 75 ad 128, 5 ad 8, 75 ad 120, 120 ad 128, 15 ad 16, 2025 ad 3456, 5 ad 8, 4 ad 9 confirmed; "sesquipla" as printed
- MARK 617 Frisch's note marker "19)" after "respondentium." struck
- IMAGE 622 p.282: chapter ends "ad perihelium."; CAPUT IV follows on the same page (line 624 trailing blank #DEL)

### Caput VII

- IMAGE 625 Chapter heading and subtitle read on p. 295 (leaf n310); heading line carries the subtitle, 628-629 #DEL
- IMAGE 636 "incubatu, tandem": comma printed (flag settled)
- IMAGE 644 "81°" read on p. 295
- IMAGE 646 "saltus, qui": comma printed; "800" read on p. 295 (also 648)
- IMAGE 650 "singulae, quanquam": comma printed
- IMAGE 653 "utrumque, eaeque": comma printed
- IMAGE 654 note letters "G in h ... ex h in d" italic in print, kept as printed
- IMAGE 658 note letters "G", "cc", "A" (659 "dd", "G, A", "cc, dd") kept with print case
- IMAGE 660 "Diapason vero et diapente": the mark the OCR read as a comma is an ink spot at mid height, no comma
- IMAGE 698 "Venere, quia": OCR space before comma removed; "consonantias" confirmed
- IMAGE 702 "harmoniarum, singula": comma printed (flag settled)
- IMAGE 705 fraction "3/5" read on p. 296 (flag settled)
- IMAGE 706 "57' 3"" read on p. 296
- IMAGE 707 "97' 37'," printed with a single prime on 37 (misprint for 37"), kept as printed
- IMAGE 711 "Venus" (OCR "Yenus")
- IMAGE 712 "fere;" semicolon printed (flag settled)
- IMAGE 715 "duobus" (OCR "duohus")
- IMAGE 719 "Mercurius 4." numeral read on p. 296
- IMAGE 723 "motibus": the u is printed as a turned letter that looks like n ("motibns"); kept "motibus", the reading the sort is
- IMAGE 734 "5/8" and "94' 50"" read on p. 297 (OCR "94/ 50"")
- IMAGE 735 "11' 51" +" and "59' 16"" read on p. 297 (OCR "11/ 51"")
- IMAGE 736 "97' 37"" read on p. 297 (double prime here)
- IMAGE 737 "61' 1"" read on p. 297
- IMAGE 843 "aphelio, Mercurius": broken comma in print (OCR read a full stop)
- IMAGE 928 "generum, duri et mollis, et in": OCR space removed, comma printed (flag settled)
- IMAGE 933 "aphelio Martis": the OCR apostrophe is a stray raised dot in print, removed; "fϱ, hic d," the sign after f is a small descending rho-like glyph (Frisch's sign for the raised note), rendered U+03F1
- IMAGE 934 "dϱ vel e perpetuo" (flag settled: d with the same rho-like sign)
- IMAGE 936 "ex e vel dϱ." (OCR "dQ .")
- IMAGE 937 "Veneris, ceu": doubled comma in OCR, one comma printed
- IMAGE 939 "gratificatus, Terra ... fuerit, tanquam": commas as printed
- IMAGE 950 "versus ♀": Venus sign printed in the prose (OCR "9"), rendered U+2640
- IMAGE 954 "oblocutricem ♀": Venus sign printed (OCR "9")
- IMAGE 956 "motu ♀, adhuc": Venus sign and comma printed (OCR "9>")
- IMAGE 957 "semitonium;": OCR space removed
- IMAGE 958 "b, h, c, d, dϱ, e,": note letters as printed (OCR "d) dg")
- IMAGE 960 "in fϱ, perihelius vero": flag settled; "cap. 5," read on p. 298
- IMAGE 1153 "in media Saturnus" whole word (printed Satur-/nus across the line); OCR variants settled
- IMAGE 1154 "perihelio, Jupiter aphelio; in acutis-": comma and semicolon as printed
- IMAGE 1260 "clausulas, singulas": OCR space removed
- IMAGE 1257 closing paragraph "Nihil igitur ... degustaret." read on p. 299 (leaf n314)
- MARK 639 footnote marker "*)" after "insusurravit." struck
- NOTE 676-681 Kepler's footnote removed: "*) Anne flagitium fecero, si a singulis hujus aetatis componistis artificiosam aliquam motetam pro hoc elogio exigam?"
- TABLE 673 junk OCR line at foot of p. 295 ("\ ■ ,"), removed
- TABLE 709 (p. 296) table "Harmoniae planetarum omnium seu universales generis duri" (Ut h concordet / Ut c concordet; staff notation, note letters, diurnal motions) is absent from the OCR lines; nothing of it to remove beyond the blank 709. Its caption prose 710-724 kept
- TABLE 739-840 table on p. 297 "Harmoniae planetarum omnium seu universales generis mollis" (Ut h concordet / Ut c concordet; staff notation, note letters, gravissima/acutissima columns of motions), removed; title line 740 removed with it
- TABLE 846-921 right-hand half of the p. 297 table (Ut c concordet: notation, letters, 379' 20" ... 325' 26"), removed; caption prose 841-845 and 922-924 kept
- TABLE 963-1151 table on p. 298 "Harmoniae planetarum quinque, dissimulata Venere" (Generis duri / Generis mollis; notation, letters, "hic obstrepit", "obstrepit e5", columns 342' 18" ... 351' 24"), removed; caption prose 1152-1160 kept
- TABLE 1174-1255 table on p. 299 for the four planets (Ut h concordet / Ut a concordet; notation with sharps, 335' 50" ... 2 11), removed
- MARK 1254 Frisch's editorial note number "27)" at the end of the p. 299 table, struck with the table
- PARA 640 "Quas harmonicas" indented on p. 295
- PARA 693 "Quodsi unica" indented on p. 296
- PARA 701 "Age igitur" indented on p. 296
- PARA 708 the caption under the p. 296 table ("Ad hanc universalem") is set apart from "ceteri ergo sic erunt:"
- PARA 716 the caption runs on from the left column ("duobus") into the right column ("motibus"): no break, blank lines 716-717 #DEL
- PARA 722 "Ceteri singulis" indented in the right column of the p. 296 caption
- PARA 682 page break 295/296: p. 296 begins "tiant" (consen-/tiant), runs on, no break
- PARA 732 page break 296/297: p. 297 begins "Secundum igitur" indented as a new paragraph
- PARA 738 the p. 297 table and its caption ("Rursum hic") stand apart from "motibus diurnis."
- PARA 853 the two captions under the p. 297 table ("Rursum hic ..." / "Et hic extritis ...") are separate paragraphs
- PARA 925 "Testatur igitur" indented on p. 297
- PARA 940 page break 297/298: p. 298 begins "dignitatem" (after "tanquam"), runs on, no break
- PARA 953 "Quodsi hanc" indented on p. 298
- PARA 962 the p. 298 table and its caption ("Hic in gravissima") stand apart from "diesi."
- PARA 1156 the two captions under the p. 298 table are separate paragraphs
- PARA 1161 "Quatuor vero planetarum" indented on p. 298
- PARA 1166 page break 298/299: p. 299 begins with the table; the next text, "Nihil igitur", is indented as a new paragraph (break at 1256)
- PARA 1256 "Nihil igitur" indented on p. 299

### Caput VIII

- IMAGE 1269 page 299 (n314): "CAPUT VIII." and subtitle "Quis in concordantiis coelestibus discanti, quis alti, quis tenoris, quis bassi vicem obeat?" (OCR "concord antiis", letter-spaced) -> "## Caput VIII. Quis in concordantiis coelestibus discanti, quis alti, quis tenoris, quis bassi vicem obeat?"; subtitle lines 1270-1272 -> #DEL
- IMAGE 1274 "humanarum" (flag settled)
- IMAGE 1279 "humano :" -> "humano:"
- IMAGE 1283 "congruentia" (flag settled)
- PARA 1285-1292 page break 299/300 (n314 -> n315): "libro tertio ca-/pite 16." runs on; #DEL run left (page 299 top carries the music table of Caput VII, outside this span)
- IMAGE 1300-1309 "1)" ... "5)" are Kepler's printed enumeration in the sentence, not note markers; kept as printed
- IMAGE 1302 "singuli ;" -> "singuli;"
- IMAGE 1313 trailing blank before Caput IX (same page 300) -> #DEL

### Caput X

- IMAGE 1314 page 323 (n338): "CAPUT X." / "Epilogus de Sole, conjecturalis." -> "## Caput X. Epilogus de Sole, conjecturalis"; 1315-1316 -> #DEL
- IMAGE 1336 "unica. Luna cursu" -> "unica Luna cursu" (no full stop in the image)
- PARA 1338-1347 page break 323/324 (n338 -> n339): "jam accedens / speciale" runs on; "21 *" signature in the run; #DEL run left
- IMAGE 1350 "ve!" -> "vel"
- IMAGE 1362 "centrUm" -> "centrum"
- GREEK 1363 "Dios phylaken" (Jove's guard, Pythagorean name of the centre, after Aristotle De caelo II.13)
- IMAGE 1365 "bernaculum. “" -> "bernaculum.“" (closing quote of the Psalm citation)
- GREEK 1367 "klythi" (Proclus, Hymn to Helios, the invocation "hear")
- MARK 1383 note marker "*)" after "adoptaret." struck
- GREEK 1385-1386 Proclus, Hymn to Helios: "chrysea hnia" and "tamieion phaous, messatien aitheros edren, kosmon kradiaion eriphengea kyklon"
- GREEK 1387 "palinnostous diphreias" (Proclus' hymn)
- GREEK 1388 "to kentron, Dios phylaken"
- GREEK 1390 "genethlen" and "blastesasan" (Proclus' hymn)
- IMAGE 1390 the image prints "et quic-," with a stray comma after the line-end hyphen; comma dropped so the hyphen joins "quic-/quid" (printer's slip, not a reading)
- NOTE 1392-1399 footnote removed: "*) Veterum de ejus libro [Greek] judicium fuit, in eo non sine divino raptu ..." (with its blank lines)
- PARA 1400-1407 page break 324/325 (n339 -> n340): "dogmatibus / cedat" runs on; #DEL run left
- GREEK 1409-1410 Proclus' hymn: "zoarkees, o ana, peges autos echon kleida" and "panta teeis eplesas egersinooio pronoies"; "moiraon" (1410)
- MARK 1411 note marker "*)" after "Evangelii" struck
- GREEK 1412-1415 Proclus' hymn: "ophra hypsitenous lathointo patros peripheggeos aules" (1412-1413) and "eikon paggenetao theou ... orymagdos ep' allelloisin ionton" (1414-1415); line 1414 holds the token, Latin of 1413 and 1415 kept
- GREEK 1418-1425 Proclus' hymn: "psychon anagogeus", "hikesie polydakrys", "tes genethles", "preunon thoon omma dikes", "Metroakes", "Achlyn aposkedasas olesimbroton iolocheuton", "phaos hagnon", "olbon astyphelikton ap' eusebies erateines"
- IMAGE 1422 "iste'" -> "iste" (speck in the image); space before "?)" removed
- IMAGE 1429 "videamur." -> "videamus."
- GREEK 1431-1435 Proclus' hymn: "Hypsothen harmonies rheuma plousion exocheteuei", Orpheus "kosmon ton enarmonion dromon helkon", "kithare hypo thesksela melpon eunazei mega kyma baryphloisboio genethles", "plesas harmonies panapemonos eurea kosmon", "pyros noerou basilea"; line 1430 (blank inside the passage; not a paragraph break in the image, the Greek runs on) -> #DEL
- IMAGE 1431 punctuation as printed: "(sic etiam Orpheus [Greek].)," before "eundem"
- GREEK 1439-1443 "pyri noero", "autonomo", "logon", "pros ton theon" (John 1:1)
- IMAGE 1444 "mnnia," -> "omnia,"
- IMAGE 1453 "prastantiae" kept: the image prints it so (Frisch's typo, not an OCR error)
- NOTE 1458-1460 footnote removed: "*) Similia tamen nonnulla Orpheo vetustissimo ..." (with its blank line)
- PARA 1461-1468 page break 325/326 (n340 -> n341): "in corde mundi / vices" runs on; #DEL run left
- IMAGE 1473 "muniis )" -> "muniis.)"
- GREEK 1476 "tes dianoias" and "ton noun"
- GREEK 1479-1481 "ametatheton", "ton dianoetikon" and "to noeron"
- IMAGE 1486 "(Videfol." -> "(Vide fol." ; "221." confirmed
- IMAGE 1490 "ratioeinatio" -> "ratiocinatio"
- GREEK 1513 "pyr noeron" and "noun"
- PARA 1521-1527 page break 326/327 (n341 -> n342): "nullus aeri locus, / quem attrahant" runs on; draft line 1523 "I" is a stray mark in the furniture run -> #DEL; #DEL run left
- IMAGE 1533 "Omnem" -> "omnem" (lower case in the image)
- IMAGE 1534 "brevitatesque," (flag settled)
- IMAGE 1540 "ineffabi litate" -> "ineffabilitate"
- GREEK 1551 "pyros noeron" (before "si non regem")
- IMAGE 1559 "percipiendum ," -> "percipiendum,"
- IMAGE 1563 "Creatorem, tuum ," -> "Creatorem tuum," (no comma after Creatorem in the image)
- GREEK 1564 "kai ta aistheta kai ta noera"
- IMAGE 1565 "penitus ," and "pars ;" -> "penitus," "pars;"
- IMAGE 1566 "secutorum. Arnen." -> "seculorum. Amen."
- TABLE 1567-1575 COLOPHON removed: "FINIS." and "Absolutum est hoc opus die 17. 27. Maii, anno MDCXVIII; revisus vero liber V. (interim dum in eo typi progrediuntur) 9. 19. Februarii anno MDCXIX." and "Lincii Metropoli Austriae Supranisanae." with their blank lines; no "APPENDIX" lines present in the span

## Every change, OCR line to corrected line

Each hunk names the OCR file's line number; `-` is the OCR line, `+` the corrected line. A hunk with only a `-` line removed it; blank lines are not compared.

```diff
@@ 1 @@
-HARMONICES  MENDI  LIBER  V.
+## Harmonices Mundi Liber V
@@ 12 @@
-'lepov  Xoyov  iym,  rov  8i]f.uovQyr]oavrog  fiuag  vuvov  dXrj&ivov  c Tvvti&rjfu } xai
+[Greek]
@@ 13 @@
-volu^co,  rovr  dvvai  rt]v  evaefisiav,  ovyi  d ravQcov  exarofifiag  avrm  naunoXXag
@@ 14 @@
-xara&vaaifju , xai  ra  aXXa  fjLVQia  /nvfja  ■bv^affaifu  xai  xaoiag’  dXX  d yvoiryv
@@ 15 @@
-fiev  avrog,  insita  8s  xai  toig  dXXoig  i^rjyrj(jaifxi]v , oiog  /j.sv  ean  rrjv  (tocpiav
@@ 16 @@
-ologrs  TTjv  dvvafuv,  bnmog  8s  rryv  yorj(rrorr]ra,  ro  yag  xoa/.iei'i>  s&sXmv  dnavta
@@ 17 @@
-tov  ivSeyo/nevor  xoitij.ov  , x<xi  (ir}8en  cp&oreiv  rcov  dyafh ov,  rrjg  reXeiorarrjg  %QTj-
@@ 18 @@
-ororrjrog  iyco  Seiy/ia  ri&ejiail  xai  ravrrj  ,u ev  wg  dya&og  tj/juv  v/.irsio\}o37  ro  8'  cag
@@ 19 @@
-dr  fraXiara  xoayirj&eir],  nav  itjsoQeiv,  axQag  aocpiag , ro  8s  xai  Syaaai  navtf  o<ra
@@ 21 @@
-nyosiXero  , 8vvaire(ag  drjrrrjrov .
@@ 31 @@
-maxime  exornarentur,  'eminentissimae  sapientiae;  omnia  denique,  quae  statuerat,  in
+maxime exornarentur, eminentissimae sapientiae; omnia denique, quae statuerat, in
@@ 35 @@
-Cum  S.  C.  M.  Privilegio  ad  annos  XV.
@@ 37 @@
-LINCII  AUSTRIAE.  Excudebat  Johannes  Plancus,  anno  MDCXIX.
@@ 40 @@
-PROOEMIUM.
+## Prooemium
@@ 50 @@
-De  Motibus  Planetarum  Harmonicis.  Liber  Y.  Prooemium.
@@ 53 @@
-269
@@ 57 @@
-spiraverat, desiderium  ingens  Excitaverat,  vitam  etiam  et  vires  ingenii  pro-
+spiraverat, desiderium ingens excitaverat, vitam etiam et vires ingenii pro-
@@ 59 @@
-Supr-Anisanae  Procerum  liberalitatem  suppeditante,  defunctus  prius  astro-
+Supr-Anisanae Procerum liberalitatem suppeditante, defunctus prius astronomica
@@ 60 @@
-nornica  provincia  quantum  sufficiebat,  tandem,  inquam,  in  lucem  protuli  supra-
+provincia quantum sufficiebat, tandem, inquam, in lucem protuli supra-
@@ 69 @@
-omneque  adeo  genus  eruditionis  promovendum  natus,  Johannes  Gfeorgius  Her-
+omneque adeo genus eruditionis promovendum natus, Johannes Georgius Her-
@@ 90 @@
-annos  centum , si  Deus  ipse  per  annorum  sena  millia  contemplatorem  prae-
+annos centum, si Deus ipse per annorum sena millia contemplatorem prae-
@@ 105 @@
-Y.  Claves  scalae  musicae,  seu  loca  systematis,  et  genera  harmoniarum,  durum
+V. Claves scalae musicae, seu loca systematis, et genera harmoniarum, durum
@@ 116 @@
-270
@@ 119 @@
-De  Motibus  Planetarum  Harmonicis.
@@ 128 @@
-Appendix  habet:  I.  Yersionem  libri  tertii  Harmonicorum  Ptolemaei  a capite  III,
+Appendix habet: I. Versionem libri tertii Harmonicorum Ptolemaei a capite III,
@@ 129 @@
-qui  tractat  eandem  materiam.  II.  Suppletionem  textus  Ptolemaici , in  tribus  ultimis
+qui tractat eandem materiam. II. Suppletionem textus Ptolemaici, in tribus ultimis
@@ 137 @@
-est:  'A'k A co  Staxfjareg , rovto  ye  Srj  navteg,  oaoi  xca  xata  (3Qa%v  aco^Qoavvrjg
+est: [Greek]
@@ 138 @@
-fxere%ovmv , ini  naaij  oQi-iy  xai  o/juhqov  xai  /neyaXov  n^ay/xarog  &eov  dei  nov
@@ 139 @@
-xaXovmv,  rjpiag  Se  rovg  neQi  nixvtog  Xoyovg  noieio&ai  nij  fj.eXXovrag,  ei  fxr]  nana-
@@ 140 @@
-nam  naQaXXartonev,  dvayxrj  •deovg  re  xai  &eag  emxaXovfxevovg  ev%e<j\}ai  nanag,
@@ 141 @@
-xata  vovv  ixeivoig  nev  ixaXiffta,  enofxevoog  Se  v^ur  eineir.  Enim  vero  Socrates,
+Enim vero Socrates,
@@ 150 @@
-CAPUT  III.
+## Caput III. Summa doctrinae astronomicae, necessaria ad contemplationem harmoniarum coelestium
@@ 152 @@
-% ■ %
@@ 154 @@
-Summa  doctrinae  astronomicae,  necessaria  ad  contemplationem  har-
@@ 155 @@
-moniarum coelestium.
@@ 162 @@
-Liber  V.  Caput  III.
@@ 165 @@
-275
@@ 168 @@
-animo  ejiciendas;  non  tradunt  namque- veram  et  corporum  mundi  dispositio-
+animo ejiciendas; non tradunt namque veram et corporum mundi dispositio-
@@ 171 @@
-In  earum  lOcum,  etsi  facere  aliter  non  possum,  quin  Copernici  de  mundo
+In earum locum, etsi facere aliter non possum, quin Copernici de mundo
@@ 173 @@
-quia  res  apud  vulgus  studiosorum  etiamnum  nova  est  et  dogma  auditu  ple—
+quia res apud vulgus studiosorum etiamnum nova est et dogma auditu ple-
@@ 178 @@
-corporum  et  contemperationem  motuum  attinent,  cum  CoperniCo  habet  com-
+corporum et contemperationem motuum attinent, cum Copernico habet com-
@@ 186 @@
-seu  tabulam  affigit  torno  volubili , is  immoto  pede  circini  seu  stilo  circulum
+seu tabulam affigit torno volubili, is immoto pede circini seu stilo circulum
@@ 187 @@
-describit  eundem  super  decurrente  tabula,  sic  etiam  hic  Gopernico  quidem
+describit eundem super decurrente tabula, sic etiam hic Copernico quidem
@@ 192 @@
-ad  stilum  tornatoris  interstitium  inter  Martis  et  Veneris  circulos,  fit, que  hoc
+ad stilum tornatoris interstitium inter Martis et Veneris circulos, fitque hoc
@@ 195 @@
-cum  motu  vero  sui  corporis , quiescente  systemate.  Cum  igitur  harmonica
+cum motu vero sui corporis, quiescente systemate. Cum igitur harmonica
@@ 197 @@
-facile  datur  inielligi,  si  quis  contemplator  in  Sole  esset,  quantumvis  mobili,
+facile datur intelligi, si quis contemplator in Sole esset, quantumvis mobili,
@@ 214 @@
-sola  Terram  habet  pro  centro  ; cujus  quidem  orbis  seu  curriculi  quantitas  non
+sola Terram habet pro centro; cujus quidem orbis seu curriculi quantitas non
@@ 223 @@
-18*
@@ 226 @@
-276
@@ 229 @@
-De  Motibus  Planetarum  Harmonicis.
@@ 232 @@
-Fig.  45.
@@ 235 @@
-feeta  denique  astronomia  polliceri.  Na
@@ 236 @@
-vallorum  ex  observationibus  Brabei
@@ 265 @@
-meo  Cosmographico , quod  edidi  ante
+meo Cosmographico, quod edidi ante
@@ 266 @@
-‘22  annos:  numerum  planetarum  seu
+22 annos: numerum planetarum seu
@@ 269 @@
-figuris  regularibus  solidis , de  quibus
+figuris regularibus solidis, de quibus
@@ 281 @@
-orbitarum  planetariarum , illa  quidem
+orbitarum planetariarum, illa quidem
@@ 289 @@
-i post  absolutam  demonstrationem  inter-
+fecta denique astronomia polliceri. Nam post absolutam demonstrationem inter-
@@ 290 @@
-deprehendi  hoc:  cubi  quidem  angulis
+vallorum ex observationibus Brahei deprehendi hoc: cubi quidem angulis
@@ 293 @@
-Liber  V.  Caput  III.
@@ 296 @@
-277
@@ 299 @@
-intimo  Saturni  circulo  applicatis , centra  planorum  fere  tangere  medium  cir-
+intimo Saturni circulo applicatis, centra planorum fere tangere medium cir-
@@ 312 @@
-circulos  adhuc  esse  majores , quam  sunt  binorum  illorum  in  figuris  orbium,
+circulos adhuc esse majores, quam sunt binorum illorum in figuris orbium,
@@ 317 @@
-deprehendo  proportionem  figuralem,  si  nempe  auctum  dodecaedron  (flg.  44),
+deprehendo proportionem figuralem, si nempe auctum dodecaedron,
@@ 319 @@
-Iaribus  eoque  proximum  quinque  corporibus  regularibus),  hoc,  inquam,  si  duo-
+laribus eoque proximum quinque corporibus regularibus), hoc, inquam, si duo-
@@ 346 @@
-ex  certissimis  Brahei  observationibus,  quod  arcus  diurni  aequales  iq  ec-
+ex certissimis Brahei observationibus, quod arcus diurni aequales in ec-
@@ 350 @@
-aequalibus,  puta  uno  die  naturali  utrinque,  respondentes  iis  diurni  veri  ar->
+aequalibus, puta uno die naturali utrinque, respondentes iis diurni veri ar-
@@ 353 @@
-278
@@ 356 @@
-De  Motibus  Planetarum  Harmonicis.
@@ 361 @@
-orbitam  planetae  esse  ellipticam , et  Solem,  fontem  motus,  esse  in  altero  fo-
+orbitam planetae esse ellipticam, et Solem, fontem motus, esse in altero fo-
@@ 362 @@
-corum hujus  ellipsis , itaque  fieri , ut  planeta,  absoluto  totius  circuitus  qua-
+corum hujus ellipsis, itaque fieri, ut planeta, absoluto totius circuitus qua-
@@ 363 @@
-drante a suo  aphelio , praecise  mediocre  habeat  intervallum  a Sole,  inter
+drante a suo aphelio, praecise mediocre habeat intervallum a Sole, inter
@@ 366 @@
-et  verus  ejus  eccentrici  arcus  diurnus  illis  momentis , quibits  planeta  est  in
+et verus ejus eccentrici arcus diurnus illis momentis, quibus planeta est in
@@ 367 @@
-fine  quadrantis  eccentrici  ab  aphelio  computati , licet  ille  quadrans  verus
+fine quadrantis eccentrici ab aphelio computati, licet ille quadrans verus
@@ 370 @@
-aphelio,  alter  a perihelio , juncti  aequent  duos  diurnos  medios ; et  per  con-
+aphelio, alter a perihelio, juncti aequent duos diurnos medios; et per con-
@@ 371 @@
-sequens, cum  sit  eadem  circulorum  proportio , quae  diametrorum , quod
+sequens, cum sit eadem circulorum proportio, quae diametrorum, quod
@@ 373 @@
-aequales , quot  sunt  in  toto  circuitu,  quae  est  medii  diurni  ad  junctos  veros
+aequales, quot sunt in toto circuitu, quae est medii diurni ad junctos veros
@@ 376 @@
-ut  jam  ex  iis  intelligamus  motus  apparentes,  oculo  in  Sole  supposito,
+ut jam ex iis intelligamus motus apparentes, oculo in Sole supposito.
@@ 378 @@
-Sexto.  Quantum  vero  attinet  arcus  apparentes  velut  ex  Sole , notum
+Sexto. Quantum vero attinet arcus apparentes velut ex Sole, notum
@@ 380 @@
-inter  se , is  qui  longius  a centro  mundi  recessit  (ut  qui  est  in  aphelio)  ap-
+inter se, is qui longius a centro mundi recessit (ut qui est in aphelio) ap-
@@ 396 @@
-centricitas,  sc.  quo  major  fit  arcus,  hoc  magis  angetur  ejus  apparentiae  an-
+centricitas, sc. quo major fit arcus, hoc magis augetur ejus apparentiae an-
@@ 407 @@
-Astr.  Copernicanae  Lib.  Y,  fuerunt  autem  hic  etiam  commemoranda,  quia
+Astr. Copernicanae Lib. V, fuerunt autem hic etiam commemoranda, quia
@@ 408 @@
-attinent  ipsissimos  terminos  harmoniarum  coelestium , per  se  singulos  seorsim
+attinent ipsissimos terminos harmoniarum coelestium, per se singulos seorsim
@@ 414 @@
-Liber  V.  Caput  III.
@@ 417 @@
-279
@@ 422 @@
-debet,  cum  Terra  non  sit  fons'  motus  ipsorum,  neque  potest,  cum  motus  ii
+debet, cum Terra non sit fons motus ipsorum, neque potest, cum motus ii
@@ 428 @@
-sint,  veluti  spectanti  ex  Sole,  fonte  motus) , removenda  prius  est  ab  iis  mo-
+sint, veluti spectanti ex Sole, fonte motus), removenda prius est ab iis mo-
@@ 437 @@
-sarii. A p sidas  proximas  duorum  planetarum  dicemus  perihelium  supe-
+sarii. Apsidas proximas duorum planetarum dicemus perihelium supe-
@@ 443 @@
-qut  in  apsidibus  oppositis,  scilicet  aphelio  superioris  et  perihelio  inferioris.
+qui in apsidibus oppositis, scilicet aphelio superioris et perihelio inferioris.
@@ 444 @@
-Rursum  igitur  hic  aliqua  pars  mei  Mysterii  Cosmographici , suspensa  ante
+Rursum igitur hic aliqua pars mei Mysterii Cosmographici, suspensa ante
@@ 446 @@
-enim  veris  orbium  intervallis  per  observationes  Brabei  plurimi  temporis  labore
+enim veris orbium intervallis per observationes Brahei plurimi temporis labore
@@ 450 @@
-Respexit  tamen  et  longo  post  tempore  venit ;
+Respexit tamen et longo post tempore venit;
@@ 466 @@
-diorum proportionem  justissimam.*)  Nam  cubica  radix  de  1 est  1,  ejus  qua-
+diorum proportionem justissimam. Nam cubica radix de 1 est 1, ejus qua-
@@ 468 @@
-majus  quam  9,  Et  Saturnus,  mediocriter  distans  a Sole,  paulo  altior  est
+majus quam 9. Et Saturnus, mediocriter distans a Sole, paulo altior est
@@ 471 @@
-*)  Nam  in  Commentariis  Martis  cap  XLVIII.  fol.  232.  (IIT.  353)  probavi,  medium  hoc  arithmeticum
@@ 472 @@
-vel  ipsam  esse  diametrum  circuli,  qui  longitudine  aequat  ellipticam  orbitam,  vel  ea  proxime  minus,
@@ 475 @@
-280
@@ 478 @@
-De  Motibus  Planetarum  Harmonicis.
@@ 490 @@
-numeri  idonei  ad  exquirendum , num  illa  itinera  faciant  proportiones  har-
+numeri idonei ad exquirendum, num illa itinera faciant proportiones har-
@@ 496 @@
-proportioni  proportionem  eversam  intervallorum  non  mediorum , sed  verorum,
+proportioni proportionem eversam intervallorum non mediorum, sed verorum,
@@ 497 @@
-quae  sunt  quovis  loco  eccentricorum , multiplicato  itinere  superioris
+quae sunt quovis loco eccentricorum, multiplicato itinere superioris
@@ 503 @@
-tervallorum aphelii  unius  ad  perihelium  alterius ; ubi  tamen  medios  motus
+tervallorum aphelii unius ad perihelium alterius; ubi tamen medios motus
@@ 507 @@
-suum  meditim,  fit  ut  hoc  medium  proportionale  ad  semidia-
+suum medium, fit ut hoc medium proportionale ad semidia-
@@ 510 @@
-27  et  8 , ergo  medii  motus  diurni  illius  ad  hunc  est  illa,  quae  8 ad  27,
+27 et 8, ergo medii motus diurni illius ad hunc est illa, quae 8 ad 27,
@@ 512 @@
-de  8 est  2 , harum  radicum  3 et  2 quadrata  sunt  9 et  4.  Sint  jam  motus
+de 8 est 2, harum radicum 3 et 2 quadrata sunt 9 et 4. Sint jam motus
@@ 513 @@
-apparentes,  aphelius  unius  2 et  perihelius  alterius  33  ^ Media  proportio-
+apparentes, aphelius unius 2 et perihelius alterius 33 1/3. Media proportio-
@@ 518 @@
-dat  perihelium  illius  intervallum  3 ‘V5.  Dico  igitur,  distantiam  apheliam  illius
+dat perihelium illius intervallum 3 3/5. Dico igitur, distantiam apheliam illius
@@ 519 @@
-esse  ad  periheliam  hujus,  ut  18  ad  Ex  quo  patet,  quod  inventis  har-
+esse ad periheliam hujus, ut 18 ad 3 3/5. Ex quo patet, quod inventis har-
@@ 523 @@
-tricitates.  *
+tricitates.
@@ 529 @@
-medium  inter  utrumque.  Sint  duo  motus  extremi  8 et  10 , medius  motus
+medium inter utrumque. Sint duo motus extremi 8 et 10, medius motus
@@ 533 @@
-dio ejus,  quod  est  inter  hanc  radicem  et  22,  Hujus  theorematis  usus  est
+dio ejus, quod est inter hanc radicem et 22. Hujus theorematis usus est
@@ 537 @@
-Liber  V.  Caput  III.
@@ 540 @@
-281
@@ 569 @@
-junctae  CG  ad  DH  et  /\E  ad  BF  sunt  minores  di-
+junctae CG ad DH et AE ad BF sunt minores di-
@@ 570 @@
-midio proportionis  AE  ad  1)H,  defectu  certo,  ut  est
+midio proportionis AE ad DH, defectu certo, ut est
@@ 573 @@
-defectu  prioris  duplo.  Sed  III  ad  EM  est  sesquialtera  proportionis  AE  ad
+defectu prioris duplo. Sed HI ad EM est sesquialtera proportionis AE ad
@@ 576 @@
-ad  EM  relinquunt  plus  quam  semis  proportionis  AE  ad  DH , excessu  dupli-
+ad EM relinquunt plus quam semis proportionis AE ad DH, excessu dupli-
@@ 581 @@
-AE  ad  DH,  defectu  simplo , ergo  BF  ad  CG  est  plus  dimidio  ipsius  AE  ad
+AE ad DH, defectu simplo, ergo BF ad CG est plus dimidio ipsius AE ad
@@ 584 @@
-est  major  simplo , ergo  proportio  motuum  GK  ad  FL  est  major  proportione
+est major simplo, ergo proportio motuum GK ad FL est major proportione
@@ 589 @@
-mediarum  distantiarum  DII  ad  AE  amittat  plus  dimidio,  tunc  motuum  GK
+mediarum distantiarum DH ad AE amittat plus dimidio, tunc motuum GK
@@ 591 @@
-CG.  Nihil  enim  ultra  faciendum,  quam  ut  mutes  voces,  major  in  minor ,
+CG. Nihil enim ultra faciendum, quam ut mutes voces, major in minor,
@@ 594 @@
-In  appositis  numeris,  quia  dimidia  de  % est  2/£,  et  5/g  est  adhuc  major
+In appositis numeris, quia dimidia de 4/9 est 2/3, et 5/8 est adhuc major
@@ 595 @@
-quam  % quantitate  excessus  15/16,  et  vero  proportionis  8 ad  9 dupla  facta
+quam 2/3 quantitate excessus 15/16, et vero proportionis 8 ad 9 dupla facta
@@ 598 @@
-4 5 8 9
@@ 599 @@
-A.  B.  C.  D.
@@ 602 @@
-282
@@ 605 @@
-De  Motibus  Planetarum  Harmonicis.
@@ 608 @@
-est  pruportio  1600  ad  2025,  id  est  64  ad  81,  et  proportionis  4 ad  5 dupla
+est proportio 1600 ad 2025, id est 64 ad 81, et proportionis 4 ad 5 dupla
@@ 617 @@
-portionis orbium  et  inter  eversam  motuum  respondentium.  19)
+portionis orbium et inter eversam motuum respondentium.
@@ 619 @@
-Ex  hoc  autem  datur  intelligi , motuum  divergentium  proportionem  esse
+Ex hoc autem datur intelligi, motuum divergentium proportionem esse
@@ 620 @@
-multo  majorem  sesquialtera  proportionis  orbium , cum  ad  sesquialteram  acce-
+multo majorem sesquialtera proportionis orbium, cum ad sesquialteram acce-
@@ 625 @@
-CAPUT  VII.
+## Caput VII. Harmonias universales omnium sex planetarum veluti communia contrapuncta quadriformia dari
@@ 628 @@
-Harmonias  universales  omnium  sex  planetarum  veluti  communia
@@ 629 @@
-contrapuncta  quadriformia  dari.
@@ 635 @@
-antiquitati  non  cognitis,  censete!  Yos  his  seculis  ultimis  prima  universitatis
+antiquitati non cognitis, censete! Vos his seculis ultimis prima universitatis
@@ 636 @@
-exempla  genuina,  bis  millium  annorum  incubatu , tandem  produxit  sui  nun-
+exempla genuina, bis millium annorum incubatu, tandem produxit sui nun-
@@ 639 @@
-Creatoris  filiae  dilectissimae,  insusurravit.*)
+Creatoris filiae dilectissimae, insusurravit.
@@ 646 @@
-tiatur, anni  labuntur  800,  neque  tamen  saltus , qui  octavum  claudit  seculum,
+tiatur, anni labuntur 800, neque tamen saltus, qui octavum claudit seculum,
@@ 650 @@
-tate continetur.  Tales  periodos  efficiunt  etiam  ceterae  bigae  singulae , quan-
+tate continetur. Tales periodos efficiunt etiam ceterae bigae singulae, quan-
@@ 653 @@
-vel  utrumque , eaeque  in  diversis  veluti  tensionibus.  Nam  quia  Saturnus  ex
+vel utrumque, eaeque in diversis veluti tensionibus. Nam quia Saturnus ex
@@ 660 @@
-Diapason  vero  ,et  diapente  in  solis  apsidum  punctis  contingit.  Mars  vero,
+Diapason vero et diapente in solis apsidum punctis contingit. Mars vero,
@@ 673 @@
-\ ■ ,
@@ 676 @@
-*)  Anne  flagitium  fecero,  si  a singulis  hujus  aetatis  componistis  artificiosam  aliquam  motetam  pro
@@ 677 @@
-hoc  elogio  exigam?  Textum  huc  aptum  Psaltes  Regius  ceterique  Sacri  libri  suppeditare  poterunt.  Ve-
@@ 678 @@
-rum heus  vos,  in  coelo  plures  quam  sex  non  concordant.  Nam  Luna  seorsim  suam  monodiam  cantillat.
@@ 679 @@
-Terris  ut  cunis  assidens.  Conferte  symbolas,  ego,  ut  liber  fiat,  sex  partibus  curatorem  me  sedulum
@@ 680 @@
-polliceor.  Qui  propius  musicam  coelestem  exprimet  hoc  opere  descriptam,  huic  Clio  sertum,  Uranie  Ve-
@@ 681 @@
-nerem sponsam  spondent.
@@ 684 @@
-296
@@ 687 @@
-De  Motibus  Planetarum  Harmonicis.
@@ 698 @@
-incipiamus  a Terra  et  Venere , quia  hi  duo  faciunt  consonantias  non  plures
+incipiamus a Terra et Venere, quia hi duo faciunt consonantias non plures
@@ 702 @@
-Age  igitur  praefigamus  duo  veluti  sceleta  harmoniarum , singula  binis
+Age igitur praefigamus duo veluti sceleta harmoniarum, singula binis
@@ 705 @@
-ramus. Primum  sceleton  habeat  inter  Terram  et  Venerem  ?'jb  et  in  gravis-
+ramus. Primum sceleton habeat inter Terram et Venerem 3/5 et in gravis-
@@ 711 @@
-nus motu  aphelio,  Terra  aphelio,  Yenus
+nus motu aphelio, Terra aphelio, Venus
@@ 712 @@
-aphelio  fere ; in  altissima  tensione  concurrit
+aphelio fere; in altissima tensione concurrit
@@ 713 @@
-Yenus  perihelio;  in  media  tensione  con-
+Venus perihelio; in media tensione con-
@@ 715 @@
-Mercurius  perihelio.  Ita  Saturnus  duohus
+Mercurius perihelio. Ita Saturnus duobus
@@ 718 @@
-motibus  potest  concurrere,  Mars  duohus,
+motibus potest concurrere, Mars duobus,
@@ 724 @@
-Mars  duohus,  Mercurius  quatuor.
+Mars duobus, Mercurius quatuor.
@@ 727 @@
-Liber  V.  Caput  VII.
@@ 730 @@
-297
@@ 734 @@
-tera possibilis  harmonia  5/8.  Ubi  de  Veneris  aphelio  motu  diurno  94/  50"
+tera possibilis harmonia 5/8. Ubi de Veneris aphelio motu diurno 94' 50"
@@ 735 @@
-pars  octava  11/  51"  +,  sumta  quinquies,  occupat  de  motu  Telluris  59'  16"
+pars octava 11' 51" +, sumta quinquies, occupat de motu Telluris 59' 16"
@@ 740 @@
-Harmoniae  planetarum  omnium  seu  universales  generis  mollis.
@@ 743 @@
-Ut  li  concordet.
@@ 746 @@
-Ut  c concordet.
@@ 749 @@
-$
@@ 752 @@
-dp7
@@ 753 @@
-b 7
@@ 755 @@
-g 6
@@ 756 @@
-dp6
@@ 759 @@
-In  tensione  gravis-
@@ 760 @@
-sima.
@@ 762 @@
-379'  20'
@@ 764 @@
-b^zr-z  284  32
@@ 765 @@
-° 237  4
@@ 766 @@
-— bp-  189  40
@@ 769 @@
-b©,
@@ 772 @@
-9 V
@@ 774 @@
-6
@@ 776 @@
-6
@@ 779 @@
-94  50
@@ 782 @@
-g*
@@ 784 @@
-b*
@@ 786 @@
-n-3
@@ 789 @@
-be-
@@ 792 @@
-r-r-  59  16
@@ 794 @@
-:=::  35  35
@@ 796 @@
-O 29  38
@@ 799 @@
-b-
@@ 802 @@
-% b'  hr
@@ 805 @@
-fj  b
@@ 807 @@
-U G
@@ 810 @@
-m
@@ 813 @@
-2 13
@@ 815 @@
-3 51
@@ 818 @@
-Acutis-
@@ 820 @@
-sima.
@@ 822 @@
-295' 56"
@@ 823 @@
-244  4
@@ 825 @@
-195  14
@@ 827 @@
-97  37
@@ 829 @@
-61  1
@@ 831 @@
-36  37
@@ 832 @@
-30  31
@@ 835 @@
-4 35
@@ 838 @@
-1 55
@@ 843 @@
-aphelio.  Mercurius  perihelio.  In  tensione
+aphelio, Mercurius perihelio. In tensione
@@ 848 @@
-0
@@ 851 @@
-In  tensione  gravis-
@@ 852 @@
-sima.
@@ 854 @@
-dp7  U « 379'  20"
@@ 857 @@
-£
@@ 860 @@
-316  5
@@ 861 @@
-237  4
@@ 862 @@
-189  40
@@ 865 @@
-g - °~
@@ 867 @@
-dp6  ^z=ba—
@@ 869 @@
-be 94  50
@@ 872 @@
-9 dp5  -
@@ 874 @@
-5 s4  _
@@ 877 @@
--O-
@@ 880 @@
-d
@@ 883 @@
-59  16
@@ 884 @@
-29  38
@@ 887 @@
-%
@@ 890 @@
--9©-
@@ 893 @@
-tj  « 3;
@@ 896 @@
-4 56
@@ 899 @@
-3 51
@@ 902 @@
-Acutis-
@@ 904 @@
-sima.
@@ 906 @@
-325' 26"
@@ 907 @@
-244  4
@@ 908 @@
-195  14
@@ 909 @@
-162  43
@@ 910 @@
-97  37
@@ 912 @@
-61  1
@@ 913 @@
-30  31
@@ 916 @@
-5 5
@@ 919 @@
-1 55
@@ 928 @@
-omnium  motuum  harmonias  easque  duorum  generum  , duri  et  mollis , et  in
+omnium motuum harmonias easque duorum generum, duri et mollis, et in
@@ 933 @@
-terquam aphelio' Martis  et  perihelio  Jovis;  quia  curo  ille  obtineat  /p , hic  d,
+terquam aphelio Martis et perihelio Jovis; quia cum ille obtineat fϱ, hic d,
@@ 934 @@
-Venus,  obtinens  intermedium  d(j  vel  e perpetuo,  non  fert  illos  suos  vicinos
+Venus, obtinens intermedium dϱ vel e perpetuo, non fert illos suos vicinos
@@ 936 @@
-dendi ex  e vel  dQ . Hoc  impedimenti  habet  conjugium  hoc  Telluris  et  Ve-
+dendi ex e vel dϱ. Hoc impedimenti habet conjugium hoc Telluris et Ve-
@@ 937 @@
-neris,, ceu  maris  et  feminae,  qui  duo  planetae  genera  harmoniarum  distinguunt,
+neris, ceu maris et feminae, qui duo planetae genera harmoniarum distinguunt,
@@ 939 @@
-alteri  fuerit  gratificatus , Terra  scilicet  vel  in  aphelio  suo  fuerit , tanquam
+alteri fuerit gratificatus, Terra scilicet vel in aphelio suo fuerit, tanquam
@@ 942 @@
-298
@@ 945 @@
-De  Motibus  Planetarum  Harmonicis.
@@ 950 @@
-blande  admiserit,  ipsave  Tellus,  suum  in  perihelium  versus  9 inque  ejus  ve-
+blande admiserit, ipsave Tellus, suum in perihelium versus ♀ inque ejus ve-
@@ 954 @@
-Quodsi  hanc  oblocutricem  9 silere  jubeamus,  hoc  est  si  consideraveri-
+Quodsi hanc oblocutricem ♀ silere jubeamus, hoc est si consideraveri-
@@ 956 @@
-quorum planetarum,  excluso  motu  9>  adhuc  quidem  Tellus  oberrat  chorda
+quorum planetarum, excluso motu ♀, adhuc quidem Tellus oberrat chorda
@@ 957 @@
-sua  gr,  nec  ascendit  ab  ea  ultra  semitonium ; possunt  igitur  cum  g conspirare
+sua g, nec ascendit ab ea ultra semitonium; possunt igitur cum g conspirare
@@ 958 @@
-6,  7i,  c,  d)  dg,  e,  ubi  Jupiter,  ut  vides,  chordam  d signans  motu  perihelio,
+b, h, c, d, dϱ, e, ubi Jupiter, ut vides, chordam d signans motu perihelio,
@@ 960 @@
-lius,  obtinens  gr,  non  fert  illum  in  fg,  perihelius  vero,  ut  supra  dictum  cap.  5;
+lius, obtinens g, non fert illum in fϱ, perihelius vero, ut supra dictum cap. 5,
@@ 964 @@
-Harmoniae  planetarum  quinque,  dissimulata  Venere.
@@ 967 @@
-Generis  duri.
@@ 970 @@
-Generis  mollis.
@@ 973 @@
-d7
@@ 975 @@
-h6
@@ 976 @@
-. 6
@@ 979 @@
-5 g
@@ 981 @@
-d6
@@ 983 @@
-hic  ob-
@@ 984 @@
-9 strepit
@@ 987 @@
-:Q:
@@ 990 @@
-In  tensione  gravis-
@@ 991 @@
-sima.
@@ 993 @@
-342' 18"
@@ 994 @@
-285  15  '
@@ 995 @@
-228  12
@@ 997 @@
-171  9
@@ 999 @@
-95  5
@@ 1002 @@
--O-,
@@ 1005 @@
-6
@@ 1007 @@
-d
@@ 1010 @@
-g*
@@ 1012 @@
-h ®
@@ 1014 @@
-g3
@@ 1017 @@
-IO:
@@ 1020 @@
-% h7
@@ 1022 @@
-h -
@@ 1025 @@
-cr
@@ 1028 @@
-¥
@@ 1031 @@
-57  3
@@ 1032 @@
-35  39
@@ 1033 @@
-28  31
@@ 1036 @@
-5 21
@@ 1039 @@
-2 13
@@ 1040 @@
-1 47
@@ 1043 @@
-Acutis-
@@ 1045 @@
-sima.
@@ 1047 @@
-351 '24"
@@ 1048 @@
-292  48
@@ 1049 @@
-234  16
@@ 1051 @@
-175  42
@@ 1053 @@
-97  37
@@ 1055 @@
-58  34
@@ 1056 @@
-36  36
@@ 1057 @@
-29  17
@@ 1060 @@
-5 30
@@ 1061 @@
-4 35
@@ 1064 @@
-In  tensione  gravis-
@@ 1065 @@
-sima.
@@ 1067 @@
-d7 342' 18"
@@ 1069 @@
-— 273  50
@@ 1070 @@
-° 228  12
@@ 1073 @@
-X h 6 &O
@@ 1075 @@
-V g6
@@ 1077 @@
-d6  ,
@@ 1080 @@
-Q obstre-—
@@ 1082 @@
-"^pit  e5
@@ 1084 @@
-6 g*  ^
@@ 1086 @@
-h3  b:
@@ 1088 @@
-d
@@ 1091 @@
--g'
@@ 1094 @@
-171  9
@@ 1096 @@
-95  5
@@ 1098 @@
-57  3
@@ 1099 @@
-34  14
@@ 1101 @@
-28  31
@@ 1104 @@
-b —
@@ 1107 @@
-%
@@ 1109 @@
-h
@@ 1112 @@
-H
@@ 1114 @@
-G
@@ 1117 @@
-:5o-
@@ 1120 @@
-5 21
@@ 1123 @@
-2 8
@@ 1125 @@
-1 47
@@ 1128 @@
-Acutis-
@@ 1130 @@
-sima.
@@ 1132 @@
-351' 24"
@@ 1133 @@
-280  57
@@ 1134 @@
-234  16
@@ 1135 @@
-175  42
@@ 1137 @@
-97  37
@@ 1139 @@
-58  34
@@ 1140 @@
-35  8
@@ 1142 @@
-29  17
@@ 1145 @@
-5 30
@@ 1148 @@
-2 12
@@ 1149 @@
-1 50
@@ 1153 @@
-Saturnus,  Terra  apheliis;  in  media  Satur-
+Saturnus, Terra apheliis; in media Saturnus
@@ 1154 @@
-nus perihelio , Jupiter  aphelio ; in  acutis-
+perihelio, Jupiter aphelio; in acutis-
@@ 1168 @@
-Liber  V.  Caput  VIII.
@@ 1171 @@
-299
@@ 1174 @@
-Ut  h concordet.
@@ 1177 @@
-Ut  a concordet.
@@ 1180 @@
-0 d7
@@ 1182 @@
-V h6
@@ 1184 @@
-fp*
@@ 1186 @@
-d«
@@ 1189 @@
-<S
@@ 1192 @@
-Tj.  dl
@@ 1193 @@
-f)  H
@@ 1196 @@
--O-
@@ 1199 @@
-335-50"
@@ 1200 @@
-279  52
@@ 1203 @@
--30  ^ 209  52
@@ 1205 @@
--gw.0_  167  55
@@ 1208 @@
-h3
@@ 1211 @@
-3:
@@ 1214 @@
--O-  34  59
@@ 1216 @@
-=ftO-  26
@@ 1218 @@
-2=  5 15
@@ 1220 @@
-^Z===  2 11
@@ 1223 @@
-d
@@ 1226 @@
-fp6
@@ 1228 @@
-dr’
@@ 1231 @@
-f p3
@@ 1234 @@
-D A
@@ 1237 @@
-:o:
@@ 1240 @@
--3©-
@@ 1243 @@
-o
@@ 1245 @@
-:#a:
@@ 1248 @@
-:o:
@@ 1251 @@
-:o:
@@ 1254 @@
-*27\
@@ 1260 @@
-tendens  in  certas  et  praescriptas  clausulas , singulas  sex  terminorum  (veluti
+tendens in certas et praescriptas clausulas, singulas sex terminorum (veluti
@@ 1269 @@
-CAPUT  VIII.
+## Caput VIII. Quis in concordantiis coelestibus discanti, quis alti, quis tenoris, quis bassi vicem obeat?
@@ 1271 @@
-Quis  in  concord  antiis  coelestibus  discanti,  quis  alti,  quis
@@ 1272 @@
-tenoris,  quis  bassi  vicem  obeat?
@@ 1279 @@
-qualis  est  in  cantu  humano : prius  quippe  erat  numerus  planetarum  sex,  So-
+qualis est in cantu humano: prius quippe erat numerus planetarum sex, So-
@@ 1287 @@
-300
@@ 1290 @@
-De  Motibus  Planetarum  Harmonicis.
@@ 1302 @@
-utrinque  unus,  ceterarum  singularum  vocum  singuli ; quodque  2)  ut  altus  pene
+utrinque unus, ceterarum singularum vocum singuli; quodque 2) ut altus pene
@@ 1314 @@
-CAPUT  X.
+## Caput X. Epilogus de Sole, conjecturalis
@@ 1316 @@
-Epilogus  de  Sole,  conjecturalis.
@@ 1328 @@
-visus  nostri  aut  certe  sensionis  illius,  qua  lib.  IV.  natura  sublimaris  perci-
+visus nostri aut certe sensionis illius, qua lib. IV. natura sublunaris perci-
@@ 1336 @@
-quatuor,  Saturnum  duo,  Tellurem  vero  et  nos  ejus  incolas  unica.  Luna  cursu
+quatuor, Saturnum duo, Tellurem vero et nos ejus incolas unica Luna cursu
@@ 1339 @@
-21  *
@@ 1342 @@
-324
@@ 1345 @@
-De  Motibus  Planetarum  Harmonicis.
@@ 1348 @@
-speciale  hoc  negotium  harmonicum , vestigium  evidentissimum  summae  provi-
+speciale hoc negotium harmonicum, vestigium evidentissimum summae provi-
@@ 1350 @@
-exire  in  totum  mundum  ex  Sole,  ut  a foco  ve!  oculo  mundi,  lucem,  ut  ex
+exire in totum mundum ex Sole, ut a foco vel oculo mundi, lucem, ut ex
@@ 1358 @@
-creatis  statim  ab  initio  seu  olirn  huc  transferendis.  Nam  et  terrestris  iste
+creatis statim ab initio seu olim huc transferendis. Nam et terrestris iste
@@ 1361 @@
-animum  cogitatio , quid  sibi  voluerint  antiqui  Pythagoraei  apud  Aristotelem,
+animum cogitatio, quid sibi voluerint antiqui Pythagoraei apud Aristotelem,
@@ 1362 @@
-qui  centrUm  mundi  (quorsum  ignem  referebant,  Solem  vero  subintelligebant)
+qui centrum mundi (quorsum ignem referebant, Solem vero subintelligebant)
@@ 1363 @@
-soliti  sunt  appellare  Jovis  excubias,  zhog  cpvhxxrjv',  quid  item  vetus  interpres
+soliti sunt appellare Jovis excubias, [Greek]; quid item vetus interpres
@@ 1365 @@
-bernaculum. “ Sed  et  in  hymnum  Procli  philosophi  Platonici  (cujus  in  superio-
+bernaculum.“ Sed et in hymnum Procli philosophi Platonici (cujus in superio-
@@ 1367 @@
-mysteriis,  si  ei  unum  illud  xXv&i  eripias;  quamvis  hoc  ipsum  in  eo  quadam-
+mysteriis, si ei unum illud [Greek] eripias; quamvis hoc ipsum in eo quadam-
@@ 1371 @@
-gentilium  poetarum  contemnere  scelus  erat  (sub  Constantino , Maxentio  et  Juliano
+gentilium poetarum contemnere scelus erat (sub Constantino, Maxentio et Juliano
@@ 1383 @@
-ipse  ab  iis  transsumtum  in  illam  suam  philosophiam  adoptaret.  *)  Itaque
+ipse ab iis transsumtum in illam suam philosophiam adoptaret. Itaque
@@ 1385 @@
-suam:  habeat  sibi  Titan  ille  res  suas  yjmm  fjnu  et  xafunov  cpaovg , fxe.aaa-
+suam: habeat sibi Titan ille res suas [Greek] et [Greek],
@@ 1386 @@
-xir\v  al&SQog  edorjp , xoapiov  xpaduuov  ioicpsyym  xvxb>v,  quam  speciem  etiam
+quam speciem etiam
@@ 1387 @@
-Copernicus  ei  largitur:  habeat  etiam  nahrvonxovg  Siq onag,  quamvis  illos  non
+Copernicus ei largitur: habeat etiam [Greek], quamvis illos non
@@ 1388 @@
-habeat  per  antiquos  Pythagoreos,  sed  eorum  loco  x o kmxqov  , z hos  cpvXaxryv
+habeat per antiquos Pythagoreos, sed eorum loco [Greek]
@@ 1390 @@
-deformatum,  non  agnovit),  habeat  et  yeve&Xrjv  ex  se  fiXaoxrjoixoav , et  quic-,
+deformatum, non agnovit), habeat et [Greek] ex se [Greek], et quic-
@@ 1394 @@
-*)  Veterum  de  ejus  libro  fitjTQmaxrj  judicium  fuit,  in  eo  non  sine  divino  raptu  expo-
@@ 1395 @@
-sitam esse  doctrinam  universam  de  Deo  , et  lacrimis  ex  eo  frequentibus  auctoris  apparen-
@@ 1396 @@
-tibus, suspicionem  omnem  audientibus  auferri.  Idem  tamen  scripsit  contra  Christianos  epi-
@@ 1397 @@
-chiremata 18 , quibus  se  opposuit  Joannes  Philoponus , exprobrans  ipsi  graecarum  rerum
@@ 1398 @@
-inscitiam , quas  tamen  defendendas  susceperat.  Scilicet  dissimulaverat  Proclus  illa , quae
@@ 1399 @@
-ad  suam  philosophiam  non  faciebant.
@@ 1402 @@
-Liber  V.  Caput  X.
@@ 1405 @@
-325
@@ 1409 @@
-Titanis  nomine,  £coagnsog,  00  dva,  nrjyrjg  avtog  eycov  xkrjitia,  et  illa,  nana  rerjg
+Titanis nomine, [Greek], et illa, [Greek],
@@ 1410 @@
-snXrjaag  eyegmvooio  ngowirjg , et  illam  potestatem  immensam  / loigvuav , et  quae
+et illam potestatem immensam [Greek], et quae
@@ 1411 @@
-in  nulla  philosophia  legebantur  ante  promulgationem  Evangelii*),  daemonas
+in nulla philosophia legebantur ante promulgationem Evangelii, daemonas
@@ 1412 @@
-formidantes  minax  illius  flagellum,  daemonas  animabus  insidiantes,  oq>ga  vxpi-
+formidantes minax illius flagellum, daemonas animabus insidiantes, [Greek];
@@ 1413 @@
-revovg  h/.thino  nazgog  negicpeyyeog  avkrjgj  et  quis  nisi  verbum  patris  est  ille
+et quis nisi verbum patris est ille
@@ 1414 @@
-nxcov  nayyeve.rap  &eov,  ov  qp avenog  dri  dggrjzov  yevezrjgog  navaaro  azoiyemv
+[Greek],
@@ 1415 @@
-opvfxaydog  eri  d\hj\ounv  ionwr,  secundum  illud : Terra  erat  rudis  indigestaque
+secundum illud: Terra erat rudis indigestaque
@@ 1418 @@
-nisi  Jesus  Nazarenus,  Dei  filius,  ijnr/orv  dvaycoyevg,  pastor  animarum,  cui  of-
+nisi Jesus Nazarenus, Dei filius, [Greek], pastor animarum, cui of-
@@ 1419 @@
-ferenda Ueoir;  nokvSaxgvog,  ut  nos  purget  a peccatis  exque  sordibus  eruat  rrjg
+ferenda [Greek], ut nos purget a peccatis exque sordibus eruat [Greek]
@@ 1420 @@
-yeyerikrjg  (quasi  peccati  originalis  fomitem  fateretur)  et  a poenis  malisque  cu-
+(quasi peccati originalis fomitem fateretur) et a poenis malisque cu-
@@ 1421 @@
-stodiat, ngrjvmv  tinor  o/iyia  SixTjg,  scilicet  iram  Patris?  et  quae  alia  velut  ex
+stodiat, [Greek], scilicet iram Patris? et quae alia velut ex
@@ 1422 @@
-hymno  Zachariae  depromta  legimus,  (an  igitur  hymnus  iste'  pars  erat  MijtQ(oav.Tjg  ?)
+hymno Zachariae depromta legimus, (an igitur hymnus iste pars erat [Greek]?)
@@ 1423 @@
-’ Aykw  dnoanedaaag  oXeaig^gorov  ioXoyevzov , ut  sc.  animabus  versantibus  in
+[Greek], ut sc. animabus versantibus in
@@ 1424 @@
-tenebris  et  umbra  mortis  det  qp aog  dyvov  et  dlfiov  darvtyeXmrov  ari  evae^irjg
+tenebris et umbra mortis det [Greek] et [Greek];
@@ 1425 @@
-egazeivrjg:  id  enim  est  servire  Deo  in  sanctitate  et  justitia  omnibus  diebus  nostris.
+id enim est servire Deo in sanctitate et justitia omnibus diebus nostris.
@@ 1429 @@
-facta  est  mentio  hymni,  id  videamur.  Eundem  enim  Solem  qui
+facta est mentio hymni, id videamus. Eundem enim Solem qui
@@ 1431 @@
-'Txporiev  dggovirjg  gvua  nkovmov  e^oyezevei  (sic  etiam  Orpheus  xoouov  rov
+[Greek] (sic etiam Orpheus [Greek].),
@@ 1432 @@
-svap/uoviov  Sgofiov  Uxav.),  eundem,  de  cujus  prosapia  oriundus  Phoebus  r.i&agr(  vno
+eundem, de cujus prosapia oriundus Phoebus [Greek],
@@ 1433 @@
-{fefJxeXa  geXrnov  evw£e.i  / ueya  xvua  pagvcfXotcrftoio  yeve&hjg,  et  cujus  chori  consors
+et cujus chori consors
@@ 1434 @@
-est  paean,  nXrjnag  dgfxovirjg  navanr^wvog  evgea  xoa/wv,  eundem  inquam  primo
+est paean, [Greek], eundem inquam primo
@@ 1435 @@
-statim  hymni  versiculo  salutat  nvgog  voegov  ftaatXea.  Quo  exordio  simul  in-
+statim hymni versiculo salutat [Greek]. Quo exordio simul in-
@@ 1437 @@
-pulum a magistris  in  centri  loco  , quod  ipsi  Soli  dabant , dissentire) , simul
+pulum a magistris in centri loco, quod ipsi Soli dabant, dissentire), simul
@@ 1439 @@
-tualia transfert,  et  illi  suo  nvgi  voegm  (igni  forte  Stoicorum  artifici),  illi  Pla-
+tualia transfert, et illi suo [Greek] (igni forte Stoicorum artifici), illi Pla-
@@ 1440 @@
-tonis sui  creato  Deo,  menti  principi  seu  avzovo/j.cg,  sedem  regiam  in  corpore
+tonis sui creato Deo, menti principi seu [Greek], sedem regiam in corpore
@@ 1441 @@
-Solis  assignavit , creaturam  et  eum , per  quem  omnia  creata  sunt,  confundens
+Solis assignavit, creaturam et eum, per quem omnia creata sunt, confundens
@@ 1442 @@
-in  unum.  At  nos  Christiani,  melius  distinguere  docti,  Xoynz  illum  aeternum
+in unum. At nos Christiani, melius distinguere docti, [Greek] illum aeternum
@@ 1443 @@
-et  increatum,  qui  erat  ngog  rov  tieov,  et  qui  nullis  sedibus  continetur,  quam-
+et increatum, qui erat [Greek], et qui nullis sedibus continetur, quam-
@@ 1444 @@
-vis sit  intra  omnia,  nullis  excluditur,  quamvis  ipse  extra  mnnia,  scimus  car-
+vis sit intra omnia, nullis excluditur, quamvis ipse extra omnia, scimus car-
@@ 1446 @@
-et  consummato  carnis  ministerio , coelos , in  quibus  et  pater  coelestis,  excel-
+et consummato carnis ministerio, coelos, in quibus et pater coelestis, excel-
@@ 1453 @@
-sit  illa  prastantiae , Creatori  suo  merito  subjicimus , nec  Deos  intelligentias
+sit illa prastantiae, Creatori suo merito subjicimus, nec Deos intelligentias
@@ 1459 @@
-*)  Similia  tamen  nonnulla  Orpheo  vetustissimo  et  prope  Mosis  aequali,  tanquam  hujus
@@ 1460 @@
-discipulo  tribuuntur  apud  Suidam.  Vide  et  hymnos  Orphei,  in  quos  scripsit  Proclus.
@@ 1463 @@
-326
@@ 1466 @@
-De  Motibus  Planetarum  Harmonicis.
@@ 1473 @@
-nullis ejus  muniis ) Quodsi  licet  analogiae  filo  ducente  labyrinthos  mysteriorum
+nullis ejus muniis.) Quodsi licet analogiae filo ducente labyrinthos mysteriorum
@@ 1476 @@
-eadem  sit  et  T//g  duxvoiag  ad  ror  vow , ut  hae  facultates  ab  Aristotele,  Pla-
+eadem sit et [Greek] ad [Greek], ut hae facultates ab Aristotele, Pla-
@@ 1479 @@
-dfieta&eror  in  spatio  totius  systematis  medio  (de  qua  testantur  maculae  Solis.
+[Greek] in spatio totius systematis medio (de qua testantur maculae Solis.
@@ 1481 @@
-rov  diaDor/tixov  ad  to  roepor;  discursuum  ratiocinationis  multiplicium  ad  in-
+[Greek] ad [Greek]; discursuum ratiocinationis multiplicium ad in-
@@ 1486 @@
-(Videfol.  221.  lib.  IV.)  Adeoque  connexa  sunt  inter  se  et  colligata  motus  plane-
+(Vide fol. 221. lib. IV.) Adeoque connexa sunt inter se et colligata motus plane-
@@ 1490 @@
-ratioeinatio  ad  verissima  planetarum  intervalla  et  ad  cetera  ab  iis  dependentia
+ratiocinatio ad verissima planetarum intervalla et ad cetera ab iis dependentia
@@ 1493 @@
-consequitur  intellectionis  simplicitas , eo  quod  hactenus  nobis  usurpatum  sem-
+consequitur intellectionis simplicitas, eo quod hactenus nobis usurpatum sem-
@@ 1496 @@
-harmonias  istas , illi  desunt  adminicula  motus  et  stationum  diversarum  sedis
+harmonias istas, illi desunt adminicula motus et stationum diversarum sedis
@@ 1499 @@
-ut  ii  sunt  in  suis  orbitis  , sed  uti  per  angulos  ad  centrum  Solis  allabuntur.
+ut ii sunt in suis orbitis, sed uti per angulos ad centrum Solis allabuntur.
@@ 1502 @@
-manis mentibus  et  de  natura  sublunari  verum  esse , supra  ex  Platone  et
+manis mentibus et de natura sublunari verum esse, supra ex Platone et
@@ 1506 @@
-gorae cratere , quem  Proclus  in  ipso  statim  primo  versu  hymni  propinat,
+gorae cratere, quem Proclus in ipso statim primo versu hymni propinat,
@@ 1509 @@
-ticam et  somniando  Ciceronis  Scipionem  imitari) : per  globos  quidem  reliquos,  de
+ticam et somniando Ciceronis Scipionem imitari): per globos quidem reliquos, de
@@ 1511 @@
-tiocinativas facultates , quarum  praestantissima  utique  et  absolutissima  illa
+tiocinativas facultates, quarum praestantissima utique et absolutissima illa
@@ 1513 @@
-in  Sole  vero  intellectum  simplicem,  tivq  wsqod  seu  vovi>  habitare,  omnis  har-
+in Sole vero intellectum simplicem, [Greek] seu [Greek] habitare, omnis har-
@@ 1517 @@
-Brahe,  non  esse  frustraneam  illam  in  mundo,  sed  incolis  refertam : quanto  ve-
+Brahe, non esse frustraneam illam in mundo, sed incolis refertam: quanto ve-
@@ 1523 @@
-I
@@ 1526 @@
-Liber  V.  Caput  X.  327
@@ 1533 @@
-Omnem  bonitatem,  ut  non  vellet  ceteros  etiam  globos  convenientibus  exornare
+omnem bonitatem, ut non vellet ceteros etiam globos convenientibus exornare
@@ 1540 @@
-ejusque  ineffabi litate  habeant:  quid  ceteros  globos  habere  putabimus  a figuris
+ejusque ineffabilitate habeant: quid ceteros globos habere putabimus a figuris
@@ 1542 @@
-ut  nostrum  domicilium  haec  nostra  Luna  unica  ? Ad  eundem  vero  modum
+ut nostrum domicilium haec nostra Luna unica? Ad eundem vero modum
@@ 1546 @@
-Ulene  globus  vacuus,  ceteri  pleni  sunt,  si  omnia  alia  respondent  propius?  si
+Illene globus vacuus, ceteri pleni sunt, si omnia alia respondent propius? si
@@ 1551 @@
-tium simplicium  capacia,  vereque  Solem  esse  nvgog  rosgov  si  non  regem,  at
+tium simplicium capacia, vereque Solem esse [Greek] si non regem, at
@@ 1552 @@
-saltem  regiam  ?
+saltem regiam?
@@ 1555 @@
-lud exclamans  cum  Psalte  rege  :
+lud exclamans cum Psalte rege:
@@ 1559 @@
-cunque sensu  ad  percipiendum , quacunque  lingua  ad  eloquendum  Creatorem
+cunque sensu ad percipiendum, quacunque lingua ad eloquendum Creatorem
@@ 1561 @@
-moniarum detectarum  arbitri  (Tuque  aute  omnes,  Moestline  felici  senecta,  nam-
+moniarum detectarum arbitri (Tuque ante omnes, Moestline felici senecta, nam-
@@ 1563 @@
-Creatorem,  tuum , quamdiu  fuero : namque  ex  ipso  et  per  ipsum  et  in  ipso
+Creatorem tuum, quamdiu fuero: namque ex ipso et per ipsum et in ipso
@@ 1564 @@
-sunt  omnia,  mu  ta  (xur&rjta  x<a  ra  vosga ; tam  ea  quae  ignoramus  penitus ,
+sunt omnia, [Greek]; tam ea quae ignoramus penitus,
@@ 1565 @@
-quam  ea  quae  scimus,  minima  illorum  pars ; quia  adhuc  plus  ultra  est.
+quam ea quae scimus, minima illorum pars; quia adhuc plus ultra est.
@@ 1566 @@
-Ipsi  laus,  honor  et  gloria  in  secula  secutorum.  Arnen.
+Ipsi laus, honor et gloria in secula seculorum. Amen.
@@ 1568 @@
-FINIS.
@@ 1570 @@
-Absolutum  est  hoc  opus  die  17.  27.  Maii , anno  MDCXVIII;  revisus  vero  liber  V.
@@ 1571 @@
-(interim  dum  iu  eo  typi  progrediuntur)  9.  19.  Februarii  anno  MDCXIX.
@@ 1573 @@
-Lincii  Metropoli  Austriae  Supranisanae.
```
