process.env.NODE_ENV = 'test';
process.env.GROQ_API_KEY = 'fake-key';
process.env.GITHUB_TOKEN = 'fake-token';

const request = require('supertest');
const app = require('../src/index');

jest.mock('fs/promises');
jest.mock('simple-git', () => {
  return () => ({
    clone: jest.fn().mockResolvedValue()
  });
});
jest.mock('node-fetch', () => jest.fn());
const fetch = require('node-fetch');

const fs = require('fs/promises');

class FakeDirent {
  constructor(name, isDir = false) {
    this.name = name;
    this._isDir = isDir;
  }
  isDirectory() {
    return this._isDir;
  }
}

fetch.mockImplementation((url) => {
  if (url.endsWith('/branches')) {
    return Promise.resolve({
      ok: true,
      json: async () => [{ name: 'main' }]
    });
  }

  if (url.endsWith('/actions/workflows')) {
    return Promise.resolve({
      ok: true,
      json: async () => ({ workflows: [{ name: 'CI Workflow' }] })
    });
  }

  if (url.includes('/commits')) {
    return Promise.resolve({
      ok: true,
      json: async () => [{
        sha: 'abc123',
        commit: {
          message: 'Initial commit',
          author: { name: 'Moi', date: '2024-01-01' }
        }
      }]
    });
  }

  if (url.includes('groq.com')) {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Analyse IA simulée avec succès." } }]
      })
    });
  }

  return Promise.resolve({
    ok: true,
    json: async () => ({})
  });
});

describe('POST /analyze-repo-with-ai', () => {

  it('retourne une erreur si aucune URL n’est fournie', async () => {
    const res = await request(app).post('/analyze-repo-with-ai').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/gitHubRepoUrl/i);
  });

  it('retourne une analyse simulée', async () => {
    fs.readdir.mockResolvedValue([new FakeDirent('fichier.js', false)]);
    fs.readFile.mockResolvedValue('du code');
    fs.access.mockResolvedValue();
    fs.mkdir.mockResolvedValue();
    fs.rm.mockResolvedValue();

    const res = await request(app)
      .post('/analyze-repo-with-ai')
      .send({ gitHubRepoUrl: 'https://github.com/fake/repo' });

    expect(res.status).toBe(200);
    expect(res.body.aiAnalysis).toContain('Analyse IA simulée');
  });

});
