const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const html = readFileSync(process.env.PHONEVOX_HTML || require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
function harness() {
  const context = {
    SR: function () { this.start = () => this.onstart(); this.stop = () => {}; },
    rec: null, wantListen: false, restarts: 0,
    sourceSel: { value: 'fr-FR' }, ta: { value: '' },
    interim: { textContent: '' }, counter: {},
    micBtn: { classList: { toggle() {} }, setAttribute() {} },
    micCaption: {}, save() {}, toast() {}, setTimeout(fn) { context.restart = fn; }
  };
  vm.createContext(context);
  vm.runInContext(html.slice(html.indexOf('  function setLive('), html.indexOf('  /* ---------- traduction')), context);
  context.startMic();
  return context;
}
function result(text, final = true) { return { 0: { transcript: text }, isFinal: final }; }
function emit(c, index, results) { c.rec.onresult({ resultIndex: index, results }); }
test('replayed final events are committed once', () => {
  const c = harness();
  for (let i = 0; i < 3; i++) emit(c, 0, [result('Bonjour tout le monde.')]);
  assert.equal(c.ta.value, 'Bonjour tout le monde.');
});
test('backward resultIndex does not duplicate earlier phrases', () => {
  const c = harness();
  emit(c, 0, [result('Bonjour.')]);
  emit(c, 0, [result('Bonjour.'), result('Comment allez-vous ?')]);
  assert.equal(c.ta.value, 'Bonjour. Comment allez-vous ?');
});
test('interim revisions stay separate until final', () => {
  const c = harness();
  emit(c, 0, [result('bon', false)]);
  emit(c, 0, [result('bonjour', false)]);
  assert.equal(c.ta.value, '');
  assert.equal(c.interim.textContent, 'bonjour');
  emit(c, 0, [result('Bonjour.')]);
  emit(c, 0, [result('Bonjour.')]);
  assert.equal(c.ta.value, 'Bonjour.');
  assert.equal(c.interim.textContent, '');
});
test('intentional repeated words and phrases remain', () => {
  const c = harness();
  emit(c, 0, [result('oui oui')]);
  emit(c, 1, [result('oui oui'), result('oui oui')]);
  assert.equal(c.ta.value, 'oui oui oui oui');
});
test('automatic restart resets result indexes and preserves text', () => {
  const c = harness();
  emit(c, 0, [result('Bonjour.')]);
  c.rec.onend();
  c.restart();
  emit(c, 0, [result('Bonjour.')]);
  emit(c, 0, [result('Bonjour.')]);
  assert.equal(c.ta.value, 'Bonjour. Bonjour.');
});
test('manual restart resets result indexes', () => {
  const c = harness();
  emit(c, 0, [result('Un.')]);
  c.stopMic();
  c.startMic();
  emit(c, 0, [result('Deux.')]);
  assert.equal(c.ta.value, 'Un. Deux.');
});
test('editing or clearing text does not reinsert committed results', () => {
  const c = harness();
  emit(c, 0, [result('Bonjour.')]);
  c.ta.value = '';
  emit(c, 0, [result('Bonjour.'), result('Suite.')]);
  assert.equal(c.ta.value, 'Suite.');
});
