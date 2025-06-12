const request = require('supertest');
const app = require('../src/index');

jest.mock('fs/promises');
jest.mock('simple-git', () => {
  return () => ({
    clone: jest.fn().mockResolvedValue()
  });
});

const fs = require('fs/promises');

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    choices: [
      {
        message: { content: "Analyse IA simulée avec succès." }
      }
    ]
  }),
});

describe('POST /analyze-repo-with-ai', () => {

  it('retourne une erreur si aucune URL n’est fournie', async () => {
    const res = await request(app).post('/analyze-repo-with-ai').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/gitHubRepoUrl/i);
  });

  it('retourne une analyse simulée', async () => {
    fs.readdir.mockResolvedValue([
      { name: 'fichier.js', isDirectory: () => false }
    ]);
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
