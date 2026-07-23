# RISE Gospel Art Concordance

**Research draft 1 · 23 July 2026**

## Governing rule

> Map artworks to Gospel **pericopes**, not to whole Gospels or broad devotional buckets. A direct institutional identification outranks thematic resemblance; stillness outranks substitution.

This document covers the major narrative and parabolic pericopes for which the Art Institute of Chicago, Cleveland Museum of Art, and Rijksmuseum were investigated. It is comprehensive at the pericope level for this pass, but deliberately does not list every duplicate impression of the same plate.

## Evidence classes

- **DIRECT** — the museum title, description, or subject record identifies the same episode.
- **COMPOSITE** — the episode is present, but shares the work with other scenes.
- **RELATED** — iconographically adjacent, but not the same event.
- **GAP** — no sufficiently direct work retained; the runtime should prefer stillness.

## Provider findings

### Rijksmuseum

Rijks is the strongest concordance provider because its object records frequently expose an Iconclass-like `This work is about` subject and, often, explicit biblical verse references. Dutch searches materially improved recall: *Besnijdenis*, *Bruiloft te Kana*, *Wonderbare spijziging*, *Ongelovige Tomas*, *Zalving te Betanië*, and *Zacheüs* surfaced exact subjects that English-only searching could miss.

The current Museum Atlas should be amended: current RijksData documentation supports `description`, `aboutActor`, `title`, and other search axes, and creation dates may use wildcard patterns. English is supported, but Dutch coverage remains more complete.

### Art Institute of Chicago

AIC is strongest where it owns first-rank paintings with explicit CC0 designation: the Samaritan Woman, Cana, Christ Receiving the Children, the Washing of the Feet, Lazarus, Peter's Denial, Pilate, Carrying the Cross, Crucifixion, Entombment, and Noli me tangere. Discovery should still be done by structured fields or exact object-title research; prose `q` remains ranking rather than curation.

### Cleveland Museum of Art

Cleveland is strong in compact Passion and devotional prints and has excellent direct works for Baptism, the Last Supper, the Good Samaritan, the Rosary mysteries, Transfiguration, Resurrection, Ascension, and Emmaus. A tooling seam remains: the official API accepts accession numbers, while the current RISE adapter accepts digits only. Candidates shown with dotted accession numbers are therefore not pin-ready.

## Recommended runtime model

```js
GOSPEL_ART_CONCORDANCE = {
  'john:4:4-42': {
    episode: 'samaritan-woman',
    works: [
      { source: 'aic', id: 16200, relation: 'direct' },
      { source: 'rijks', id: 200124940, relation: 'direct' }
    ]
  }
}
```

The Scripture compiler already preserves verse sentinels before display-side stripping. Use those sentinels to emit a `gospelPassageId` on atoms or passage spans. The visual cortex should switch pools only when the reader enters the relevant verse range. A chapter with several episodes therefore becomes a small deterministic visual schedule, not one undifferentiated pool.

Recommended selection order:

1. DIRECT works already reviewed in RISE.
2. DIRECT newly discovered works after contact-sheet review.
3. COMPOSITE works only in multi-episode intervals and with explicit metadata.
4. RELATED works only as consciously authored accompaniment.
5. Otherwise, stillness.

## Passage mapping

### Infancy and childhood

#### The Annunciation — Luke 1:26-38

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **AIC `16327`** — *The Annunciation* — Jean Hey · `DIRECT` · `existing_pin`
  - Already contact-sheet reviewed in RISE.
  - Source: https://www.artic.edu/artworks/16327
- **RIJKS `20025868`** — *The Annunciation* · `DIRECT` · `existing_pin`
  - Already in chapel-nativity.
  - Source: https://id.rijksmuseum.nl/20025868
- **RIJKS `20025780`** — *The Annunciation* · `DIRECT` · `existing_pin`
  - Already in chapel-nativity.
  - Source: https://id.rijksmuseum.nl/20025780

**Search lexicon:** EN — Annunciation, Gabriel and Mary · NL — Annunciatie, Aankondiging aan Maria

#### The Visitation — Luke 1:39-56

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **CLEVELAND `136192`** — *The Visitation* · `DIRECT` · `existing_pin`
  - Current Rosarium Joyful Mystery work.
  - Source: https://www.clevelandart.org/art/136192

**Search lexicon:** EN — Visitation, Mary visits Elizabeth · NL — Visitatie, Maria bezoekt Elisabet

#### The Nativity / Birth of Christ — Luke 2:1-7

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **CLEVELAND `135311`** — *The Nativity* — Gerard David · `DIRECT` · `existing_pin`
  - Source: https://www.clevelandart.org/art/135311
- **AIC `184371`** — *The Nativity* — Fra Bartolommeo · `DIRECT` · `existing_pin`
  - Source: https://www.artic.edu/artworks/184371
- **RIJKS `200107955`** — *The Adoration of the Christ Child* · `RELATED` · `existing_pin`
  - Devotional adoration rather than a strict narrative birth scene.
  - Source: https://id.rijksmuseum.nl/200107955

**Search lexicon:** EN — Nativity, Birth of Christ · NL — Geboorte van Christus, Kerstnacht

#### The Annunciation to the Shepherds — Luke 2:8-14

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **RIJKS `20026246`** — *The Annunciation to the Shepherds* · `DIRECT` · `existing_pin`
  - Source: https://id.rijksmuseum.nl/20026246
- **RIJKS `200108947`** — *Annunciation to the Shepherds* · `DIRECT` · `existing_pin`
  - Source: https://id.rijksmuseum.nl/200108947

**Search lexicon:** EN — Annunciation to the Shepherds, Angel appears to shepherds · NL — Verkondiging aan de herders, Engel verschijnt aan de herders

#### The Adoration of the Shepherds — Luke 2:15-20

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **CLEVELAND `97171`** — *Adoration of the Shepherds* — Hans Leonhard Schäufelein · `DIRECT` · `existing_pin`
  - Source: https://www.clevelandart.org/art/97171
- **RIJKS `200108423`** — *The Adoration of the Shepherds* · `DIRECT` · `existing_pin`
  - Source: https://id.rijksmuseum.nl/200108423
- **RIJKS `200109187`** — *The Adoration of the Shepherds* · `DIRECT` · `existing_pin`
  - Source: https://id.rijksmuseum.nl/200109187

**Search lexicon:** EN — Adoration of the Shepherds · NL — Aanbidding door de herders

#### The Circumcision and Naming of Jesus — Luke 2:21

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **RIJKS `200122440`** — *Circumcision of Christ* — Albrecht Dürer · woodcut · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200122440
- **RIJKS `200124519`** — *Circumcision of Christ* · woodcut · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200124519

**Search lexicon:** EN — Circumcision of Christ · NL — Besnijdenis van Christus

#### The Presentation in the Temple — Luke 2:22-38

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **CLEVELAND `136177`** — *The Presentation in the Temple* · `DIRECT` · `existing_pin`
  - Source: https://www.clevelandart.org/art/136177
- **RIJKS `200122446`** — *Presentation of Christ in the Temple* — Albrecht Dürer · woodcut · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200122446
- **RIJKS `200122444`** — *Presentation of Christ in the Temple* — Albrecht Dürer · woodcut · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200122444

**Search lexicon:** EN — Presentation in the Temple, Simeon · NL — Presentatie in de tempel, Simeon

#### The Adoration of the Magi — Matthew 2:1-12

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **CLEVELAND `122223`** — *The Adoration of the Magi* — Giovanni di Paolo · `DIRECT` · `existing_pin`
  - Source: https://www.clevelandart.org/art/122223
- **CLEVELAND `128389`** — *The Adoration of the Magi* — Geertgen tot Sint Jans · `DIRECT` · `existing_pin`
  - Source: https://www.clevelandart.org/art/128389
- **RIJKS `200106080`** — *The Adoration of the Magi* · `DIRECT` · `existing_pin`
  - Source: https://id.rijksmuseum.nl/200106080
- **RIJKS `200107773`** — *The Adoration of the Magi* · `DIRECT` · `existing_pin`
  - Source: https://id.rijksmuseum.nl/200107773

**Search lexicon:** EN — Adoration of the Magi, Three Kings · NL — Aanbidding der koningen, Drie koningen

#### The Flight into Egypt — Matthew 2:13-15

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **AIC `16134`** — *The Flight into Egypt* — Bernardino Butinone · painting · `DIRECT` · `needs_contact_sheet`
  - Source: https://www.artic.edu/artworks/16134
- **RIJKS `200383792`** — *The Flight into Egypt* · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200383792
- **RIJKS `200147235`** — *Massacre of the Innocents and Flight into Egypt* · `COMPOSITE` · `hold`
  - Two episodes share one surface; do not present as an exact single-scene work.
  - Source: https://id.rijksmuseum.nl/200147235

**Search lexicon:** EN — Flight into Egypt · NL — Vlucht naar Egypte

#### The Massacre of the Innocents — Matthew 2:16-18

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **RIJKS `20028291`** — *The Massacre of the Innocents* — Lodovico Mazzolino · painting · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/20028291
- **RIJKS `200147235`** — *Massacre of the Innocents and Flight into Egypt* · `COMPOSITE` · `hold`
  - Source: https://id.rijksmuseum.nl/200147235

**Search lexicon:** EN — Massacre of the Innocents · NL — Kindermoord te Bethlehem, Moord op de onschuldige kinderen

#### The Return from Egypt / Settlement at Nazareth — Matthew 2:19-23

**Coverage:** GAP · **Runtime:** `exact_range`

No high-confidence direct candidate retained in this pass.

- **No retained direct work.**

**Search lexicon:** EN — Return from Egypt, Holy Family returns · NL — Terugkeer uit Egypte

#### The Twelve-Year-Old Jesus among the Doctors — Luke 2:41-52

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **CLEVELAND `104139`** — *Christ among the Doctors* · `DIRECT` · `existing_pin`
  - Source: https://www.clevelandart.org/art/104139

**Search lexicon:** EN — Christ among the Doctors, Jesus in the Temple · NL — Twaalfjarige Christus in de tempel

### Public ministry

#### The Baptism of Christ — Matthew 3:13-17; Mark 1:9-11; Luke 3:21-22; John 1:29-34

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **CLEVELAND `1953.143`** — *The Baptism of Christ* — Lucas Cranach · painting · `DIRECT` · `needs_athena_id`
  - Official CMA record is CC0; current RISE adapter rejects dotted accession numbers.
  - Source: https://www.clevelandart.org/art/1953.143
- **CLEVELAND `1950.400`** — *Baptism of Christ* — Workshop of Jacopo Tintoretto · painting · `DIRECT` · `needs_athena_id`
  - Source: https://www.clevelandart.org/art/1950.400
- **AIC `3827`** — *The Baptism of Christ* — Martin Schongauer · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://www.artic.edu/artworks/3827

**Search lexicon:** EN — Baptism of Christ · NL — Doop van Christus, Doop in de Jordaan

#### The Temptation of Christ — Matthew 4:1-11; Mark 1:12-13; Luke 4:1-13

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **RIJKS `200144296`** — *Temptation of Christ* — Cornelis Saftleven · drawing · `DIRECT` · `needs_contact_sheet`
  - Directly depicts the command to turn stones into bread.
  - Source: https://id.rijksmuseum.nl/200144296

**Search lexicon:** EN — Temptation of Christ · NL — Verzoeking van Christus

#### The Calling of the First Disciples / Miraculous Catch — Matthew 4:18-22; Mark 1:16-20; Luke 5:1-11; John 1:35-51

**Coverage:** GAP · **Runtime:** `exact_range`

Gap: conduct a dedicated subject-node search; do not substitute generic fishing scenes.

- **No retained direct work.**

**Search lexicon:** EN — Calling of the apostles, Miraculous catch of fish · NL — Roeping van de apostelen, Wonderbare visvangst

#### The Wedding at Cana — John 2:1-11

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **AIC `2166`** — *The Wedding at Cana* — Giuseppe Maria Crespi · painting · `DIRECT` · `needs_contact_sheet`
  - Source: https://www.artic.edu/artworks/2166
- **RIJKS `200230363`** — *Marriage at Cana* — Jacob Matham · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200230363
- **RIJKS `200428834`** — *Marriage at Cana* — Jacob Matham · two-plate engraving · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200428834

**Search lexicon:** EN — Wedding at Cana, Marriage at Cana · NL — Bruiloft te Kana

#### Christ Cleanses the Temple — John 2:13-22; Matthew 21:12-17; Mark 11:15-19; Luke 19:45-48

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **RIJKS `200124928`** — *Christ Driving the Money Changers from the Temple* — Rembrandt van Rijn · print · `DIRECT` · `needs_contact_sheet`
  - The image is exact, but the same iconography can be assigned to either Johannine or Synoptic placement.
  - Source: https://id.rijksmuseum.nl/200124928

**Search lexicon:** EN — Cleansing of the Temple, Money changers · NL — Tempelreiniging, Geldwisselaars uit de tempel

#### Jesus and Nicodemus — John 3:1-21

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **RIJKS `200148161`** — *Christ with Nicodemus* — Pieter de Jode II · drawing · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200148161

**Search lexicon:** EN — Jesus and Nicodemus · NL — Christus en Nicodemus, Christus bij Nikodemus

#### Jesus and the Samaritan Woman — John 4:4-42

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **AIC `16200`** — *Christ and the Woman of Samaria* — Pietro Perugino · painting · `DIRECT` · `needs_contact_sheet`
  - Source: https://www.artic.edu/artworks/16200
- **RIJKS `200124940`** — *Christ and the Woman of Samaria* — Rembrandt van Rijn · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200124940

**Search lexicon:** EN — Christ and the Woman of Samaria, Samaritan woman at the well · NL — Christus en de Samaritaanse vrouw, Samaritaanse vrouw bij de bron

#### The Healing at the Pool of Bethesda — John 5:1-9

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **RIJKS `200267740`** — *Christ Healing the Sick at Bethesda* · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200267740

**Search lexicon:** EN — Pool of Bethesda, Healing at Bethesda · NL — Bad van Bethesda, Genezing te Bethesda

#### The Sermon on the Mount — Matthew 5:1-7:29

**Coverage:** RELATED · **Runtime:** `exact_range`

No exact retained work from these three providers; RISE's current Bloch Commons work remains the stronger exact image.

- **RIJKS `200124917`** — *Christ Preaching ('La petite tombe')* — Rembrandt van Rijn · print · `RELATED` · `hold`
  - A teaching scene, not securely the Sermon on the Mount.
  - Source: https://id.rijksmuseum.nl/200124917

**Search lexicon:** EN — Sermon on the Mount · NL — Bergrede

#### Jesus Blesses the Children — Matthew 19:13-15; Mark 10:13-16; Luke 18:15-17

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **AIC `9672`** — *Christ Receiving the Children* — Sébastien Bourdon · painting · `DIRECT` · `needs_contact_sheet`
  - Source: https://www.artic.edu/artworks/9672
- **RIJKS `200126043`** — *Christ Preaching / The Hundred Guilder Print* — Rembrandt van Rijn · print · `COMPOSITE` · `hold`
  - Includes children and healings within a broader Matthew 19 synthesis.
  - Source: https://id.rijksmuseum.nl/200126043

**Search lexicon:** EN — Christ receiving the children · NL — Christus zegent de kinderen, Laat de kinderen tot mij komen

#### Christ Heals and Teaches the Multitude — Matthew 8-9; Matthew 19:1-15

**Coverage:** COMPOSITE · **Runtime:** `chapter_pool`

- **RIJKS `200126043`** — *Christ Preaching / The Hundred Guilder Print* — Rembrandt van Rijn · print · `COMPOSITE` · `needs_contact_sheet`
  - Best used for a multi-episode ministry interval, not a single miracle.
  - Source: https://id.rijksmuseum.nl/200126043

**Search lexicon:** EN — Christ healing the sick, Hundred Guilder Print · NL — Christus geneest de zieken, Honderdguldenprent

#### Christ Calms the Storm — Matthew 8:23-27; Mark 4:35-41; Luke 8:22-25

**Coverage:** GAP · **Runtime:** `exact_range`

Gap in the retained pass. Keep stillness rather than use a generic seascape.

- **No retained direct work.**

**Search lexicon:** EN — Christ calming the storm, Storm on the Sea of Galilee · NL — Christus stilt de storm, Storm op het Meer van Galilea

#### The Multiplication of Loaves and Fishes — Matthew 14:13-21; Matthew 15:32-39; Mark 6:32-44; Mark 8:1-10; Luke 9:10-17; John 6:1-14

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **RIJKS `200626632`** — *The Miraculous Feeding* — Pieter van der Borcht I · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200626632
- **RIJKS `200485086`** — *The Miraculous Feeding* — Jacques de Gheyn II · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200485086

**Search lexicon:** EN — Multiplication of loaves and fishes, Feeding of the five thousand · NL — Wonderbare spijziging, Vermenigvuldiging van broden en vissen

#### Jesus and Peter Walk on the Water — Matthew 14:22-33; Mark 6:45-52; John 6:16-21

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **RIJKS `200179614`** — *Christ Walks on the Water* — Christoffel van Sichem II · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200179614
- **RIJKS `200401646`** — *Christ Walks on the Water* — Monogrammist AB · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200401646

**Search lexicon:** EN — Christ walking on water, Peter sinking · NL — Christus loopt over het water, Petrus zinkt

#### The Transfiguration — Matthew 17:1-8; Mark 9:2-8; Luke 9:28-36

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **CLEVELAND `146788`** — *The Transfiguration* — Camillo Procaccini · `DIRECT` · `existing_pin`
  - Source: https://www.clevelandart.org/art/146788

**Search lexicon:** EN — Transfiguration of Christ · NL — Gedaanteverandering van Christus, Transfiguratie

#### The Parable of the Good Samaritan — Luke 10:25-37

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **RIJKS `200107987`** — *The Good Samaritan* · painting · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200107987
- **RIJKS `200125033`** — *The Good Samaritan* — Rembrandt van Rijn · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200125033
- **CLEVELAND `2024.32`** — *The Good Samaritan* — Gustave Moreau · watercolor · `DIRECT` · `needs_athena_id`
  - Source: https://www.clevelandart.org/art/2024.32

**Search lexicon:** EN — Good Samaritan · NL — Barmhartige Samaritaan

#### Jesus with Mary and Martha — Luke 10:38-42

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **RIJKS `200255893`** — *Christ with Martha and Mary* — Pieter Sluyter · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200255893

**Search lexicon:** EN — Christ with Mary and Martha · NL — Christus bij Martha en Maria

#### The Parable of the Prodigal Son — Luke 15:11-32

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **RIJKS `200125040`** — *The Return of the Prodigal Son* — Rembrandt van Rijn · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200125040

**Search lexicon:** EN — Prodigal Son, Return of the Prodigal Son · NL — Verloren zoon, Terugkeer van de verloren zoon

#### The Raising of Lazarus — John 11:1-44

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **AIC `49000`** — *The Raising of Lazarus: The Larger Plate* — Rembrandt van Rijn · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://www.artic.edu/artworks/49000
- **AIC `111467`** — *The Raising of Lazarus* — Follower of Rembrandt · painting · `DIRECT` · `needs_contact_sheet`
  - Source: https://www.artic.edu/artworks/111467
- **RIJKS `200124949`** — *The Raising of Lazarus* — Rembrandt van Rijn · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200124949

**Search lexicon:** EN — Raising of Lazarus · NL — Opwekking van Lazarus

#### Jesus and the Woman Taken in Adultery — John 8:2-11

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **RIJKS `200110644`** — *Christ and the Woman in Adultery* — Gerbrand van den Eeckhout · painting · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200110644
- **RIJKS `200168676`** — *Christ and the Woman in Adultery* — Giuseppe Camerata II · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200168676

**Search lexicon:** EN — Woman taken in adultery · NL — Christus en de overspelige vrouw

#### Jesus Calls Zacchaeus — Luke 19:1-10

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **RIJKS `2009076`** — *Christ and Zacchaeus* — Erasmus Quellinus II · drawing · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/2009076
- **RIJKS `200396204`** — *Zacchaeus in the Fig Tree* — Jan Luyken · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200396204

**Search lexicon:** EN — Zacchaeus in the fig tree · NL — Zacheüs in de vijgenboom, Roeping van Zacheüs

#### The Tribute Money / Coin in the Fish — Matthew 17:24-27

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **RIJKS `200124921`** — *The Tribute Money* — Rembrandt van Rijn · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200124921

**Search lexicon:** EN — Tribute money, Coin in the fish · NL — Cijnspenning, Petrus vindt munt in de vis

### Passion

#### The Anointing at Bethany — Matthew 26:6-13; Mark 14:3-9; John 12:1-8

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **RIJKS `200247822`** — *Anointing at Bethany* — Johann Sadeler I · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200247822

**Search lexicon:** EN — Anointing at Bethany · NL — Zalving te Betanië

#### The Entry into Jerusalem — Matthew 21:1-11; Mark 11:1-11; Luke 19:28-40; John 12:12-19

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **RIJKS `200395198`** — *The Entry into Jerusalem* — Schelte Adamsz. Bolswert · engraving · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200395198

**Search lexicon:** EN — Entry into Jerusalem, Palm Sunday · NL — Intocht in Jeruzalem, Palmzondag

#### Christ Washes the Disciples' Feet — John 13:1-20

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **AIC `58052`** — *Christ Washing the Feet of His Disciples* — Nicolas Bertin · painting · `DIRECT` · `needs_contact_sheet`
  - Source: https://www.artic.edu/artworks/58052

**Search lexicon:** EN — Christ washing the disciples' feet · NL — Voetwassing, Christus wast de voeten

#### The Last Supper — Matthew 26:17-30; Mark 14:12-26; Luke 22:7-23; John 13:21-30

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **RIJKS `200536193`** — *The Last Supper* — Jan Harmensz. Muller · triptych print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200536193
- **CLEVELAND `1926.112`** — *The Last Supper* — Albrecht Dürer · woodcut · `DIRECT` · `needs_athena_id`
  - Source: https://www.clevelandart.org/art/1926.112
- **CLEVELAND `1923.55.1`** — *The Last Supper* — Lucas van Leyden · engraving · `DIRECT` · `needs_athena_id`
  - Source: https://www.clevelandart.org/art/1923.55.1

**Search lexicon:** EN — Last Supper · NL — Laatste Avondmaal

#### The Agony in the Garden — Matthew 26:36-46; Mark 14:32-42; Luke 22:39-46

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **RIJKS `200124962`** — *The Agony in the Garden* — Rembrandt van Rijn · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200124962
- **CLEVELAND `102535`** — *Ecce Homo* — Albrecht Dürer · `RELATED` · `hold`
  - Not Gethsemane; retained here only as a false-friend warning.
  - Source: https://www.clevelandart.org/art/102535

**Search lexicon:** EN — Agony in the Garden, Gethsemane · NL — Christus in Getsemane, Gebed op de Olijfberg

#### The Betrayal and Arrest of Jesus — Matthew 26:47-56; Mark 14:43-52; Luke 22:47-53; John 18:1-12

**Coverage:** COMPOSITE · **Runtime:** `exact_range`

- **RIJKS `200254865`** — *The Agony in the Garden and the Approaching Betrayal* · print · `COMPOSITE` · `hold`
  - Judas and the arrest party appear as a secondary scene; not an exact arrest-only image.
  - Source: https://id.rijksmuseum.nl/200254865

**Search lexicon:** EN — Betrayal of Christ, Arrest of Christ, Kiss of Judas · NL — Verraad van Judas, Gevangenneming van Christus, Judaskus

#### Jesus before Annas and Caiaphas — Matthew 26:57-68; Mark 14:53-65; Luke 22:54-71; John 18:12-24

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **RIJKS `200403431`** — *Christ before Caiaphas* · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200403431
- **RIJKS `200403430`** — *Christ before Caiaphas* · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200403430

**Search lexicon:** EN — Christ before Caiaphas, Christ before Annas · NL — Christus voor Kajafas, Christus voor Annas

#### The Denial of Saint Peter — Matthew 26:69-75; Mark 14:66-72; Luke 22:54-62; John 18:15-18,25-27

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **AIC `30901`** — *The Denial of Saint Peter* — Hendrick ter Brugghen · painting · `DIRECT` · `needs_contact_sheet`
  - Source: https://www.artic.edu/artworks/30901
- **RIJKS `200137068`** — *Christ before Annas with the Denial of Peter* · print · `COMPOSITE` · `hold`
  - Source: https://id.rijksmuseum.nl/200137068
- **RIJKS `200225335`** — *Peter Weeping after the Denial* · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200225335

**Search lexicon:** EN — Denial of Peter · NL — Verloochening van Petrus, Petrus weent

#### Jesus before Pilate — Matthew 27:1-26; Mark 15:1-15; Luke 23:1-25; John 18:28-19:16

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **RIJKS `200124976`** — *Christ before Pilate* — Rembrandt van Rijn · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200124976
- **AIC `49009`** — *Christ Before Pilate: Large Plate* — Rembrandt van Rijn · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://www.artic.edu/artworks/49009
- **AIC `109500`** — *Christ before Pilate* — Pontormo · drawing · `DIRECT` · `needs_contact_sheet`
  - Source: https://www.artic.edu/artworks/109500

**Search lexicon:** EN — Christ before Pilate · NL — Christus voor Pilatus

#### The Flagellation of Christ — Matthew 27:26; Mark 15:15; John 19:1

**Coverage:** DIRECT · **Runtime:** `exact_range`

Provider gap among the three requested institutions in the retained set; keep the existing Met work.

- **CLEVELAND `current-rosarium-flagellation`** — *The Flagellation of Christ* · `DIRECT` · `existing_pin`
  - Current Rosarium pin is Met 438466; no exact AIC/CMA/Rijks replacement selected in this pass.

**Search lexicon:** EN — Flagellation of Christ · NL — Geseling van Christus

#### The Crowning with Thorns / Ecce Homo — Matthew 27:27-31; Mark 15:16-20; John 19:2-5

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **CLEVELAND `102535`** — *Ecce Homo* — Albrecht Dürer · `DIRECT` · `existing_pin`
  - Source: https://www.clevelandart.org/art/102535
- **CLEVELAND `164752`** — *Ecce Homo: Christ Presented to the People* — Rembrandt van Rijn · `DIRECT` · `existing_pin`
  - Source: https://www.clevelandart.org/art/164752
- **CLEVELAND `104612`** — *The Passion: Ecce Homo* — Martin Schongauer · `DIRECT` · `existing_pin`
  - Source: https://www.clevelandart.org/art/104612

**Search lexicon:** EN — Ecce Homo, Crowning with thorns · NL — Ecce Homo, Doornenkroning

#### Christ Carrying the Cross — Matthew 27:31-34; Mark 15:20-23; Luke 23:26-32; John 19:16-17

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **AIC `234781`** — *Christ Carrying the Cross* — Sebastiano del Piombo · `DIRECT` · `existing_pin`
  - Source: https://www.artic.edu/artworks/234781

**Search lexicon:** EN — Christ carrying the cross · NL — Kruisdraging, Christus draagt het kruis

#### The Crucifixion — Matthew 27:35-56; Mark 15:24-41; Luke 23:33-49; John 19:18-37

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **CLEVELAND `112856`** — *The Crucifixion with a Carthusian Monk* — Rogier van der Weyden · `DIRECT` · `existing_pin`
  - Source: https://www.clevelandart.org/art/112856
- **AIC `80084`** — *The Crucifixion* — Francisco de Zurbarán · `DIRECT` · `existing_pin`
  - Source: https://www.artic.edu/artworks/80084
- **AIC `111622`** — *The Crucifixion* — Carlo Crivelli · `DIRECT` · `existing_pin`
  - Source: https://www.artic.edu/artworks/111622
- **RIJKS `200109302`** — *The Crucifixion with Mary, John, Mary Magdalene and Longinus* · `DIRECT` · `existing_pin`
  - Source: https://id.rijksmuseum.nl/200109302

**Search lexicon:** EN — Crucifixion of Christ · NL — Kruisiging van Christus, Christus aan het kruis

### Resurrection and appearances

#### The Descent from the Cross and Lamentation — Matthew 27:57-58; Mark 15:42-45; Luke 23:50-53; John 19:38

**Coverage:** DIRECT · **Runtime:** `exact_range`

These are distinct post-crucifixion iconographies. Keep separate sub-pools even if they share a brief passage interval.

- **RIJKS `20027041`** — *The Descent from the Cross* · `DIRECT` · `existing_pin`
  - Source: https://id.rijksmuseum.nl/20027041
- **RIJKS `2004499`** — *The Descent from the Cross* · `DIRECT` · `existing_pin`
  - Source: https://id.rijksmuseum.nl/2004499
- **RIJKS `200109204`** — *Lamentation of Christ* · `DIRECT` · `existing_pin`
  - Source: https://id.rijksmuseum.nl/200109204
- **CLEVELAND `94846`** — *Pietà* · `DIRECT` · `existing_pin`
  - Source: https://www.clevelandart.org/art/94846

**Search lexicon:** EN — Descent from the Cross, Lamentation, Pietà · NL — Kruisafneming, Bewening van Christus, Pietà

#### The Entombment of Christ — Matthew 27:57-61; Mark 15:42-47; Luke 23:50-56; John 19:38-42

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **AIC `86323`** — *The Entombment* — Guercino · painting · `DIRECT` · `needs_contact_sheet`
  - Source: https://www.artic.edu/artworks/86323
- **AIC `29120`** — *The Entombment* — Rembrandt van Rijn · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://www.artic.edu/artworks/29120
- **RIJKS `20027024`** — *Entombment of Christ with Joseph of Arimathea and Nicodemus* · painting · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/20027024
- **RIJKS `20013267`** — *Entombment of Christ* — Federico Barocci · drawing · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/20013267

**Search lexicon:** EN — Entombment of Christ · NL — Graflegging van Christus

#### The Resurrection / Empty Tomb — Matthew 28:1-10; Mark 16:1-8; Luke 24:1-12; John 20:1-18

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **CLEVELAND `78982`** — *The Resurrection of Christ* — Johann König · `DIRECT` · `existing_pin`
  - Source: https://www.clevelandart.org/art/78982
- **CLEVELAND `159717`** — *The Resurrection of Christ* — Philip Galle · `DIRECT` · `existing_pin`
  - Source: https://www.clevelandart.org/art/159717
- **RIJKS `200109462`** — *The Resurrection of Christ* · `DIRECT` · `existing_pin`
  - Source: https://id.rijksmuseum.nl/200109462
- **CLEVELAND `133419`** — *The Three Marys at the Tomb* · `DIRECT` · `existing_pin`
  - Source: https://www.clevelandart.org/art/133419

**Search lexicon:** EN — Resurrection of Christ, Three Marys at the tomb · NL — Opstanding van Christus, Drie Maria's bij het graf

#### Christ Appears to Mary Magdalene / Noli me tangere — John 20:11-18

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **AIC `16207`** — *Noli Me Tangere* — Pietro Perugino · painting · `DIRECT` · `needs_contact_sheet`
  - Source: https://www.artic.edu/artworks/16207
- **CLEVELAND `134264`** — *Christ Appearing to the Magdalen* — Martin Schongauer · `DIRECT` · `existing_pin`
  - Source: https://www.clevelandart.org/art/134264

**Search lexicon:** EN — Noli me tangere, Christ appears to Mary Magdalene · NL — Noli me tangere, Christus verschijnt aan Maria Magdalena

#### The Road to and Supper at Emmaus — Luke 24:13-35

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **CLEVELAND `106440`** — *Supper at Emmaus* — Israhel van Meckenem · `DIRECT` · `existing_pin`
  - Source: https://www.clevelandart.org/art/106440
- **RIJKS `20026350`** — *Supper at Emmaus* — Jan Steen · painting · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/20026350
- **RIJKS `200125018`** — *The Supper at Emmaus* — Rembrandt van Rijn · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200125018

**Search lexicon:** EN — Supper at Emmaus, Road to Emmaus · NL — Maaltijd te Emmaüs, Emmaüsgangers

#### Christ Appears to the Apostles behind Locked Doors — Luke 24:36-49; John 20:19-23

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **RIJKS `200125028`** — *Christ Appearing to the Apostles* — Rembrandt van Rijn · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200125028
- **RIJKS `200392481`** — *Christ Appears to the Apostles* — Antonie Wierix II · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200392481

**Search lexicon:** EN — Christ appears to the apostles · NL — Christus verschijnt aan de apostelen

#### The Incredulity of Thomas — John 20:24-29

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **RIJKS `200178954`** — *Doubting Thomas* — Reinier Vinkeles I · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200178954
- **RIJKS `RP-P-OB-1353`** — *The Incredulity of Thomas* — Albrecht Dürer · woodcut · `DIRECT` · `needs_persistent_id`
  - Object page found; resolve the Linked Art persistent numeric ID before pinning.

**Search lexicon:** EN — Doubting Thomas, Incredulity of Thomas · NL — Ongelovige Thomas, Ongeloof van Tomas

#### The Appearance at the Sea of Tiberias / Miraculous Catch — John 21:1-14

**Coverage:** GAP · **Runtime:** `exact_range`

Gap: do not reuse the pre-Resurrection calling-of-disciples imagery without explicit composite labeling.

- **No retained direct work.**

**Search lexicon:** EN — Appearance at the Sea of Tiberias, Miraculous catch after Resurrection · NL — Verschijning aan het Meer van Tiberias, Wonderbare visvangst na de opstanding

#### The Ascension — Mark 16:19-20; Luke 24:50-53; Acts 1:6-11

**Coverage:** DIRECT · **Runtime:** `exact_range`

- **CLEVELAND `130151`** — *Ascension of Christ* — Albrecht Dürer · `DIRECT` · `existing_pin`
  - Source: https://www.clevelandart.org/art/130151
- **AIC `16313`** — *The Ascension* · `DIRECT` · `needs_contact_sheet`
  - Source: https://www.artic.edu/artworks/16313
- **RIJKS `200397609`** — *Ascension of Christ* — Nicolaes de Bruyn · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200397609
- **RIJKS `200194093`** — *Ascension of Christ* — Cornelis Galle II · print · `DIRECT` · `needs_contact_sheet`
  - Source: https://id.rijksmuseum.nl/200194093

**Search lexicon:** EN — Ascension of Christ · NL — Hemelvaart van Christus

## Immediate collection refactor

Retire whole-Gospel defaults such as `matthew -> chapel-passion + chapel-crucifixion`. Replace the four mixed pools with smaller exact collections, for example:

```text
chapel-gospel-annunciation
chapel-gospel-presentation
chapel-gospel-cana
chapel-gospel-samaritan-woman
chapel-gospel-feeding
chapel-gospel-lazarus
chapel-gospel-entry-jerusalem
chapel-gospel-washing-feet
chapel-gospel-last-supper
chapel-gospel-gethsemane
chapel-gospel-pilate
chapel-gospel-crucifixion
chapel-gospel-entombment
chapel-gospel-emmaus
chapel-gospel-thomas
```

The existing `chapel-nativity`, `chapel-passion`, and `chapel-resurrection` arrays can remain as Curia browse aggregates, but they should no longer be the semantic unit used by Scripture playback.

## Required next validation

1. Generate contact sheets only for entries marked `needs_contact_sheet`.
2. Resolve Cleveland Athena IDs for dotted accessions, or deliberately widen the adapter.
3. Resolve the one Rijks object marked `needs_persistent_id`.
4. Re-probe the Rijks VisualItem rights hop for every new numeric ID.
5. Record rejected works in an episode-level exclusions ledger so they cannot quietly return.
6. Add tests asserting that a work can never be served outside its declared passage ranges.

## Summary

- Pericopes mapped: **56**
- COMPOSITE: **2**
- DIRECT: **49**
- GAP: **4**
- RELATED: **1**
- Candidate records: **112**
  - aic: **20**
  - cleveland: **26**
  - rijks: **66**
