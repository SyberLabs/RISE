export function renderScoreCanvas(view) {
  return `
    <main class="studio-pane studio-score-canvas" aria-labelledby="studio-score-title" data-studio-pane="score">
      <div class="studio-canvas-heading">
        <div><span class="studio-eyebrow">Media Score</span><h2 id="studio-score-title">Compose against the text</h2></div>
      </div>
      ${view.scoreHtml}
    </main>`;
}
