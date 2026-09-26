if (typeof process.env.OPENROUTER_API_KEY !== 'string' || !process.env.OPENROUTER_API_KEY.trim()) {
    console.error('Production deploy requires OPENROUTER_API_KEY in Netlify Builds and Functions scopes.');
    process.exitCode = 1;
}
