/**
 * Roboflow Image Recognition Test App - FIXED VERSION
 * 
 * Diese App öffnet die Kamera, nimmt alle 1-2 Sekunden ein Frame,
 * sendet es an den Roboflow API Endpoint und zeigt die Erkennungsergebnisse.
 */

// === Konfiguration ===
const ROBOFLOW_API_KEY = 'l2LvnfFF1hhRi5dFwcJY';
const ROBOFLOW_MODEL_ID = 'artrecognition-test-u48k2';
const ROBOFLOW_VERSION = '1';
const ROBOFLOW_URL = `https://serverless.roboflow.com/${ROBOFLOW_MODEL_ID}/${ROBOFLOW_VERSION}?api_key=${ROBOFLOW_API_KEY}`;

const FRAME_INTERVAL = 1500;
const JPEG_QUALITY = 0.8;
const CONFIDENCE_THRESHOLD = 0.3;

// === DOM Elemente ===
const videoEl = document.getElementById('camera');
const canvasEl = document.getElementById('canvas');
const resultEl = document.getElementById('result');
const startBtn = document.getElementById('startBtn');

// === State ===
let stream = null;
let frameIntervalId = null;
let isRunning = false;

async function startCamera() {
  try {
    startBtn.disabled = true;
    startBtn.textContent = 'Kamera wird geöffnet...';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        'getUserMedia nicht unterstützt. ' +
        'Stelle sicher, dass: ' +
        '1) Die Seite über HTTPS lädt (nicht HTTP). ' +
        '2) Dein Browser die Kamera unterstützt (Chrome, Firefox, Safari 11+). ' +
        '3) Du Kamera-Zugriff erlaubt hast.'
      );
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    });

    videoEl.srcObject = stream;

    await new Promise(resolve => {
      videoEl.onloadedmetadata = () => {
        videoEl.play();
        resolve();
      };
    });

    canvasEl.width = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;

    isRunning = true;
    startBtn.textContent = 'Kamera läuft...';
    startBtn.disabled = true;

    captureAndSend();
  } catch (error) {
    console.error('Fehler beim Öffnen der Kamera:', error);
    resultEl.innerHTML = `<div class="result-empty">❌ Kamera-Fehler:<br><small>${error.message}</small></div>`;
    startBtn.disabled = false;
    startBtn.textContent = 'Kamera starten';
  }
}

async function captureAndSend() {
  if (!isRunning) return;

  try {
    const ctx = canvasEl.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);

    canvasEl.toBlob(
      async (blob) => {
        try {
          if (!blob || blob.size === 0) {
            console.warn('Blob ist leer oder undefined!', blob);
            resultEl.innerHTML = '<div class="result-empty">⚠️ Canvas-Fehler: Kein Bild</div>';
            if (isRunning) {
              frameIntervalId = setTimeout(captureAndSend, FRAME_INTERVAL);
            }
            return;
          }

          console.log('Blob-Größe:', blob.size, 'bytes');
          console.log('Sende zu:', ROBOFLOW_URL);

          const formData = new FormData();
          formData.append('file', blob);

          const response = await fetch(ROBOFLOW_URL, {
            method: 'POST',
            body: formData
          });

          console.log('Response Status:', response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Server Fehler:', errorText);
            throw new Error(`HTTP Error: ${response.status}`);
          }

          const data = await response.json();
          displayResult(data);
        } catch (error) {
          console.error('Fehler bei API-Anfrage:', error);
          resultEl.innerHTML = `<div class="result-empty">⚠️ API-Fehler: ${error.message}</div>`;
        }

        if (isRunning) {
          frameIntervalId = setTimeout(captureAndSend, FRAME_INTERVAL);
        }
      },
      'image/jpeg',
      JPEG_QUALITY
    );
  } catch (error) {
    console.error('Fehler beim Frame-Capture:', error);
    if (isRunning) {
      frameIntervalId = setTimeout(captureAndSend, FRAME_INTERVAL);
    }
  }
}

function displayResult(data) {
  if (!data || !data.predictions || data.predictions.length === 0) {
    resultEl.innerHTML = '<div class="result-empty">Keine Erkennung...</div>';
    return;
  }

  const prediction = data.predictions[0];
  const { class: className, confidence } = prediction;
  const confidencePercent = (confidence * 100).toFixed(1);

  if (confidence >= CONFIDENCE_THRESHOLD) {
    resultEl.innerHTML = `
      <div class="result-class">🎨 ${className}</div>
      <div class="result-confidence">Sicherheit: ${confidencePercent}%</div>
      <div class="result-status">✓ Erkannt</div>
    `;
  } else {
    resultEl.innerHTML = `<div class="result-empty">Zu unsicher (${confidencePercent}%)</div>`;
  }
}

function stopCamera() {
  isRunning = false;
  if (frameIntervalId) {
    clearTimeout(frameIntervalId);
  }
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  resultEl.innerHTML = '<div class="result-empty">Gestoppt</div>';
  startBtn.disabled = false;
  startBtn.textContent = 'Kamera starten';
}

startBtn.addEventListener('click', () => {
  if (isRunning) {
    stopCamera();
  } else {
    startCamera();
  }
});

window.addEventListener('beforeunload', () => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
});
