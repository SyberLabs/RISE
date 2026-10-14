import { describe, expect, it } from 'vitest';
import { SYSTEM_PROMPT_FILE, childEnv, claudeArgs, createAsk, readClaudeResult } from './claude-cli.js';

const TOKEN = 'sk-ant-oat01-SECRET-test-token-value';
const MODEL = 'claude-sonnet-5-5';
const env = {
  CLAUDE_CODE_OAUTH_TOKEN: TOKEN, PATH: '/usr/bin', HOME: '/home/runner',
  GH_TOKEN: 'ghs_github', GITHUB_TOKEN: 'ghs_github', ANTHROPIC_API_KEY: 'sk-ant-api', AWS_SECRET_ACCESS_KEY: 'aws'
};
const success = result => JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result, session_id: 's', total_cost_usd: 0.01 });

describe('claudeArgs', () => {
  it('runs one print-mode turn with no tools, no MCP, no commands and no saved session', () => {
    const args = claudeArgs({ model: MODEL });
    expect(args.slice(0, 1)).toEqual(['-p']);
    const value = flag => args[args.indexOf(flag) + 1];
    expect(value('--output-format')).toBe('json');
    expect(value('--model')).toBe(MODEL);
    expect(value('--max-turns')).toBe('1');
    expect(value('--tools')).toBe('');
    expect(value('--disallowedTools')).toBe('mcp__*');
    expect(value('--system-prompt-file')).toBe(SYSTEM_PROMPT_FILE);
    expect(value('--permission-mode')).toBe('dontAsk');
    for (const flag of ['--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence']) expect(args).toContain(flag);
  });

  it('refuses a model name that could be read as a flag', () => {
    expect(() => claudeArgs({ model: '--dangerously-skip-permissions' })).toThrow(/model/);
  });
});

describe('childEnv', () => {
  it('passes the Claude token through the environment and leaves every other credential behind', () => {
    const child = childEnv(env);
    expect(child.CLAUDE_CODE_OAUTH_TOKEN).toBe(TOKEN);
    expect(child.PATH).toBe('/usr/bin');
    expect(child.HOME).toBe('/home/runner');
    for (const name of ['GH_TOKEN', 'GITHUB_TOKEN', 'ANTHROPIC_API_KEY', 'AWS_SECRET_ACCESS_KEY']) expect(child).not.toHaveProperty(name);
    expect(child.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBe('1');
  });

  it('refuses to run without the token', () => {
    expect(() => childEnv({ PATH: '/usr/bin' })).toThrow(/CLAUDE_CODE_OAUTH_TOKEN/);
  });
});

describe('readClaudeResult', () => {
  it('reads the result text of a successful run', () => {
    expect(readClaudeResult(success('{"a":1}'))).toBe('{"a":1}');
  });

  it('reads the last result of an array of messages', () => {
    expect(readClaudeResult(JSON.stringify([{ type: 'system' }, JSON.parse(success('hi'))]))).toBe('hi');
  });

  it('refuses an error result, a non-JSON stdout, and a result that is not text', () => {
    expect(() => readClaudeResult(JSON.stringify({ type: 'result', subtype: 'error_max_turns', is_error: true, result: '' }))).toThrow(/error_max_turns/);
    expect(() => readClaudeResult('Invalid API key')).toThrow(/not JSON/);
    expect(() => readClaudeResult(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 3 }))).toThrow(/result/);
  });
});

describe('createAsk', () => {
  const fakeRun = outcome => {
    const calls = [];
    const run = async request => { calls.push(request); return typeof outcome === 'function' ? outcome(request) : outcome; };
    return { run, calls };
  };

  it('sends the prompt on stdin and the system prompt as a file, and returns the text', async () => {
    const { run, calls } = fakeRun({ code: 0, stdout: success('answer'), stderr: '' });
    const ask = createAsk({ run, env, log: () => {} });
    expect(await ask({ system: 'You route.', prompt: 'The pull requests.', model: MODEL })).toBe('answer');
    expect(calls[0].command).toBe('claude');
    expect(calls[0].input).toBe('The pull requests.');
    expect(calls[0].files).toEqual({ [SYSTEM_PROMPT_FILE]: 'You route.' });
    expect(calls[0].args).toEqual(claudeArgs({ model: MODEL }));
  });

  it('never puts the token in argv, stdin or the files it writes', async () => {
    const { run, calls } = fakeRun({ code: 0, stdout: success('ok'), stderr: '' });
    await createAsk({ run, env, log: () => {} })({ system: 's', prompt: 'p', model: MODEL });
    const { env: childEnvironment, ...visible } = calls[0];
    expect(JSON.stringify(visible)).not.toContain(TOKEN);
    expect(childEnvironment.CLAUDE_CODE_OAUTH_TOKEN).toBe(TOKEN);
    expect(childEnvironment).not.toHaveProperty('GH_TOKEN');
  });

  it('redacts the token if the CLI ever echoes it, in the error and in the log', async () => {
    const { run } = fakeRun({ code: 1, stdout: JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true, result: `bad token ${TOKEN}` }), stderr: `auth ${TOKEN} refused` });
    const lines = [];
    const ask = createAsk({ run, env, log: line => lines.push(line) });
    const error = await ask({ system: 's', prompt: 'p', model: MODEL }).catch(caught => caught);
    expect(error).toBeInstanceOf(Error);
    expect(String(error.message)).not.toContain(TOKEN);
    expect(lines.join('\n')).not.toContain(TOKEN);
    expect(lines.join('\n') + error.message).toContain('[redacted]');
  });

  it('fails on a non-zero exit even with a success result', async () => {
    const { run } = fakeRun({ code: 2, stdout: success('x'), stderr: '' });
    await expect(createAsk({ run, env, log: () => {} })({ system: 's', prompt: 'p', model: MODEL })).rejects.toThrow(/exited with 2/);
  });
});
