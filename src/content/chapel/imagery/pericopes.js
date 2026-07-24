/**
 * Gospel pericopes — the runtime concordance (GENERATED).
 *
 * Machine output of scripts/build-pericopes.mjs from
 * image_map/rise-gospel-art-concordance.json. DO NOT EDIT BY HAND —
 * edit the concordance JSON and rebuild. Only cleared, pin-ready works
 * are admitted (99 works across 50 pericopes with imagery;
 * the rest resolve to stillness until their works clear review).
 *
 * PERICOPE-IMAGERY-SPEC §3.1. Verse ranges within a book never
 * overlap (asserted at build time).
 */

export const GOSPEL_PERICOPES = Object.freeze([
    {
        id: "annunciation", title: "The Annunciation", coverage: "DIRECT",
        ranges: [{ book: "luke", chapter: 1, verseStart: 26, verseEnd: 38 }],
        works: [{ source: "aic", id: 16327 }, { source: "rijks", id: 20025868 }, { source: "rijks", id: 20025780 }]
    },
    {
        id: "visitation", title: "The Visitation", coverage: "DIRECT",
        ranges: [{ book: "luke", chapter: 1, verseStart: 39, verseEnd: 56 }],
        works: [{ source: "cleveland", id: 136192 }]
    },
    {
        id: "nativity", title: "The Nativity / Birth of Christ", coverage: "DIRECT",
        ranges: [{ book: "luke", chapter: 2, verseStart: 1, verseEnd: 7 }],
        works: [{ source: "cleveland", id: 135311 }, { source: "aic", id: 184371 }, { source: "rijks", id: 200107955 }]
    },
    {
        id: "annunciation-to-shepherds", title: "The Annunciation to the Shepherds", coverage: "DIRECT",
        ranges: [{ book: "luke", chapter: 2, verseStart: 8, verseEnd: 14 }],
        works: [{ source: "rijks", id: 20026246 }, { source: "rijks", id: 200108947 }]
    },
    {
        id: "adoration-shepherds", title: "The Adoration of the Shepherds", coverage: "DIRECT",
        ranges: [{ book: "luke", chapter: 2, verseStart: 15, verseEnd: 20 }],
        works: [{ source: "cleveland", id: 97171 }, { source: "rijks", id: 200108423 }, { source: "rijks", id: 200109187 }]
    },
    {
        id: "circumcision", title: "The Circumcision and Naming of Jesus", coverage: "DIRECT",
        ranges: [{ book: "luke", chapter: 2, verseStart: 21, verseEnd: 21 }],
        works: [{ source: "rijks", id: 200122440 }, { source: "rijks", id: 200124519 }]
    },
    {
        id: "presentation", title: "The Presentation in the Temple", coverage: "DIRECT",
        ranges: [{ book: "luke", chapter: 2, verseStart: 22, verseEnd: 38 }],
        works: [{ source: "cleveland", id: 136177 }, { source: "rijks", id: 200122446 }, { source: "rijks", id: 200122444 }]
    },
    {
        id: "magi", title: "The Adoration of the Magi", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 2, verseStart: 1, verseEnd: 12 }],
        works: [{ source: "cleveland", id: 122223 }, { source: "cleveland", id: 128389 }, { source: "rijks", id: 200106080 }, { source: "rijks", id: 200107773 }]
    },
    {
        id: "flight-into-egypt", title: "The Flight into Egypt", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 2, verseStart: 13, verseEnd: 15 }],
        works: [{ source: "aic", id: 16134 }, { source: "rijks", id: 200383792 }]
    },
    {
        id: "massacre-innocents", title: "The Massacre of the Innocents", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 2, verseStart: 16, verseEnd: 18 }],
        works: [{ source: "rijks", id: 20028291 }]
    },
    {
        id: "return-egypt", title: "The Return from Egypt / Settlement at Nazareth", coverage: "GAP",
        ranges: [{ book: "matthew", chapter: 2, verseStart: 19, verseEnd: 23 }],
        works: []
    },
    {
        id: "christ-among-doctors", title: "The Twelve-Year-Old Jesus among the Doctors", coverage: "DIRECT",
        ranges: [{ book: "luke", chapter: 2, verseStart: 41, verseEnd: 52 }],
        works: [{ source: "cleveland", id: 104139 }]
    },
    {
        id: "baptism", title: "The Baptism of Christ", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 3, verseStart: 13, verseEnd: 17 }, { book: "mark", chapter: 1, verseStart: 9, verseEnd: 11 }, { book: "luke", chapter: 3, verseStart: 21, verseEnd: 22 }, { book: "john", chapter: 1, verseStart: 29, verseEnd: 34 }],
        works: [{ source: "aic", id: 3827 }]
    },
    {
        id: "temptation", title: "The Temptation of Christ", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 4, verseStart: 1, verseEnd: 11 }, { book: "mark", chapter: 1, verseStart: 12, verseEnd: 13 }, { book: "luke", chapter: 4, verseStart: 1, verseEnd: 13 }],
        works: [{ source: "rijks", id: 200144296 }]
    },
    {
        id: "calling-disciples", title: "The Calling of the First Disciples / Miraculous Catch", coverage: "GAP",
        ranges: [{ book: "matthew", chapter: 4, verseStart: 18, verseEnd: 22 }, { book: "mark", chapter: 1, verseStart: 16, verseEnd: 20 }, { book: "luke", chapter: 5, verseStart: 1, verseEnd: 11 }, { book: "john", chapter: 1, verseStart: 35, verseEnd: 51 }],
        works: []
    },
    {
        id: "wedding-cana", title: "The Wedding at Cana", coverage: "DIRECT",
        ranges: [{ book: "john", chapter: 2, verseStart: 1, verseEnd: 11 }],
        works: [{ source: "aic", id: 2166 }, { source: "rijks", id: 200230363 }, { source: "rijks", id: 200428834 }]
    },
    {
        id: "cleansing-temple", title: "Christ Cleanses the Temple", coverage: "DIRECT",
        ranges: [{ book: "john", chapter: 2, verseStart: 13, verseEnd: 22 }, { book: "matthew", chapter: 21, verseStart: 12, verseEnd: 17 }, { book: "mark", chapter: 11, verseStart: 15, verseEnd: 19 }, { book: "luke", chapter: 19, verseStart: 45, verseEnd: 48 }],
        works: [{ source: "rijks", id: 200124928 }]
    },
    {
        id: "nicodemus", title: "Jesus and Nicodemus", coverage: "DIRECT",
        ranges: [{ book: "john", chapter: 3, verseStart: 1, verseEnd: 21 }],
        works: [{ source: "rijks", id: 200148161 }]
    },
    {
        id: "samaritan-woman", title: "Jesus and the Samaritan Woman", coverage: "DIRECT",
        ranges: [{ book: "john", chapter: 4, verseStart: 4, verseEnd: 42 }],
        works: [{ source: "aic", id: 16200 }, { source: "rijks", id: 200124940 }]
    },
    {
        id: "bethesda", title: "The Healing at the Pool of Bethesda", coverage: "DIRECT",
        ranges: [{ book: "john", chapter: 5, verseStart: 1, verseEnd: 9 }],
        works: [{ source: "rijks", id: 200267740 }]
    },
    {
        id: "sermon-mount", title: "The Sermon on the Mount", coverage: "RELATED",
        ranges: [{ book: "matthew", chapter: 5, verseStart: 1, verseEnd: Infinity }, { book: "matthew", chapter: 6, verseStart: 1, verseEnd: Infinity }, { book: "matthew", chapter: 7, verseStart: 1, verseEnd: 29 }],
        works: []
    },
    {
        id: "christ-children", title: "Jesus Blesses the Children", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 19, verseStart: 13, verseEnd: 15 }, { book: "mark", chapter: 10, verseStart: 13, verseEnd: 16 }, { book: "luke", chapter: 18, verseStart: 15, verseEnd: 17 }],
        works: [{ source: "aic", id: 9672 }]
    },
    {
        id: "healing-crowd", title: "Christ Heals and Teaches the Multitude", coverage: "COMPOSITE",
        ranges: [{ book: "matthew", chapter: 8, verseStart: 1, verseEnd: Infinity }, { book: "matthew", chapter: 9, verseStart: 1, verseEnd: Infinity }, { book: "matthew", chapter: 19, verseStart: 1, verseEnd: 15 }],
        works: [{ source: "rijks", id: 200126043 }]
    },
    {
        id: "calming-storm", title: "Christ Calms the Storm", coverage: "GAP",
        ranges: [{ book: "matthew", chapter: 8, verseStart: 23, verseEnd: 27 }, { book: "mark", chapter: 4, verseStart: 35, verseEnd: 41 }, { book: "luke", chapter: 8, verseStart: 22, verseEnd: 25 }],
        works: []
    },
    {
        id: "feeding-multitude", title: "The Multiplication of Loaves and Fishes", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 14, verseStart: 13, verseEnd: 21 }, { book: "matthew", chapter: 15, verseStart: 32, verseEnd: 39 }, { book: "mark", chapter: 6, verseStart: 32, verseEnd: 44 }, { book: "mark", chapter: 8, verseStart: 1, verseEnd: 10 }, { book: "luke", chapter: 9, verseStart: 10, verseEnd: 17 }, { book: "john", chapter: 6, verseStart: 1, verseEnd: 14 }],
        works: [{ source: "rijks", id: 200626632 }, { source: "rijks", id: 200485086 }]
    },
    {
        id: "walking-water", title: "Jesus and Peter Walk on the Water", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 14, verseStart: 22, verseEnd: 33 }, { book: "mark", chapter: 6, verseStart: 45, verseEnd: 52 }, { book: "john", chapter: 6, verseStart: 16, verseEnd: 21 }],
        works: [{ source: "rijks", id: 200179614 }, { source: "rijks", id: 200401646 }]
    },
    {
        id: "transfiguration", title: "The Transfiguration", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 17, verseStart: 1, verseEnd: 8 }, { book: "mark", chapter: 9, verseStart: 2, verseEnd: 8 }, { book: "luke", chapter: 9, verseStart: 28, verseEnd: 36 }],
        works: [{ source: "cleveland", id: 146788 }]
    },
    {
        id: "good-samaritan", title: "The Parable of the Good Samaritan", coverage: "DIRECT",
        ranges: [{ book: "luke", chapter: 10, verseStart: 25, verseEnd: 37 }],
        works: [{ source: "rijks", id: 200107987 }, { source: "rijks", id: 200125033 }]
    },
    {
        id: "mary-martha", title: "Jesus with Mary and Martha", coverage: "DIRECT",
        ranges: [{ book: "luke", chapter: 10, verseStart: 38, verseEnd: 42 }],
        works: [{ source: "rijks", id: 200255893 }]
    },
    {
        id: "prodigal-son", title: "The Parable of the Prodigal Son", coverage: "DIRECT",
        ranges: [{ book: "luke", chapter: 15, verseStart: 11, verseEnd: 32 }],
        works: [{ source: "rijks", id: 200125040 }]
    },
    {
        id: "raising-lazarus", title: "The Raising of Lazarus", coverage: "DIRECT",
        ranges: [{ book: "john", chapter: 11, verseStart: 1, verseEnd: 44 }],
        works: [{ source: "aic", id: 49000 }, { source: "aic", id: 111467 }, { source: "rijks", id: 200124949 }]
    },
    {
        id: "woman-adultery", title: "Jesus and the Woman Taken in Adultery", coverage: "DIRECT",
        ranges: [{ book: "john", chapter: 8, verseStart: 2, verseEnd: 11 }],
        works: [{ source: "rijks", id: 200110644 }, { source: "rijks", id: 200168676 }]
    },
    {
        id: "zacchaeus", title: "Jesus Calls Zacchaeus", coverage: "DIRECT",
        ranges: [{ book: "luke", chapter: 19, verseStart: 1, verseEnd: 10 }],
        works: [{ source: "rijks", id: 2009076 }, { source: "rijks", id: 200396204 }]
    },
    {
        id: "tribute-money", title: "The Tribute Money / Coin in the Fish", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 17, verseStart: 24, verseEnd: 27 }],
        works: [{ source: "rijks", id: 200124921 }]
    },
    {
        id: "anointing-bethany", title: "The Anointing at Bethany", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 26, verseStart: 6, verseEnd: 13 }, { book: "mark", chapter: 14, verseStart: 3, verseEnd: 9 }, { book: "john", chapter: 12, verseStart: 1, verseEnd: 8 }],
        works: [{ source: "rijks", id: 200247822 }]
    },
    {
        id: "entry-jerusalem", title: "The Entry into Jerusalem", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 21, verseStart: 1, verseEnd: 11 }, { book: "mark", chapter: 11, verseStart: 1, verseEnd: 11 }, { book: "luke", chapter: 19, verseStart: 28, verseEnd: 40 }, { book: "john", chapter: 12, verseStart: 12, verseEnd: 19 }],
        works: [{ source: "rijks", id: 200395198 }]
    },
    {
        id: "washing-feet", title: "Christ Washes the Disciples' Feet", coverage: "DIRECT",
        ranges: [{ book: "john", chapter: 13, verseStart: 1, verseEnd: 20 }],
        works: [{ source: "aic", id: 58052 }]
    },
    {
        id: "last-supper", title: "The Last Supper", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 26, verseStart: 17, verseEnd: 30 }, { book: "mark", chapter: 14, verseStart: 12, verseEnd: 26 }, { book: "luke", chapter: 22, verseStart: 7, verseEnd: 23 }, { book: "john", chapter: 13, verseStart: 21, verseEnd: 30 }],
        works: [{ source: "rijks", id: 200536193 }]
    },
    {
        id: "gethsemane", title: "The Agony in the Garden", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 26, verseStart: 36, verseEnd: 46 }, { book: "mark", chapter: 14, verseStart: 32, verseEnd: 42 }, { book: "luke", chapter: 22, verseStart: 39, verseEnd: 46 }],
        works: [{ source: "rijks", id: 200124962 }]
    },
    {
        id: "betrayal-arrest", title: "The Betrayal and Arrest of Jesus", coverage: "COMPOSITE",
        ranges: [{ book: "matthew", chapter: 26, verseStart: 47, verseEnd: 56 }, { book: "mark", chapter: 14, verseStart: 43, verseEnd: 52 }, { book: "luke", chapter: 22, verseStart: 47, verseEnd: 53 }, { book: "john", chapter: 18, verseStart: 1, verseEnd: 12 }],
        works: []
    },
    {
        id: "annas-caiaphas", title: "Jesus before Annas and Caiaphas", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 26, verseStart: 57, verseEnd: 68 }, { book: "mark", chapter: 14, verseStart: 53, verseEnd: 65 }, { book: "luke", chapter: 22, verseStart: 54, verseEnd: 71 }, { book: "john", chapter: 18, verseStart: 12, verseEnd: 24 }],
        works: [{ source: "rijks", id: 200403431 }, { source: "rijks", id: 200403430 }]
    },
    {
        id: "denial-peter", title: "The Denial of Saint Peter", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 26, verseStart: 69, verseEnd: 75 }, { book: "mark", chapter: 14, verseStart: 66, verseEnd: 72 }, { book: "luke", chapter: 22, verseStart: 54, verseEnd: 62 }, { book: "john", chapter: 18, verseStart: 15, verseEnd: 18 }, { book: "john", chapter: 18, verseStart: 25, verseEnd: 27 }],
        works: [{ source: "aic", id: 30901 }, { source: "rijks", id: 200225335 }]
    },
    {
        id: "before-pilate", title: "Jesus before Pilate", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 27, verseStart: 1, verseEnd: 26 }, { book: "mark", chapter: 15, verseStart: 1, verseEnd: 15 }, { book: "luke", chapter: 23, verseStart: 1, verseEnd: 25 }, { book: "john", chapter: 18, verseStart: 28, verseEnd: Infinity }, { book: "john", chapter: 19, verseStart: 1, verseEnd: 16 }],
        works: [{ source: "rijks", id: 200124976 }, { source: "aic", id: 49009 }, { source: "aic", id: 109500 }]
    },
    {
        id: "flagellation", title: "The Flagellation of Christ", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 27, verseStart: 26, verseEnd: 26 }, { book: "mark", chapter: 15, verseStart: 15, verseEnd: 15 }, { book: "john", chapter: 19, verseStart: 1, verseEnd: 1 }],
        works: [{ source: "cleveland", id: "current-rosarium-flagellation" }]
    },
    {
        id: "crowning-ecce-homo", title: "The Crowning with Thorns / Ecce Homo", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 27, verseStart: 27, verseEnd: 31 }, { book: "mark", chapter: 15, verseStart: 16, verseEnd: 20 }, { book: "john", chapter: 19, verseStart: 2, verseEnd: 5 }],
        works: [{ source: "cleveland", id: 102535 }, { source: "cleveland", id: 164752 }, { source: "cleveland", id: 104612 }]
    },
    {
        id: "carrying-cross", title: "Christ Carrying the Cross", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 27, verseStart: 31, verseEnd: 34 }, { book: "mark", chapter: 15, verseStart: 20, verseEnd: 23 }, { book: "luke", chapter: 23, verseStart: 26, verseEnd: 32 }, { book: "john", chapter: 19, verseStart: 16, verseEnd: 17 }],
        works: [{ source: "aic", id: 234781 }]
    },
    {
        id: "crucifixion", title: "The Crucifixion", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 27, verseStart: 35, verseEnd: 56 }, { book: "mark", chapter: 15, verseStart: 24, verseEnd: 41 }, { book: "luke", chapter: 23, verseStart: 33, verseEnd: 49 }, { book: "john", chapter: 19, verseStart: 18, verseEnd: 37 }],
        works: [{ source: "cleveland", id: 112856 }, { source: "aic", id: 80084 }, { source: "aic", id: 111622 }, { source: "rijks", id: 200109302 }]
    },
    {
        id: "descent-lamentation", title: "The Descent from the Cross and Lamentation", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 27, verseStart: 57, verseEnd: 58 }, { book: "mark", chapter: 15, verseStart: 42, verseEnd: 45 }, { book: "luke", chapter: 23, verseStart: 50, verseEnd: 53 }, { book: "john", chapter: 19, verseStart: 38, verseEnd: 38 }],
        works: [{ source: "rijks", id: 20027041 }, { source: "rijks", id: 2004499 }, { source: "rijks", id: 200109204 }, { source: "cleveland", id: 94846 }]
    },
    {
        id: "entombment", title: "The Entombment of Christ", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 27, verseStart: 57, verseEnd: 61 }, { book: "mark", chapter: 15, verseStart: 42, verseEnd: 47 }, { book: "luke", chapter: 23, verseStart: 50, verseEnd: 56 }, { book: "john", chapter: 19, verseStart: 38, verseEnd: 42 }],
        works: [{ source: "aic", id: 86323 }, { source: "aic", id: 29120 }, { source: "rijks", id: 20027024 }, { source: "rijks", id: 20013267 }]
    },
    {
        id: "resurrection", title: "The Resurrection / Empty Tomb", coverage: "DIRECT",
        ranges: [{ book: "matthew", chapter: 28, verseStart: 1, verseEnd: 10 }, { book: "mark", chapter: 16, verseStart: 1, verseEnd: 8 }, { book: "luke", chapter: 24, verseStart: 1, verseEnd: 12 }, { book: "john", chapter: 20, verseStart: 1, verseEnd: 18 }],
        works: [{ source: "cleveland", id: 78982 }, { source: "cleveland", id: 159717 }, { source: "rijks", id: 200109462 }, { source: "cleveland", id: 133419 }]
    },
    {
        id: "noli-me-tangere", title: "Christ Appears to Mary Magdalene / Noli me tangere", coverage: "DIRECT",
        ranges: [{ book: "john", chapter: 20, verseStart: 11, verseEnd: 18 }],
        works: [{ source: "aic", id: 16207 }, { source: "cleveland", id: 134264 }]
    },
    {
        id: "emmaus", title: "The Road to and Supper at Emmaus", coverage: "DIRECT",
        ranges: [{ book: "luke", chapter: 24, verseStart: 13, verseEnd: 35 }],
        works: [{ source: "cleveland", id: 106440 }, { source: "rijks", id: 20026350 }, { source: "rijks", id: 200125018 }]
    },
    {
        id: "appearance-apostles", title: "Christ Appears to the Apostles behind Locked Doors", coverage: "DIRECT",
        ranges: [{ book: "luke", chapter: 24, verseStart: 36, verseEnd: 49 }, { book: "john", chapter: 20, verseStart: 19, verseEnd: 23 }],
        works: [{ source: "rijks", id: 200125028 }, { source: "rijks", id: 200392481 }]
    },
    {
        id: "doubting-thomas", title: "The Incredulity of Thomas", coverage: "DIRECT",
        ranges: [{ book: "john", chapter: 20, verseStart: 24, verseEnd: 29 }],
        works: [{ source: "rijks", id: 200178954 }]
    },
    {
        id: "sea-tiberias", title: "The Appearance at the Sea of Tiberias / Miraculous Catch", coverage: "GAP",
        ranges: [{ book: "john", chapter: 21, verseStart: 1, verseEnd: 14 }],
        works: []
    },
    {
        id: "ascension", title: "The Ascension", coverage: "DIRECT",
        ranges: [{ book: "mark", chapter: 16, verseStart: 19, verseEnd: 20 }, { book: "luke", chapter: 24, verseStart: 50, verseEnd: 53 }, { book: "acts", chapter: 1, verseStart: 6, verseEnd: 11 }],
        works: [{ source: "cleveland", id: 130151 }, { source: "aic", id: 16313 }, { source: "rijks", id: 200397609 }, { source: "rijks", id: 200194093 }]
    }
].map(Object.freeze));

/**
 * The pericope whose range contains (book, chapter, verse), or null.
 * When episodes nest or adjoin (the flagellation within the Pilate
 * scene, Noli me tangere within the resurrection), the NARROWEST
 * containing range wins — the most specific episode the reader is in.
 * Most of a Gospel is not a mapped episode; null is the common,
 * correct case (-> stillness). Pure; no side effects.
 */
export function pericopeForVerse(book, chapter, verse) {
    if (!book || !Number.isInteger(chapter) || !Number.isInteger(verse)) return null;
    let best = null;
    let bestSpan = Infinity;
    for (const p of GOSPEL_PERICOPES) {
        for (const r of p.ranges) {
            if (r.book === book && r.chapter === chapter
                && verse >= r.verseStart && verse <= r.verseEnd) {
                const span = r.verseEnd - r.verseStart;
                if (span < bestSpan) { bestSpan = span; best = p; }
            }
        }
    }
    return best;
}
