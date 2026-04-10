# Audio QR Clipboard Share

Share clipboard text between devices using QR code and audio handshake (WebRTC data channel).

## How it works

1. **Host** generates a WebRTC offer, displayed as a QR code.
2. **Guest** scans the QR code with camera, receives the offer.
3. Guest creates a WebRTC answer, encodes it as audio (using quiet.js ultrasonic transmission).
4. Host listens with microphone, decodes the audio answer, sets remote description.
5. WebRTC connection established; data channel opens.
6. Clipboard text can be sent manually via a text box.

## Project Structure

- `index.html` – Main interface
- `css/style.css` – Styling
- `js/app.js` – Application logic
- `lib/quiet.js` – Bundled quiet-js library (data-over-sound)
- Dependencies (loaded via CDN):
  - QRCode.js
  - html5-qrcode
  - WebRTC adapter

## Setup

No build step required. Just open `index.html` in a modern browser (Chrome/Edge) with microphone and camera permissions.

1. Clone the repository or download the files.
2. Open `index.html` in a browser.
3. Allow camera access for QR scanning and microphone access for audio handshake.

## Usage

### Host (sender)
1. Click "Be Host (Generate QR)".
2. Click "Generate Offer & QR". Show the QR code to the guest.
3. After guest scans, click "Listen for Audio Answer". Hold the device close to the guest's speaker.
4. Once connection is established, type or paste text into the text area and click "Send to Peer".

### Guest (receiver)
1. Click "Be Guest (Scan QR)".
2. Scan the host's QR code with your camera.
3. After scanning, click "Play Audio Answer". Hold the device close to the host's microphone.
4. Wait for connection. Received text will appear in the "Received Text" box. You can copy it to clipboard.

## Limitations

- Audio handshake uses ultrasonic frequencies (profile `ultrasonic-experimental`) which may not work on all devices.
- Quiet.js library may have limited bandwidth; large SDP payloads may cause transmission errors.
- WebRTC ICE candidates are not exchanged; connection may fail across complex NATs. Works best on same local network.
- Requires HTTPS for clipboard API (works on localhost).

## Future Improvements

- Use QR codes for both directions to avoid audio bandwidth issues.
- Implement proper ICE candidate exchange via audio or data channel after initial connection.
- Add automatic clipboard synchronization.
- Improve UI/UX with connection status indicators.

## Credits

- Quiet.js: https://github.com/quiet/quiet-js
- QRCode.js: https://github.com/davidshimjs/qrcodejs
- html5-qrcode: https://github.com/mebjas/html5-qrcode
- WebRTC adapter: https://github.com/webrtc/adapter

## License

MIT