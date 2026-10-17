# Kepler, Harmonices Mundi, Book V (Linz, 1619): a first proofing pass, not served

Not ingested. The pass was made by a model, line by line against the Internet Archive OCR, and left 181 readings unresolved ([?]) in about 4,100 words of text, one in 23, against RISE's limit of one in 40. The 1619 type defeats the OCR: c and t are confused throughout, the long s reads as f, words run together, Kepler's marginal notes are fused into the lines, the Greek (Plato, Proclus, Orpheus) is lost entirely, and the musical and numerical tables of Caput VII are noise. After removing the tables the selection is also short of the 6,000 words planned. Book V needs proofing from the page images.
# Kepler, Harmonices Mundi (1619), Book V selection: the proofing diff

Every change RISE made to the Internet Archive's OCR (ioanniskepplerih00kepl) in a first pass (the proofed text is not served and not kept; the `+` lines below are that pass), for a person to read against the OCR (`harmonices-mundi-v.ocr.txt`, untouched) and, where in doubt, against the page images at https://archive.org/details/ioanniskepplerih00kepl.

Rules applied everywhere and not listed line by line:

- Lines are joined into the edition's paragraphs, and runs of spaces become one space (space before `; : ! ?` kept in French).
- A word hyphenated across a line end is joined into one word, unless the hyphen belongs to the word (the hyphenated form is printed elsewhere in the book, the next word is a conjunction after a suspended compound, or the second part begins with a capital); those kept are listed below.

Listed below, line by line: every line removed (running heads, page numbers, signatures, catchwords, footnotes, margin notes, captions, scanner noise) and every line corrected (OCR errors, note markers and margin fragments struck, headings set, the long s and ligatures normalised). `[?]` marks a reading the OCR does not settle.

## Counts

- OCR lines removed or replaced: 1261; corrected or new lines: 504.
- Line-end hyphens joined into one word: 189; kept as hyphens: 2 (listed below).
- Readings left unresolved, marked [?]: 181.

## Line-end hyphens kept

- TABERNACU-LUM
- glo- bis

## Every change, OCR to first pass, word by word

Almost every line of this OCR needed a change, so the changes are shown word by word: `[-…-]` is what the OCR read, `{+…+}` what the first pass reads; text outside the brackets was kept. The OCR file's lines run in order; whole lines removed (running heads, catchwords, margins, tables) appear as `[-…-]` alone.

```text
@@ -1,1261 +1,504 @@
[-Prooemium. -]

[-^^lj^^Vod-]{+## Prooemium+}

{+Quod+} ante duos & viginti [-annos ,-]{+annos,+} primum at-
[-jPJA  f-,.  iljSque-]{+que+} figuras quinque [-folidasinterorbes  coeleftes  reperi , -]
[-5*  y)  ^hjmauguratus;qdodfirmiceranimoperfua(imeo,priuf- -]
[-pfLji  i,imjfc\a^m-]{+solidas inter orbes coelestes reperi,+}
{+auguratus; quod firmiter animo persuasi meo, prius-+}
{+quam+} Ptolemaei Harmonica [-vidiflem;quod  ciculo-]{+vidissem; quod titulo+} libri hu-
[-awWs^^jusquincinuncuparo^priufquamdere  iplacercus  eflcm , -]
[-polliclcus  fumamicis  ;  quodance  fedecimannospubhcofcripcoqua:--]{+jus quinti nuncupato, priusquam de re ipsa certus essem,+}
{+pollicitus sum amicis; quod ante sedecim annos publico scripto quae-+}
rendum [-inculcavi  ;-]{+inculcavi;+} cujus causa [-vicae  parcem  opcimam  Aftronomicis -]
[-concemplacionibus  impendi ,-]{+vitae partem optimam Astronomicis+}
{+contemplationibus impendi,+} Tychonem Braheum [-conveni ,-]{+conveni,+} Pragam
[-fedem  elegi .-]{+sedem elegi:+} id [-candem,-]{+tandem,+} Deo [-Opc.Maximo,-]{+Opt. Maximo,+} qui [-mencem  infpiravejat , -]
[-deiiderium-]{+mentem inspiraverat,+}
{+desiderium+} ingens [-excicaverac ,  vicam  eciam  &:  vkes-]{+excitaverat, vitam etiam & vires+} ingenij prorogan-
[-ce,mediaquecnetera,  perduorumlmperacorum  ,'hujufqueprovinci<e -]
[-Auftria:  Supr-Anifanae-]{+te, mediaque caetera, per duorum Imperatorum, hujusque provinciae+}
{+Austriae Supr-Anisanae+} Procerum [-liberalicacem,fuppedicante,defuncls' -]
[-pnus  Aftronomica  provincia ,  quancum  fufficiebac ,  candem  inquarn -]
[-inlucemprocuh  *  fupraquequamfperareunquampocui,  veriflimum-]{+liberalitatem, suppeditante, defunctus+}
{+prius Astronomica provincia, quantum sufficiebat, tandem inquam+}
{+in lucem protuli, supraque quam sperare unquam potui, verissimum+}
deprehendi; [-ToramHarmonicesnacuram  ,quancaquancaeft,cumo- -]
[-mmbusfuis  parcibus,libro-]{+Totam Harmonices naturam, quanta quanta est, cum o-+}
{+mnibus suis partibus, libro+} III. [-explicacis,  incerMocuscoeleftes-]{+explicatis, inter Motus coelestes+} repe-
riri; non eo quidem modo, quem ego conceperam animo; pars haec [-eft -]
[-nonpoftremameigaudij ;  fed  diverfiflimo alio  ,  fimulque-]{+est+}
{+non postrema mei gaudij; sed diversissimo alio, simulque+} & [-praeftan- -]
[-ciflimo-]{+praestan-+}
{+tissimo+} & [-perfe&iflimo.  Acceflic-]{+perfectissimo. Accessit+} hoc [-incermedio  cempore ,-]{+intermedio tempore,+} quo me
[-fufpenfumcenuit  Mocuum  refticuciolaboriofiflima,-]{+suspensum tenuit Motuum restitutio laboriosissima,+} praecipuum & cu-
[-pidicacismeceincremencum,&propoflci  incicamencum  ,  le&ioHar- -]
[-monicorumPcolemsi  ,q«aemanufcripcamihicranfmificVireximius, -]
[-adquephilofophiam,  omneq-,  adeogenuserudicionispromovendum -]
[-nacus,-]{+piditatis meae incrementum, & propositi incitamentum, lectio Har-+}
{+monicorum Ptolemaei, quae manuscripta mihi transmisit Vir eximius,+}
{+adque philosophiam, omneque adeo genus eruditionis promovendum+}
{+natus,+} Johannes Georgius Hervvardus, Bavariae Cancellarius: ubi prae-
ter [-expe&acionem ,-]{+expectationem,+} & [-fumma-]{+summa+} cum [-admiracione ,-]{+admiratione,+} inveni, [-cocum-]{+totum+} fere li-
brum ejus [-cercium-]{+tertium+} in eadem [-concemplacioneHarmoniaecoeleftisin- -]
[-fumpcum,  ance-]{+contemplatione Harmoniae coelestis in-+}
{+sumptum, ante+} mille & quingentos annos. Verum id [-aecacis  mulcum -]
[-adhucdeerac  Aftronomia:;pocuicque  Pcolemzeus ,-]{+aetatis multum+}
{+adhuc deerat Astronomiae; potuitque Ptolemaeus,+} re infoeliciter [-cen- -]
[-caca,defperarionemalijsobjicere  ;  ucqui-]{+ten-+}
{+tata, desperationem alijs objicere; ut qui+} cum Scipione Ciceroniano
[-pocius  fuave-]{+potius suave+} quoddam [-fomnium  Pythagoricu  recicafle ,-]{+somnium Pythagoricum recitasse,+} quam [-philofo--]{+philoso-+}
phiam [-ad  juviffe  viderecur:-]{+adjuvisse videretur:+} ac me cum [-ilja  veceris  Aftronomiae  rudicas, -]
[-cumhicipfe  medi:acionumucriufque,ex-]{+illa veteris Astronomiae ruditas,+}
{+tum hic ipse meditationum utriusque, ex+} quindecim [-faeculorum  incer--]{+saeculorum inter-+}
vallo, [-confenfus-]{+consensus+} ad [-amufsim  exa<ftus ,  vehemencer  conflrmavic  inur--]{+amussim exactus, vehementer confirmavit in ur-+}
gendo [-propofico.-]{+proposito.+} Nam quid [-mulcis-]{+multis+} opus? [-Ipfa-]{+Ipsa+} rerum [-Nacura  fefe-]{+Natura sese+} pro-
[-dicumibachominibus,perdiverfbsdiftantiumfaeculorumincerpreces: -]
[-digitusDeieracuccumHebraeisloquar,  hicinAnimis  duorum  ,-]{+ditum ibat hominibus, per diversos distantium saeculorum interpretes:+}
{+digitus Dei erat ut cum Hebraeis loquar, hic in Animis duorum,+} qui
[-fecocosconcemplacioniNacuraededidifTencsde  conformacione-]{+se totos contemplationi Naturae dedidissent, de conformatione+} Mun-
[-di,concepcus  idem  :-]{+di, conceptus idem:+} cum [-neuceralceri-]{+neuter alteri+} dux [-fuiflecad-]{+fuisset ad+} hoc [-icer-]{+iter+} ingre-
diendum. [-Jampoftquam-]{+Jam postquam+} a [-menfibus  o&odecim-]{+mensibus octodecim+} prima [-lux  ,-]{+lux,+} a tri-
[-bus,dies  jufta ,  apaucifsimis.vero  diebus >-]{+bus, dies justa, a paucissimis vero diebus,+} Sol [-jpfemerusiliuxit-]{+ipse merus illuxit+} con-
[-cemplationis  admirabilifsimae ;-]{+templationis admirabilissimae;+} nihil me [-retinet ,-]{+retinet,+} lubet indulgere
[-facro  furori ,  lubec  infultare-]{+sacro furori, lubet insultare+} mortalibus [-confeffione  ingenua  ,  rae -]

[-vafa -]


[-Harmonicis  LlB  Vj         \79 -]

[-Vafa-]{+confessione ingenua, me+}
{+Vasa+} aurea [-yEgypciorum-]{+Aegyptiorum+} furari, [-uc  Ded-]{+ut Deo+} meo Tabernaculum ex [-iji -]
[-conftruam,  longilfime-]{+iis+}
{+construam, longissime+} ab [-iEgypci  firiibus.-]{+Aegypti finibus.+} Si [-ignofcicis  ,  gaudebo ;  fi -]
[-fiiecenfecis,feram:jacioen-]{+ignoscitis, gaudebo; si+}
{+succensetis, feram: jacio en+} aleam, librumque [-fcribo  ,  fcu  prasfenci- -]
[-bus,feu  pofteris  legcndum,-]{+scribo, seu praesenti-+}
{+bus, seu posteris legendum,+} nihil [-incereft  :  expec~tecillc'fuum  leclo- -]
[-iemper  anrioscencum  ,•  fiDeusipfe-]{+interest: expectet ille suum lecto-+}
{+rem per annos centum; si Deus ipse+} per annorum [-fenamillia  coacem- -]
[-placcrem  praftolacus  eft.-]{+sena millia contem-+}
{+platorem praestolatus est.+}

Capita [-hujuslibri  fuiit  ift&» -]

[-t,-]{+hujus libri sunt ista.+}

{+I.+} De [-quinqut fblidisfiguris  Regutaribui.-]{+quinque solidis figuris Regularibus.+}

II. [-Decognations-]{+De cognatione+} cum [-ijs ,-]{+ijs,+} proportionum [-HarmonicarunLs. -]

[-IH.Summa  dotlrink  Aftronomicd,necefaria  adcontemplationem  Havmg* -]
[-fiiarnm  ccekflium^.-]{+Harmonicarum.+}

{+III. Summa doctrinae Astronomicae, necessaria ad contemplationem Harmo-+}
{+niarum coelestium.+}

IV. [-Quj.bus-]{+Quibus+} in rebus ad Planetarum motus [-pertinentihus  exprejfk  fint -]
[-Harrnomg  Jimplices ,  tf  qubd  omn&s  illa-]{+pertinentibus expressae sint+}
{+Harmoniae simplices, & quod omnes illae+} in [-Ccelo  reperiantur ,  qu<e-]{+Coelo reperiantur, quae+} in [-CantU -]
[-infant.-]{+Cantu+}
{+insunt.+}

V. [-Cl*ves  ScaU  Muficx,feuloca  Syflematis,  gf-]{+Claves Scalae Musicae, seu loca Systematis, &+} Genera [-Harmoniarunts^-]{+Harmoniarum,+}
Durum [-z$  Molle  ,-]{+& Molle,+} a certis [-motibusexprefa  efle_s. -]

[-VI:-]{+motibus expressa esse.+}

{+VI.+} Tonos [-feti  Modoi  Mufiios,ftngulos quod&mmodb  ajtnguks  p/anetis -]
[-ixprimi.-]{+seu Modos Musicos, singulos quodammodo a singulis planetis+}
{+exprimi.+}

VII. [-ContrapunEfa  ,feu-]{+Contrapuncta, seu+} Harmonias [-univerfales-]{+universales+} omnium [-Planetarum^i -]
[-tafque  diverfas ,  aliamfcJicetex-]{+Planetarum,+}
{+easque diversas, aliam scilicet ex+} alia, [-exiflerepofie_j>. -]

[-VI II.-]{+existere posse.+}

{+VIII.+} In Planetis [-exprefas  efie-]{+expressas esse+} naturas quatuor [-vocuhis,  Difcanti ,  Alti  ,-]{+[?], Discanti, Alti,+}
Tenoris [-5  Bafi.-]{+& Bassi.+}

IX. [-Demonflratio ,  qucd-]{+Demonstratio, quod+} ad [-oltinendamhanc difliofitionem  harrnonicants  ■>-]{+obtinendam hanc dispositionem harmonicam,+}
Eccentricitates [-Piandnrum  ill*  ippt ,-]{+Planetarum illae ipsae,+} quas [-quilihst  profe hab&t,^-]{+quilibet pro se habet,+} non [-a/iigycon*. -]
[-fiitui  dehuerint,-]{+aliae con-+}
{+stitui debuerint.+}

X. [-Epihgus-]{+Epilogus+} de [-Sole ,-]{+Sole,+} ex [-conjeUuris prxgnantijfimis  t -]

[-^Append.ix  hahe-t :-]{+conjecturis praegnantissimis.+}

{+Appendix habet:+} I. [-Verfionem  lihri  iertij :-]{+Versionem libri tertij+} Harmonicorum [-Pio/emti  aca*-]{+Ptolemaei a ca-+}
pite III. [-quji  trackst-]{+quae tractat+} eandem [-materiants.-]{+materiam.+}

II. Suppletionem textus Ptolemaici [-i  irttrihusultimis  Ptolemsticapitibus  i -]
[-quarum  lemmatn  fblapofeit  Pto!em<cus.-]{+in tribus ultimis Ptolemaei capitibus,+}
{+quorum lemmata sola posuit Ptolemaeus.+}

III. [-'A[otas  adhanc-]{+Notas ad hanc+} partem [-Harmonicorum ,-]{+Harmonicorum,+} quibus [-Mthoremexp/ico,rc$ -]
[-fUto,eju*<L  ve/invenlzt  ve/  attentatu-]{+Authorem explico, re-+}
{+futo, ejusque vel inventa vel attentata+} cum [-msis-]{+meis+} comparo.

De his [-a&uro-]{+acturo+} mihi lubet [-Lec~toribusiriculcareTi-* -]

[-iiiaji ,  Gencilis  philofophi ,-]{+Lectoribus inculcare Ti-+}
{+maei, Gentilis philosophi,+} de [-ijfdem  exordiencis,  adhorcacionem  fan- -]
[-t"tiffimam  ,  aChriftianis-]{+ijsdem exordientis, adhortationem san-+}
{+ctissimam, a Christianis+} hominibus [-furnma.-]{+summa+} cum [-admiracidne  &pu- -]

[-dore,niilimiCericur,cogriOfcendam;qux  caliseft.  A/A  &2&)X^£- -]
[-m )  Tovto  yi  h\  7rAc ,  ocroi,  ^  xotfgi  $$$.yy  (rtoty^jQvm (*.iri- -]
[-^amVi^Bi  7rd<rti  o^fjuni^  <TfjLi}t^y{gj\  ymytxNd  itZ&ypLarpcJdio* -]
[-dii7mKci}\mv  3rifjLoig^i  raV<afe<  ITANT02  T^yxs  7roM&cU -]


[-IgO   DEMOTIBtlsPLANETARUM -]


[-jgij  .9-sots  c^fcoAy^syyc  &;££<&-£«  ttolv^  j  xa&c  *d«£  smvois -]

[-§i$v fj.0LM<;cL ,  zmjLizva)$<&v[Atvei7reiv.-]{+admiratione & pu-+}
{+dore, nisi imitentur, cognoscendam; quae talis est. [?] [?]+}
{+[?] [?] [?] [?] [?] [?] [?] [?] [?] [?] [?]+}
{+[?] [?] [?] [?] [?] [?]+}
{+[?] [?] [?] [?] [?] [?]+}
{+[?] [?] [?] [?] [?] [?] [?] [?] [?]+}
{+[?] [?] [?]+} Enimvero [-Socrates , -]
[-cumomnes-]{+Socrates,+}
{+cum omnes+} qui vel minimum [-Mencishabenc,  quocies  negOciumalU; -]
[-quodfeulevefeu  arduumaggrediuncur,  Deumfemper  invocenc :-]{+Mentis habent, quoties negotium ali-+}
{+quod seu leve seu arduum aggrediuntur, Deum semper invocent:+} Nos
[-ucique,quibu9deRerumuniverficatediuerere  anirpuseft ,  nifiplane-]{+utique, quibus de Rerum universitate disserere animus est, nisi plane+}
ab [-omai  fanaracione-]{+omni sana ratione+} aberramus, [-neceflc  eft,-]{+necesse est,+} Deos [-Peasque-]{+Deasque+} vocis con-
[-cepcisprecariunanimes,  uc  calia  dicamus ,  quas-]{+ceptis precari unanimes, ut talia dicamus, quae+} primum [-ipfis  maxiiae, -]
[-nm-]{+ipsis maxime,+}
{+[?]+} deinde & vobis [-fincgraca-]{+sint grata+} & [-accepca. -]
[-CAP VT-]{+accepta.+}

{+## Caput+} VII. Harmonias [-univerfales-]{+universales+} omnium [-fexPlanetarum  ,veluti  communiaContra- -]


[-'.TSflD -]

[-pun£laj  quadi  iformia  dari. -]


[-J^JVnc  opus ,-]{+sex Planetarum, veluti communia Contrapuncta, quadriformia dari+}

{+Nunc opus,+} Vranie, [-fonitu  majore :-]{+sonitu majore:+} dum per [-fcalatri -]
[--'    Harmomcam  cosleftium  mocuum ,-]{+scalam+}
{+Harmonicam coelestium motuum,+} ad altiora [-c,onfcendo ;  q  u  a-]{+conscendo; qua+} ge-[-^auinud -]


[-208    De  Motibus  Planetarum -]

[-'-]
nuinus [-Archecypus  fabricas  Mundanaerecondicusaffervacur.  Sequi* -]
[-miniMufici moderni,remque  veftris arcibus,  anciquicaci-]{+Archetypus fabricae Mundanae reconditus asservatur. Sequi-+}
{+mini Musici moderni, remque vestris artibus, antiquitati+} non cogni-
[-Anne  fla.  cis,  cenfece  :-]{+tis, censete:+} vos [-hisfaxulis  ultimis ,-]{+his saeculis ultimis,+} prima [-univerficacisexemplage- -]
[-gitium fe.  nuina ,-]{+universitatis exempla ge-+}
{+nuina,+} bis [-milhum-]{+millium+} annorum [-incubacu ,  candem produxicfui-]{+incubatu, tandem produxit sui+} nunquam[-fC1°  i  1?-]
non [-Procuga  Nacura :  veftris-]{+Prodiga Natura: vestris+} illa vocum variarum [-concencibus ,-]{+concentibus,+} perque
[-insS*uns  veftras  aures,fefe  ipfam,qualis  exiftac  peniciffimo  iinu,  Menci  humana;, -]
[-Compom-  Dci  Crcacoris  nliaj  dilecliffima:  infufurravic. -]

[-doftmfii--]{+vestras aures, sese ipsam, qualis existat penitissimo sinu, Menti humanae,+}
{+Dei Creatoris filiae dilectissimae insusurravit.+}

Quas Harmonicas [-proporciones-]{+proportiones+} bini [-Planecae-]{+Planetae+} vicini [-Mocuum  fuo- -]
[-quamMo-  rumextremicacibus complecterencur , idexplicacum  fuic  fupra.-]{+Motuum suo-+}
{+rum extremitatibus complecterentur, id explicatum fuit supra.+} Ve-[-tetam  pco-]
rum [-COncingic  rariffime,  uc  ducpfcrcim  cardiffimi,  fimui-]{+contingit rarissime, ut duo praesertim tardissimi, simul+} in [-lua  incidac -]
[-gio  exiffamexcrema  incervalla.-  verbicaufa,  Sacurni&-]{+sua incidant+}
{+extrema intervalla: verbi causa, Saturni &+} Jovis [-apfidesdiftanccirci- -]
[-rextum  cer  gi  gradibus :  igicur  Licerea ,-]{+apsides distant circi-+}
{+ter [?] gradibus: igitur [?],+} dum haec illorum [-diftancia,  cercis-]{+distantia, certis+} vice-[-peSt«Re-]
norum annorum [-faicibus ycocum-]{+saltibus totum+} Zodiacum [-emeciacur ,-]{+emetiatur,+} anni [-labuncur -]
[-gius,ca;ce-  oclingenci;-]{+labuntur+}
{+octingenti;+} neque [-camen  falcus,quioclavumclaudicfaeculum,-]{+tamen saltus, qui octavum claudit saeculum,+} praeci-
[-riq;  Sacri  fefercur  adipfiliimas  apfidas;  &fipauld-]{+se fertur ad ipsissimas apsidas; & si paulo+} longius [-aberrec  ,•  expeclandi -]
[-diwre^po- fum-]{+aberret; expectandi+}
{+sunt+} alij [-octingenci  anni,uc  falcus-]{+octingenti anni, ut saltus+} illo felicior cum [-racione  quseri  poffic ; -]
[-tscunc.Ve--]{+ratione quaeri possit;+}
idque [-coties  icerandum,  quocies-]{+toties iterandum, quoties+} modulus [-aberracionis-]{+aberrationis+} in unius [-faicus -]
[-rumheus  dimidiaci prolixicace concinecur.-]{+saltus+}
{+dimidiati prolixitate continetur.+} Tales [-Periodosefficiunteciamcae- -]

[-vos>inc<se-  i  -         /-  i  •«  •  i-  t  •  i -]

[-lopiures  ceraz  bigaeltngulae ,  quanquamnonicaprohxas.  Incenm-]{+Periodos efficiunt etiam cae-+}
{+terae bigae singulae, quanquam non ita prolixas. Interim+} vero con-
[-quam  fex  cingunc  eciam-]{+tingunt etiam+} aliae Harmoniae binorum [-Planecarum ;  incer  mocus-]{+Planetarum; inter motus+} non
[-cocdan""  excremosucrofque, fedintermedium,  velunum-]{+extremos utrosque, sed intermedium,+} vel [-ucrumque :'eseq; -]
[-Nam  Lu--]{+unum vel utrumque: [?]+}
in [-diverfis  veluci  cenfionibus.-]{+diversis veluti tensionibus.+} Nam quia Saturnus ex G in [-§-]{+[?]+} & paulo
[-na  fcC^fim  ulcerius  cendicur ,  Jupicerexfun-]{+ulterius tenditur, Jupiter ex [?] in+} d[-&amphus:  poffunc  igicur  concin- -]
[-nodiatn  gereincerfc-] & [-^Harmonia;etiimiftajmpraDiapafon,Tertiautraq>r,& -]
[-cantiiiat ,  Diateffaron ;-]{+amplius: possunt igitur contin-+}
{+gere inter se & Harmoniae etiam istae praeter Diapason, Tertia utraque, &+}
{+Diatessaron;+} illarum [-qdem  alcerucrap  cenfionem ,  q-]{+quidem alterutra per tensionem, quae+} habet [-amphtudi- -]
[-cunis^ffi-  dmem-]{+amplitudi-+}
{+nem+} reliquae; [-hasc-]{+haec+} vero per [-amplicudinem-]{+amplitudinem+} Toni majoris. [-Diaceffa- -]
[-«knsCou--]{+Diatessa-+}
ron enim [-eric  noncancuma  GSaturniin  cc  Jovisfedeciamab^Sa- -]
[-fette  fym-  curniin;&/-]{+erit non tantum a G Saturni in c Jovis sed etiam a [?] Sa-+}
{+turni in [?]+} Jovis, [-&per  incermediaomniaincerG.  ^.illius&fc.  aWhu- -]
[-BUiberh-  )us-  Diapafon-]{+& per intermedia omnia inter G [?] illius & [?] hu-+}
{+jus. Diapason+} vero & [-Diapence  infolisapfidum-]{+Diapente in solis apsidum+} punctis [-concingic. -]
[-•t,  feipar--]{+contingit.+}
Mars vero majus [-naclus  incervallum  proprium ,-]{+nactus intervallum proprium,+} hoc [-obcinuic,  uc  eciam -]
[-tlbus,Cura*Diapafoncumfuperioribus,  peraliquam  cenfionis  amplicudinem-]{+obtinuit, ut etiam+}
{+Diapason cum superioribus, per aliquam tensionis amplitudinem+} fa-
[-feduium  ciaC--]{+ciat.+} Mercurius [-cancum obcinuicincervallum ;  ucpierumque-]{+tantum obtinuit intervallum; ut plerumque+} omnes[-poliiceor.-]
Harmonias cum [-bmnibus  conftituac,incra-]{+omnibus constituat, intra+} unam periodum [-fuam,  qua; -]
[-^Mufi--]{+suam, quae+}
non [-^oWxiot efl-]{+[?] est+} trium [-menfium  fpacio.  Telluse concra, Venufque -]
[-camccee  mulco  magisj/anguftia  propriorumincecvallorum,  reftringuntHar- -]
[-ftem,exPn"moniasfuas-]{+mensium spatio. Tellus e contra, Venusque+}
{+multo magis, angustia propriorum intervallorum, restringunt Har-+}
{+monias suas+} non [-cancum cum.casceris  ,  fedmaximeincerfemucuas,-]{+tantum cum caeteris, sed maxime inter se mutuas,+} ad
[-f  erc  defcri"paucicacem  fpe&abilem.-]{+paucitatem spectabilem.+} Quod [-fi  cres-]{+si tres+} in unam Harmoniam [-confpi- -]
[-ptamjhuic  raredebeanc:mulcaequidem  vicesfuncexfpectandae;  mulcae  cawen -]
[-tum/vr--]{+conspi-+}
{+rare debeant: multae quidem vices sunt exspectandae; multae tamen+}
Harmoniae [-func ;  ucicacancofacihuscontinganc  ,  dumvicinamfuam -]
[-enievene--]{+sunt; ut ita tanto facilius contingant, dum vicinam suam+}
proxima [-quarque  excipic :  yidencurquc  incer  Marcem ,-]{+quaeque excipit: videnturque inter Martem,+} Tellurem &
[-farnfPOn"  Mercurium ,  criplices  concingere  fspiufcule.  Quacuor-]{+Mercurium, triplices contingere saepiuscule. Quatuor+} vero [-pianeca- -]
[-ienJ°a~  rumHarmoniae,-]{+planeta-+}
{+rum Harmoniae,+} jam [-incipiunc  fpargi-]{+incipiunt spargi+} in [-faecula:-]{+saecula:+} quinque [-Plaheca. -]

[-rum'.-]{+Planeta-+}
{+rum+} in Myriadas annorum. [-Uc-]{+Ut+} vero [-fex-]{+sex+} omnes [-confenciancid  longifl. -]

[-fimisaeyifpacijsincerfepcum  ,  &nefcioan-]{+consentiant id longis-+}
{+simis aevi spacijs interseptum, & nescio an+} penitus [-impcffibilc  ficbis -]
[-•rinltri  concingere ,-]{+impossibile sit bis+}
{+contingere,+} per [-exaclam evolucionem;  pociufque-]{+exactam evolutionem; potiusque+} principium quod-
[-Mundi.    damTemporis  demonflrecaquoomnis  Mundiaecasdefluxeric. -]

[-Qnod  fi-]{+dam Temporis demonstret a quo omnis Mundi aetas defluxerit.+}

{+Quod si+} unica [-fola,  concingere  poffec  Harmoaia  fexcuplex ,  auc -]

[-incej -]


[-HarmonigisLiberV;      io£ -]


[-jnterplures-]{+sola, contingere posset Harmonia sexcuplex, aut+}
{+inter plures+} unica [-infignis ;  eaprdculdubio  prochara£tereCreationis-]{+insignis; ea procul dubio pro charactere Creationis+}
haberi [-poflet.-]{+posset.+} Quaerendum [-igitur ,-]{+igitur,+} an & quot omnino formis redigan-
tur omnium [-fex-]{+sex+} planetarum motus in unam communem [-harmomam?-]{+harmoniam?+}
Methodus [-inquifitionis  haee  eft,-]{+inquisitionis haec est,+} ut incipiamus a Terra & Venere; quia
[-hiduo  faciuntconfonantiasnonpluresduabus,&  (quodhujusreicau- -]
[-fam  continetj-]{+hi duo faciunt consonantias non plures duabus, & (quod hujus rei cau-+}
{+sam continet)+} per [-intenfiones-]{+intensiones+} motuum [-breviffimas.-]{+brevissimas.+}

Age [-igr  prfcfigamus  duoveluti  fceleta-]{+igitur praefigamus duo veluti sceleta+} Harmoniarum, [-fingnlabinis-]{+singula binis+}
numerorum [-(  quibus-]{+(quibus+} termini [-tenfionum  fignantur )  excremitacibus -]
[-concenca,  quidq-,-]{+tensionum signantur) extremitatibus+}
{+contenta, quidque+} ijs [-congruac-]{+congruat+} ex [-var  iecate  mocuum  cuiq;  Planeca?-]{+varietate motuum cuique Planetae+} con-
[-cefforum,  eonquiramus.  PrimumfceleconhabeacincerTerram&-]{+cessorum, conquiramus. Primum sceleton habeat inter Terram &+} Ve-
nerem 3,5. [-&>ingravifi]macenfiGnernocumdiurnum-]{+& in gravissima tensione motum diurnum+} Telluris apheli-
[-'\1mj7pr.\3Jec. inacucifllma,-]{+um [?] pr. 3 sec. in acutissima,+} Veneris [-pei ihelium-]{+perihelium+} 97 [-pr, 37/f e.  caeterier--]{+pr. 37 sec. caeteri er-+}
go [-ficerunc: -]


[-CAP.VI* -]


[-Harmom*  rianecarum  omiiium  feu  iiniver- -]

[-fales  Gtnens  Duri -]


[-1H  fy  oncordx -]


[-In  Tenfiond  Gravif- -]
[-firna. -]
[-Sc^rr.  fec -]
[-e  %ij.  <§■- — - — .    380.   io -]

[-...   ~~3E      ""    2.8,-,    15 -]
[-5  !??• -]


[-A  cutif- -]
[-fima. -]
[-Sc  Pr.Se. -]


[-g<5/ -]
[-cv/ -]


[-2JZ.    48. -]

[-190.  id   195.  tq.. -]


[-VenuseS- -]


[-■^ -]


[-9/.    S -]


[-n- -]


[-T«'g''?, §: -]


[-97-  17 -]
[-58.  ;*. -]

[-55.  jf. -]
[-19.  n- -]


[-l -]


[-IJt  c  conccrdzt -]

[-InTenfionc  Gravilfi-  j  Acuciifi-  ! -]
[-ma.      I      ma -]


[-e9^'. -]
[-c  ^ij. -]


[-Sc  pr.Scc'Sc.i'1'.  Ge. -]

[--$- 5  8o.   20.  j -]

[-V        "  "04.   H  i  ju.     11 -]

[--^i^c-  '°-jl>5-  J4- -]


[-Veaus  ev- -]


[-*~     95   •' -]


[-Ter.g^C_I$I    **■  3- -]


[-dtii  — — V-—   38.     1. -]


[-0* -]


[-*    tf -]


[-*k -]


[-2.      1*. -]

[-I.  47- -]


[-g»; -]


[--$■ -]


[-*•  34' -]


[-4^ -]


[-M: -]


[-.*7-  57- -]

[-5S.  34- -]

[-y.  3- -]

[-t*.  17. -]


[-5* -]


[-A—  4-    4-M     4-    «• -]


[-35- -]


[-|  |    $  G     — -$-     1.  47- -]


[-s.  *9 -]


[-»■■  — — ■ -c -]

[-Adhancuniverfalemconcurnt^aturnus -]
[-_ctuaphelio,Terraaphelio,Venusaphelio -]
[-fcre;inaltiffima  tenfione  concurric-]{+sic erunt:+}

{+Ad hanc universalem concurrunt Saturnus+}
{+[?] aphelio, Terra aphelio, Venus aphelio+}
{+fere; in altissima tensione concurrit+} Venus
[-perihelio;in-]{+perihelio; in+} media [-tenfione  concurritSa- -]
[-turnusperihelio,Jupiterapheiio,Mercurius -]

[-penhelio.  I  ta  Saturnus  diiobos  motibus-]{+tensione concurrit Sa-+}
{+turnus perihelio, Jupiter aphelio, Mercurius+}
{+perihelio. Ita Saturnus duobus motibus+} po-
[-KftcoacuirerejMarsduobus^MercurJus^.-]{+test concurrere, Mars duobus, Mercurius [?].+}

Hic [-csteris-]{+caeteris+} manentibus, Saturni perihelius
[-&Jovis  aphehus-]{+& Jovis aphelius+} non [-feiuntur;-]{+feruntur;+} ac eorum lo-
[-coconcamtMarspenheliomotu.-]{+co [?] Mars perihelio motu.+}

Caeteri [-fingulismotibusconcurrunt;fo»-]{+singulis motibus concurrunt; so-+}
lus Mars [-due-feus ,  Mercutius  ciuatuoc -]


[-Dd -]


[-§ecun- -]


[-De  Motibus  Planeta  r  um -]

[-fecundiim  igi"  fcelecon  eric,-]{+duobus, Mercurius quatuor+}

{+Secundum igitur sceleton erit,+} in quo [-incerTerrarti-]{+inter Terram+} & [-?  cft  alcera  poffibiHs -]
[-Harrnonia  5. 8-  Ubide?  apheliomocudiurno94£r.  ^o/ec.  parso&ava -]
[-|i-]{+[?] est altera possibilis+}
{+Harmonia 5.8. Ubi de [?] aphelio motu diurno 94 pr. [?] sec. pars octava+}
{+11+} pr. [-5  \fee  -.  fumpca  quinquies ,  occupac-]{+51 sec. sumpta quinquies, occupat+} de [-mocu-]{+motu+} Telluris [-5-9^.  1 6  fec.  5c -]
[-deperihclio$  97/>r.  J7/&.  parsconfimilis,  occupacde-]{+59 pr. 16 sec. &+}
{+de perihelio [?] 97 pr. 37 sec. pars consimilis, occupat de+} motu Telluris
[-^ifiy.iy^c-CxceriigrPlanecajconcordanciequencibusmocibusdiurnis.. -]

[-I-    j . i ,-       .    --,-,- : -^ i* : __ « -]
[-HarmonidcPIanecarumomnium  leu  umver- -]
[-fales  Generis  MdHis. -]


[-IJt  f)  concordet. -]


[-*g% ■- -]

[-df9/ -]


[-InTenfione  Gravif- -]

[-fima. -]
[-I      .  Sc.  Pr.Sec -]

[-t_I~  379-™ -]
[-___$_-  »84-3i -]

[-i  §  *i7.  + -]

[-_3JE  %g9-  40 -]


[-E -]


[-:_fcA~ -]


[-Ven»  df  %_^.^..„  s -]
[-_~Z_ -]


[-Tei.  g  #'/'/) -]


[-j__$:i- -]


[-£: -]


[-*S>-3« -]


[-JUP-W  \      $ -]


[-% -]


[-y.T — - -]


[-Acurii- -]

[-firaa. -]

[-Sc  I.    Sec -]

[-tj>t.s6 -]

[-Z'4#;   4 -]
[-I9/.I4 -]

[-61.  x -]
[-jo.  JI  J -]


[-1-.  c  cwcorda. -]

[-•^       1 -]


[-4-   51 -]


[-InTenfioneGravif. -]
[-■  Sc.  Pr  Sec -]

[-g  cy        $  j  y7-  4 -]

[-$d>  S»  | k$-  ig_  .40 -]


[-i_  •  1« -]


[-Marsg/t/  A    .    *$ -]


[-J* -]


[-_ -]


[-*I -]


[-Acutif- -]

[-lima. -]

[-Sc.pc.Scc -]

[-'44-  4 -]
[-19.  14 -]
[-Itfi.  4} -]

[-97>17 -]


[-JO.  i» -]


[-Jap.cj    ~5«fc-~-  4J<S -]


[-=  . -]


[-3= -]


[-fcurfum  hic  ln  tenfipnemediaconcurrunt  Sa- -]
[-turnusmotuperihelio,Jiipiter  aphelio,  Mer- -]
[-eurius  perihelio.  Jn  renfionc  altllTiisa  fcre -]
[-eoncurrit  perihelius  Telluiis  nsotus. -]


[-r.  sj   I  j  Satcrn.  G A~    i . -]


[-*•  f -]


[-*S* -]


[-Ethiccjctritisapheliojovi*  ,  &perihelioSa- -]
[-turni,  adrmtcitui Mersunj  aphclius  proxim* -]
[-prsetcrpcriaelium.  Cseterao.  aent. -]


[-Teftacur  igr  experiencia  Aftronomica,  poite  cohcihgere  univerla» -]

[-ksomniiimmocuumHarmonias.eafque-]{+[?] [?]. Caeteri igitur Planetae concordant sequentibus motibus diurnis.+}


{+Testatur  igitur  experientia  Astronomica,  posse  contingere  universa-+}
{+les omnium motuum Harmonias, easque+}  duorum  [-generum  ,  Durifc -]

[-Mollis  j  &inucroquegenere,forma:feu(fiicalicec)  Toniduplici9i-]{+generum,  Duri+} &
[-inunoquolibecquacuorcafuum,-]{+Mollis;  & in utroque genere, formae seu (si ita licet)  Toni duplicis;  &+}
{+in unoquolibet quatuor casuum,+}  cum  aliqua  [-cenfionis lacicudine,-]{+tensionis latitudine,+}  &
cum  aliqua  [-eciam  variecace  parciculariumHarmoniarum  Sacurni,Mar°-]{+etiam  varietate  particularium Harmoniarum  Saturni, Mar-+}
tis  &  [-Mcrcurij,  eujuique-]{+Mercurij,  cujusque+}  cum  [-cseccris:  ncc-]{+caeteris:  nec+}  id  [-prseftari  folis  mocibus  in» -]

[-termedijs ,  (cd-]{+praestari  solis  motibus  in-+}
{+termedijs,  sed+}  omnino  [-excremis-]{+extremis+}  omnibus,  [-praecerquam  aphclio-]{+praeterquam  aphelio+}  Mar-
[-tis ,-]{+tis,+}  &  perihelio  [-Jovis,--]{+Jovis;+}  quia  [-ciim-]{+cum+}  ille  [-obcineac/e,-]{+obtineat e,+}  hic  d,  Venus  [-obcincns -]

[-incermcdium  dq-]{+obtinens+}
{+intermedium  d+}  vel  e  [-pcrpecuo ,-]{+perpetuo,+}  non  [-ferc-]{+fert+}  illos  [-fiios-]{+suos+}  vicinos  [-diflbnos  iit-]{+dissonos  in+}
harmonia  [-univerfali ,-]{+universali,+}  quod  [-facerec ,  fina&afuiflecfpacium  cxcedendi -]

[-cx-]{+faceret,  si nacta fuisset spacium  excedendi+}
{+ex+}  e  [-vcl  d?.-]{+vel  d.+}    Hoc  [-impedimenci  habec-]{+impedimenti  habet+}  conjugium  hoc  [-Tclluris-]{+Telluris+}  &  [-Vc--]{+Ve-+}
neris,  [-ccu  maris&  fceminx,  quiduo  planeca  gencra-]{+ceu  maris & foeminae,  qui duo  planetae  genera+}  Harmonia-
[-«"urn  diftinguut,-]{+rum  distinguunt,+}  in  duras  [-fciiicec-]{+scilicet+}  &  [-m«fcula8,mollesque-]{+masculas, mollesque+}  &  [-famihinas : -]

[-proui -]


[-Harmonicis  Liber  VJ      atn -]


[-jsroiitalterconjugum-]{+foemininas:+}
{+prout alter conjugum+}  alteri  [-fueritgratificacuSjTerrafciliccitvclinA- -]
[-p  hel  io  fiio  fiierie,  canquam  digriicacem  cuerls  m  ar  i  tal  em ,-]{+fuerit gratificatus, Terra scilicet vel in A-+}
{+phelio  suo  fuerit,  tanquam  dignitatem  tuens  maritalem,+}  &  [-oga-]{+opera+}  urgens
viro  [-digna,Venere-]{+digna, Venere+}  in  [-periheliumfuumvelucadcolumferiiota&de- -]
[-trusa.vel-]{+perihelium suum veluti ad colum semota & de-+}
{+trusa. vel+}  eam  in  [-ApheliUm  afcendenccm-]{+Aphelium  ascendentem+}  blande  [-admiferic;  ipfave-]{+admiserit;  ipsave+}  Tel-
[-ius,  fuuminPeriheliumverrus?jinqueejus  velucicomplcxus  defcen--]{+lus,  suum in Perihelium versus ♀, inque ejus  veluti complexus  descen-+}
derit,  [-voluptaciscausa,  poficisclypeopaUlHper&armiSidperibusqu©-]{+voluptatis causa,  positis clypeo paulisper & armis, operibusque+}
viro  [-conveniencibus.-cunceriirri  Harmoniamollis  eft.-]{+convenientibus: tunc enim  Harmonia mollis  est.+}

Quod  [-fi-]{+si+}  hanc  [-oblocucricem  ?  filerc  jiibeamus,  hoceft ,  fi-]{+oblocutricem  ♀  silere  jubeamus,  hoc est,  si+}  confide-
raverimus,  [-quscnam  efle poftinc  Harmoriue , nori  orhnium,  fed  quinqi -]
[-fakem-]{+quaenam  esse possint  Harmoniae, non  omnium,  sed  quinque+}
{+saltem+}  reliquorum  [-Plarietarum,exclufomotu?j  adhucquidem  TeL -]


[-CAf.TO -]


[-Harmoniae  Pianetarum  quinque,  diffiraulaca -]

[-Veriere -]


[-Generii  Duri -]


[-la  Teniiosie  Gravif-        Acutif- -]
[-fimfl.  fima. -]

[-Sc.pr.iee.  Sc.Pr.8e. -]

[-d  9y.        •*£ — "  5*2-   iBjjjH  24. -]

[-a*f        __3E*Z~    *8*    V I292'  48, -]

[-&        _*Z  i2%- fl -]


[-Verius  hic— — ; -]

[-ob-    e*  -—4- -]
[-ftrepit         . .     _ -]


[-Ter.gwf; -]


[-7-     t -]


[-97'   37 -]

[-5&   J*. -]
[-5<f.  }<r. -]


[-Gene¥ti  Mollu -]


[-JnTcnfione  Gmiffl- -]

[-rna. -]

[-Sc.pr.8ec -]

[-■541.   18. -]

[-[17J.  ro -]

[-l?inusobr — —        , -]

[-ikepit.ct- +— -]


[-2t -]


[-31. -]


[-f.   jb. -]
[-4-  ** -]


[-G. -]


[-* -]


[--3L^. -]


[-2.    ip -]
[-i.  47. -]


[-a* -]


[-b«y  0- — ^ -]


[-Acutiffi- -]

[-ma. -]
[-Sc.Pr.  Se. -]

[-?/«■   14 -]
[-i$o.   /7. -]

[-*j*.  /6- -]

[-JH175.  4*- -]
[-^7;    37- -]

[-58.    J4- -]


[-3J.      8. -]
[-*^;   i7. -]


[-1 -]

[-li -]


[-ij. -]


[-%\ -]


[-% -]


[-♦• -]


[-f.  11 -]


[-x.     8. -]
[-i.  47- -]


[-*    jo. -]


[-11. -]

[-ro. -]


[-Hic  in  graviffima  tenfione  concurrunt -]
[-Saturnut ,  Terra.aphelijsjinmediaSa- -]
[-«urnus  perihclio.Jupiter  aphelio;  in  acu- -]
[-tjffiriw,  Jupiter  periheli»; -]


[-II -]


[-Hicnontoleratur  aphcliu»  Jovis,  at -]
[-in  acutiffima  tenfione  concurrit  Satwffc -]
[-nus  periheliopioximc.-]{+Planetarum, excluso motu ♀; adhuc quidem  Tel-+}
lus  [-oberrac-]{+oberrat+}  chorda  [-fua^,  rjfcg  afcendit-]{+suâ,  [?]  ascendit+}  ab  [-eaultrafemitohiutn :  poiTunt -]
[-jgitur  cum^  corifpirare  b,b,csd}  dp-]{+ea ultra semitonium:  possunt+}
{+igitur  cum  [?]  conspirare  b, b, c, d,  [?]+}  e:  ubi  [-Jupicer ,-]{+Jupiter,+}  ut  vides,  chordam  d
[-fignarismocuperihelio,admitcitur,-  fupCreft  igicurde  Marcisaphelio -]
[-difrlculcas.  N?,m-]{+signans motu perihelio, admittitur;  superest  igitur de  Martis aphelio+}
{+difficultas.  Nam+}  Telluris  [-apbeIins,obcinens  j?,nonferc  iliuminy^.-]{+aphelius, obtinens  g, non fert  illum  [?]+}
perihelius  [-vero ,  uc  fupra  didlum-]{+vero,  ut  supra  dictum+}  Cap.  [-V.ab-]{+V. ab+}  aphelij  Martij  [-eonfenfu  ab* -]
[-fhorrec  circicer-]{+consensu  ab-+}
{+horret  circiter+}  dimidia  [-Diefi. -]


[-t>d -]


[-Quatuoi' -]


[-Ojg        De  MoTIBUS  PLANETAR  UM -]

[-«•;■.-■  '  - -]

[-cap.  vir  QuatuorveroPIanetarurn.,  SaturnijJovis,MartiSiMercurij,poi -]

[-teft-]{+Diesi.+}

{+Quatuor vero Planetarum,  Saturni, Jovis, Martis, Mercurij, po-+}
{+test+}  &  haec  [-eiTe  Harm®nia  >  m-]{+esse  Harmonia,  in+}  qua  [-fic  eciam-]{+sit  etiam+}  aphelius  [-Marcis,  fed  eft  fine -]
[-fionislatitudirieV -]


[-IJt  l)  comord.es -]

[-*_^  #  cuncordet.  y , -]

[-Sc.Pr.Sec, -]

[-kj    _.  ,.,,,      .  ,. -]

[-"/■  $        "'          3"  •    >°' -]
[-9  *?•  -Z§             ^*-  •y'f- -]

[-8.,. -]

[-*  fe  ..  -&A- —  ■J°^  <3 -]
[-d9j     ____.$.    i67.  fS- -]

[-$  #  ~  *~ -]

[-*        ff  _.    _sg_A.__, -]

[-d%    .____.$. -]

[-__ ;    ' -]

[-k">-  zz$t$z  *«  *. -]

[-■ -]

[-.: -]

[-o*                   V -]

[-**  :_pz;' -]

[-'    .".                     .r-i -]

[-^dj.    — $ —      f.  m -]

[-2f  d>    zz$zz -]

[-\  &  /        4-  ■    "     ,.  _; -]

[-.     -    •  '  t -]

[-• -]

[-%    a  ___£__ -]

[-Nihilig.turaliitdfunsmotus  ccelorum.-]{+Martis,  sed  est  sine+}
{+tensionis latitudine.+}

{+Nihil igitur aliud sunt motus  coelorum,+}  quam  [-perenriis  quidara -]
[-conccntus(rati9naIi3  noh  vocalis  )  pcrdiirona_testenfiones>eluti -]
[-quaidarnSyncopationesyielCadentias(quibushominesimitanturiftas -]
[-d    onantiasnaturales;-]{+perennis  quidam+}
{+concentus (rationalis  non  vocalis)  per dissonantes tensiones, veluti+}
{+quasdam Syncopationes vel Cadentias (quibus homines imitantur istas+}
{+dissonantias naturales)+}  tendens  [-incertas&pra.fcriptasclaufulas,  _n- -]

[-t!       'T0rU!  (vcIuci  Voctim  )  ^q»6-]{+in certas & praescriptas clausulas,  [?]+}
{+[?]  [?]  (veluti  Vocum)  [?]+}  Notis  [-immehfitatem -]

[-Tempo  ismfignienS&diftingue„S;utmirum-]{+immensitatem+}
{+Temporis insigniens & distinguens; ut mirum+}  amplius  non  [-fit ,-]{+sit,+}  tan-
dem  inventam [-efle-]{+esse+} ab  [-Homine .-]{+Homine,+}  Creatoris  [-fui Simi! ,rationem-]{+sui [?], rationem+}  canen-
[-oi-]{+di+}  per  [-.concentum  ,  ignocam  veteribus  .  uc  fcilicer-]{+concentum,  ignotam  veteribus,  ut  scilicet+}  totius  Temporis
[-mundaniperpecuicacem-]{+mundani perpetuitatem+}  in  [-brevialiquaHorsparce.  perarcificiofara-]{+brevi aliqua Horae parte,  per artificiosam+}
plurium  [-vocumfymphoniamluderet,     DeiqueOpificiscompIa- -]

[-eentiam-]{+vocum symphoniam luderet,     Deique Opificis compla-+}
{+centiam+}  in  [-openbus  fuis _  fuaviffimo  feafu-]{+operibus  suis,  suavissimo  sensu+}  voluptatis,  ex
hac  Dei  [-lmicacrice  Mufica  percepca?,  quadariis -]

[-cenusdeguftare^ -]


[-" -]


[-■  . -]


[-E -]


[-Ha&MONICIsLiB.  V.  215 -]

[-CAP VT-]{+imitatrice  Musica  perceptae,  quadan-+}
{+tenus degustaret.+}


{+## Caput+} VIII. [-Quisinconcordantijs  coeieftibti^ -]

[-Difcanci ,-]{+Quis in concordantijs coelestibus Discanti,+} quis [-Alci ,-]{+Alti,+} quis [-Tenoris ,-]{+Tenoris,+} quis [-Baflivicemobeac? -]

[-cfih^cfiincvocabulavocumhumariarum  s  neciri -]

[-ccdo-]{+Bassi vicem obeat?+}

{+[?] [?] in vocabula vocum humanarum; nec in+}
{+coelo+} voces [-auc  foni  cxiftunc,-]{+aut soni existunt,+} ob [-fummam  mocuum  cranquillica- -]
[-tem";  acne  fubjeda  quidem  ,-]{+summam motuum tranquillita-+}
{+tem; ac ne subjecta quidem,+} in quibus Harmonias [-deprehendimus , -]
[-iub  mocus  vengenere  comprehenduntur  ;-]{+deprehendimus,+}
{+sub motus veri genere comprehenduntur;+} quippe cum [-folum-]{+solum+} appa-
[-rentesexSolemocusconfideremusietfidcnique  caufanullatahseftin -]
[-coelo }  quse-]{+rentes ex Sole motus consideremus; et si denique causa nulla talis est in+}
{+coelo, quae+} voces [-cerco-]{+certo+} numero [-advocec-]{+advocet+} ad faciendam Harmoniam,
qualis [-eft-]{+est+} in [-cancu  humano;prius-]{+cantu humano; prius+} quippe [-erac  nunierus  Planecarum  fex, -]
[-Solemcircurneuncium,  exnumero  quinqueincervallorum,  afiguris -]
[-Regularibiis  defumpcorum ;  poftea-]{+erat numerus Planetarum sex,+}
{+Solem circumeuntium, ex numero quinque intervallorum, a figuris+}
{+Regularibus desumptorum; postea+} demum (ordine Naturae non tem-
[-pons)  democuumcongruenciaitacuendum  fuic  •  nefcio  camen-]{+poris) de motuum congruentia statuendum fuit: nescio tamen+} quo
pacto [-m  i  hi-]{+mihi+} vim faciat [-h«£c-]{+haec+} admirabilis congruentia [-cufn-]{+cum+} humano [-can  ttii-]{+cantu,+}
ut [-hartc-]{+hanc+} quoque [-parcem  comparacionis ,  eciam  iine  fohda  caufanacura- -]
[-li ,  pf ofequi-]{+partem comparationis, etiam sine solida causa natura-+}
{+li, prosequi+} cogar. Quas [-eilirn-]{+enim+} libro [-cercio ,  Capice  X VI.  proprietatcs -]
[-Baflb-]{+tertio, Capite XVI. proprietates+}
{+Basso+} tribuit [-ufus ,  vindicacque  natura :  eafdem-]{+usus, vindicatque natura: easdem+} quodammodo [-Satiir--]{+Satur-+}
nus & Jupiter [-obcinenc-]{+obtinent+} in [-ccelo  •;-]{+coelo;+} quas [-Tenori  >-]{+Tenori,+} nos in [-Marce-]{+Marte+} inveni-
[-mus;quas  Alto,eaeinfuncin-]{+mus; quas Alto, eae insunt in+} Tellure & [-Venere  ■;  quasDifcanto  ,  eaf--]{+Venere; quas Discanto, eas-+}
dem habet [-Mercurius,finon  aequalicace  intervallorum,atcercepro- -]
[-porcione.  Uccunque-]{+Mercurius, si non aequalitate intervallorum, at certe pro-+}
{+portione. Utcunque+} enim proprijs ex [-caufis-]{+causis+} capite [-fequenci-]{+sequenti+} deducan-
tur [-cujufque  Planeca? Eccencricicaces,&:-]{+cujusque Planetae Eccentricitates, &+} per eas, [-prppria cujufque-]{+propria cujusque+} mo-
tuum [-incervalla:  lllud-]{+intervalla: illud+} tamen inde [-refulcat-]{+resultat+} admirabile, [-necfcio-]{+nescio+} an non
[-juxcaprocuracum,-]{+juxta procuratum,+} nec mere [-neceflitatum  temperamentumi-]{+necessitatum temperamentum:+} quod
I. ut Alto [-Bafliis  opponitu r;  fic-]{+Bassus opponitur; sic+} duo [-Planecae  funt ,-]{+Planetae sunt,+} qui Alti naturam ha-
bent, [-dubquiBafii,  velutinquohbetGenerecantus  ucrinqueunus: -]
[-czecerarum  fingularum-]{+duo qui Bassi, velut in quolibet Genere cantus utrinque unus:+}
{+caeterarum singularum+} Vocum [-finguli;  quddque  IL  uc  Altuspene  fu- -]
[-prcmus,-]{+singuli; quodque II. ut Altus pene su-+}
{+premus,+} in [-anguftijseft,  neceflarijs-]{+angustijs est, necessarijs+} & [-nacuralibus  decaufis,lib.III.-]{+naturalibus de causis, lib. III.+} ex-
[-plicacis:  ficpene  intimiPlanetaj,Terra&:  Venus,anguftiflimamotuurn -]
[-habenc-]{+plicatis: sic pene intimi Planetae, Terra & Venus, angustissima motuum+}
{+habent+} intervalla, [-Tellusnonmultdplusfemitonio,  VenusneDielin-]{+Tellus non multo plus semitonio, Venus ne Diesin+}
quidem; [-Ill.ctut-]{+III. et ut+} Tenor liber [-eft,  modefte-]{+est, modeste+} tamen incedit; [-fic-]{+sic+} Mars, uno
[-Mercurioexcepto  ,  maximumintervallum/icilicetDiapente  ,  facerc -]
[-poceft.TV.  ctutBafliis-]{+Mercurio excepto, maximum intervallum scilicet Diapente, facere+}
{+potest. IV. et ut Bassus+} Harmonicos [-falcusfacic;  ficSacurnus-]{+saltus facit; sic Saturnus+} & [-Jupicer -]
[-intervallaobtinent-]{+Jupiter+}
{+intervalla obtinent+} Harmonica, [-ipfiqueinterfeaDiapafon  ufque-]{+ipsique inter se a Diapason usque+} ad
Diapente epi [-Diapafbn  veniunc:  V.&  uc  Difcancus-]{+Diapason veniunt: V. & ut Discantus+} liberrimus [-eft ,  pius-]{+est, plus+}
quam [-omnesreliqui ,-]{+omnes reliqui,+} idemque [-&celerrimus ;  fic  eciam-]{+& celerrimus; sic etiam+} Mercurius
[-plufquamDiapafon,  breviflirno  redicu-]{+plusquam Diapason, brevissimo reditu+} perambulare po-
[-teft.  Sedfichocfaneperaccidens:audiamus-]{+test. Sed sit hoc sane per accidens: audiamus+}
nunc [-Eccencricicatum  caufas» -]
[-GAPVT-]{+Eccentricitatum causas.+}

{+## Caput+} X. [-EpilogusdeSole,  coniecturalis.-]{+Epilogus de Sole, coniecturalis+}

A [-Mufica  cadefti-]{+Musica coelesti+} ad [-auditorem  ,-]{+auditorem,+} a [-Mufis-]{+Musis+} ad Chora-
[-gura  Apollinem  ,;a  Planetisfex-]{+gum Apollinem, a Planetis sex+} circumeuntibus, [-Harmoniafque -]
[-facientibus,adSolem-]{+Harmoniasque+}
{+facientibus, ad Solem+} in curriculorum omnium [-centro  ,-]{+centro,+} immobilem
loco, in [-feipfum  camen fe  revolvencem.-]{+seipsum tamen se revolventem.+} Cum [-eiiim 3bfohlriffima  fit -]
[-incer  excremos  Planecarum  mocus  Harmonice ,-]{+enim absolutissima sit+}
{+inter extremos Planetarum motus Harmonice,+} non quoad veras [-celc--]{+cele-+}
ritates per auram [-aetheriam."  fed-]{+aetheriam, sed+} quoad angulos, quos [-formarit-]{+formant+} termini
diurnorum arcuum de [-orbicisplanetarum ,-]{+orbitis planetarum,+} connexi cum [-eentro  Soiis; -]
[-Harmoniaveronondecoreccerminosj  ideft  ,  motusperfefingulos ; -]
[-fed  quacenus  incer  fe  jundi-]{+centro Solis;+}
{+Harmonia vero non decoret terminos, id est, motus per se singulos;+}
{+sed quatenus inter se juncti+} & [-comparacijfiutK  objeftum-]{+comparati fiunt objectum+} alicujus Men-
[-cis:&-]{+tis: &+} cum nullum [-objedtum  fruftra  fn  ordinatum,non  exiftente  aiiqua.-]{+objectum frustra sit ordinatum, non existente aliqua+}
re, [-qua?  ijlo  moveattir ;-]{+quae illo moveatur;+} anguli vero [-ifti  praefupponere-]{+isti praesupponere+} videantur actio-
nem aliquam, [-limilem  vifus  noftri,  auccerte  fehfionis  iilius,-]{+similem visus nostri, aut certe sensionis illius,+} qua [-libr.I  V* -]
[-Nacurafublunaris  percipiebac-]{+libr. IV.+}
{+Natura sublunaris percipiebat+} angulos radiorum ex [-Planetis ,-]{+Planetis,+} in [-rerra -]
[-formacos :-]{+terra+}
{+formatos:+} equidem qualis in Sole [-vifus ,-]{+visus,+} qui Oculi [-finc ,  auc-]{+sint, aut+} quis [-inftin- -]
[-£tus  alius ,-]{+instin-+}
{+ctus alius,+} percipiendi [-hosangulos,etiamfineoculis ,  aeftimandique -]
[-Harmoniasmocuum,admencis  veftibulum-]{+hos angulos, etiam sine oculis, aestimandique+}
{+Harmonias motuum, ad mentis vestibulum+} quacunque porta ingre-
[-diencium ,  qua;denique-]{+dientium, quae denique+} Mens [-iftain  Sole ;-]{+ista in Sole;+} conjicere [-nonfacile  eft,cer--]{+non facile est, ter-+}
ram [-incolencibus.-]{+incolentibus.+} Utcunque [-camen  fe  habeanc  ifta,  cerce  circumpO- -]
[-ficio-]{+tamen se habeant ista, certe circumpo-+}
{+sitio+} illa [-fex-]{+sex+} orbium [-primarior  um-]{+primariorum+} circa [-Solem,colentium-]{+Solem, colentium+} illum perpe-
[-tuiscircumvolucionibus,  Scveluciadoranciumfficucfeorfim  jovisglo* -]
[-bumquacuor,Sacurnumduo>Tellurem  vero&nosejus  ihcolas-]{+tuis circumvolutionibus, & veluti adorantium (sicut seorsim Jovis glo-+}
{+bum quatuor, Saturnum duo, Tellurem vero & nos ejus incolas+} uni-
ca Luna [-curfu  cingic  ,  colic ,  fovec ,  nobifque  famulacur )  ,-]{+cursu cingit, colit, fovet, nobisque famulatur),+} & illi
[-confideracioni-]{+considerationi+} jam accedens [-fpeciale-]{+speciale+} hoc [-negocium  Harmonicumi -]
[-^eftigium  evidenciffimum  fummac  providenciae-]{+negotium Harmonicum,+}
{+vestigium evidentissimum summae providentiae+} rerum Solarium,
hanc a me [-confeffionem  excorquenc :-]{+confessionem extorquent:+} Non [-cancum-]{+tantum+} exire in [-cotum  Mu--]{+totum Mun-+}
dum ex Sole, [-ucafoco-]{+ut a foco+} vel oculo Mundi, Lucem; [-ucex  corde ,  vicam-]{+ut ex corde, vitam+} &
[-calorem ,  uc-]{+calorem, ut+} a rege & [-mocore ,  mocum  omnem :  fed  vicifllm  eciam-]{+motore, motum omnem: sed vicissim etiam+} in
Solem colligi ex omni Mundana [-provincia ,-]{+provincia,+} jure [-regio ,-]{+regio,+} hos [-veluci-]{+veluti+} red-
ditus [-Harmonia?  defiderabiliffima? ,-]{+Harmoniae desiderabilissimae,+} imo [-confluences-]{+confluentes+} eo [-fpecies  mocu--]{+species motu-+}
um binorum, [-mencis-]{+mentis+} alicujus opera in unam Harmoniam [-colligari ,-]{+colligari,+} &
[-veluc  cx-]{+velut ex+} rudi [-argenco-]{+argento+} atque auro [-Monecam  fignari  :-]{+Monetam signari:+} denique in Sole
[-CURlAM,Palacium,&PraecoriumfeuRcgiameffecociusregniNacu- -]
[-rae  >  quofcunque  dederic-]{+CURIAM, Palatium, & Praetorium seu Regiam esse totius regni Natu-+}
{+rae, quoscunque dederit+} illi [-Creacor  Cancellarios ,  Palacinos  ,  Praefe* -]
[-&os;  quibufcunque  paraveric  iftas  fedes,feu  creacis  ftacim-]{+Creator Cancellarios, Palatinos, Praefe-+}
{+ctos; quibuscunque paraverit istas sedes, seu creatis statim+} ab [-inicio,feii-]{+initio, seu+}
olim huc [-cransferendis.-]{+transferendis.+} Nam & [-cerreftris  ifte-]{+terrestris iste+} ornatus [-pociflima  fui-]{+potissima sui+}
parte, diu admodum [-fpeculacoribus-]{+speculatoribus+} & [-ufurpatoribus,-]{+usurpatoribus,+} quibus [-camen  e « -]
[-racdeftinacus,carebac,  fedefque  vacua?eranc,  Subicigicuranimum -]
[-cogicacio  ,-]{+tamen e-+}
{+rat destinatus, carebat, sedesque vacuae erant. Subit igitur animum+}
{+cogitatio,+} quid [-fibi  vofuerirtc  anciqui  Fythagoraei-]{+sibi voluerint antiqui Pythagoraei+} apud [-Ariftocelem  , -]
[-quicencrumMundi(quorfumIgnemreferebanc,-]{+Aristotelem,+}
{+qui centrum Mundi (quorsum Ignem referebant,+} Solem vero [-fubin- -]
[-tcHigebant)  folici  func-]{+subin-+}
{+telligebant) soliti sunt+} appellare Jovis [-E  X  C  U  B I A  S,  AIOZ  <J>T- -]
[-A  AKH  N  ,■-]{+EXCUBIAS, [?]+}
{+[?],+} quid [-icem-]{+item+} vetus [-incerpres  agicaverit-]{+interpres agitaverit+} animo, cum [-verficu- -]

[-lumcx -]


[-HarmonicisLib.  V.        245 -]

[-lumexPfalmoficredderec,IN-]{+versicu-+}
{+lum ex Psalmo sic redderet, IN+} SOLE POSUIT TABERNACU-
[-CAp.  x -]
[-L  U  M.-]{+LUM.+} Sed & in Hymnum Procli [-philofophi  Placonici-]{+philosophi Platonici+} nuper [-incidi , -]
[-fcripcum  m-]{+incidi,+}
{+scriptum in+} Solem, [-refercumque-]{+refertumque+} venerandis [-myftenjs,  fi-]{+mysterijs, si+} ei unum [-lllud  &«£&&, -]
[-K/w.  eripias :-]{+illud [?],+}
{+[?] eripias:+} quamvis hoc [-ipfum-]{+ipsum+} in eo [-quadamcenus  excufavenC-]{+quadamtenus excusaverit+} ve-
[-b*s  |lbris -]
[-cus  mcerpres ,-]{+tus interpres,+} jam [-cicacus :  uc-]{+citatus: ut+} ille [-fcilicec-]{+scilicet+} Solem [-invocans ,-]{+invocans,+} illum [-fubin-  mehtio. -]
[-celhgac.quipofuicinSolecabernaculumfuum.       Vixicenim-]{+subin-+}
{+telligat, qui posuit in Sole tabernaculum suum. Vixit enim+} Proclus[-sub  Coti--]
quo [-cenapore ,  Jefum-]{+tempore, Jesum+} Nazarenum [-fervacorem rioftrum,-]{+servatorem nostrum,+} Deum profi-
[-flamino, -]
[-ceri , deofque gencilium  poecarum  concemnere, fcelus erac ,-]{+teri, deosque gentilium poetarum contemnere, scelus erat,+} quod om-
[-& 5™j? "* -]
[-hibus  fupplicijs  vindicabanc  Mortarchs-]{+nibus supplicijs vindicabant Monarchae+} orbis, [-populufque-]{+populusque+} adeo [-ipfe;  Apoftata. -]
[-Proclusigicur,quifiliumdeivelexphiIofophiafuaPiaconica,  nacura-  v     .  ,-]{+ipse;+}
{+Proclus igitur, qui filium dei vel ex philosophia sua Platonica, natura-+}
li [-mencis-]{+mentis+} lumine [-confpexerac-]{+conspexerat+} eminus, lucem illam [-veram ,-]{+veram,+} quae [-lllumi-  ejUS libio -]
[-nac-]{+illumi-+}
{+nat+} omnem [-hominem , veniencem  iri-]{+hominem, venientem in+} hunc [-mundum :-]{+mundum:+} qui [-divinicacerr.  jyTjj^^ -]
[-ih-]{+divinitatem+}
{+in+} rebus [-fenfilibiis-]{+sensilibus+} cum [-fuperfticiosa-]{+superstitiosa+} plebe nequaquam quaerendam [-cQ     ,-_ -]
[-fe-]{+es-+}
{+se+} jam [-fciebac  :  Deurn  cameil-]{+sciebat: Deum tamen+} in [-Sole  ,-]{+Sole,+} quam in [-Chrifto-]{+Christo+} homine [-fenfi  h°^ ,u  '' -]
[-quxrere ,-]{+[?]+}
{+quaerere,+} videri [-maluic ;  lic  fimul-]{+maluit; sic simul+} & gentes [-fallerec,  Tkanem  poecarum  r,umin  °t -]
[-verbocdnus  hoflorans  ,•  fimuljfuje  pbilofophiaj opCraretur ,  abftracturus  no  fi'nc  di- -]
[-6igences&Chriftianosafenfihbus  ,  illosaSolevifibili,  iftosaMaria.  vinorapta -]
[-fiho.quiaMyfieriumincarnacioriisrefpu._bat,  nacuraUMericislumini  ^Tdcau-]{+falleret, Titanem poetarum+}
{+verbotenus honorans, simul suae philosophiae operaretur, abstracturus+}
{+gentes & Christianos a sensilibus, illos a Sole visibili, istos a Maria+}
{+filio, quia Mysterium incarnationis respuebat, naturali Mentis lumini+}
nimium [-eonfifus :  fimuldenique  ,  quodhabebamCh.iftiamd.v.nifli-  nam  uni--]{+confisus: simul denique, quod habebant Christiani divinissi-+}
mum, [-&:  Placonicae  Philofophia.maxime  confencaneum    ,   ipfeabijs  yfrS™j°f -]
[-cranfumpcurii,iriillamfuamphilofophiamadopcareCt      Icaquedacnr  chrymis -]
[-dofh-inae-]{+& Platonicae Philosophiae maxime consentaneum, ipse ab ijs+}
{+transumptum, in illam suam philosophiam adoptaret. Itaque datur+}
{+doctrinae+} Evangelij de [-Chrifto , concra-]{+Christo, contra+} hunc Procli [-Hymnum , adio-]{+Hymnum, actio+} in[-ae0 ^--]
rem [-fuam :  habeac  fibi Tican iile-]{+suam: habeat sibi Titan ille+} res [-fuas  XevcrdwicL  dCTcifJLteiov  Cpd-  authoris -]
[-ag ,  fj.2cr(rctTilwdi3-i^(^J'iSlw  msfitfs  K^ihdiov  l&LCpiyyicLxv-  t>Pus, rufp.- -]

[-n  •         r-y  ■  ■  ■  1         -  11  .  cionem  o- -]

[-yJhoV  ,  quamfpeciemeciamCopernicuseilargitur:habeaceciam7rot-  m..emau- -]

[-XwoW  ^(p^ictg,  qaamvisillosnonhabeacperanciquosPychago-  ^tl -]

[-reos ,  fed-]{+suas [?] [?]+}
{+[?], [?] [?] [?]+}
{+[?], quam speciem etiam Copernicus ei largitur: habeat etiam+}
{+[?] [?], quamvis illos non habeat per antiquos Pythago-+}
{+reos, sed+} eorum loco [-t* '&%" > ^  $«**# » ( quod ipforum-]{+[?] [?] [?] (quod ipsorum+} do-
[-£™J -]
[-gmafuccelior  Prociusoblivionefa?culorum  ,  Velucd.luviodelbrma-  na  chri- -]

[-cum ,-]{+gma successor Proclus oblivione saeculorum, veluti diluvio deforma-+}
{+tum,+} non [-aghovic)  habeacSc  ymfihlw  eX  fe  &&swajtrwi ,  &C  J£ -]
[-quicquideftnacurale  :  cedac  viciciflim  philofophia  ProcliChiiftianis  «*# -]
[-dogmacibus  ,  cedac-]{+agnovit) habeat & [?] [?] [?] [?], &+}
{+quicquid est naturale: cedat vicissim philosophia Procli Christianis+}
{+dogmatibus, cedat+} Sol [-fenfibilis  Mariaefilio  ,  filiumillum  Dei ,  poiuicjo"-]{+sensibilis Mariae filio, filium illum Dei,+}
quem Proclus [-alloquicur  fub  Ticanis  nomine ,  ^aopxl^,  u  dvcL,7TVI-  f™« -]

[-yvgajJvfzXM*7^^ '-]{+alloquitur sub Titanis nomine, [?], [?]+}
{+[?]+} & [-^a '  nwfo™  ***»««  iy^mooio  ippf~bra" -]
[-fofayoiYig  j-]{+[?] [?] [?] [?]+}
{+[?],+} & illam [-poceftacem  immenfamJu.aj£0Mdj/,&  qua;  in*-]{+potestatem immensam [?], & quae in+} nulla
[-^"J -]
[-philofophia-]{+philosophia+} legebantur [-ance  promulgacionem  EVangelij ,   Da?m  onas  qi -]


[-rseca- -]
[-reiuna -]
[-tiam» -]
[-uastame -]
[-cfenden- -]


[-Verbu  pacris'eft-]{+ante promulgationem Evangelij, Daemonas+}
{+Verbum patris est+} ille [-UKW  7T(JLyyiViTCL0  SlSi «  (pClLvivl^cbt 'appJlfe  muiauerat. -]
[-ymTt)$(§>J  7TclvctclIo  ^oi^eim  o^vfjLOLy&og  hr  dftviteifif  loilav  Jfi"*^ -]

[-*     Similia  tamen  non  nulla  Orpheo vctuftiflimo,  &prope  Mofissquali,  tanquamhujus  difci-  nOBYa0i»i -]
[-pulo  tribuuntur  ap.  Suidanv    Viie  &  Hymnos  Orphei ,  in  quos  fcirpfit  Produs.  b*nu -]

[-Hh    |  Secua= -]


[-1\6     De  MoTIBUS  Pl ANETAR UM -]

[-cap.  x,    fecundum  illud >-]{+[?] [?] [?] [?]+}
{+[?] [?] [?] [?] [?] [?] [?]+}
{+secundum illud,+} Terra erat rudis [-indigeftaque  moles  ,-]{+indigestaque moles,+} & [-cehebrje  fu--]{+tenebrae su-+}
per faciem [-abyffi;&,DivificDeuslucem-]{+abyssi; &, Divisit Deus lucem+} a [-tenebris,aquas-]{+tenebris, aquas+} ab [-aquis,mare-]{+aquis, mare+}
ab [-anda;-]{+arida;+} &[-v-] Omnia per [-ipfum-]{+ipsum+} Verbum [-faclafunt.-]{+facta sunt.+} Quis [-nifi  Jefus -]

[-An^i-     Nazarenus  ,-]{+nisi Jesus+}
{+Nazarenus,+} Dei filius, [-'fyyfcM    CLVdy^yivg   ,   paftor-]{+[?] [?], pastor+} anima-
[-nusifte,    rum  ,-]{+rum,+} cui [-offerendatxgflr/n 7TQ\vS)ciLX.PV©J >  utnospurgcta  peccatis» -]

[-pars  erat  5  ,  . -]

[-M^&)-exclue  fordibus-]{+offerenda [?] [?], ut nos [?] peccatis,+}
{+[?] sordibus+} eruat [-wg  ytViUMg  •>  ( quafi-]{+[?] [?] (quasi+} peccati originalis [-fomicem -]

[-~* .    facerecur)-]{+fomitem+}
{+fateretur)+} & a [-pcenis  malifque  euftodiac,  7%t)UJJM  §0QV  OLILLCL  JYwjff  t -]

[-5    fciliceciramPatris?  &quzealia-]{+poenis malisque custodiat, [?] [?] [?] [?]+}
{+scilicet iram Patris; & quae alia+} velut [-exHymnoZachanaedeprompca-]{+ex Hymno Zachariae deprompta+}
legimus, [-A%7\iw  )>7m<i>i.tc'ciQ'a.g  oMw^^gtov  XoKoypTov  > -]

[-utfc.-]{+[?] [?] [?] [?],+}
{+ut sc.+} animabus [-verlantibus-]{+versantibus+} in tenebris [-&umbra  morcis,dec  <£#©-' -]

[-cLyvov  Sc  oX@qv  cLsvtpihizlov  cltt  zvo-ifiing  i&Twmg  \-]{+& umbra mortis, det+}
{+[?] & [?] [?] [?] [?] [?];+} id enim [-eft, -]

[-fervire-]{+est,+}
{+servire+} Deo in [-fanclicace-]{+sanctitate+} & [-jufticia-]{+justitia+} omnibus diebus [-noftris. -]

[-Hsecigicur&fimihafeponamusnos-]{+nostris.+}

{+Haec igitur & similia seponamus nos+} jam, [-adquedddrinamEccle- -]

[-fi£Cacholicaj,cujusfuncpropria,remiccamus:  Cujusverbcarsapotif. -]

[-i.     .       fimum  radtaeft-]{+[?] doctrinam Eccle-+}
{+siae Catholicae, cujus sunt propria, remittamus: Cujus vero causa potis-+}
{+simum facta est+} mentio Hymni, [-idvideamus.  Eundemenim  Solem ,  q. -]

[-Sicetiam  va  ,  ,„       .,-.-■/       i  i  *1      /         ■  >  v      •         .7  .  , -]

[-orpkeus.  Y^oSriV  cteLLOVMg  pvLLCL  fihovo-iov  i%o%tTtvet ,  eundemde-]{+id videamus. Eundem enim Solem,+}
{+[?] [?] [?] [?] [?], eundem de+} cu-[-KQtTLLX-]
jus [-profapia-]{+prosapia+} oriundus Phoebus, [-KiQctP,  w  t/Vo  M<rKZ7\cLJLLi7\7TQV -]

[-tov  sir1-      lLvvcilfi  Ltiyci  KVLLct@cLev(p7\oio-@>oio  yiv$7ws,-]{+[?] [?] [?] [?]+}
{+[?] [?] [?] [?],+} & cujus chori
[-OftW.0-  conlbrs  eft  Pzean ,  riAnVct?  ctefioving  7rcuia.7rrifiov@j  ivgict  kovllov. -]

[-ViQV       eundeminquamprimoftatimHymniverficulofalutac  TLvffogvoiPp -]

[-fipJLLQV  @>0L<ri7\&CL.-]{+consors est Paean, [?] [?] [?] [?] [?].+}
{+eundem inquam primo statim Hymni versiculo salutat [?]+}
{+[?].+} Quo exordio [-fimul  indicat ,-]{+simul indicat,+} quid [-Pychagoreifub-]{+Pythagorei sub+} Ignis
[-ihKW.  vocabulointellexerinc,  (ucmirumfic,  difcipulumamagiftrisinCen- -]

[-*  triloco,  quodipfiSolidabanc,  dirtencire):  fimulcotumHymnum-]{+vocabulo intellexerint, (ut mirum sit, discipulum a magistris in Cen-+}
{+tri loco, quod ipsi Soli dabant, dissentire): simul totum Hymnum+} a
corpore Solis, [-ejufq;-]{+ejusque+} qualitate [-luCe,fenfilibp,-]{+luce, sensilibus,+} ad [-intelleftualia  tranlrerc;-]{+intellectualia transfert;+}
& illi [-fuo TIvpJ,  VQiPCO-]{+suo [?] [?]+} (igni [-fbrce  Scoicorii  arcifici )-]{+forte Stoicorum artifici)+} illi [-Placonis fui-]{+Platonis sui+} cre-
[-aco  Deo,Menci-]{+ato Deo, Menti+} principi [-feu  AvTOVU),  fedem-]{+seu [?], sedem+} regiam in corpore Solis [-aP -]

[-fignavki Creacuram-]{+as-+}
{+signavit Creaturam+} & eum, per quem omnia [-creacafunc,-]{+creata sunt,+} confundens
in unum. Ac nos [-Chriftiani ,-]{+Christiani,+} melius [-diftinguere  docli ,-]{+distinguere docti,+} Logon illum [-^- -]

[-ternum&  increatum,qui  tr&tftgogTOvQzoV,  &quinuIIisfedibuscon--]{+ae-+}
{+ternum & increatum, qui [?], & qui nullis sedibus con-+}
tinetur, quamvis [-fic  incra  omnia ,-]{+sit intra omnia,+} nullis [-excludirur,-]{+excluditur,+} quamvis [-ipfe  excra-]{+ipse extra+}
omnia, [-fcimus-]{+scimus+} carnem ex [-ucerogloriofiffimaj-]{+utero gloriosissimae+} Virginis Mariae in [-unica- -]

[-temPerlbnajfufcepifle  i  &confummaco-]{+unita-+}
{+tem Personae suscepisse, & consummato+} carnis [-minifterio,  ccelos,-]{+ministerio, coelos,+} in
quibus & pater [-cceleftis ,  exccllenci-]{+coelestis, excellenti+} quodammodo prae caeteris Mundi
[-parcibus,per-]{+partibus, per+} gloriam [-fcihcec-]{+scilicet+} & [-majeftacem  habicare  3gnofcicur,fedem -]

[-regiambccupafle,  eciamquefuisfidehbus  inilladomopacrisfuiman- -]

[-fiones  efle  pollicicum:de  caacero  fuper-]{+majestatem habitare agnoscitur, sedem+}
{+regiam occupasse, etiamque suis fidelibus in illa domo patris sui man-+}
{+siones esse pollicitum: de caetero super+} illa [-iede  curiofius-]{+sede curiosius+} aliquid inqui-
[-rere,lenfufque-]{+rere, sensusque+} vel rationes [-haturalesad-]{+naturales ad+} id indagandum [-arceflere,quod -]

[-oculusnonvidit,  aurisnonaudivit,&in  corhominisnon  afcendicfu- -]

[-pervacuumexiftimamus:Mentemverbcreacam,  quancaxumque  fic-]{+arcessere, quod+}
{+oculus non vidit, auris non audivit, & in cor hominis non ascendit su-+}
{+pervacuum existimamus: Mentem vero creatam, quantacunque sit+}
illa [-praeftanciaj,  Creacori  fiio  mericb  fubjicimus,-  necDeos  Incelligenci--]{+praestantiae, Creatori suo merito subjicimus, nec Deos Intelligenti-+}
as cum [-Ariftotele&  philofophis gencilibus ,-]{+Aristotele & philosophis gentilibus,+} nec [-Spiricuum  Planecario*-]{+Spirituum Planetario-+}
rum [-exercicus-]{+exercitus+} innumerabiles cum Magis [-introducimus ,  adorandofve-]{+introducimus, adorandosve+}
aut [-a -]

[-cu!.xSolis -]
[-cmon- -]
[--»     ftratum -]
[-oc in  co- -]


[-HARMONICIS  LlBER  V,        247 -]

[-autTheurgicis  fuperftitionibus  adrnutuum-]{+Theurgicis superstitionibus ad mutuum+} commercium exciendos
[-proponimus :  hocdiiigenter  cavences ,-]{+proponimus: hoc diligenter caventes,+} jam porro qualis Mens [-qua:que -]
[-fit ,  pfertim  fi-]{+quaeque+}
{+sit, praesertim si+} qua in corde Mundi [-viees-]{+vices+} animae mundi [-gerens ,  Naturse  videLibri-]{+gerens, Naturae+}
rerum [-arclius  eft-]{+arctius est+} alligata, [-('autfieciamaliquaecreacura:incelligentes,mcideftel--]{+(aut si etiam aliquae creaturae intelligentes,+}
Naturae [-diverfae-]{+diversae+} ab [-Humana,globum  ficanimatum  forfitan  mhabi-  lan<£vCiv -]
[-tan t ,-]{+Humana, globum sic animatum forsitan inhabi-+}
{+tant,+} inhabitabuntve) [-naturahbus-]{+naturalibus+} etiam [-ratiombus-]{+rationibus+} inquirimus [-hbere.  de  An^ma-]{+libere.+}
Quod [-fi-]{+si+} licet [-analogia;-]{+analogiae+} filo [-ducence,-]{+ducente,+} labyrinthos [-myftenorum  Nacura*  Mundi  & -]

[-\  r.     r  ii  nonnullis-]{+mysteriorum Naturae+}
permeare; non [-mepce-]{+inepte+} quis, [-opinor,iic  ruenc-]{+opinor, sic fuerit+} argumentatus, quod quae
[-e,  muniji -]
[-eft-]{+est+} habitudo [-fex-]{+sex+} orbium ad commune [-illorum ,  totiufque  ade6-]{+illorum, totiusque adeo+} mundi
[-centrunr,-]{+centrum,+} eadem [-fit-]{+sit+} & [-TftS  focLVoicLS-]{+[?] [?]+} ad [-TOV  VOVV  5-]{+[?] [?],+} ut [-tiae  facukates-]{+hae facultates+} ab [-A* -]
[-riftotele  ,  Placone,-]{+A-+}
{+ristotele, Platone,+} Proclo & caeteris [-diftinguuntur  :  &rurfum,qucd -]
[-quse hablcudo  revbliitibhum-]{+distinguuntur: & rursum, quod+}
{+quae habitudo revolutionum+} localium, [-Planetarumfingulorumcirca  n -]

[-1  >  ■    /a  r\      •  •','•'  iJcqiiate- -]

[-Sdlem  idSoiiseYrationem^gra.Og/O^mfpaciototiusfyftemacisme-ftantwn1-]{+Planetarum singulorum circa+}
{+Solem ad Solis [?] [?] [?] spatio totius systematis me-+}
dio; eadem [-fit-]{+sit+} etiam habitudo [-§ d'iW0Y)TlX.%-]{+[?] [?] ad [?] [?] discursuum+}
{+ratiocinationis multiplicium,+} ad [-TO j/og^opjdifcurfuum  d< -]

[-ratiocinationismultipliciumsadintelledtiortem  merttalem  fimplicifii-  h -]
[-mam.NamuriSolinfeipfum revolutus,peremiflam exfe fpecieha,mo-  mentajrijs -]
[-vetFlanetasomnes :  ficetiammens,utphilofophidocent,feipfamin-  ^amc°j/ -]
[-telligeil3,mqueie:psaomhia,ratiocinationesciet,  fuamquefimplici- -]
[-tueminiliasdiducens'&  explicans ,  omniafacit-]{+intellectionem mentalem simplicissi-+}
{+mam. Nam ut Sol in seipsum revolutus, per emissam ex se speciem, mo-+}
{+vet Planetas omnes: sic etiam mens, ut philosophi docent, seipsam in-+}
{+telligens, inque se ipsa omnia, ratiocinationes ciet, suamque simplici-+}
{+tatem in illas diducens & explicans, omnia facit+} intelligi. [-Adeoq;  coriwj^iv?  >l?-]{+Adeoque con-+}
nexa [-func incer  fe-]{+sunt inter se+} & colligata, motus Planetarum circa [-iblem-]{+Solem+} in eorum
[-centro  ,-]{+centro,+} & [-ducm-fusratiocinationum  :  utnifiTellUs , domiciliumno- -]
[-ftrurri;  annuumcirculum/medium  interorbescaeteros  ,metaretur,-]{+discursus ratiocinationum: ut nisi Tellus, domicilium no-+}
{+strum, annuum circulum, medium inter orbes caeteros, metaretur,+} lo-
cum[-exloeo ,  ftationerh-] ex [-ftatione  permutans,-nunquam-]{+loco, stationem ex statione permutans, nunquam+} humana ra-
[-tiocinatioadveriflimaPlarietarumincervalla^&adcaeteraabijsdepen-  Yi<?e0P- -]
[-dencia  fueritenifura,nunq  Aftronomiamconftitutura.      Exadverio  i9noimm -]
[-q  jiecem-]{+tiocinatio ad verissima Planetarum intervalla, & ad caetera ab ijs depen-+}
{+dentia fuerit enisura, nunquam Astronomiam constitutura. Ex adverso+}
{+quietem+} Solis in centro [-miindi,-]{+mundi,+} pulchro [-refponfu  confequitur-]{+responsu consequitur+} intelle-
[-pattem -]
[-ftionis  fimplicitas;  eoqaodha&enus  nobisufurpatum  femperfuicfo*  CAP#    •-]{+ctionis simplicitas; eo quod hactenus nobis usurpatum semper fuit so-+}
lares [-llksHarmoniis  mocuummeque-]{+illas Harmonias motuum neque+} plagarum [-diverficate,neque  fpa- -]
[-ciorum-]{+diversitate, neque spa-+}
{+tiorum+} Mundi amplitudine [-definiri.Nimirum  fi-]{+definiri. Nimirum si+} qua mens ex Sole pro-
[-fpicit  Harmomas  iilasiilli  defunt-]{+spicit Harmonias illas, illi desunt+} adminicula motus & [-ftationum-]{+stationum+} diver-
[-farum  fedis  fuae,-]{+sarum sedis suae,+} ex quibus [-ne£tat-]{+nectat+} ratiocinationes & [-difcurfus-]{+discursus+} interval-
lis planetarum dimetiendis [-neceflarios.    Comp  irac  igr-]{+necessarios. Comparat igitur+} diurnos [-cujufq;-]{+cujusque+}
Planetae [-motus ,-]{+motus,+} non ut ij [-funt infuis-]{+sunt in suis+} orbitis; [-fed  uci-]{+sed uti+} per angulos ad cen-
trum Solis [-allabuntur.Itaque  fi-]{+allabuntur. Itaque si+} cognitionem habet magnitudinis [-fphae- -]
[-rarum :-]{+sphae-+}
{+rarum:+} hanc illi [-opor tet-]{+oportet+} a priori [-inefle ,  Cme-]{+inesse, sine+} ratiocinationum [-labore  .*-]{+labore:+}
quod quidem [-quadamcenus-]{+quadamtenus+} & de humanis [-mentib9,&-]{+mentibus, &+} de natura [-fublu- -]
[-nariverum  efle,fupre  exPlatone&Proclo  patuit» -]

[-QuaecumitafintJnonequidemmirumfueritjfiquisexhociPytha--]{+sublu-+}
{+nari verum esse, supra ex Platone & Proclo patuit.+}

{+Quae cum ita sint, non equidem mirum fuerit, si quis ex hoc Pytha-+}
gorae cratere, quem [-Proclp-]{+Proclus+} in [-ipfo  ftarim-]{+ipso statim+} primo [-verfuHymni  propinatj -]
[-h iuftu-]{+versu Hymni propinat,+}
{+haustu+} liberaliori [-aflumpco  concalefatlus,  fi-]{+assumpto concalefactus, si+} Harmonia chori Planeta-
[-Lkeat & -]
[-ru  nfuaviflimainfoporem  datus,fomniare-]{+rum suavissima in soporem datus, somniare+} incipiat: [-Perglobosqdem  fabulan«Ja -]
[-rehquos-]{+Per globos quidem+}
{+reliquos+} de loco in [-;ocum  uccedltes-]{+locum succedentes+} circa Solem, [-difleminaras  efle-]{+disseminatas esse+} di-
[-Atfa^ntka' -]
[-f;urfivas(euRatiocn)aciva^taculcaces;qu3rumpr£eftantiflimautiq-,&  &fomnii- -]
[-abfolutiflimaillacenferidebet,-]{+scursivas seu Ratiocinativas facultates; quarum praestantissima utique, &+}
{+absolutissima illa censeri debet,+} quae [-efl-]{+est+} in [-illorumgloborum-]{+illorum globorum+} medio,[-n°scCp™l-]
humana [-fcmTellure :-]{+sc. in Tellure:+} in Sole [-ver6  Intelledlum  fimplicem,  7W0  yotpqv  nem  ,raii -]

[-C       xt   ""      l  1  ■  ^^       taii» -]

[-ieuJNOVy  nabicare,-]{+vero Intellectum simplicem, [?] [?]+}
{+seu [?] habitare,+} omnis Harmoniae [-foncem,-]{+fontem,+} quicunque ille [-fit. -]

[-Nam -]


[-248    De  Motibus  Planetarum -]

[-CAP.  X.  •  "-]{+sit.+}

Nam [-Fivelde-]{+si vel de+} nuda globorum illorum [-vaftitate  fic  vifum  eft-]{+vastitate sic visum est+} Ty-
[-choniBrahe,non  effe  frufrraneam-]{+choni Brahe, non esse frustraneam+} illam in [-mudo,  fedincolisrefercam: -]

[-quancoverifimiliusnosabillavariecace  ,  q,inhoc  Tellurisglobocer- -]

[-nimuSj-]{+mundo, sed incolis refertam:+}
{+quanto verisimilius nos ab illa varietate, quam in hoc Telluris globo cer-+}
{+nimus,+} operum [-confiiiorumq;-]{+consiliorumque+} Dei, [-conje&uram  eciam-]{+conjecturam etiam+} de [-cjecerisglo*-]{+caeteris glo-+}
bis [-capiemus  ?-]{+capiemus?+} Qui enim [-fpecies  ereavic,  qua:-]{+species creavit, quae+} aquas [-incolerenc,  fub-]{+incolerent, sub+} qui-
bus [-camen-]{+tamen+} nullus aeri locus, quem [-accrahanc  vivencia:-]{+attrahant viventia:+} qui in aeris [-vafti- -]

[-cacem ,  penis  fuffulcas  immific-]{+vasti-+}
{+tatem, pennis suffultas immisit+} volucres; qui [-nivofis  fepcencrionis-]{+nivosis septentrionis+} plagis
[-urfos  albos,albas  viilpes dedic,pabulumq;-]{+ursos albos, albas vulpes dedit, pabulumque+} illis, marina [-Cece ,-]{+Cete,+} his avium
[-ova  ,•  quifolicudinibusseftuancisLibya?,Ieones,  quidiffufiffimis  Syria? -]

[-planiciebuscamelos;famifqueillis,  hifceficiscoieranciam:hiccineom--]{+ova; qui solitudinibus aestuantis Libyae, leones, qui diffusissimis Syriae+}
{+planitiebus camelos; famisque illis, hisce sitis tolerantiam: hiccine om-+}
nem [-inglobo-]{+in globo+} Telluris [-confumpferic  arcem ,  ucnonpoffecomnem-]{+consumpserit artem, ut non posset omnem+} bo-
[-nicacem,uc-]{+nitatem, ut+} non [-vellec,  ca:ceros  eciam  gldbds  conveniencibus-]{+vellet, caeteros etiam globos convenientibus+} exornare
[-creacuris;-]{+creaturis;+} quas vel [-revolucionum prolixicaces  brevicacefque  ,-]{+revolutionum prolixitates brevitatesque,+} vel Solis
[-propinquicas-]{+propinquitas+} & [-remocio ,-]{+remotio,+} vel [-Ecceritncicacum  vanecas,-]{+Eccentricitatum varietas,+} vel corporum
[-nicor  auc  obfcuricas,-]{+nitor aut obscuritas,+} vel [-jfigurarum,quib9  cjlibec-]{+figurarum, quibus quaelibet+} regio [-fulcicur,-]{+fulcitur,+} proprie-
[-tacesfuadebanc.  Eccen.  ucanimancumfa;clainhocTellurisg!oboma- -]

[-fculi-]{+tates suadebant. [?] ut animantum saecla in hoc Telluris globo ma-+}
{+sculi+} effigiem in Dodecaedro, [-fcemina;-]{+foeminae+} in [-Icofiedro,  (  quorum-]{+Icosiedro, (quorum+} illud ex-
[-teriusTelluris-]{+terius Telluris+} orbem [-fulcicjioc  incerius)gener  acionis  deniq;-]{+fulcit, hoc interius) generationis denique+} effigiem,
in [-iilius-]{+illius+} conjugij divina [-proporcione  ejufq;  inerTabilicace  habeanc:-]{+proportione ejusque ineffabilitate habeant:+} quid
[-czecerosgloboshaberepucabimus  afiguriscsceris/'  Cuibono-]{+caeteros globos habere putabimus a figuris caeteris? Cui bono+} Jovem
[-quacuor  Lunaj,Sacurnum-]{+quatuor Lunae, Saturnum+} duas, [-curfibus  cinguncucnoftrumdomicihu -]

[-hascnoftra-]{+cursibus cingunt, ut nostrum domicilium+}
{+haec nostra+} Luna [-unica/-]{+unica?+} Ad eundem vero modum [-eciam  degloboSolis -]

[-raciocinabimur,  con  jedlurasqj-]{+etiam de globo Solis+}
{+ratiocinabimur, conjecturasque+} ab [-Harmonijs,c«cerisq;,  defumpcas,per -]

[-fe-]{+Harmonijs, caeterisque, desumptas, per+}
{+se+} quidem [-ponderofiffimas,conjeduris-]{+ponderosissimas, conjecturis+} alijs, magis ad corpora vergen-
tibus, magis ad vulgi [-capcum  accommodacis ,-]{+captum accommodatis,+} velut incorporabimus,
[-Ulene-]{+Illene+} globus vacuus, [-caeceri-]{+caeteri+} pleni [-func,  fi-]{+sunt, si+} omnia [-aliarefpondehc-]{+alia respondent+} propi-
us? [-fi  ucTerra  nubes,fic-]{+si ut Terra nubes, sic+} Sol [-acras-]{+atras+} fuligines [-expirac?  fi  uc-]{+expirat? si ut+} illa [-imbrib9-]{+imbribus+} hu-
[-meclarur-]{+mectatur+} & [-virefcic,  fic-]{+virescit, sic+} Sol maculis [-illisfuis  exuftislucefcic ,-]{+illis suis exustis lucescit,+} emicanti-
bus in [-ipfb-]{+ipso+} corpore, [-toco-]{+toto+} igneo, [-fiarhulis-]{+flammulis+} clarioribus. Cui [-uf ui-]{+usui+} hic appa-
[-racus,  fi-]{+ratus, si+} globus vacuus? An non vel [-f  enfus  ipfi  exclamant ,-]{+sensus ipsi exclamant,+} ignea hic ha-
[-bicare  corpora  >  Mencium  fimplicium-]{+bitare corpora, Mentium simplicium+} capacia, vereque Solem [-effe -]

[-7TV^g  J/os^SfinonRegem  ,  acfalcemRegiam  $-]{+esse+}
{+[?] [?] si non Regem, at saltem Regiam?+}

Abrumpo [-confulco-]{+consulto & somnum+} & [-fomnum  &fpeculacionem  vaftiffirriam;  tan-, -]

[-«um-]{+speculationem vastissimam; tan-+}
{+tum+} illud [-exclamanscum  Pfalce  Rege :-]{+exclamans cum Psalte Rege:+}

Magnus Dominus [-nofter,&-]{+noster, &+} magna [-vircus  ejns-]{+virtus ejus+} & [-Sapientias  ejusnon -]

[-eftnumerus:laudateeum  ccelijlaudace-]{+Sapientiae ejus non+}
{+est numerus: laudate eum coeli, laudate+} eum [-SoLLuna  &PlanecaJ,quo-*-]{+Sol, Luna & Planetae, quo-+}
cunque [-fehfu-]{+sensu+} ad percipiendum, [-quacunq,-  hngua-]{+quacunque lingua+} ad eloquendum Cre-[-Tuq;  ante-]
atorem [-veftrumutamini :  Laudace-]{+vestrum utamini: Laudate+} eum [-Harmohi»  cceleftes ,-]{+Harmoniae coelestes,+} laudate
[-omnesM oe etim-]{+eum+} vos Harmoniarum [-dece&arum arbicri:lauda-]{+detectarum arbitri: lauda+} & [-cu-]{+tu+} anima [-meaDo- -]
[-^1^^11  minumCreacorem-]{+mea Do-+}
{+minum Creatorem+} tuum, [-quamdiufuero: namqj  exipfb&peripfum -]
[-namq;  tu'-]{+quamdiu fuero: namque ex ipso & per ipsum+}
& in [-ipfo  funt  omnia  >  ^gyj  rd  dl<drf&  5  j@i}  rd  VOlgy,  j-]{+ipso sunt omnia, [?] [?] [?] [?] [?] [?],+} tam ea quae ig-
[-Hasdais  noramuspenitus,quameaquasfcimp,minimaiIlorumpars;quiaadhuc -]
[-animate    pius  uiCra  eft.  Ipfi  laus,honor-]{+noramus penitus, quam ea quae scimus, minima illorum pars; quia adhuc+}
{+plus ultra est. Ipsi laus, honor+} & gloria [-ih  faecula  feculorum-]{+in saecula seculorum+} Amen.

[-fpeqscuras r  F         I         N  ,      I         S.-]{+FINIS.+}
```
