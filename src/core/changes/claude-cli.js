/**
 * ask({ system, prompt, model }) through the Claude Code CLI in print mode,
 * because the repository's only model credential is CLAUDE_CODE_OAUTH_TOKEN
 * (https://code.claude.com/docs/en/authentication#generate-a-long-lived-token).
 *
 * The CLI answers once, with no tools, no MCP servers, no slash commands and
 * no saved session (https://code.claude.com/docs/en/headless,
 * https://code.claude.com/docs/en/cli-reference). The token reaches the child
 * only through its environment: never argv, stdin, a file or a log line, and
 * any echo of it in the CLI's output is redacted before it is logged or thrown.
 * Spawning is the caller's `run`, so tests inject a fake process.
 */

export const SYSTEM_PROMPT_FILE = 'system-prompt.txt';
const TOKEN_NAME = 'CLAUDE_CODE_OAUTH_TOKEN';
const MAX_STDOUT = 4 * 1024 * 1024;
const MAX_LOGGED = 600;

/** What the child may see of this process's environment: enough to run, and the one credential it needs. */
const PASSED = ['PATH', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TMPDIR', 'TEMP', 'TMP', 'SYSTEMROOT', 'LANG', 'LC_ALL', TOKEN_NAME];

/** The CLI's arguments for one answer; the system prompt is a file in the child's working directory. */
export function claudeArgs({ model }) {
  if (typeof model !== 'string' || !/^[a-z0-9][a-z0-9.-]*$/.test(model)) throw new Error('The model must be a model name');
  return [
    '-p',
    '--output-format', 'json',
    '--model', model,
    '--max-turns', '1',
    '--tools', '',
    '--disallowedTools', 'mcp__*',
    '--strict-mcp-config',
    '--disable-slash-commands',
    '--no-session-persistence',
    '--permission-mode', 'dontAsk',
    '--system-prompt-file', SYSTEM_PROMPT_FILE
  ];
}

export function childEnv(env) {
  if (typeof env[TOKEN_NAME] !== 'string' || !env[TOKEN_NAME]) throw new Error(`${TOKEN_NAME} is not set; the composer cannot run`);
  const child = {};
  for (const name of PASSED) if (typeof env[name] === 'string') child[name] = env[name];
  child.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1';
  return child;
}

/** The answer text of a successful print-mode run's JSON; anything else throws. */
export function readClaudeResult(stdout) {
  if (typeof stdout !== 'string' || stdout.length > MAX_STDOUT) throw new Error('The CLI wrote no readable output');
  let value;
  try {
    value = JSON.parse(stdout);
  } catch {
    throw new Error('The CLI output is not JSON');
  }
  const result = Array.isArray(value) ? value.findLast(message => message?.type === 'result') : value;
  if (result?.type !== 'result') throw new Error('The CLI output has no result');
  if (result.is_error !== false || result.subtype !== 'success') throw new Error(`The CLI run failed: ${String(result.subtype).slice(0, 60)}`);
  if (typeof result.result !== 'string') throw new Error('The CLI result is not text');
  return result.result;
}

export function createAsk({ run, env, log }) {
  const secret = env[TOKEN_NAME];
  const redact = text => {
    const line = String(text ?? '');
    return (secret ? line.split(secret).join('[redacted]') : line).slice(0, MAX_LOGGED);
  };
  return async function ask({ system, prompt, model }) {
    const { code, stdout, stderr } = await run({
      command: 'claude',
      args: claudeArgs({ model }),
      input: prompt,
      files: { [SYSTEM_PROMPT_FILE]: system },
      env: childEnv(env)
    });
    let text;
    try {
      text = readClaudeResult(stdout);
    } catch (error) {
      if (stderr) log(`claude stderr: ${redact(stderr)}`);
      if (typeof stdout === 'string' && stdout) log(`claude stdout: ${redact(stdout)}`);
      throw new Error(redact(`${error.message} (exit ${code})`));
    }
    if (code !== 0) {
      if (stderr) log(`claude stderr: ${redact(stderr)}`);
      throw new Error(`The CLI exited with ${code}`);
    }
    return text;
  };
}
