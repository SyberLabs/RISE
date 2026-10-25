/**
 * Reads a pinned plate catalog (src/sources/visual/<book>-catalog.generated.json)
 * into a picture work's units: one per plate, in plate order. A unit is its
 * plate's title line, the sentence that places the plate in its book, and
 * what the catalog took from Commons about it: the organisms its figures
 * show, one to a line, or the file's note. Nothing else is written.
 *
 * Imported only by scripts/school-ingest.mjs.
 */

const countWords = text => String(text).split(/\s+/u).filter(Boolean).length;

export function readPlates(text, recipe) {
    const { plates } = JSON.parse(text);
    let sourceWords = 0;
    const parts = plates.map((plate, index) => {
        if (plate.plate !== index + 1) throw new Error(`plate ${index + 1} is missing; the catalog has ${plate.plate} there`);
        const name = `Tafel ${plate.plate} · ${plate.title}`;
        const titleLine = plate.genus ? `${name} · ${plate.genus}` : name;
        const said = [...plate.organisms, ...(plate.note ? [plate.note] : [])];
        sourceWords += countWords([plate.title, plate.genus ?? '', ...said].join(' '));
        const content = [titleLine, `Plate ${plate.plate} of ${recipe.book}, ${recipe.year}.`, ...(said.length ? [said.join('\n')] : [])]
            .join('\n\n');
        return { name, content, verse: false, lines: 0 };
    });
    // Every catalog word read is carried; the fixed words of each unit are the reader's, not the source's.
    return { parts, sourceWords, importedWords: sourceWords, dropped: {}, groups: [] };
}
