import { describe, expect, it } from 'vitest';
import { publicRepositoryProblems, repositoryNameProblems, requirePublicRepository } from './repository.js';

const REFUSAL = 'The repository is not public, so the run stops before reading it';

describe('repositoryNameProblems', () => {
  it('accepts an owner and a name', () => {
    expect(repositoryNameProblems('SyberLabs/RISE')).toBeNull();
    expect(repositoryNameProblems('a/b')).toBeNull();
  });

  it('refuses a URL, a second path, a parent segment, and a name that is not owner/name', () => {
    for (const name of [
      'SyberLabs/RISE/extra',
      'https://github.com/SyberLabs/RISE',
      '../RISE',
      'SyberLabs/../RISE',
      'SyberLabs/RISE.git',
      'SyberLabs/..',
      'SyberLabs/.',
      '-lab/RISE',
      'lab-/RISE',
      'owner/name name',
      'SyberLabs\\RISE',
      '',
      'SyberLabs',
      '/RISE'
    ]) {
      expect(repositoryNameProblems(name), name).toMatch(/owner\/name/);
    }
  });
});

describe('publicRepositoryProblems', () => {
  const repo = 'SyberLabs/RISE';
  const record = { full_name: repo, private: false, visibility: 'public' };

  it('accepts a repository GitHub calls public', () => {
    expect(publicRepositoryProblems(repo, record)).toBeNull();
  });

  it('refuses private, internal, a missing or mistyped flag, a different name, and anything that is not the record', () => {
    expect(publicRepositoryProblems(repo, { ...record, private: true, visibility: 'private' })).toBe(REFUSAL);
    expect(publicRepositoryProblems(repo, { ...record, visibility: 'internal' })).toBe(REFUSAL);
    expect(publicRepositoryProblems(repo, { full_name: repo, visibility: 'public' })).toBe(REFUSAL);
    expect(publicRepositoryProblems(repo, { ...record, private: 'false' })).toBe(REFUSAL);
    expect(publicRepositoryProblems(repo, { ...record, full_name: 'Other/RISE' })).toMatch(/different repository/);
    expect(publicRepositoryProblems(repo, null)).toMatch(/did not return/);
    expect(publicRepositoryProblems(repo, [])).toMatch(/did not return/);
  });
});

describe('requirePublicRepository', () => {
  const repo = 'SyberLabs/RISE';

  it('asks GitHub for that repository and only that repository', async () => {
    const calls = [];
    const gh = async args => {
      calls.push(args);
      return JSON.stringify({ full_name: repo, private: false, visibility: 'public' });
    };
    await requirePublicRepository(gh, repo);
    expect(calls).toEqual([['api', '--method', 'GET', 'repos/SyberLabs/RISE']]);
  });

  it('refuses a name that is not owner/name before asking GitHub', async () => {
    const gh = async () => { throw new Error('GitHub was asked'); };
    await expect(requirePublicRepository(gh, 'https://github.com/SyberLabs/RISE')).rejects.toThrow(/owner\/name/);
  });

  it('refuses a private repository, an error, a non-JSON body, and a body past the cap, with no detail from the response', async () => {
    const secret = 'ghs_this-must-not-appear';
    const cases = [
      async () => JSON.stringify({ full_name: repo, private: true, visibility: 'private', token: secret }),
      async () => { throw new Error(`gh failed ${secret}`); },
      async () => `not json ${secret}`,
      async () => 'x'.repeat((128 * 1024) + 1)
    ];
    for (const gh of cases) {
      await expect(requirePublicRepository(gh, repo)).rejects.toThrow(REFUSAL);
      await expect(requirePublicRepository(gh, repo)).rejects.not.toThrow(/ghs_|not json|x{20}/);
    }
  });
});
