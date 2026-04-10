const factory = require('./node_modules/ggwave/ggwave.js');

async function test() {
    console.log('Loading ggwave...');
    const ggwave = await factory();
    console.log('ggwave loaded');
    const params = ggwave.getDefaultParameters();
    console.log('Default params:', params);
    const instance = ggwave.init(params);
    const payload = 'hello';
    const waveform = ggwave.encode(instance, payload, 1, 10);
    console.log('Waveform length:', waveform.length);
    const decoded = ggwave.decode(instance, waveform);
    console.log('Decoded:', decoded);
    console.log('Success?', decoded === payload);
}

test().catch(console.error);