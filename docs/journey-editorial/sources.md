# Source evidence for *Heaven and Household*

Status: editorial draft. These records establish exact passage locations and
checksums against committed payloads; they are not editorial approval or a
claim of edition certification.

| Work and edition | Source-defined unit | Disclosed excerpt | Words | Excerpt SHA-256 |
| --- | --- | --- | ---: | --- |
| John Milton, *Paradise Lost*, Standard Ebooks (1667), `paradise-lost` | Book VI | `He on his impious foes right onward drove` → `Unquenchable, the house of woe and pain.` | 348 | `48673a215f0d1763359b327bbeeb344f96cab3264bb4059f601ea75edfd12713` |
| Homer, *The Iliad*, William Cullen Bryant translation, Standard Ebooks (1870), `the-iliad` | `Book VI: Interviews Between Glaucus and Diomed, and Hector and Andromache` | `Too brave! Thy valor yet will cause thy death.` → `I hear thy cries as thou art borne away!` | 556 | `15f5cc1f77ce283b8e7f6d7224786dffb9a96a32c820b1a00961efc3a7849942` |

The anchors and word counts were checked against the generated local payload
sections in [Paradise Lost](../../src/content/archive/works/paradise-lost.js)
and [The Iliad](../../src/content/archive/works/the-iliad.js), then resolved
with the same excerpt resolver used by Journeys. Each checksum covers the
excerpted passage. The two passages total 904 words, about 4.5 minutes at 200
words per minute; the score estimates five minutes. The Milton route starts
inside the Son's charge and ends with Hell closing over the fallen host. The
Homer route starts at the opening of Andromache's warning and includes her
recalled losses, Hector's resolve and prediction, and his final fear for her.
It ends at a full sentence, before the poem changes to the next scene.

## Full selected passages

### Milton, Book VI

```text
He on his impious foes right onward drove,
Gloomy as night; under his burning wheels
The steadfast Empyrean shook throughout,
All but the throne itself of God. Full soon
Among them he arrived, in his right hand
Grasping ten thousand thunders, which he sent
Before him, such as in their souls infixed
Plagues; they, astonished, all resistance lost,
All courage; down their idle weapons dropt;
O’er shields, and helms, and helmed heads he rode
Of Thrones and mighty Seraphim prostrate,
That wished the mountains now might be again
Thrown on them, as a shelter from his ire.
Nor less on either side tempestuous fell
His arrows, from the fourfold-visaged Four,
Distinct with eyes, and from the living wheels,
Distinct alike with multitude of eyes;
One spirit in them ruled, and every eye
Glared lightning, and shot forth pernicious fire
Among the accursed, that withered all their strength,
And of their wonted vigour left them drained,
Exhausted, spiritless, afflicted, fallen.
Yet half his strength he put not forth, but checked
His thunder in mid-volley; for he meant
Not to destroy, but root them out of Heaven.
The overthrown he raised, and, as a herd
Of goats or timorous flock together thronged,
Drove them before him thunderstruck, pursued
With terrors and with furies to the bounds
And crystal wall of Heaven; which, opening wide,
Rolled inward, and a spacious gap disclosed
Into the wasteful deep. The monstrous sight
Strook them with horror backward, but far worse
Urged them behind; headlong themselves they threw
Down from the verge of Heaven; eternal wrath
Burned after them to the bottomless pit.

“Hell heard the unsufferable noise; Hell saw
Heaven ruining from Heaven, and would have fled
Affrighted; but strict Fate had cast too deep
Her dark foundations, and too fast had bound.
Nine days they fell; confounded Chaos roared,
And felt tenfold confusion in their fall
Through his wild anarchy; so huge a rout
Encumbered him with ruin. Hell at last,
Yawning, received them whole, and on them closed;
Hell, their fit habitation, fraught with fire
Unquenchable, the house of woe and pain.
```

Context: this route opens in the middle of the battle after the Son has taken
the field; it closes the book's account of the rebels' expulsion. The route is
an excerpt from Book VI, not a claim to represent the whole book.

### Bryant, *The Iliad*, Book VI

```text
Too brave! Thy valor yet will cause thy death.
Thou hast no pity on thy tender child,
Nor me, unhappy one, who soon must be
Thy widow. All the Greeks will rush on thee
To take thy life. A happier lot were mine,
If I must lose thee, to go down to earth,
For I shall have no hope when thou art gone⁠—
Nothing but sorrow. Father have I none,
And no dear mother. Great Achilles slew
My father when he sacked the populous town
Of the Cilicians⁠—Thebé with high gates.
’Twas there he smote Eëtion, yet forbore
To make his arms a spoil; he dared not that,
But burned the dead with his bright armor on,
And raised a mound above him. Mountain-nymphs,
Daughters of aegis-bearing Jupiter,
Came to the spot and planted it with elms.
Seven brothers had I in my father’s house,
And all went down to Hades in one day.
Achilles the swift-footed slew them all
Among their slow-paced bullocks and white sheep.
My mother, princess on the woody slopes
Of Placos, with his spoils he bore away,
And only for large ransom gave her back.
But her Diana, archer-queen, struck down
Within her father’s palace. Hector, thou
Art father and dear mother now to me,
And brother and my youthful spouse besides.
In pity keep within the fortress here,
Nor make thy child an orphan nor thy wife
A widow. Post thine army near the place
Of the wild fig-tree, where the city-walls
Are low and may be scaled. Thrice in the war
The boldest of the foe have tried the spot⁠—
The Ajaces and the famed Idomeneus,
The two chiefs born to Atreus, and the brave
Tydides, whether counselled by some seer
Or prompted to the attempt by their own minds.”

Then answered Hector, great in war: “All this
I bear in mind, dear wife; but I should stand
Ashamed before the men and long-robed dames
Of Troy, were I to keep aloof and shun
The conflict, coward-like. Not thus my heart
Prompts me, for greatly have I learned to dare
And strike among the foremost sons of Troy,
Upholding my great father’s fame and mine;
Yet well in my undoubting mind I know
The day shall come in which our sacred Troy,
And Priam, and the people over whom
Spear-bearing Priam rules, shall perish all.
But not the sorrows of the Trojan race,
Nor those of Hecuba herself, nor those
Of royal Priam, nor the woes that wait
My brothers many and brave⁠—who all at last,
Slain by the pitiless foe, shall lie in dust⁠—
Grieve me so much as thine, when some mailed Greek
Shall lead thee weeping hence, and take from thee
Thy day of freedom. Thou in Argos then
Shalt, at another’s bidding, ply the loom,
And from the fountain of Messeis draw
Water, or from the Hypereian spring,
Constrained unwilling by thy cruel lot.
And then shall someone say who sees thee weep,
‘This was the wife of Hector, most renowned
Of the horse-taming Trojans, when they fought
Around their city.’ So shall someone say,
And thou shalt grieve the more, lamenting him
Who haply might have kept afar the day
Of thy captivity. O, let the earth
Be heaped above my head in death before
I hear thy cries as thou art borne away!
```

Context: this is Bryant's version of the Scaean Gate meeting in Book VI. The
next lines begin a new beat: Hector embraces his child, returns his helmet to
his head, and leaves; the poem then follows Paris. The draft stops at Hector's
complete sentence about Andromache's imagined captivity.

## Availability and prior score

The committed release policy currently serves uncertified candidate works
(`RELEASE_SERVES_UNCERTIFIED` is true in
[the Archive registry](../../src/content/archive/index.js)). Matching a
committed payload proves source identity, not human certification.

The existing *War* score is not repaired here. It estimates 24 minutes, while
its prose says the experience takes 75 minutes; its final movement also cites
*The Storm of Steel*, withheld by the canonical policy pending source and
edition review. The Iliad excerpts already in that score use anchors absent
from Bryant's Book VI. The old Milton excerpt in the demonstration uses
`terrour`, while the canonical payload reads `terror`. These are distinct
source problems: reanchoring does not clear the Jünger gate.

Relevant policy and score references: [Journey specification](../vision/JOURNEYS-SPEC.md)
§§1.3–1.5, 2.4, and 10; [canonical-source policy](../specs/ARCHIVE-CANON-SPEC.md)
§§5 and 8; [War score](../../src/content/journeys/war.js); [demonstration
score](../../src/content/journeys/demo.js).
